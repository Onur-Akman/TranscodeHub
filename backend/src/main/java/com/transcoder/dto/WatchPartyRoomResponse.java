package com.transcoder.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WatchPartyRoomResponse {
    private String id;
    private String movieImdbId;
    private String movieTitle;
    private String moviePoster;
    private Long transcodeJobId;
    private String outputFileName;
    private String outputFormat;
    private String hostUsername;
    private boolean active;
    private LocalDateTime createdAt;
}
