package com.transcoder.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "cms_subtitles")
@Getter
@Setter
@NoArgsConstructor
public class CmsSubtitle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String movieImdbId;

    @Column(nullable = false)
    private String language;

    @Column(nullable = false)
    private String fileName;
}
