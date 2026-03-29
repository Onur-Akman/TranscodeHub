package com.transcoder.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WatchableMovieResponse {
    private String imdbId;
    private String title;
    private String year;
    private String poster;
    private String genre;
    private String runtime;
    private String imdbRating;
    private String director;
    private String actors;
    private String plot;
    private Long transcodeJobId;
    private String outputFileName;
    private String outputFormat;
    private String presetNames;
}
