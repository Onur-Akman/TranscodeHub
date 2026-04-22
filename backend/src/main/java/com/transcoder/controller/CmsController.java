package com.transcoder.controller;

import com.transcoder.model.CmsDub;
import com.transcoder.model.CmsMovie;
import com.transcoder.model.CmsSubtitle;
import com.transcoder.repository.CmsDubRepository;
import com.transcoder.repository.CmsMovieRepository;
import com.transcoder.repository.CmsSubtitleRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cms")
public class CmsController {

    private final CmsMovieRepository movieRepository;
    private final CmsSubtitleRepository subtitleRepository;
    private final CmsDubRepository dubRepository;
    private final Path posterDir;
    private final Path subtitleDir;
    private final Path dubDir;

    public CmsController(CmsMovieRepository movieRepository,
            CmsSubtitleRepository subtitleRepository,
            CmsDubRepository dubRepository,
            @Value("${app.cms.poster-dir:/app/posters}") String posterDirPath,
            @Value("${app.cms.subtitle-dir:/app/videos/input/subtitles}") String subtitleDirPath,
            @Value("${app.cms.dub-dir:/app/videos/input/dub}") String dubDirPath) {
        this.movieRepository = movieRepository;
        this.subtitleRepository = subtitleRepository;
        this.dubRepository = dubRepository;
        this.posterDir = Paths.get(posterDirPath);
        this.subtitleDir = Paths.get(subtitleDirPath);
        this.dubDir = Paths.get(dubDirPath);
        try {
            Files.createDirectories(this.posterDir);
            Files.createDirectories(this.subtitleDir);
            Files.createDirectories(this.dubDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create CMS directories", e);
        }
    }

    // ======== Directory Listings ========

    @GetMapping("/subtitle-files")
    public List<String> listSubtitleFiles() {
        return listDirectory(subtitleDir);
    }

    @GetMapping("/dub-files")
    public List<String> listDubFiles() {
        return listDirectory(dubDir);
    }

    private List<String> listDirectory(Path dir) {
        try (var stream = Files.list(dir)) {
            return stream.filter(Files::isRegularFile)
                    .map(p -> p.getFileName().toString())
                    .sorted()
                    .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    // ======== Movies ========

    @GetMapping("/movies")
    public List<CmsMovie> getAllMovies() {
        return movieRepository.findAll();
    }

    @GetMapping("/movies/{imdbId}")
    public ResponseEntity<CmsMovie> getMovie(@PathVariable String imdbId) {
        return movieRepository.findByImdbId(imdbId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/movies")
    @PreAuthorize("hasRole('ADMIN')")
    public CmsMovie saveMovie(@RequestBody CmsMovie incoming) {
        CmsMovie movie = movieRepository.findByImdbId(incoming.getImdbId())
                .orElse(new CmsMovie());

        movie.setImdbId(incoming.getImdbId());
        movie.setTitle(incoming.getTitle());
        movie.setYear(incoming.getYear());
        movie.setRated(incoming.getRated());
        movie.setReleased(incoming.getReleased());
        movie.setRuntime(incoming.getRuntime());
        movie.setGenre(incoming.getGenre());
        movie.setDirector(incoming.getDirector());
        movie.setActors(incoming.getActors());
        movie.setPlot(incoming.getPlot());
        movie.setImdbRating(incoming.getImdbRating());
        movie.setVideoFileName(incoming.getVideoFileName());
        movie.setPresetId(incoming.getPresetId());
        movie.setTranscodeJobId(incoming.getTranscodeJobId());

        if (incoming.getPoster() != null && !incoming.getPoster().isBlank()) {
            movie.setPoster(incoming.getPoster());
        }

        return movieRepository.save(movie);
    }

    @PostMapping(value = "/movies/{imdbId}/poster", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public CmsMovie uploadPoster(@PathVariable String imdbId,
            @RequestPart("file") MultipartFile file) throws IOException {
        CmsMovie movie = movieRepository.findByImdbId(imdbId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found: " + imdbId));

        String fileName = generateFileName(imdbId, file.getOriginalFilename());
        Path target = posterDir.resolve(fileName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        movie.setPoster("/api/cms/posters/" + fileName);
        return movieRepository.save(movie);
    }

    @DeleteMapping("/movies/{imdbId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteMovie(@PathVariable String imdbId) {
        CmsMovie movie = movieRepository.findByImdbId(imdbId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found"));
        movieRepository.delete(movie);
    }

    @GetMapping("/posters/{filename:.+}")
    public ResponseEntity<Resource> servePoster(@PathVariable String filename) {
        return serveFile(posterDir, filename);
    }

    // ======== Subtitles ========

    @GetMapping("/movies/{imdbId}/subtitles")
    public List<CmsSubtitle> getSubtitles(@PathVariable String imdbId) {
        return subtitleRepository.findByMovieImdbId(imdbId);
    }

    @PostMapping(value = "/movies/{imdbId}/subtitles", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public CmsSubtitle uploadSubtitle(@PathVariable String imdbId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("language") String language) throws IOException {
        String fileName = generateFileName(imdbId + "_" + language, file.getOriginalFilename());
        Path target = subtitleDir.resolve(fileName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        CmsSubtitle subtitle = new CmsSubtitle();
        subtitle.setMovieImdbId(imdbId);
        subtitle.setLanguage(language);
        subtitle.setFileName(fileName);
        return subtitleRepository.save(subtitle);
    }

    @DeleteMapping("/subtitles/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteSubtitle(@PathVariable Long id) {
        CmsSubtitle subtitle = subtitleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtitle not found"));
        try {
            Files.deleteIfExists(subtitleDir.resolve(subtitle.getFileName()));
        } catch (IOException ignored) {
        }
        subtitleRepository.delete(subtitle);
    }

    @GetMapping("/subtitles/file/{filename:.+}")
    public ResponseEntity<Resource> serveSubtitle(@PathVariable String filename) {
        return serveFile(subtitleDir, filename);
    }

    // ======== Dubs ========

    @GetMapping("/movies/{imdbId}/dubs")
    public List<CmsDub> getDubs(@PathVariable String imdbId) {
        return dubRepository.findByMovieImdbId(imdbId);
    }

    @PostMapping(value = "/movies/{imdbId}/dubs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public CmsDub uploadDub(@PathVariable String imdbId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("language") String language) throws IOException {
        String fileName = generateFileName(imdbId + "_" + language, file.getOriginalFilename());
        Path target = dubDir.resolve(fileName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        CmsDub dub = new CmsDub();
        dub.setMovieImdbId(imdbId);
        dub.setLanguage(language);
        dub.setFileName(fileName);
        return dubRepository.save(dub);
    }

    @DeleteMapping("/dubs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteDub(@PathVariable Long id) {
        CmsDub dub = dubRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dub not found"));
        try {
            Files.deleteIfExists(dubDir.resolve(dub.getFileName()));
        } catch (IOException ignored) {
        }
        dubRepository.delete(dub);
    }

    @GetMapping("/dubs/file/{filename:.+}")
    public ResponseEntity<Resource> serveDub(@PathVariable String filename) {
        return serveFile(dubDir, filename);
    }

    // ======== Helpers ========

    private String generateFileName(String prefix, String originalName) {
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }
        return prefix + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;
    }

    private ResponseEntity<Resource> serveFile(Path directory, String filename) {
        try {
            Path file = directory.resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = Files.probeContentType(file);
            if (contentType == null)
                contentType = "application/octet-stream";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
