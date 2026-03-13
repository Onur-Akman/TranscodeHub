package com.transcoder.repository;

import com.transcoder.model.CmsSubtitle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CmsSubtitleRepository extends JpaRepository<CmsSubtitle, Long> {
    List<CmsSubtitle> findByMovieImdbId(String movieImdbId);
}
