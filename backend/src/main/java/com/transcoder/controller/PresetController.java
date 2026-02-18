package com.transcoder.controller;

import com.transcoder.model.EncodingPreset;
import com.transcoder.service.PresetService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/presets")
public class PresetController {

    private final PresetService presetService;

    public PresetController(PresetService presetService) {
        this.presetService = presetService;
    }

    @GetMapping
    public List<EncodingPreset> getAllPresets() {
        return presetService.findAll();
    }

    @GetMapping("/{id}")
    public EncodingPreset getPreset(@PathVariable Long id) {
        return presetService.findById(id);
    }

    @PostMapping
    public EncodingPreset createPreset(@Valid @RequestBody EncodingPreset preset) {
        return presetService.create(preset);
    }

    @PutMapping("/{id}")
    public EncodingPreset updatePreset(@PathVariable Long id, @Valid @RequestBody EncodingPreset updated) {
        return presetService.update(id, updated);
    }

    @DeleteMapping("/{id}")
    public void deletePreset(@PathVariable Long id) {
        presetService.delete(id);
    }
}
