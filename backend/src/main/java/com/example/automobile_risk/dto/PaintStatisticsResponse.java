package com.example.automobile_risk.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaintStatisticsResponse {
    private Long totalInspections;
    private Long passedInspections;
    private Long failedInspections;
    private Long warningInspections;
    private Long defectCount;
    private Double defectRate;
    private Double passRate;
    private Double avgConfidence;
}
