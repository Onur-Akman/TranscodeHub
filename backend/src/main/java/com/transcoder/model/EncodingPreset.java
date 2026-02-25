package com.transcoder.model;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

@Entity
@Table(name = "encoding_presets")
@Schema(description = "Video encoding preset configuration")
public class EncodingPreset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Schema(description = "Preset ID (auto-generated)", accessMode = Schema.AccessMode.READ_ONLY)
    private Long id;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Preset name", example = "1080p High Quality")
    private String name;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Video codec", example = "libx264")
    private String videoCodec;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Audio codec", example = "aac")
    private String audioCodec;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Video resolution (WxH)", example = "1920x1080")
    private String resolution;

    @NotNull
    @Min(0) @Max(51)
    @Column(nullable = false)
    @Schema(description = "Constant Rate Factor (0-51, lower = better quality)", example = "23")
    private Integer crf;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Maximum bitrate", example = "4000k")
    private String maxRate;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Buffer size", example = "8000k")
    private String bufSize;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Audio bitrate", example = "128k")
    private String audioBitrate;

    @NotBlank
    @Column(nullable = false)
    @Schema(description = "Encoding speed preset", example = "medium")
    private String preset;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getVideoCodec() { return videoCodec; }
    public void setVideoCodec(String videoCodec) { this.videoCodec = videoCodec; }

    public String getAudioCodec() { return audioCodec; }
    public void setAudioCodec(String audioCodec) { this.audioCodec = audioCodec; }

    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }

    public Integer getCrf() { return crf; }
    public void setCrf(Integer crf) { this.crf = crf; }

    public String getMaxRate() { return maxRate; }
    public void setMaxRate(String maxRate) { this.maxRate = maxRate; }

    public String getBufSize() { return bufSize; }
    public void setBufSize(String bufSize) { this.bufSize = bufSize; }

    public String getAudioBitrate() { return audioBitrate; }
    public void setAudioBitrate(String audioBitrate) { this.audioBitrate = audioBitrate; }

    public String getPreset() { return preset; }
    public void setPreset(String preset) { this.preset = preset; }
}
