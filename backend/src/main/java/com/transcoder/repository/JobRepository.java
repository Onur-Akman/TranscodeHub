package com.transcoder.repository;

import com.transcoder.model.TranscodeJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<TranscodeJob, Long> {
    List<TranscodeJob> findAllByOrderByCreatedAtDesc();
}
