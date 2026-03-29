package com.transcoder.service;

import com.transcoder.dto.CreateRoomRequest;
import com.transcoder.dto.WatchPartyRoomResponse;
import com.transcoder.dto.WatchableMovieResponse;
import com.transcoder.model.WatchPartyRoom;

import java.util.List;

public interface WatchPartyService {

    List<WatchableMovieResponse> getWatchableMovies();

    WatchPartyRoom createRoom(CreateRoomRequest request, String username);

    WatchPartyRoomResponse getRoom(String roomId);

    List<WatchPartyRoom> getActiveRooms();
}
