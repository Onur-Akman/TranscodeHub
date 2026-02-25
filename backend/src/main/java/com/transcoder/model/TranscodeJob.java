package com.transcoder.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transcode_jobs")
public class TranscodeJob {

    public enum Status {
        QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String inputFileName;

    @Column(nullable = true)
    private String inputUrl;

    @Column(nullable = false)
    private String outputFileName;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "transcode_job_presets", joinColumns = @JoinColumn(name = "job_id"))
    @Column(name = "preset_id")
    private java.util.List<Long> presetIds = new java.util.ArrayList<>();

    // Keep this for backward UI compatibility or store combined names
    @Column(nullable = true)
    private String presetNames;

    @Column(nullable = false)
    private String outputFormat = "HLS"; // MP4, HLS, DASH

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.QUEUED;

    @Column(nullable = false)
    private Integer progress = 0;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime completedAt;

    private String errorMessage;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getInputFileName() { return inputFileName; }
    public void setInputFileName(String inputFileName) { this.inputFileName = inputFileName; }

    public String getInputUrl() { return inputUrl; }
    public void setInputUrl(String inputUrl) { this.inputUrl = inputUrl; }

    public String getOutputFileName() { return outputFileName; }
    public void setOutputFileName(String outputFileName) { this.outputFileName = outputFileName; }

    public java.util.List<Long> getPresetIds() { return presetIds; }
    public void setPresetIds(java.util.List<Long> presetIds) { this.presetIds = presetIds; }

    public String getPresetNames() { return presetNames; }
    public void setPresetNames(String presetNames) { this.presetNames = presetNames; }

    public String getOutputFormat() { return outputFormat; }
    public void setOutputFormat(String outputFormat) { this.outputFormat = outputFormat; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
