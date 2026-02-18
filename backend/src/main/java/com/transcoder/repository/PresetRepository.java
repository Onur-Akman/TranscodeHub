package com.transcoder.repository;

import com.transcoder.model.EncodingPreset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PresetRepository extends JpaRepository<EncodingPreset, Long> {
}
