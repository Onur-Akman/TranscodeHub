package com.transcoder.service;

import com.transcoder.model.EncodingPreset;
import com.transcoder.model.TranscodeJob;

import java.util.List;

public interface FFmpegService {

    double getVideoDuration(String inputPath);

    void runTranscode(TranscodeJob job, List<EncodingPreset> presets);

    void cancelTranscode(TranscodeJob job);
}
