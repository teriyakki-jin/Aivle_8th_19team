package com.example.automobile_risk.service;

import com.example.automobile_risk.dto.PaintAnalysisResponse;
import com.example.automobile_risk.dto.PaintStatisticsResponse;
import com.example.automobile_risk.entity.DetectedDefect;
import com.example.automobile_risk.entity.PaintAnalysisResult;
import com.example.automobile_risk.repository.DetectedDefectRepository;
import com.example.automobile_risk.repository.PaintAnalysisResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaintAnalysisService {
    
    private final PaintAnalysisResultRepository paintAnalysisResultRepository;
    private final DetectedDefectRepository detectedDefectRepository;
    
    /**
     * 분석 결과 저장
     */
    @Transactional
    public PaintAnalysisResult saveAnalysisResult(PaintAnalysisResult result) {
        return paintAnalysisResultRepository.save(result);
    }
    
    /**
     * 전체 분석 이력 조회 (최신순)
     */
    @Transactional(readOnly = true)
    public List<PaintAnalysisResponse> getAllAnalysisHistory() {
        List<PaintAnalysisResult> results = paintAnalysisResultRepository.findTop100ByOrderByAnalyzedAtDesc();
        return results.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * 특정 분석 결과 상세 조회
     */
    @Transactional(readOnly = true)
    public Optional<PaintAnalysisResponse> getAnalysisDetail(String resultId) {
        return paintAnalysisResultRepository.findByResultId(resultId)
                .map(this::convertToResponse);
    }
    
    /**
     * 오늘의 통계 조회
     */
    @Transactional(readOnly = true)
    public PaintStatisticsResponse getTodayStatistics() {
        LocalDateTime startOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        
        Long totalInspections = paintAnalysisResultRepository.countByAnalyzedAtAfter(startOfDay);
        Long passedInspections = paintAnalysisResultRepository.countByStatusAndAnalyzedAtAfter("PASS", startOfDay);
        Long failedInspections = paintAnalysisResultRepository.countByStatusAndAnalyzedAtAfter("FAIL", startOfDay);
        Long warningInspections = paintAnalysisResultRepository.countByStatusAndAnalyzedAtAfter("WARNING", startOfDay);
        Long defectCount = detectedDefectRepository.countByDetectedAtAfter(startOfDay);
        Double avgConfidence = paintAnalysisResultRepository.getAverageConfidenceAfter(startOfDay);
        
        if (totalInspections == null) totalInspections = 0L;
        if (passedInspections == null) passedInspections = 0L;
        if (failedInspections == null) failedInspections = 0L;
        if (warningInspections == null) warningInspections = 0L;
        if (defectCount == null) defectCount = 0L;
        if (avgConfidence == null) avgConfidence = 0.0;
        
        double defectRate = totalInspections > 0 ? (failedInspections * 100.0 / totalInspections) : 0.0;
        double passRate = totalInspections > 0 ? (passedInspections * 100.0 / totalInspections) : 0.0;
        
        return new PaintStatisticsResponse(
                totalInspections,
                passedInspections,
                failedInspections,
                warningInspections,
                defectCount,
                defectRate,
                passRate,
                avgConfidence
        );
    }
    
    /**
     * Entity를 Response DTO로 변환
     */
    private PaintAnalysisResponse convertToResponse(PaintAnalysisResult result) {
        List<PaintAnalysisResponse.DefectDetail> defectDetails = result.getDetectedDefects().stream()
                .map(defect -> new PaintAnalysisResponse.DefectDetail(
                        defect.getDefectClass(),
                        defect.getDefectNameKo(),
                        defect.getConfidence(),
                        defect.getSeverityLevel()
                ))
                .collect(Collectors.toList());
        
        return new PaintAnalysisResponse(
                result.getId(),
                result.getResultId(),
                result.getImageFilename(),
                result.getImageUrl(),
                result.getResultImageUrl(),
                result.getStatus(),
                result.getPrimaryDefectType(),
                result.getConfidence(),
                result.getAnalyzedAt(),
                result.getLocationCode(),
                defectDetails
        );
    }
}
