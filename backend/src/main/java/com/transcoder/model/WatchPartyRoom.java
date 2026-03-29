package com.transcoder.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "watch_party_rooms")
@Getter
@Setter
@NoArgsConstructor
public class WatchPartyRoom {

    @Id
    private String id;

    @Column(nullable = false)
    private String movieImdbId;

    @Column(nullable = false)
    private Long transcodeJobId;

    private String movieTitle;
    private String moviePoster;

    @Column(nullable = false)
    private String hostUsername;

    private boolean active = true;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
