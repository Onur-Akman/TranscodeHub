package com.transcoder.repository;

import com.transcoder.model.CmsMovie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CmsMovieRepository extends JpaRepository<CmsMovie, Long> {
    Optional<CmsMovie> findByImdbId(String imdbId);
    boolean existsByImdbId(String imdbId);
}
