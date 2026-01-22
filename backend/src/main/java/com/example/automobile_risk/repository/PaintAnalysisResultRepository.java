package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.PaintAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaintAnalysisResultRepository extends JpaRepository<PaintAnalysisResult, Long> {
    
    Optional<PaintAnalysisResult> findByResultId(String resultId);
    
    List<PaintAnalysisResult> findAllByOrderByAnalyzedAtDesc();
    
    List<PaintAnalysisResult> findByAnalyzedAtBetween(LocalDateTime start, LocalDateTime end);
    
    @Query("SELECT p FROM PaintAnalysisResult p ORDER BY p.analyzedAt DESC")
    List<PaintAnalysisResult> findTop100ByOrderByAnalyzedAtDesc();
    
    @Query("SELECT COUNT(p) FROM PaintAnalysisResult p WHERE p.analyzedAt >= :startDate")
    Long countByAnalyzedAtAfter(LocalDateTime startDate);
    
    @Query("SELECT COUNT(p) FROM PaintAnalysisResult p WHERE p.status = :status AND p.analyzedAt >= :startDate")
    Long countByStatusAndAnalyzedAtAfter(String status, LocalDateTime startDate);
    
    @Query("SELECT AVG(p.confidence) FROM PaintAnalysisResult p WHERE p.analyzedAt >= :startDate")
    Double getAverageConfidenceAfter(LocalDateTime startDate);
}
