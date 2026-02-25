package com.transcoder.service.Impl;

import com.transcoder.dto.TranscodeRequest;
import com.transcoder.model.EncodingPreset;
import com.transcoder.model.TranscodeJob;
import com.transcoder.repository.JobRepository;
import com.transcoder.repository.PresetRepository;
import com.transcoder.service.FFmpegService;
import com.transcoder.service.TranscodeService;
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
public class TranscodeServiceImpl implements TranscodeService {

    private final JobRepository jobRepository;
    private final PresetRepository presetRepository;
    private final FFmpegService ffmpegService;

    @Value("${app.videos.input-dir}")
    private String inputDir;

    @Value("${app.videos.output-dir}")
    private String outputDir;

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v"
    );

    public TranscodeServiceImpl(JobRepository jobRepository, PresetRepository presetRepository, FFmpegService ffmpegService) {
        this.jobRepository = jobRepository;
        this.presetRepository = presetRepository;
        this.ffmpegService = ffmpegService;
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
    public Map<String, String> uploadVideo(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        Path uploadDir = Paths.get(inputDir);
        Files.createDirectories(uploadDir);
        String fileName = file.getOriginalFilename();
        Path targetPath = uploadDir.resolve(fileName);
        file.transferTo(targetPath.toFile());
        return Map.of("fileName", fileName, "message", "Upload successful");
    }

    @Override
    public TranscodeJob startTranscode(TranscodeRequest request) {
        EncodingPreset preset = presetRepository.findById(request.getPresetId())
                .orElseThrow(() -> new IllegalArgumentException("Preset not found"));

        File inputFile = new File(inputDir, request.getInputFileName());
        if (!inputFile.exists()) {
            throw new IllegalArgumentException("Input file not found: " + request.getInputFileName());
        }

        String baseName = request.getInputFileName().replaceFirst("\\.[^.]+$", "");
        String outputFileName = baseName + "_" + preset.getName() + "." + preset.getFormat();

        TranscodeJob job = new TranscodeJob();
        job.setInputFileName(request.getInputFileName());
        job.setOutputFileName(outputFileName);
        job.setPresetId(preset.getId());
        job.setPresetName(preset.getName());
        job.setStatus(TranscodeJob.Status.QUEUED);
        job.setProgress(0);
        job.setCreatedAt(LocalDateTime.now());
        job = jobRepository.save(job);

        ffmpegService.runTranscode(job, preset);
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

        throw new UnsupportedOperationException("Bu gorevi daha vermediler de kalsın ");
    }
}
