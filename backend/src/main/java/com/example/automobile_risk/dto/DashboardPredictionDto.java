package com.example.automobile_risk.dto;

import lombok.*;

import java.util.List;

public class DashboardPredictionDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProcessContribution {
        private String process;
        private double delayMinH;
        private double delayMaxH;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SourceStatus {
        private String endpoint;
        private boolean ok;
        private String reason;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CurrentPrediction {
        private double predDelayMinH;
        private double predDelayMaxH;
        private String riskLevel;
        private List<ProcessContribution> contributions;
        private List<SourceStatus> sources;
        private String status;
        private String lastUpdated;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DeltaDriver {
        private String process;
        private double delayMaxBefore;
        private double delayMaxAfter;
        private double delayMaxDelta;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DeltaSincePrev {
        private double delayMinDelta;
        private double delayMaxDelta;
        private boolean riskChanged;
        private List<DeltaDriver> drivers;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PredictionTrendPoint {
        private String t;
        private double delayMax;
        private String risk;
    }
}
