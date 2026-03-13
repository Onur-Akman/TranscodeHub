package com.transcoder.model;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "encoding_presets")
@Schema(description = "Video encoding preset configuration")
@Getter
@Setter
@NoArgsConstructor
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
}
