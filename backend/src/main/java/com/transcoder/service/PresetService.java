package com.transcoder.service;

import com.transcoder.model.EncodingPreset;

import java.util.List;

public interface PresetService {

    List<EncodingPreset> findAll();

    EncodingPreset findById(Long id);

    EncodingPreset create(EncodingPreset preset);

    EncodingPreset update(Long id, EncodingPreset updated);

    void delete(Long id);
}
