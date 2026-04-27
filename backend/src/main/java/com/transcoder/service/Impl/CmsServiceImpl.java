package com.transcoder.service.Impl;

import com.transcoder.dto.CmsFileResponse;
import com.transcoder.exception.ResourceNotFoundException;
import com.transcoder.model.CmsDub;
import com.transcoder.model.CmsMovie;
import com.transcoder.model.CmsSubtitle;
import com.transcoder.repository.CmsDubRepository;
import com.transcoder.repository.CmsMovieRepository;
import com.transcoder.repository.CmsSubtitleRepository;
import com.transcoder.service.CmsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class CmsServiceImpl implements CmsService {

    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    private final CmsMovieRepository movieRepository;
    private final CmsSubtitleRepository subtitleRepository;
    private final CmsDubRepository dubRepository;
    private final Path posterDir;
    private final Path subtitleDir;
    private final Path dubDir;

    public CmsServiceImpl(
            CmsMovieRepository movieRepository,
            CmsSubtitleRepository subtitleRepository,
            CmsDubRepository dubRepository,
            @Value("${app.cms.poster-dir:/app/posters}") String posterDirPath,
            @Value("${app.cms.subtitle-dir:/app/videos/input/subtitles}") String subtitleDirPath,
            @Value("${app.cms.dub-dir:/app/videos/input/dub}") String dubDirPath) {
        this.movieRepository = movieRepository;
        this.subtitleRepository = subtitleRepository;
        this.dubRepository = dubRepository;
        this.posterDir = createDirectory(posterDirPath, "poster");
        this.subtitleDir = createDirectory(subtitleDirPath, "subtitle");
        this.dubDir = createDirectory(dubDirPath, "dub");
    }

    @Override
    public List<String> listSubtitleFiles() {
        return listDirectory(subtitleDir);
    }

    @Override
    public List<String> listDubFiles() {
        return listDirectory(dubDir);
    }

    @Override
    public List<CmsMovie> getAllMovies() {
        return movieRepository.findAll();
    }

    @Override
    public CmsMovie getMovie(String imdbId) {
        return findMovie(imdbId);
    }

    @Override
    public CmsMovie saveMovie(CmsMovie incoming) {
        CmsMovie movie = movieRepository.findByImdbId(incoming.getImdbId())
                .orElse(new CmsMovie());

        applyMovieFields(movie, incoming);
        return movieRepository.save(movie);
    }

    @Override
    public CmsMovie uploadPoster(String imdbId, MultipartFile file) throws IOException {
        CmsMovie movie = findMovie(imdbId);
        String fileName = generateFileName(imdbId, file.getOriginalFilename());

        saveMultipartFile(file, posterDir, fileName);

        movie.setPoster("/api/cms/posters/" + fileName);
        return movieRepository.save(movie);
    }

    @Override
    public void deleteMovie(String imdbId) {
        movieRepository.delete(findMovie(imdbId));
    }

    @Override
    public CmsFileResponse getPosterFile(String filename) {
        return getFile(posterDir, filename);
    }

    @Override
    public List<CmsSubtitle> getSubtitles(String imdbId) {
        return subtitleRepository.findByMovieImdbId(imdbId);
    }

    @Override
    public CmsSubtitle uploadSubtitle(String imdbId, MultipartFile file, String language) throws IOException {
        String fileName = generateFileName(imdbId + "_" + language, file.getOriginalFilename());
        saveMultipartFile(file, subtitleDir, fileName);

        CmsSubtitle subtitle = new CmsSubtitle();
        subtitle.setMovieImdbId(imdbId);
        subtitle.setLanguage(language);
        subtitle.setFileName(fileName);
        return subtitleRepository.save(subtitle);
    }

    @Override
    public void deleteSubtitle(Long id) {
        CmsSubtitle subtitle = subtitleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subtitle not found"));

        deleteFileIfExists(subtitleDir.resolve(subtitle.getFileName()));
        subtitleRepository.delete(subtitle);
    }

    @Override
    public CmsFileResponse getSubtitleFile(String filename) {
        return getFile(subtitleDir, filename);
    }

    @Override
    public List<CmsDub> getDubs(String imdbId) {
        return dubRepository.findByMovieImdbId(imdbId);
    }

    @Override
    public CmsDub uploadDub(String imdbId, MultipartFile file, String language) throws IOException {
        String fileName = generateFileName(imdbId + "_" + language, file.getOriginalFilename());
        saveMultipartFile(file, dubDir, fileName);

        CmsDub dub = new CmsDub();
        dub.setMovieImdbId(imdbId);
        dub.setLanguage(language);
        dub.setFileName(fileName);
        return dubRepository.save(dub);
    }

    @Override
    public void deleteDub(Long id) {
        CmsDub dub = dubRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Dub not found"));

        deleteFileIfExists(dubDir.resolve(dub.getFileName()));
        dubRepository.delete(dub);
    }

    @Override
    public CmsFileResponse getDubFile(String filename) {
        return getFile(dubDir, filename);
    }

    private Path createDirectory(String path, String label) {
        try {
            Path directory = Paths.get(path).normalize();
            Files.createDirectories(directory);
            return directory;
        } catch (IOException e) {
            throw new IllegalStateException("Could not create CMS " + label + " directory", e);
        }
    }

    private List<String> listDirectory(Path directory) {
        try (var stream = Files.list(directory)) {
            return stream.filter(Files::isRegularFile)
                    .map(path -> path.getFileName().toString())
                    .sorted()
                    .toList();
        } catch (IOException e) {
            log.warn("Could not list CMS directory: {}", directory, e);
            return List.of();
        }
    }

    private CmsMovie findMovie(String imdbId) {
        return movieRepository.findByImdbId(imdbId)
                .orElseThrow(() -> new ResourceNotFoundException("Movie not found: " + imdbId));
    }

    private void applyMovieFields(CmsMovie movie, CmsMovie incoming) {
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
    }

    private void saveMultipartFile(MultipartFile file, Path directory, String fileName) throws IOException {
        Files.copy(file.getInputStream(), resolveSafePath(directory, fileName), StandardCopyOption.REPLACE_EXISTING);
    }

    private void deleteFileIfExists(Path file) {
        try {
            Files.deleteIfExists(file.normalize());
        } catch (IOException e) {
            log.warn("Could not delete CMS file: {}", file, e);
        }
    }

    private String generateFileName(String prefix, String originalName) {
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }
        return prefix + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;
    }

    private CmsFileResponse getFile(Path directory, String filename) {
        Path file = resolveSafePath(directory, filename);

        try {
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("File not found: " + filename);
            }
            return new CmsFileResponse(resource, detectMediaType(file));
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Invalid file path: " + filename, e);
        }
    }

    private Path resolveSafePath(Path directory, String filename) {
        Path baseDirectory = directory.toAbsolutePath().normalize();
        Path resolvedFile = baseDirectory.resolve(filename).normalize();

        if (!resolvedFile.startsWith(baseDirectory)) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }
        return resolvedFile;
    }

    private MediaType detectMediaType(Path file) {
        try {
            String contentType = Files.probeContentType(file);
            if (contentType == null) {
                contentType = DEFAULT_CONTENT_TYPE;
            }
            return MediaType.parseMediaType(contentType);
        } catch (IOException e) {
            throw new IllegalStateException("Could not determine content type for file: " + file.getFileName(), e);
        }
    }
}
