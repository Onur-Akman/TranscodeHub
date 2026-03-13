package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Schema(description = "Transcode request")
@Getter
@Setter
@NoArgsConstructor
public class TranscodeRequest {

    @Schema(description = "Name of the input video file (required if inputUrl is empty)", example = "sample_video.mp4")
    private String inputFileName;

    @Schema(description = "URL of the input stream (required if inputFileName is empty)", example = "rtmp://localhost/live/stream")
    private String inputUrl;

    @NotNull
    @Schema(description = "List of encoding preset IDs to use", example = "[1, 2]")
    private List<Long> presetIds;

    @Schema(description = "Output format (MP4, HLS, DASH)", example = "HLS")
    private String outputFormat = "HLS";
}
