package com.example.automobile_risk.controller;

import com.example.automobile_risk.dto.PaintAnalysisResponse;
import com.example.automobile_risk.dto.PaintStatisticsResponse;
import com.example.automobile_risk.entity.PaintAnalysisResult;
import com.example.automobile_risk.service.PaintAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/paint-analysis")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PaintAnalysisController {
    
    private final PaintAnalysisService paintAnalysisService;
    
    /**
     * 전체 분석 이력 조회
     */
    @GetMapping("/history")
    public ResponseEntity<List<PaintAnalysisResponse>> getAnalysisHistory() {
        List<PaintAnalysisResponse> history = paintAnalysisService.getAllAnalysisHistory();
        return ResponseEntity.ok(history);
    }
    
    /**
     * 특정 분석 결과 상세 조회
     */
    @GetMapping("/detail/{resultId}")
    public ResponseEntity<PaintAnalysisResponse> getAnalysisDetail(@PathVariable String resultId) {
        return paintAnalysisService.getAnalysisDetail(resultId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 오늘의 통계 조회
     */
    @GetMapping("/statistics/today")
    public ResponseEntity<PaintStatisticsResponse> getTodayStatistics() {
        PaintStatisticsResponse statistics = paintAnalysisService.getTodayStatistics();
        return ResponseEntity.ok(statistics);
    }
    
    /**
     * 분석 결과 저장 (Python ML 서비스에서 호출)
     */
    @PostMapping("/save")
    public ResponseEntity<PaintAnalysisResponse> saveAnalysisResult(@RequestBody PaintAnalysisResult result) {
        PaintAnalysisResult savedResult = paintAnalysisService.saveAnalysisResult(result);
        return paintAnalysisService.getAnalysisDetail(savedResult.getResultId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(500).build());
    }
}
