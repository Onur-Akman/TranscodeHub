package com.transcoder.model;

import jakarta.persistence.*;

@Entity
@Table(name = "live_stream_settings")
public class LiveStreamSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long jobId;

    @Column(nullable = false)
    private Integer chunkDurationMinutes = 30;

    @Column(nullable = false)
    private Integer retentionPeriodHours = 168; // 7 days

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }

    public Integer getChunkDurationMinutes() { return chunkDurationMinutes; }
    public void setChunkDurationMinutes(Integer chunkDurationMinutes) { this.chunkDurationMinutes = chunkDurationMinutes; }

    public Integer getRetentionPeriodHours() { return retentionPeriodHours; }
    public void setRetentionPeriodHours(Integer retentionPeriodHours) { this.retentionPeriodHours = retentionPeriodHours; }
}
