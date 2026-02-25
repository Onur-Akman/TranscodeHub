package com.transcoder.controller;

import com.transcoder.dto.TranscodeRequest;
import com.transcoder.dto.UploadResponse;
import com.transcoder.model.LiveStreamSegment;
import com.transcoder.model.LiveStreamSettings;
import com.transcoder.model.TranscodeJob;
import com.transcoder.service.LiveRecordingService;
import com.transcoder.service.TranscodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@Tag(name = "Transcode", description = "Video Transcoding Operations")
public class TranscodeController {

    private final TranscodeService transcodeService;
    private final LiveRecordingService liveRecordingService;

    public TranscodeController(TranscodeService transcodeService, LiveRecordingService liveRecordingService) {
        this.transcodeService = transcodeService;
        this.liveRecordingService = liveRecordingService;
    }

    @GetMapping("/videos/input")
    @Operation(summary = "List Input Videos", description = "List all video files in the input directory")
    public List<String> listInputVideos() {
        return transcodeService.listInputVideos();
    }

    @PostMapping(value = "/videos/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload Video", description = "Upload a video file to the input directory")
    public UploadResponse uploadVideo(@RequestPart("file") MultipartFile file) throws IOException {
        return transcodeService.uploadVideo(file);
    }

    @PostMapping("/transcode")
    @Operation(summary = "Start Transcode", description = "Start a new transcoding job with the given preset")
    public TranscodeJob startTranscode(@Valid @RequestBody TranscodeRequest request) {
        return transcodeService.startTranscode(request);
    }

    @GetMapping("/jobs")
    @Operation(summary = "List All Jobs", description = "Get all transcoding jobs ordered by creation date")
    public List<TranscodeJob> getAllJobs() {
        return transcodeService.getAllJobs();
    }

    @GetMapping("/jobs/{id}")
    @Operation(summary = "Get Job", description = "Get a specific transcoding job by ID")
    public TranscodeJob getJob(@PathVariable Long id) {
        return transcodeService.getJob(id);
    }

    @GetMapping("/jobs/{id}/progress")
    @Operation(summary = "Stream Progress", description = "Stream transcoding progress via SSE (Server-Sent Events)")
    public SseEmitter streamProgress(@PathVariable Long id) {
        return transcodeService.streamProgress(id);
    }

    @PostMapping("/jobs/{id}/cancel")
    @Operation(summary = "Cancel Job", description = "Cancel a transcoding job that is queued or in progress")
    public void cancelJob(@PathVariable Long id) {
        transcodeService.cancelJob(id);
    }

    // ---- Live Recording Settings & Segments ----

    @GetMapping("/jobs/{id}/recording-settings")
    @Operation(summary = "Get Recording Settings", description = "Get chunk duration and retention settings for a live stream job")
    public LiveStreamSettings getRecordingSettings(@PathVariable Long id) {
        return liveRecordingService.getSettings(id);
    }

    @PutMapping("/jobs/{id}/recording-settings")
    @Operation(summary = "Update Recording Settings", description = "Update chunk duration and/or retention for a live stream job")
    public LiveStreamSettings updateRecordingSettings(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        Integer chunkDuration = body.get("chunkDurationMinutes");
        Integer retention = body.get("retentionPeriodHours");
        return liveRecordingService.updateSettings(id, chunkDuration, retention);
    }

    @GetMapping("/jobs/{id}/segments")
    @Operation(summary = "Get Segments", description = "Get all recorded segments for a live stream job")
    public List<LiveStreamSegment> getSegments(@PathVariable Long id) {
        return liveRecordingService.getSegments(id);
    }
}
