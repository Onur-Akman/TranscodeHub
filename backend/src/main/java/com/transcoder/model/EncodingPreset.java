package com.transcoder.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;

@Entity
@Table(name = "encoding_presets")
public class EncodingPreset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false)
    private String name;

    @NotBlank
    @Column(nullable = false)
    private String videoCodec; // libx264, libx265, libvpx-vp9

    @NotBlank
    @Column(nullable = false)
    private String audioCodec; // aac, libopus

    @NotBlank
    @Column(nullable = false)
    private String resolution; // 1920x1080, 1280x720, etc.

    @NotNull
    @Min(0) @Max(51)
    @Column(nullable = false)
    private Integer crf;

    @NotBlank
    @Column(nullable = false)
    private String maxRate; // 4000k, 2500k

    @NotBlank
    @Column(nullable = false)
    private String bufSize; // 8000k, 5000k

    @NotBlank
    @Column(nullable = false)
    private String audioBitrate; // 128k, 192k

    @NotBlank
    @Column(nullable = false)
    private String preset; // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow

    @NotBlank
    @Column(nullable = false)
    private String format; // mp4, mkv, webm

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

    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }
}
