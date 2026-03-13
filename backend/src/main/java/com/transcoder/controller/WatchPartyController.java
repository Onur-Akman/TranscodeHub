package com.transcoder.controller;

import com.transcoder.model.CmsMovie;
import com.transcoder.model.TranscodeJob;
import com.transcoder.model.WatchPartyRoom;
import com.transcoder.repository.CmsMovieRepository;
import com.transcoder.repository.JobRepository;
import com.transcoder.repository.WatchPartyRoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.*;

@RestController
@RequestMapping("/api/watch-party")
public class WatchPartyController {

    private final CmsMovieRepository movieRepository;
    private final JobRepository jobRepository;
    private final WatchPartyRoomRepository roomRepository;

    public WatchPartyController(CmsMovieRepository movieRepository,
                                JobRepository jobRepository,
                                WatchPartyRoomRepository roomRepository) {
        this.movieRepository = movieRepository;
        this.jobRepository = jobRepository;
        this.roomRepository = roomRepository;
    }

    @GetMapping("/movies")
    public List<Map<String, Object>> getWatchableMovies() {
        List<CmsMovie> movies = movieRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (CmsMovie movie : movies) {
            if (movie.getTranscodeJobId() == null) continue;

            Optional<TranscodeJob> jobOpt = jobRepository.findById(movie.getTranscodeJobId());
            if (jobOpt.isEmpty() || jobOpt.get().getStatus() != TranscodeJob.Status.COMPLETED) continue;

            TranscodeJob job = jobOpt.get();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("imdbId", movie.getImdbId());
            item.put("title", movie.getTitle());
            item.put("year", movie.getYear());
            item.put("poster", movie.getPoster());
            item.put("genre", movie.getGenre());
            item.put("runtime", movie.getRuntime());
            item.put("imdbRating", movie.getImdbRating());
            item.put("director", movie.getDirector());
            item.put("actors", movie.getActors());
            item.put("plot", movie.getPlot());
            item.put("transcodeJobId", job.getId());
            item.put("outputFileName", job.getOutputFileName());
            item.put("outputFormat", job.getOutputFormat());
            item.put("presetNames", job.getPresetNames());
            result.add(item);
        }
        return result;
    }

    @PostMapping("/rooms")
    public WatchPartyRoom createRoom(@RequestBody Map<String, Object> body, Principal principal) {
        String movieImdbId = (String) body.get("movieImdbId");
        Number transcodeJobIdNum = (Number) body.get("transcodeJobId");
        if (movieImdbId == null || transcodeJobIdNum == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "movieImdbId and transcodeJobId required");
        }

        Long transcodeJobId = transcodeJobIdNum.longValue();
        CmsMovie movie = movieRepository.findByImdbId(movieImdbId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found"));

        WatchPartyRoom room = new WatchPartyRoom();
        room.setId(UUID.randomUUID().toString());
        room.setMovieImdbId(movieImdbId);
        room.setTranscodeJobId(transcodeJobId);
        room.setMovieTitle(movie.getTitle());
        room.setMoviePoster(movie.getPoster());
        room.setHostUsername(principal.getName());

        return roomRepository.save(room);
    }

    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<Map<String, Object>> getRoom(@PathVariable String roomId) {
        WatchPartyRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        TranscodeJob job = jobRepository.findById(room.getTranscodeJobId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transcode job not found"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", room.getId());
        result.put("movieImdbId", room.getMovieImdbId());
        result.put("movieTitle", room.getMovieTitle());
        result.put("moviePoster", room.getMoviePoster());
        result.put("transcodeJobId", room.getTranscodeJobId());
        result.put("outputFileName", job.getOutputFileName());
        result.put("outputFormat", job.getOutputFormat());
        result.put("hostUsername", room.getHostUsername());
        result.put("active", room.isActive());
        result.put("createdAt", room.getCreatedAt());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/rooms")
    public List<WatchPartyRoom> getActiveRooms() {
        return roomRepository.findByActiveTrueOrderByCreatedAtDesc();
    }
}
