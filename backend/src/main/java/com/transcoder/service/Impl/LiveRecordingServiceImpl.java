package com.transcoder.service.Impl;

import com.transcoder.model.LiveStreamSegment;
import com.transcoder.model.LiveStreamSettings;
import com.transcoder.model.TranscodeJob;
import com.transcoder.repository.JobRepository;
import com.transcoder.repository.LiveStreamSegmentRepository;
import com.transcoder.repository.LiveStreamSettingsRepository;
import com.transcoder.service.LiveRecordingService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LiveRecordingServiceImpl implements LiveRecordingService {

    private final LiveStreamSettingsRepository settingsRepository;
    private final LiveStreamSegmentRepository segmentRepository;
    private final JobRepository jobRepository;

    @Value("${app.videos.output-dir}")
    private String outputDir;

    // Active recording processes per job ID
    private final Map<Long, Process> activeRecordingProcesses = new ConcurrentHashMap<>();

    // Pattern to parse segment filenames like: rec_<jobId>_2026-02-24_09-30-00.mp4
    private static final Pattern SEGMENT_FILENAME_PATTERN =
            Pattern.compile("rec_(\\d+)_(\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2})\\.mp4");

    private static final DateTimeFormatter SEGMENT_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    public LiveRecordingServiceImpl(LiveStreamSettingsRepository settingsRepository,
                                     LiveStreamSegmentRepository segmentRepository,
                                     JobRepository jobRepository) {
        this.settingsRepository = settingsRepository;
        this.segmentRepository = segmentRepository;
        this.jobRepository = jobRepository;
    }

    @Override
    public void startRecording(TranscodeJob job) {
        LiveStreamSettings settings = getSettings(job.getId());

        String inputUrl = job.getInputUrl();
        if (inputUrl == null || inputUrl.isEmpty()) {
            System.err.println("Cannot start recording: no input URL for job " + job.getId());
            return;
        }

        String recordDir = outputDir + "/recordings/job_" + job.getId();
        new File(recordDir).mkdirs();

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

            // Log output in background thread
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        // Silently consume FFmpeg output
                    }
                } catch (Exception e) {
                    // Ignore
                }
            }, "rec-logger-" + job.getId()).start();

            System.out.println("Started recording for job " + job.getId() +
                    " with chunk=" + settings.getChunkDurationMinutes() + "min");

        } catch (Exception e) {
            System.err.println("Failed to start recording for job " + job.getId() + ": " + e.getMessage());
        }
    }

    @Override
    public void stopRecording(Long jobId) {
        Process process = activeRecordingProcesses.remove(jobId);
        if (process != null && process.isAlive()) {
            process.destroy();
            try {
                // Give it a moment to finish writing
                process.waitFor(java.util.concurrent.TimeUnit.SECONDS.toMillis(5),
                        java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            if (process.isAlive()) {
                process.destroyForcibly();
            }
            System.out.println("Stopped recording for job " + jobId);
        }

        // Also try to kill any lingering ffmpeg processes for this recording
        try {
            String pattern = "rec_" + jobId + "_";
            Runtime.getRuntime().exec(new String[]{"pkill", "-f", pattern});
        } catch (Exception e) {
            // Ignore
        }
    }

    @Override
    public void restartRecording(Long jobId) {
        Optional<TranscodeJob> jobOpt = jobRepository.findById(jobId);
        if (jobOpt.isEmpty()) return;

        TranscodeJob job = jobOpt.get();
        if (job.getStatus() != TranscodeJob.Status.IN_PROGRESS) return;

        stopRecording(jobId);

        // Small delay to let FFmpeg fully terminate
        try { Thread.sleep(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        startRecording(job);
    }

    @Override
    public LiveStreamSettings getSettings(Long jobId) {
        return settingsRepository.findByJobId(jobId).orElseGet(() -> {
            LiveStreamSettings s = new LiveStreamSettings();
            s.setJobId(jobId);
            s.setChunkDurationMinutes(30);
            s.setRetentionPeriodHours(168);
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

        // If chunk duration changed, restart the recording process with new settings
        if (chunkChanged && activeRecordingProcesses.containsKey(jobId)) {
            restartRecording(jobId);
        }

        return settings;
    }

    @Override
    public List<LiveStreamSegment> getSegments(Long jobId) {
        return segmentRepository.findByJobIdOrderByStartTimeAsc(jobId);
    }

    /**
     * Scheduled task: scan recording directories for new completed segments and add to DB.
     * Also enforce retention policies.
     * Runs every 30 seconds.
     */
    @Scheduled(fixedRate = 30000)
    public void scanAndCleanSegments() {
        File recordingsRoot = new File(outputDir + "/recordings");
        if (!recordingsRoot.exists()) return;

        File[] jobDirs = recordingsRoot.listFiles(File::isDirectory);
        if (jobDirs == null) return;

        for (File jobDir : jobDirs) {
            String dirName = jobDir.getName(); // e.g. "job_42"
            if (!dirName.startsWith("job_")) continue;

            Long jobId;
            try {
                jobId = Long.parseLong(dirName.substring(4));
            } catch (NumberFormatException e) {
                continue;
            }

            // Discover new segment files
            File[] segmentFiles = jobDir.listFiles((dir, name) -> name.endsWith(".mp4") && name.startsWith("rec_"));
            if (segmentFiles == null) continue;

            for (File segFile : segmentFiles) {
                // Skip if already in DB
                if (segmentRepository.existsByFileName(segFile.getName())) continue;

                // Skip files currently being written (if still recording, the last file may be in progress)
                // A simple heuristic: skip files modified in the last 5 seconds
                if (System.currentTimeMillis() - segFile.lastModified() < 5000) continue;

                // Parse filename to get start time
                Matcher matcher = SEGMENT_FILENAME_PATTERN.matcher(segFile.getName());
                if (!matcher.matches()) continue;

                try {
                    LocalDateTime startTime = LocalDateTime.parse(matcher.group(2), SEGMENT_DATE_FORMAT);

                    // Get duration via ffprobe
                    double duration = probeDuration(segFile.getAbsolutePath());
                    // Skip files that are still writing or tiny init segments (e.g. 0.04s)
                    if (duration < 2) continue;

                    LocalDateTime endTime = startTime.plusSeconds((long) duration);

                    LiveStreamSegment segment = new LiveStreamSegment();
                    segment.setJobId(jobId);
                    segment.setFileName(segFile.getName());
                    segment.setStartTime(startTime);
                    segment.setEndTime(endTime);
                    segment.setDurationSeconds(duration);
                    segment.setCreatedAt(LocalDateTime.now());
                    segmentRepository.save(segment);

                    System.out.println("Discovered segment: " + segFile.getName() +
                            " (duration=" + String.format("%.1f", duration) + "s)");
                } catch (Exception e) {
                    System.err.println("Error processing segment " + segFile.getName() + ": " + e.getMessage());
                }
            }

            // Enforce retention policy
            Optional<LiveStreamSettings> settingsOpt = settingsRepository.findByJobId(jobId);
            if (settingsOpt.isPresent()) {
                int retentionHours = settingsOpt.get().getRetentionPeriodHours();
                LocalDateTime cutoff = LocalDateTime.now().minusHours(retentionHours);

                List<LiveStreamSegment> allSegments = segmentRepository.findByJobIdOrderByStartTimeAsc(jobId);
                for (LiveStreamSegment seg : allSegments) {
                    if (seg.getStartTime().isBefore(cutoff)) {
                        // Delete file
                        File f = new File(jobDir, seg.getFileName());
                        if (f.exists()) {
                            f.delete();
                            System.out.println("Deleted expired segment: " + seg.getFileName());
                        }
                        segmentRepository.delete(seg);
                    }
                }
            }
        }
    }

    /**
     * Get video duration in seconds using ffprobe.
     */
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
            return 0;
        }
    }
}
