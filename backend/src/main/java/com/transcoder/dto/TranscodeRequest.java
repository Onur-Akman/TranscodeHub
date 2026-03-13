package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Transcode request")
public class TranscodeRequest {

    @Schema(description = "Name of the input video file (required if inputUrl is empty)", example = "sample_video.mp4")
    private String inputFileName;

    @Schema(description = "URL of the input stream (required if inputFileName is empty)", example = "rtmp://localhost/live/stream")
    private String inputUrl;

    @NotNull
    @Schema(description = "List of encoding preset IDs to use", example = "[1, 2]")
    private java.util.List<Long> presetIds;

    @Schema(description = "Output format (MP4, HLS, DASH)", example = "HLS")
    private String outputFormat = "HLS";

    public String getInputFileName() { return inputFileName; }
    public void setInputFileName(String inputFileName) { this.inputFileName = inputFileName; }

    public String getInputUrl() { return inputUrl; }
    public void setInputUrl(String inputUrl) { this.inputUrl = inputUrl; }

    public java.util.List<Long> getPresetIds() { return presetIds; }
    public void setPresetIds(java.util.List<Long> presetIds) { this.presetIds = presetIds; }

    public String getOutputFormat() { return outputFormat; }
    public void setOutputFormat(String outputFormat) { this.outputFormat = outputFormat; }
}
