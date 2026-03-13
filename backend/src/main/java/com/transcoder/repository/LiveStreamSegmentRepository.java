package com.transcoder.repository;

import com.transcoder.model.LiveStreamSegment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LiveStreamSegmentRepository extends JpaRepository<LiveStreamSegment, Long> {
    List<LiveStreamSegment> findByJobIdOrderByStartTimeAsc(Long jobId);
    List<LiveStreamSegment> findByCreatedAtBefore(LocalDateTime before);
    boolean existsByFileName(String fileName);
}
