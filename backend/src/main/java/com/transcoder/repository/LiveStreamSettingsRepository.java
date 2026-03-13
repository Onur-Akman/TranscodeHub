package com.transcoder.repository;

import com.transcoder.model.LiveStreamSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LiveStreamSettingsRepository extends JpaRepository<LiveStreamSettings, Long> {
    Optional<LiveStreamSettings> findByJobId(Long jobId);
}
