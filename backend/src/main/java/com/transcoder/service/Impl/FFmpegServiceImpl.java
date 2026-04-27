package com.transcoder.service.Impl;

import com.github.kokorin.jaffree.ffmpeg.*;
import com.github.kokorin.jaffree.ffprobe.FFprobe;
import com.github.kokorin.jaffree.ffprobe.FFprobeResult;
import com.transcoder.model.EncodingPreset;
import com.transcoder.model.TranscodeJob;
import com.transcoder.repository.JobRepository;
import com.transcoder.service.FFmpegService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class FFmpegServiceImpl implements FFmpegService {

    private static final String LIVE_STREAM_INPUT = "LIVE_STREAM";

    private final JobRepository jobRepository;
    private final Map<Long, FFmpegResultFuture> activeJobs = new ConcurrentHashMap<>();

    @Value("${app.videos.input-dir}")
    private String inputDir;

    @Value("${app.videos.output-dir}")
    private String outputDir;

    @Override
    public double getVideoDuration(String inputPath) {
        try {
            FFprobeResult result = FFprobe.atPath()
                    .setShowFormat(true)
                    .setInput(inputPath)
                    .execute();

            Float duration = result.getFormat().getDuration();
            return duration != null ? duration.doubleValue() : 0;
        } catch (Exception e) {
            log.warn("Failed to get video duration for input {}", inputPath, e);
            return 0;
        }
    }

    @Async
    @Override
    public void runTranscode(TranscodeJob job, List<EncodingPreset> presets) {
        String inputPath = (job.getInputUrl() != null && !job.getInputUrl().isEmpty()) 
                           ? job.getInputUrl() 
                           : inputDir + "/" + job.getInputFileName();
                           
        String outputPath = outputDir + "/" + job.getOutputFileName();
        boolean isLive = LIVE_STREAM_INPUT.equals(job.getInputFileName());
        
        File outDirFile = new File(outputPath).getParentFile();
        if (outDirFile != null && !outDirFile.exists() && !outDirFile.mkdirs()) {
            log.warn("Could not create output directory {}", outDirFile.getAbsolutePath());
        }

        double totalDuration = isLive ? 0 : getVideoDuration(inputPath);
        
       
        job.setStatus(TranscodeJob.Status.IN_PROGRESS);
        jobRepository.save(job);

        try {
            if ("MP4".equalsIgnoreCase(job.getOutputFormat())) {
                processSingleMp4(job, presets.get(0), inputPath, outputPath, totalDuration);
            } else if (isLive) {
                processLiveFfmpegMulti(job, presets, inputPath, outputPath, totalDuration);
            } else {
                processVodShaka(job, presets, inputPath, outputPath, totalDuration);
            }

            job.setStatus(TranscodeJob.Status.COMPLETED);
            job.setProgress(100);

        } catch (java.util.concurrent.CancellationException e) {
            job.setStatus(TranscodeJob.Status.CANCELLED);
            job.setErrorMessage("Job was cancelled by the user");
        } catch (Exception e) {
            job.setStatus(TranscodeJob.Status.FAILED);
            job.setErrorMessage(e.getMessage());
            log.error("Transcode job {} failed", job.getId(), e);
        }

        job.setCompletedAt(LocalDateTime.now());
        jobRepository.save(job);
        activeJobs.remove(job.getId());
    }

    private FFmpeg createBaseFFmpeg(TranscodeJob job, double totalDuration, String inputPath) {
        FFmpeg ffmpeg = FFmpeg.atPath()
                .addInput(UrlInput.fromUrl(inputPath))
                .setOverwriteOutput(true);

        ffmpeg.setProgressListener(new com.github.kokorin.jaffree.ffmpeg.ProgressListener() {
            private TranscodeJob.Status lastSavedStatus = job.getStatus();
            private int lastSavedProgress = job.getProgress();
            private long lastEventTime = 0;

            @Override
            public void onProgress(FFmpegProgress progress) {
                boolean shouldSave = false;

                if (job.getStatus() == TranscodeJob.Status.QUEUED) {
                    job.setStatus(TranscodeJob.Status.IN_PROGRESS);
                    shouldSave = true;
                }

                if (totalDuration > 0) {
                    Long timeMillis = progress.getTimeMillis();
                    if (timeMillis != null) {
                        double timeSeconds = timeMillis / 1000.0;
                        int pct = (int) Math.min(100, (timeSeconds / totalDuration) * 100);
                        if (pct != job.getProgress()) {
                            job.setProgress(pct);
                            shouldSave = true;
                        }
                    }
                } else {
                    if (job.getProgress() != 1) {
                        job.setProgress(1);
                        shouldSave = true;
                    }
                }

                // Rate limit saves to at most once per second for safety
                long now = System.currentTimeMillis();
                if (shouldSave || (now - lastEventTime > 1000 && (job.getStatus() != lastSavedStatus || job.getProgress() != lastSavedProgress))) {
                    jobRepository.save(job);
                    lastSavedStatus = job.getStatus();
                    lastSavedProgress = job.getProgress();
                    lastEventTime = now;
                }
            }
        });
        return ffmpeg;
    }

    private void applyResolutionScale(FFmpeg ffmpeg, EncodingPreset preset, String streamIndex) {
        boolean useOrg = "original".equalsIgnoreCase(preset.getResolution()) 
                         || preset.getResolution() == null 
                         || preset.getResolution().isEmpty();

        if (!useOrg && preset.getResolution().contains("x")) {
            String[] parts = preset.getResolution().split("x");
            String filter = "scale=" + parts[0] + ":" + parts[1];
            if (streamIndex != null) {
                ffmpeg.addArguments("-filter:v:" + streamIndex, filter);
            } else {
                ffmpeg.addArguments("-vf", filter);
            }
        }
    }

    private void processSingleMp4(TranscodeJob job, EncodingPreset preset, String inputPath, String outputPath, double totalDuration) throws Exception {
        FFmpeg ffmpeg = createBaseFFmpeg(job, totalDuration, inputPath)
                .addArguments("-c:v", preset.getVideoCodec())
                .addArguments("-crf", String.valueOf(preset.getCrf()))
                .addArguments("-maxrate", preset.getMaxRate())
                .addArguments("-bufsize", preset.getBufSize())
                .addArguments("-c:a", preset.getAudioCodec())
                .addArguments("-b:a", preset.getAudioBitrate())
                .addArguments("-movflags", "+faststart");

        applyResolutionScale(ffmpeg, preset, null);

        if (preset.getVideoCodec().contains("x264") || preset.getVideoCodec().contains("x265")) {
            ffmpeg.addArguments("-preset", preset.getPreset());
        }

        ffmpeg.addOutput(UrlOutput.toPath(Paths.get(outputPath)));
        
        FFmpegResultFuture future = ffmpeg.executeAsync();
        activeJobs.put(job.getId(), future);
        future.get();
    }

    private void processLiveFfmpegMulti(TranscodeJob job, List<EncodingPreset> presets, String inputPath, String outputPath, double totalDuration) throws Exception {
        FFmpeg ffmpeg = createBaseFFmpeg(job, totalDuration, inputPath);
        File outDirFile = new File(outputPath).getParentFile();
        StringBuilder mapString = new StringBuilder();
        
        for (int i = 0; i < presets.size(); i++) {
            EncodingPreset p = presets.get(i);
            
            ffmpeg.addArguments("-map", "0:v");
            ffmpeg.addArguments("-map", "0:a");
            
            ffmpeg.addArguments("-c:v:" + i, p.getVideoCodec());
            ffmpeg.addArguments("-b:v:" + i, p.getMaxRate());
            ffmpeg.addArguments("-maxrate:v:" + i, p.getMaxRate());
            ffmpeg.addArguments("-bufsize:v:" + i, p.getBufSize());
            applyResolutionScale(ffmpeg, p, String.valueOf(i));

            ffmpeg.addArguments("-c:a:" + i, p.getAudioCodec());
            ffmpeg.addArguments("-b:a:" + i, p.getAudioBitrate());
            
            if (p.getVideoCodec().contains("x264") || p.getVideoCodec().contains("x265")) {
                ffmpeg.addArguments("-preset", p.getPreset());
            }

            mapString.append("v:").append(i).append(",a:").append(i).append(" ");
        }

        ffmpeg.addArguments("-f", "hls");
        ffmpeg.addArguments("-hls_time", "4");
        ffmpeg.addArguments("-hls_list_size", "30");
        ffmpeg.addArguments("-hls_flags", "delete_segments");
        ffmpeg.addArguments("-force_key_frames", "expr:gte(t,n_forced*4)");
        
        if ("DASH".equalsIgnoreCase(job.getOutputFormat())) {
            // For DASH Live stream 
            ffmpeg.addArguments("-f", "dash");
            ffmpeg.addArguments("-window_size", "30");
            ffmpeg.addArguments("-extra_window_size", "10");
            ffmpeg.addArguments("-use_timeline", "1");
            ffmpeg.addArguments("-use_template", "1");
        }

        ffmpeg.addArguments("-var_stream_map", mapString.toString().trim());
        
        if ("HLS".equalsIgnoreCase(job.getOutputFormat())) {
            ffmpeg.addArguments("-master_pl_name", new File(outputPath).getName());
            String outputPattern = outDirFile.getAbsolutePath() + "/stream_%v.m3u8";
            ffmpeg.addOutput(UrlOutput.toPath(Paths.get(outputPattern)));
        } else {
            ffmpeg.addOutput(UrlOutput.toPath(Paths.get(outputPath)));
        }
        
        FFmpegResultFuture future = ffmpeg.executeAsync();
        activeJobs.put(job.getId(), future);
        future.get();
    }

    private void processVodShaka(TranscodeJob job, List<EncodingPreset> presets, String inputPath, String outputPath, double totalDuration) throws Exception {
        File outDirFile = new File(outputPath).getParentFile();
        FFmpeg ffmpeg = createBaseFFmpeg(job, totalDuration, inputPath);
        
        List<String> packagerArgs = new ArrayList<>();
        packagerArgs.add("packager");

        for (int i = 0; i < presets.size(); i++) {
            EncodingPreset p = presets.get(i);
            String vOut = outDirFile.getAbsolutePath() + "/int_v" + i + ".mp4";
            
            UrlOutput vOutput = UrlOutput.toPath(Paths.get(vOut))
                .addArguments("-map", "0:v:0")
                .addArguments("-c:v", p.getVideoCodec())
                .addArguments("-b:v", p.getMaxRate())
                .addArguments("-maxrate", p.getMaxRate())
                .addArguments("-bufsize", p.getBufSize());
            
            boolean useOrg = p.getResolution() == null || p.getResolution().isEmpty() || "original".equalsIgnoreCase(p.getResolution());
            if (!useOrg && p.getResolution().contains("x")) {
                vOutput.addArguments("-vf", "scale=" + p.getResolution().replace("x", ":"));
            }
            if (p.getVideoCodec().contains("x264") || p.getVideoCodec().contains("x265")) {
                vOutput.addArguments("-preset", p.getPreset());
            }
            ffmpeg.addOutput(vOutput);

            packagerArgs.add("in=" + vOut + ",stream=video,out=" + outDirFile.getAbsolutePath() + "/v" + i + ".mp4");
            
            if (i == 0) {
                String aOut = outDirFile.getAbsolutePath() + "/int_a.mp4";
                UrlOutput aOutput = UrlOutput.toPath(Paths.get(aOut))
                    .addArguments("-map", "0:a:0")
                    .addArguments("-c:a", p.getAudioCodec())
                    .addArguments("-b:a", p.getAudioBitrate());
                ffmpeg.addOutput(aOutput);
                packagerArgs.add("in=" + aOut + ",stream=audio,out=" + outDirFile.getAbsolutePath() + "/a.mp4");
            }
        }

        // Run heavy FFmpeg multi-stream encoding
        FFmpegResultFuture future = ffmpeg.executeAsync();
        activeJobs.put(job.getId(), future);
        future.get();

        // 2. Run Shaka Packager
        if ("DASH".equalsIgnoreCase(job.getOutputFormat())) {
            packagerArgs.add("--mpd_output");
            packagerArgs.add(outputPath);
        } else {
            packagerArgs.add("--hls_master_playlist_output");
            packagerArgs.add(outputPath);
        }
        
        Process process = new ProcessBuilder(packagerArgs).inheritIO().start();
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IllegalStateException("Shaka Packager failed with exit code " + exitCode);
        }
        
        // Cleanup intermediate files
        for (int i = 0; i < presets.size(); i++) {
            deleteIntermediateFile(new File(outDirFile.getAbsolutePath() + "/int_v" + i + ".mp4"));
        }
        deleteIntermediateFile(new File(outDirFile.getAbsolutePath() + "/int_a.mp4"));
    }

    @Override
    public void cancelTranscode(TranscodeJob job) {
        if (job == null) return;
        
        FFmpegResultFuture future = activeJobs.get(job.getId());
        if (future != null) {
            future.forceStop(); 
            future.cancel(true);
        }
        
        if (job.getOutputFileName() != null) {
            try {
                String searchString = new File(job.getOutputFileName()).getParent();
                if (searchString == null) searchString = job.getOutputFileName();
                log.info("Killing FFmpeg process matching {}", searchString);
                Runtime.getRuntime().exec(new String[]{"pkill", "-9", "-f", searchString});
            } catch (Exception e) {
                log.warn("Failed to kill FFmpeg process for job {}", job.getId(), e);
            }
        }
    }

    private void deleteIntermediateFile(File file) {
        if (file.exists() && !file.delete()) {
            log.debug("Could not delete intermediate media file {}", file.getAbsolutePath());
        }
    }
}
