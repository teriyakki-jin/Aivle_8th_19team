package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.DetectedDefect;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DetectedDefectRepository extends JpaRepository<DetectedDefect, Long> {
    
    List<DetectedDefect> findByResultId(String resultId);
    
    @Query("SELECT COUNT(d) FROM DetectedDefect d WHERE d.detectedAt >= :startDate")
    Long countByDetectedAtAfter(LocalDateTime startDate);
    
    @Query("SELECT d.defectClass, COUNT(d) FROM DetectedDefect d WHERE d.detectedAt >= :startDate GROUP BY d.defectClass")
    List<Object[]> countByDefectTypeAfter(LocalDateTime startDate);
}
