package com.transcoder.service;

import com.transcoder.model.EncodingPreset;
import com.transcoder.model.TranscodeJob;
import com.transcoder.repository.JobRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FFmpegService {

    private final JobRepository jobRepository;

    @Value("${app.videos.input-dir}")
    private String inputDir;

    @Value("${app.videos.output-dir}")
    private String outputDir;

    public FFmpegService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    /**
     * Get duration of a video file in seconds using ffprobe.
     */
    public double getVideoDuration(String inputPath) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                inputPath
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = reader.readLine();
            process.waitFor();
            if (line != null && !line.isEmpty()) {
                return Double.parseDouble(line.trim());
            }
        } catch (Exception e) {
            System.err.println("Failed to get video duration: " + e.getMessage());
        }
        return 0;
    }

    /**
     * Build the FFmpeg command from preset settings.
     */
    public List<String> buildFFmpegCommand(String inputPath, String outputPath, EncodingPreset preset) {
        List<String> cmd = new ArrayList<>();
        cmd.add("ffmpeg");
        cmd.add("-y"); // overwrite
        cmd.add("-i");
        cmd.add(inputPath);

        // Video codec
        cmd.add("-c:v");
        cmd.add(preset.getVideoCodec());

        // Resolution
        String res = preset.getResolution();
        if (res != null && res.contains("x")) {
            String[] parts = res.split("x");
            cmd.add("-vf");
            cmd.add("scale=" + parts[0] + ":" + parts[1]);
        }

        // CRF
        cmd.add("-crf");
        cmd.add(String.valueOf(preset.getCrf()));

        // Max bitrate & buffer size
        cmd.add("-maxrate");
        cmd.add(preset.getMaxRate());
        cmd.add("-bufsize");
        cmd.add(preset.getBufSize());

        // Encoding preset speed (only for x264/x265)
        String codec = preset.getVideoCodec();
        if (codec.contains("x264") || codec.contains("x265")) {
            cmd.add("-preset");
            cmd.add(preset.getPreset());
        }

        // Audio codec & bitrate
        cmd.add("-c:a");
        cmd.add(preset.getAudioCodec());
        cmd.add("-b:a");
        cmd.add(preset.getAudioBitrate());

        // Fast start for MP4
        if ("mp4".equalsIgnoreCase(preset.getFormat())) {
            cmd.add("-movflags");
            cmd.add("+faststart");
        }

        // Progress output
        cmd.add("-progress");
        cmd.add("pipe:1");

        cmd.add(outputPath);
        return cmd;
    }

    /**
     * Run FFmpeg transcoding asynchronously, tracking progress.
     */
    @Async
    public void runTranscode(TranscodeJob job, EncodingPreset preset) {
        String inputPath = inputDir + "/" + job.getInputFileName();
        String outputPath = outputDir + "/" + job.getOutputFileName();

        // Ensure output directory exists
        new File(outputDir).mkdirs();

        // Get video duration for progress calculation
        double totalDuration = getVideoDuration(inputPath);

        // Update status to IN_PROGRESS
        job.setStatus(TranscodeJob.Status.IN_PROGRESS);
        jobRepository.save(job);

        try {
            List<String> command = buildFFmpegCommand(inputPath, outputPath, preset);
            System.out.println("Running FFmpeg: " + String.join(" ", command));

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(false);
            Process process = pb.start();

            // Read progress from stdout (pipe:1)
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            // Read stderr in a separate thread to prevent blocking
            Thread errThread = new Thread(() -> {
                try (BufferedReader errReader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                    String line;
                    while ((line = errReader.readLine()) != null) {
                        // Log stderr
                        System.err.println("[FFmpeg] " + line);
                    }
                } catch (IOException ignored) {}
            });
            errThread.setDaemon(true);
            errThread.start();

            Pattern timePattern = Pattern.compile("out_time_ms=(\\d+)");
            String line;
            while ((line = reader.readLine()) != null) {
                Matcher matcher = timePattern.matcher(line);
                if (matcher.find()) {
                    long timeMicros = Long.parseLong(matcher.group(1));
                    double timeSeconds = timeMicros / 1_000_000.0;
                    if (totalDuration > 0) {
                        int progress = (int) Math.min(100, (timeSeconds / totalDuration) * 100);
                        job.setProgress(progress);
                        jobRepository.save(job);
                    }
                }
                if (line.startsWith("progress=end")) {
                    break;
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                job.setStatus(TranscodeJob.Status.COMPLETED);
                job.setProgress(100);
            } else {
                job.setStatus(TranscodeJob.Status.FAILED);
                job.setErrorMessage("FFmpeg exited with code " + exitCode);
            }
        } catch (Exception e) {
            job.setStatus(TranscodeJob.Status.FAILED);
            job.setErrorMessage(e.getMessage());
        }

        job.setCompletedAt(LocalDateTime.now());
        jobRepository.save(job);
    }
}
