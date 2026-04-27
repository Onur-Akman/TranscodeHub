package com.transcoder.controller;

import com.transcoder.model.CmsDub;
import com.transcoder.model.CmsMovie;
import com.transcoder.model.CmsSubtitle;
import com.transcoder.service.CmsService;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/cms")
public class CmsController {

    private final CmsService cmsService;

    public CmsController(CmsService cmsService) {
        this.cmsService = cmsService;
    }

    // ======== Directory Listings ========

    @GetMapping("/subtitle-files")
    public List<String> listSubtitleFiles() {
        return cmsService.listSubtitleFiles();
    }

    @GetMapping("/dub-files")
    public List<String> listDubFiles() {
        return cmsService.listDubFiles();
    }

    // ======== Movies ========

    @GetMapping("/movies")
    public List<CmsMovie> getAllMovies() {
        return cmsService.getAllMovies();
    }

    @GetMapping("/movies/{imdbId}")
    public ResponseEntity<CmsMovie> getMovie(@PathVariable String imdbId) {
        return ResponseEntity.ok(cmsService.getMovie(imdbId));
    }

    @PostMapping("/movies")
    @PreAuthorize("hasRole('ADMIN')")
    public CmsMovie saveMovie(@RequestBody CmsMovie incoming) {
        return cmsService.saveMovie(incoming);
    }

    @PostMapping(value = "/movies/{imdbId}/poster", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public CmsMovie uploadPoster(@PathVariable String imdbId,
            @RequestPart("file") MultipartFile file) throws IOException {
        return cmsService.uploadPoster(imdbId, file);
    }

    @DeleteMapping("/movies/{imdbId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteMovie(@PathVariable String imdbId) {
        cmsService.deleteMovie(imdbId);
    }

    @GetMapping("/posters/{filename:.+}")
    public ResponseEntity<Resource> servePoster(@PathVariable String filename) {
        return cmsService.getPosterFile(filename).toResponseEntity();
    }

    // ======== Subtitles ========

    @GetMapping("/movies/{imdbId}/subtitles")
    public List<CmsSubtitle> getSubtitles(@PathVariable String imdbId) {
        return cmsService.getSubtitles(imdbId);
    }

    @PostMapping(value = "/movies/{imdbId}/subtitles", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public CmsSubtitle uploadSubtitle(@PathVariable String imdbId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("language") String language) throws IOException {
        return cmsService.uploadSubtitle(imdbId, file, language);
    }

    @DeleteMapping("/subtitles/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteSubtitle(@PathVariable Long id) {
        cmsService.deleteSubtitle(id);
    }

    @GetMapping("/subtitles/file/{filename:.+}")
    public ResponseEntity<Resource> serveSubtitle(@PathVariable String filename) {
        return cmsService.getSubtitleFile(filename).toResponseEntity();
    }

    // ======== Dubs ========

    @GetMapping("/movies/{imdbId}/dubs")
    public List<CmsDub> getDubs(@PathVariable String imdbId) {
        return cmsService.getDubs(imdbId);
    }

    @PostMapping(value = "/movies/{imdbId}/dubs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public CmsDub uploadDub(@PathVariable String imdbId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("language") String language) throws IOException {
        return cmsService.uploadDub(imdbId, file, language);
    }

    @DeleteMapping("/dubs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteDub(@PathVariable Long id) {
        cmsService.deleteDub(id);
    }

    @GetMapping("/dubs/file/{filename:.+}")
    public ResponseEntity<Resource> serveDub(@PathVariable String filename) {
        return cmsService.getDubFile(filename).toResponseEntity();
    }
}
