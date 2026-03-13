package com.transcoder.service.Impl;

import com.transcoder.model.EncodingPreset;
import com.transcoder.repository.PresetRepository;
import com.transcoder.service.PresetService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PresetServiceImpl implements PresetService {

    private final PresetRepository presetRepository;

    public PresetServiceImpl(PresetRepository presetRepository) {
        this.presetRepository = presetRepository;
    }

    @Override
    public List<EncodingPreset> findAll() {
        return presetRepository.findAll();
    }

    @Override
    public EncodingPreset findById(Long id) {
        return presetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Preset not found with id: " + id));
    }

    @Override
    public EncodingPreset create(EncodingPreset preset) {
        return presetRepository.save(preset);
    }

    @Override
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
        return presetRepository.save(existing);
    }

    @Override
    public void delete(Long id) {
        EncodingPreset existing = findById(id);
        presetRepository.delete(existing);
    }
}
