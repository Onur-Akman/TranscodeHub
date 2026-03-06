package com.transcoder.service;

import com.transcoder.model.LiveStreamSegment;
import com.transcoder.model.LiveStreamSettings;
import com.transcoder.model.TranscodeJob;

import java.util.List;

public interface LiveRecordingService {


    void startRecording(TranscodeJob job);


    void stopRecording(Long jobId);


    void restartRecording(Long jobId);

    LiveStreamSettings getSettings(Long jobId);


    LiveStreamSettings updateSettings(Long jobId, Integer chunkDurationMinutes, Integer retentionPeriodHours);


    List<LiveStreamSegment> getSegments(Long jobId);
}
