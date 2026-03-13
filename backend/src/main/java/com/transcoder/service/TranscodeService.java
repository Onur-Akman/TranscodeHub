package com.transcoder.service;

import com.transcoder.dto.TranscodeRequest;
import com.transcoder.dto.UploadResponse;
import com.transcoder.model.TranscodeJob;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;

public interface TranscodeService {

    List<String> listInputVideos();

    UploadResponse uploadVideo(MultipartFile file) throws IOException;

    TranscodeJob startTranscode(TranscodeRequest request);

    List<TranscodeJob> getAllJobs();

    TranscodeJob getJob(Long id);

    SseEmitter streamProgress(Long id);

    void cancelJob(Long id);
}
