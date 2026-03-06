package com.transcoder.repository;

import com.transcoder.model.CmsDub;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CmsDubRepository extends JpaRepository<CmsDub, Long> {
    List<CmsDub> findByMovieImdbId(String movieImdbId);
}
