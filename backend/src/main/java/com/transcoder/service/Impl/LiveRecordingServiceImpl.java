package com.transcoder.service.Impl;

import com.transcoder.model.LiveStreamSegment;
import com.transcoder.model.LiveStreamSettings;
import com.transcoder.model.TranscodeJob;
import com.transcoder.repository.JobRepository;
import com.transcoder.repository.LiveStreamSegmentRepository;
import com.transcoder.repository.LiveStreamSettingsRepository;
import com.transcoder.service.LiveRecordingService;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class LiveRecordingServiceImpl implements LiveRecordingService {

    private static final int DEFAULT_CHUNK_DURATION_MINUTES = 30;
    private static final int DEFAULT_RETENTION_PERIOD_HOURS = 168;
    private static final int RECORDING_STOP_TIMEOUT_SECONDS = 5;
    private static final long RECORDING_RESTART_DELAY_MS = 1000;
    private static final long SEGMENT_SCAN_RATE_MS = 30000;
    private static final long SEGMENT_STABILIZATION_MS = 5000;
    private static final double MIN_SEGMENT_DURATION_SECONDS = 2.0;

    private final LiveStreamSettingsRepository settingsRepository;
    private final LiveStreamSegmentRepository segmentRepository;
    private final JobRepository jobRepository;
    private final ExecutorService recordingLogExecutor = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "recording-log-consumer");
        thread.setDaemon(true);
        return thread;
    });

    @Value("${app.videos.output-dir}")
    private String outputDir;

    private final Map<Long, Process> activeRecordingProcesses = new ConcurrentHashMap<>();

    private static final Pattern SEGMENT_FILENAME_PATTERN =
            Pattern.compile("rec_(\\d+)_(\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2})\\.mp4");

    private static final DateTimeFormatter SEGMENT_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    @PreDestroy
    public void shutdown() {
        activeRecordingProcesses.keySet().forEach(this::stopRecording);
        recordingLogExecutor.shutdownNow();
    }

    @Override
    public void startRecording(TranscodeJob job) {
        LiveStreamSettings settings = getSettings(job.getId());

        String inputUrl = job.getInputUrl();
        if (inputUrl == null || inputUrl.isEmpty()) {
            log.warn("Cannot start recording: no input URL for job {}", job.getId());
            return;
        }

        String recordDir = outputDir + "/recordings/job_" + job.getId();
        File recordDirectory = new File(recordDir);
        if (!recordDirectory.exists() && !recordDirectory.mkdirs()) {
            log.warn("Could not create recording directory {}", recordDirectory.getAbsolutePath());
        }

        int segmentSeconds = settings.getChunkDurationMinutes() * 60;
        String outputPattern = recordDir + "/rec_" + job.getId() + "_%Y-%m-%d_%H-%M-%S.mp4";

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg",
                    "-i", inputUrl,
                    "-c:v", "copy",
                    "-c:a", "copy",
                    "-f", "segment",
                    "-segment_time", String.valueOf(segmentSeconds),
                    "-segment_format", "mp4",
                    "-reset_timestamps", "1",
                    "-strftime", "1",
                    outputPattern
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            activeRecordingProcesses.put(job.getId(), process);

            recordingLogExecutor.submit(() -> consumeRecordingOutput(job.getId(), process));

            log.info("Started recording for job {} with chunk={}min", job.getId(), settings.getChunkDurationMinutes());

        } catch (Exception e) {
            log.warn("Failed to start recording for job {}", job.getId(), e);
        }
    }

    @Override
    public void stopRecording(Long jobId) {
        Process process = activeRecordingProcesses.remove(jobId);
        if (process != null && process.isAlive()) {
            process.destroy();
            try {

                process.waitFor(RECORDING_STOP_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            if (process.isAlive()) {
                process.destroyForcibly();
            }
            log.info("Stopped recording for job {}", jobId);
        }


        try {
            String pattern = "rec_" + jobId + "_";
            Runtime.getRuntime().exec(new String[]{"pkill", "-f", pattern});
        } catch (Exception e) {
            log.debug("Could not kill remaining recording process for job {}", jobId, e);
        }
    }

    @Override
    public void restartRecording(Long jobId) {
        Optional<TranscodeJob> jobOpt = jobRepository.findById(jobId);
        if (jobOpt.isEmpty()) return;

        TranscodeJob job = jobOpt.get();
        if (job.getStatus() != TranscodeJob.Status.IN_PROGRESS) return;

        stopRecording(jobId);

        if (!sleepBeforeRestart()) {
            return;
        }

        startRecording(job);
    }

    @Override
    public LiveStreamSettings getSettings(Long jobId) {
        return settingsRepository.findByJobId(jobId).orElseGet(() -> {
            LiveStreamSettings s = new LiveStreamSettings();
            s.setJobId(jobId);
            s.setChunkDurationMinutes(DEFAULT_CHUNK_DURATION_MINUTES);
            s.setRetentionPeriodHours(DEFAULT_RETENTION_PERIOD_HOURS);
            return settingsRepository.save(s);
        });
    }

    @Override
    public LiveStreamSettings updateSettings(Long jobId, Integer chunkDurationMinutes, Integer retentionPeriodHours) {
        LiveStreamSettings settings = getSettings(jobId);
        boolean chunkChanged = false;

        if (chunkDurationMinutes != null && !chunkDurationMinutes.equals(settings.getChunkDurationMinutes())) {
            settings.setChunkDurationMinutes(chunkDurationMinutes);
            chunkChanged = true;
        }
        if (retentionPeriodHours != null) {
            settings.setRetentionPeriodHours(retentionPeriodHours);
        }

        settings = settingsRepository.save(settings);


        if (chunkChanged && activeRecordingProcesses.containsKey(jobId)) {
            restartRecording(jobId);
        }

        return settings;
    }

    @Override
    public List<LiveStreamSegment> getSegments(Long jobId) {
        return segmentRepository.findByJobIdOrderByStartTimeAsc(jobId);
    }

    @Scheduled(fixedRate = SEGMENT_SCAN_RATE_MS)
    public void scanAndCleanSegments() {
        File recordingsRoot = new File(outputDir + "/recordings");
        if (!recordingsRoot.exists()) return;

        File[] jobDirs = recordingsRoot.listFiles(File::isDirectory);
        if (jobDirs == null) return;

        for (File jobDir : jobDirs) {
            String dirName = jobDir.getName(); 
            if (!dirName.startsWith("job_")) continue;

            Long jobId;
            try {
                jobId = Long.parseLong(dirName.substring(4));
            } catch (NumberFormatException e) {
                continue;
            }


            File[] segmentFiles = jobDir.listFiles((dir, name) -> name.endsWith(".mp4") && name.startsWith("rec_"));
            if (segmentFiles == null) continue;

            for (File segFile : segmentFiles) {

                if (segmentRepository.existsByFileName(segFile.getName())) continue;

                if (System.currentTimeMillis() - segFile.lastModified() < SEGMENT_STABILIZATION_MS) continue;


                Matcher matcher = SEGMENT_FILENAME_PATTERN.matcher(segFile.getName());
                if (!matcher.matches()) continue;

                try {
                    LocalDateTime startTime = LocalDateTime.parse(matcher.group(2), SEGMENT_DATE_FORMAT);


                    double duration = probeDuration(segFile.getAbsolutePath());

                    if (duration < MIN_SEGMENT_DURATION_SECONDS) continue;

                    LocalDateTime endTime = startTime.plusSeconds((long) duration);

                    LiveStreamSegment segment = new LiveStreamSegment();
                    segment.setJobId(jobId);
                    segment.setFileName(segFile.getName());
                    segment.setStartTime(startTime);
                    segment.setEndTime(endTime);
                    segment.setDurationSeconds(duration);
                    segment.setCreatedAt(LocalDateTime.now());
                    segmentRepository.save(segment);

                    log.info("Discovered segment {} duration={}s", segFile.getName(), String.format("%.1f", duration));
                } catch (Exception e) {
                    log.warn("Error processing segment {}", segFile.getName(), e);
                }
            }


            Optional<LiveStreamSettings> settingsOpt = settingsRepository.findByJobId(jobId);
            if (settingsOpt.isPresent()) {
                int retentionHours = settingsOpt.get().getRetentionPeriodHours();
                LocalDateTime cutoff = LocalDateTime.now().minusHours(retentionHours);

                List<LiveStreamSegment> allSegments = segmentRepository.findByJobIdOrderByStartTimeAsc(jobId);
                for (LiveStreamSegment seg : allSegments) {
                    if (seg.getStartTime().isBefore(cutoff)) {

                        File f = new File(jobDir, seg.getFileName());
                        if (f.exists()) {
                            if (f.delete()) {
                                log.info("Deleted expired segment {}", seg.getFileName());
                            } else {
                                log.debug("Could not delete expired segment file {}", f.getAbsolutePath());
                            }
                        }
                        segmentRepository.delete(seg);
                    }
                }
            }
        }
    }

    private double probeDuration(String filePath) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    filePath
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes()).trim();
            process.waitFor();
            return Double.parseDouble(output);
        } catch (Exception e) {
            log.debug("Could not probe segment duration for {}", filePath, e);
            return 0;
        }
    }

    private void consumeRecordingOutput(Long jobId, Process process) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                log.trace("Recording job {}: {}", jobId, line);
            }
        } catch (IOException e) {
            log.debug("Recording output consumer stopped for job {}", jobId, e);
        }
    }

    private boolean sleepBeforeRestart() {
        try {
            Thread.sleep(RECORDING_RESTART_DELAY_MS);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
