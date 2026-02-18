package com.transcoder.repository;

import com.transcoder.model.EncodingPreset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PresetRepository extends JpaRepository<EncodingPreset, Long> {
}
