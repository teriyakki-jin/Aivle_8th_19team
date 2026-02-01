package com.example.automobile_risk.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardResponse {
    private List<AnomalyData> anomalyData;
    private List<AnomalyData> warningData;
    private Integer totalAnomalies;
    private Integer totalWarnings;
    private Double totalDelayHours;
    private String originalDeadline;
    private Double overallEfficiency;
    private Double productionEfficiency;
    private List<HistoryData> historyData;
    private List<ProcessStat> processStats;
    private List<ProcessDelayBreakdown> processDelayBreakdown;
    private String overallRiskLevel;

    // Real-time ML prediction fields
    private DashboardPredictionDto.CurrentPrediction currentPrediction;
    private DashboardPredictionDto.DeltaSincePrev deltaSincePrev;
    private List<DashboardPredictionDto.PredictionTrendPoint> predictionTrend;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AnomalyData {
        private String process;
        private Integer count;
        private Double avgDelayPerIssue;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HistoryData {
        private String 날짜;
        private Double 지연시간;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProcessStat {
        private String name;
        private Integer 정상;
        private Integer 경고;
        private Integer 이상;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProcessDelayBreakdown {
        private String process;
        private Double totalDelayHours;
        private Integer eventCount;
    }
}
