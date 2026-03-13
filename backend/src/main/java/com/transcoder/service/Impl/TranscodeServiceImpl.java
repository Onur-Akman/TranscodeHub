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
import lombok.RequiredArgsConstructor;
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

@Service
@RequiredArgsConstructor
public class TranscodeServiceImpl implements TranscodeService {

    private final JobRepository jobRepository;
    private final PresetRepository presetRepository;
    private final FFmpegService ffmpegService;
    private final LiveRecordingService liveRecordingService;

    @Value("${app.videos.input-dir}")
    private String inputDir;

    @Value("${app.videos.output-dir}")
    private String outputDir;

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v"
    );

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
        Path uploadDir = Paths.get(inputDir);
        Files.createDirectories(uploadDir);
        String fileName = file.getOriginalFilename();
        Path targetPath = uploadDir.resolve(fileName);
        file.transferTo(targetPath.toFile());
        return new UploadResponse("Upload successful", fileName);
    }

    @Override
    public TranscodeJob startTranscode(TranscodeRequest request) {
        if (request.getInputFileName() == null && request.getInputUrl() == null) {
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
        if (request.getInputFileName() != null) {
            File inputFile = new File(inputDir, request.getInputFileName());
            if (!inputFile.exists()) {
                throw new IllegalArgumentException("Input file not found: " + request.getInputFileName());
            }
            baseName = request.getInputFileName().replaceFirst("\\.[^.]+$", "");
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
        if (request.getInputFileName() != null) {
            job.setInputFileName(request.getInputFileName());
        } else {
            job.setInputFileName("LIVE_STREAM"); // Placeholder as column is non-nullable
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
        if ("LIVE_STREAM".equals(job.getInputFileName())) {
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

        throw new UnsupportedOperationException("Streaming progress not supported");
    }

    @Override
    public void cancelJob(Long id) {
        TranscodeJob job = getJob(id);
        if (job.getStatus() == TranscodeJob.Status.QUEUED || job.getStatus() == TranscodeJob.Status.IN_PROGRESS) {
            ffmpegService.cancelTranscode(job);

            if ("LIVE_STREAM".equals(job.getInputFileName())) {
                liveRecordingService.stopRecording(id);
            }

            job.setStatus(TranscodeJob.Status.CANCELLED);
            job.setErrorMessage("Job was cancelled by the user");
            jobRepository.save(job);
        }
    }
}
