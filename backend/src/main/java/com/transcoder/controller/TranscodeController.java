package com.transcoder.controller;

import com.transcoder.dto.TranscodeRequest;
import com.transcoder.model.TranscodeJob;
import com.transcoder.service.TranscodeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TranscodeController {

    private final TranscodeService transcodeService;

    public TranscodeController(TranscodeService transcodeService) {
        this.transcodeService = transcodeService;
    }

    @GetMapping("/videos/input")
    public List<String> listInputVideos() {
        return transcodeService.listInputVideos();
    }

    @PostMapping("/videos/upload")
    public Map<String, String> uploadVideo(@RequestParam("file") MultipartFile file) throws IOException {
        return transcodeService.uploadVideo(file);
    }

    @PostMapping("/transcode")
    public TranscodeJob startTranscode(@Valid @RequestBody TranscodeRequest request) {
        return transcodeService.startTranscode(request);
    }

    @GetMapping("/jobs")
    public List<TranscodeJob> getAllJobs() {
        return transcodeService.getAllJobs();
    }

    @GetMapping("/jobs/{id}")
    public TranscodeJob getJob(@PathVariable Long id) {
        return transcodeService.getJob(id);
    }

    @GetMapping("/jobs/{id}/progress")
    public SseEmitter streamProgress(@PathVariable Long id) {
        return transcodeService.streamProgress(id);
    }
}
