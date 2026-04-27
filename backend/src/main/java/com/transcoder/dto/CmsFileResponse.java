package com.transcoder.dto;

import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

public record CmsFileResponse(Resource resource, MediaType mediaType) {

    public ResponseEntity<Resource> toResponseEntity() {
        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(resource);
    }
}
