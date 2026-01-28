package com.example.automobile_risk.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaintAnalysisResponse {
    private Long id;
    private String resultId;
    private String imageFilename;
    private String imageUrl;
    private String resultImageUrl;
    private String status;
    private String primaryDefectType;
    private Double confidence;
    private LocalDateTime analyzedAt;
    private String locationCode;
    private List<DefectDetail> detectedDefects;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DefectDetail {
        private String defectClass;
        private String defectNameKo;
        private Double confidence;
        private String severityLevel;
    }
}
