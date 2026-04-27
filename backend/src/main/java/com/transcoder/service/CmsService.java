package com.transcoder.service;

import com.transcoder.dto.CmsFileResponse;
import com.transcoder.model.CmsDub;
import com.transcoder.model.CmsMovie;
import com.transcoder.model.CmsSubtitle;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface CmsService {

    List<String> listSubtitleFiles();

    List<String> listDubFiles();

    List<CmsMovie> getAllMovies();

    CmsMovie getMovie(String imdbId);

    CmsMovie saveMovie(CmsMovie incoming);

    CmsMovie uploadPoster(String imdbId, MultipartFile file) throws IOException;

    void deleteMovie(String imdbId);

    CmsFileResponse getPosterFile(String filename);

    List<CmsSubtitle> getSubtitles(String imdbId);

    CmsSubtitle uploadSubtitle(String imdbId, MultipartFile file, String language) throws IOException;

    void deleteSubtitle(Long id);

    CmsFileResponse getSubtitleFile(String filename);

    List<CmsDub> getDubs(String imdbId);

    CmsDub uploadDub(String imdbId, MultipartFile file, String language) throws IOException;

    void deleteDub(Long id);

    CmsFileResponse getDubFile(String filename);
}
