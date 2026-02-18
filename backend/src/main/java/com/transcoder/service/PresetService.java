package com.transcoder.service;

import com.transcoder.model.EncodingPreset;
import com.transcoder.repository.PresetRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PresetService {

    private final PresetRepository presetRepository;

    public PresetService(PresetRepository presetRepository) {
        this.presetRepository = presetRepository;
    }

    public List<EncodingPreset> findAll() {
        return presetRepository.findAll();
    }

    public EncodingPreset findById(Long id) {
        return presetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Preset not found with id: " + id));
    }

    public EncodingPreset create(EncodingPreset preset) {
        return presetRepository.save(preset);
    }

    public EncodingPreset update(Long id, EncodingPreset updated) {
        EncodingPreset existing = findById(id);
        existing.setName(updated.getName());
        existing.setVideoCodec(updated.getVideoCodec());
        existing.setAudioCodec(updated.getAudioCodec());
        existing.setResolution(updated.getResolution());
        existing.setCrf(updated.getCrf());
        existing.setMaxRate(updated.getMaxRate());
        existing.setBufSize(updated.getBufSize());
        existing.setAudioBitrate(updated.getAudioBitrate());
        existing.setPreset(updated.getPreset());
        existing.setFormat(updated.getFormat());
        return presetRepository.save(existing);
    }

    public void delete(Long id) {
        EncodingPreset existing = findById(id);
        presetRepository.delete(existing);
    }
}
