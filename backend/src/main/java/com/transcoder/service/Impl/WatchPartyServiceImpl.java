package com.transcoder.service.Impl;

import com.transcoder.dto.CreateRoomRequest;
import com.transcoder.dto.WatchPartyRoomResponse;
import com.transcoder.dto.WatchableMovieResponse;
import com.transcoder.model.CmsMovie;
import com.transcoder.model.TranscodeJob;
import com.transcoder.model.WatchPartyRoom;
import com.transcoder.repository.CmsMovieRepository;
import com.transcoder.repository.JobRepository;
import com.transcoder.repository.WatchPartyRoomRepository;
import com.transcoder.exception.ResourceNotFoundException;
import com.transcoder.service.WatchPartyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class WatchPartyServiceImpl implements WatchPartyService {

    private final CmsMovieRepository movieRepository;
    private final JobRepository jobRepository;
    private final WatchPartyRoomRepository roomRepository;

    @Override
    public List<WatchableMovieResponse> getWatchableMovies() {
        List<CmsMovie> movies = movieRepository.findAll();
        List<WatchableMovieResponse> result = new ArrayList<>();

        for (CmsMovie movie : movies) {
            if (movie.getTranscodeJobId() == null) continue;

            Optional<TranscodeJob> jobOpt = jobRepository.findById(movie.getTranscodeJobId());
            if (jobOpt.isEmpty() || jobOpt.get().getStatus() != TranscodeJob.Status.COMPLETED) continue;

            TranscodeJob job = jobOpt.get();
            result.add(new WatchableMovieResponse(
                    movie.getImdbId(),
                    movie.getTitle(),
                    movie.getYear(),
                    movie.getPoster(),
                    movie.getGenre(),
                    movie.getRuntime(),
                    movie.getImdbRating(),
                    movie.getDirector(),
                    movie.getActors(),
                    movie.getPlot(),
                    job.getId(),
                    job.getOutputFileName(),
                    job.getOutputFormat(),
                    job.getPresetNames()
            ));
        }
        return result;
    }

    @Override
    public WatchPartyRoom createRoom(CreateRoomRequest request, String username) {
        CmsMovie movie = movieRepository.findByImdbId(request.getMovieImdbId())
                .orElseThrow(() -> new ResourceNotFoundException("Movie not found"));

        WatchPartyRoom room = new WatchPartyRoom();
        room.setId(UUID.randomUUID().toString());
        room.setMovieImdbId(request.getMovieImdbId());
        room.setTranscodeJobId(request.getTranscodeJobId());
        room.setMovieTitle(movie.getTitle());
        room.setMoviePoster(movie.getPoster());
        room.setHostUsername(username);

        return roomRepository.save(room);
    }

    @Override
    public WatchPartyRoomResponse getRoom(String roomId) {
        WatchPartyRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found"));

        TranscodeJob job = jobRepository.findById(room.getTranscodeJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Transcode job not found"));

        return new WatchPartyRoomResponse(
                room.getId(),
                room.getMovieImdbId(),
                room.getMovieTitle(),
                room.getMoviePoster(),
                room.getTranscodeJobId(),
                job.getOutputFileName(),
                job.getOutputFormat(),
                room.getHostUsername(),
                room.isActive(),
                room.getCreatedAt()
        );
    }

    @Override
    public List<WatchPartyRoom> getActiveRooms() {
        return roomRepository.findByActiveTrueOrderByCreatedAtDesc();
    }
}
