package com.transcoder.service.Impl;

import com.transcoder.dto.TranscodeRequest;
import com.transcoder.dto.UploadResponse;
import com.transcoder.model.EncodingPreset;
import com.transcoder.model.TranscodeJob;
import com.transcoder.repository.JobRepository;
import com.transcoder.repository.PresetRepository;
import com.transcoder.service.FFmpegService;
import com.transcoder.service.LiveRecordingService;
import com.transcoder.service.TranscodeService;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TranscodeServiceImpl implements TranscodeService {

    private static final String LIVE_STREAM_INPUT = "LIVE_STREAM";
    private static final long PROGRESS_STREAM_INTERVAL_MS = 1000;

    private final JobRepository jobRepository;
    private final PresetRepository presetRepository;
    private final FFmpegService ffmpegService;
    private final LiveRecordingService liveRecordingService;
    private final ExecutorService progressStreamExecutor = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "job-progress-stream");
        thread.setDaemon(true);
        return thread;
    });

    @Value("${app.videos.input-dir}")
    private String inputDir;

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v"
    );

    @PreDestroy
    public void shutdown() {
        progressStreamExecutor.shutdownNow();
    }

    @Override
    public List<String> listInputVideos() {
        File dir = new File(inputDir);
        if (!dir.exists() || !dir.isDirectory()) {
            return Collections.emptyList();
        }
        String[] files = dir.list((d, name) -> {
            String lower = name.toLowerCase();
            return SUPPORTED_EXTENSIONS.stream().anyMatch(lower::endsWith);
        });
        return files != null ? Arrays.asList(files) : Collections.emptyList();
    }

    @Override
    public UploadResponse uploadVideo(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        String fileName = normalizeFileName(file.getOriginalFilename());
        Path uploadDir = inputRoot();
        Files.createDirectories(uploadDir);
        Path targetPath = resolveInputPath(fileName);
        file.transferTo(targetPath.toFile());
        return new UploadResponse("Upload successful", fileName);
    }

    @Override
    public TranscodeJob startTranscode(TranscodeRequest request) {
        if (isBlank(request.getInputFileName()) && isBlank(request.getInputUrl())) {
            throw new IllegalArgumentException("Either inputFileName or inputUrl must be provided");
        }

        if (request.getPresetIds() == null || request.getPresetIds().isEmpty()) {
            throw new IllegalArgumentException("At least one preset must be selected");
        }

        List<EncodingPreset> presets = presetRepository.findAllById(request.getPresetIds());
        if (presets.isEmpty()) {
            throw new IllegalArgumentException("Presets not found");
        }

        String baseName;
        if (!isBlank(request.getInputFileName())) {
            Path inputFile = resolveInputPath(request.getInputFileName());
            if (!Files.isRegularFile(inputFile)) {
                throw new IllegalArgumentException("Input file not found: " + request.getInputFileName());
            }
            baseName = inputFile.getFileName().toString().replaceFirst("\\.[^.]+$", "");
        } else {
            baseName = "stream_" + System.currentTimeMillis();
        }


        String outputFileName;
        if ("MP4".equalsIgnoreCase(request.getOutputFormat())) {
            outputFileName = baseName + "_" + presets.get(0).getName() + ".mp4";
        } else {
            // For HLS or DASH, output is usually a folder or a master playlist 
            // We can name the main entrypoint: baseName/master.m3u8 or baseName/manifest.mpd
            String ext = "DASH".equalsIgnoreCase(request.getOutputFormat()) ? "manifest.mpd" : "master.m3u8";
            outputFileName = baseName + "_multi/" + ext;
        }

        TranscodeJob job = new TranscodeJob();
        if (!isBlank(request.getInputFileName())) {
            job.setInputFileName(request.getInputFileName());
        } else {
            job.setInputFileName(LIVE_STREAM_INPUT);
            job.setInputUrl(request.getInputUrl());
        }
        
        job.setOutputFileName(outputFileName);
        job.setPresetIds(request.getPresetIds());
        
        // Comma separated names for UI display
        String presetNames = presets.stream().map(EncodingPreset::getName).reduce((a, b) -> a + ", " + b).orElse("");
        job.setPresetNames(presetNames);
        job.setOutputFormat(request.getOutputFormat());
        
        job.setStatus(TranscodeJob.Status.QUEUED);
        job.setProgress(0);
        job.setCreatedAt(LocalDateTime.now());
        job = jobRepository.save(job);

        ffmpegService.runTranscode(job, presets);

        // Start recording for live streams
        if (LIVE_STREAM_INPUT.equals(job.getInputFileName())) {
            liveRecordingService.startRecording(job);
        }

        return job;
    }

    @Override
    public List<TranscodeJob> getAllJobs() {
        return jobRepository.findAllByOrderByCreatedAtDesc();
    }

    @Override
    public TranscodeJob getJob(Long id) {
        return jobRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Job not found with id: " + id));
    }

    @Override
    public SseEmitter streamProgress(Long id) {
        SseEmitter emitter = new SseEmitter(0L);

        progressStreamExecutor.execute(() -> {
            try {
                while (true) {
                    TranscodeJob job = getJob(id);
                    emitter.send(progressPayload(job));

                    if (isTerminal(job.getStatus())) {
                        emitter.complete();
                        return;
                    }

                    Thread.sleep(PROGRESS_STREAM_INTERVAL_MS);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                emitter.complete();
            } catch (Exception e) {
                log.debug("Progress stream failed for job {}", id, e);
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @Override
    public void cancelJob(Long id) {
        TranscodeJob job = getJob(id);
        if (job.getStatus() == TranscodeJob.Status.QUEUED || job.getStatus() == TranscodeJob.Status.IN_PROGRESS) {
            ffmpegService.cancelTranscode(job);

            if (LIVE_STREAM_INPUT.equals(job.getInputFileName())) {
                liveRecordingService.stopRecording(id);
            }

            job.setStatus(TranscodeJob.Status.CANCELLED);
            job.setErrorMessage("Job was cancelled by the user");
            jobRepository.save(job);
        }
    }

    private Path inputRoot() {
        return Paths.get(inputDir).toAbsolutePath().normalize();
    }

    private Path resolveInputPath(String fileName) {
        Path root = inputRoot();
        Path resolved = root.resolve(fileName).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("Invalid input file name: " + fileName);
        }
        return resolved;
    }

    private String normalizeFileName(String originalName) {
        if (isBlank(originalName)) {
            throw new IllegalArgumentException("File name is required");
        }
        return Paths.get(originalName).getFileName().toString();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isTerminal(TranscodeJob.Status status) {
        return status == TranscodeJob.Status.COMPLETED
                || status == TranscodeJob.Status.FAILED
                || status == TranscodeJob.Status.CANCELLED;
    }

    private Map<String, Object> progressPayload(TranscodeJob job) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", job.getId());
        payload.put("progress", job.getProgress());
        payload.put("status", job.getStatus());
        if (job.getErrorMessage() != null) {
            payload.put("errorMessage", job.getErrorMessage());
        }
        return payload;
    }
}
