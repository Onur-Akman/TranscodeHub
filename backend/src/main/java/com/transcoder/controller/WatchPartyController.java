package com.transcoder.controller;

import com.transcoder.dto.CreateRoomRequest;
import com.transcoder.dto.WatchPartyRoomResponse;
import com.transcoder.dto.WatchableMovieResponse;
import com.transcoder.model.WatchPartyRoom;
import com.transcoder.service.WatchPartyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/watch-party")
@RequiredArgsConstructor
public class WatchPartyController {

    private final WatchPartyService watchPartyService;

    @GetMapping("/movies")
    public List<WatchableMovieResponse> getWatchableMovies() {
        return watchPartyService.getWatchableMovies();
    }

    @PostMapping("/rooms")
    public WatchPartyRoom createRoom(@RequestBody CreateRoomRequest request, Principal principal) {
        return watchPartyService.createRoom(request, principal.getName());
    }

    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<WatchPartyRoomResponse> getRoom(@PathVariable String roomId) {
        return ResponseEntity.ok(watchPartyService.getRoom(roomId));
    }

    @GetMapping("/rooms")
    public List<WatchPartyRoom> getActiveRooms() {
        return watchPartyService.getActiveRooms();
    }
}
