package com.transcoder.service;

import com.transcoder.model.LiveStreamSegment;
import com.transcoder.model.LiveStreamSettings;
import com.transcoder.model.TranscodeJob;

import java.util.List;

public interface LiveRecordingService {

    /**
     * Start recording a live stream into segmented MP4 files.
     */
    void startRecording(TranscodeJob job);

    /**
     * Stop the recording process for a job.
     */
    void stopRecording(Long jobId);

    /**
     * Restart recording with updated settings (e.g. new chunk duration).
     */
    void restartRecording(Long jobId);

    /**
     * Get or create default settings for a job.
     */
    LiveStreamSettings getSettings(Long jobId);

    /**
     * Update recording settings for a job.
     */
    LiveStreamSettings updateSettings(Long jobId, Integer chunkDurationMinutes, Integer retentionPeriodHours);

    /**
     * Get all recorded segments for a job.
     */
    List<LiveStreamSegment> getSegments(Long jobId);
}
