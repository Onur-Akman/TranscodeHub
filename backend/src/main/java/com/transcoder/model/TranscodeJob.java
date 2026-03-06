package com.transcoder.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "transcode_jobs")
@Getter
@Setter
@NoArgsConstructor
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
    private List<Long> presetIds = new ArrayList<>();


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
}
