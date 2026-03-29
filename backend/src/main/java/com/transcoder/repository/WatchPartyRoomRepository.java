package com.transcoder.repository;

import com.transcoder.model.WatchPartyRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WatchPartyRoomRepository extends JpaRepository<WatchPartyRoom, String> {
    List<WatchPartyRoom> findByActiveTrueOrderByCreatedAtDesc();
}
