package com.example.automobile_risk.service;

import com.example.automobile_risk.dto.DashboardPredictionDto;
import com.example.automobile_risk.entity.enumclass.RiskLevel;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class DefectDelayRuleEngine {

    // Per-process delay factor (hours per defect)
    private static final Map<String, Double> DELAY_FACTOR = Map.of(
            "press_vibration", 1.5,
            "press_image",     1.2,
            "paint",           2.0,
            "welding",         2.5,
            "windshield",      1.0,
            "engine",          2.2,
            "body_inspect",    1.8
    );

    private static final double MIN_RATIO = 0.6;

    @Getter
    @AllArgsConstructor
    public static class ProcessedPrediction {
        private final double delayMinH;
        private final double delayMaxH;
        private final RiskLevel riskLevel;
        private final List<DashboardPredictionDto.ProcessContribution> contributions;
    }

    public ProcessedPrediction evaluate(List<MlOrchestrationService.EndpointResult> results) {
        List<DashboardPredictionDto.ProcessContribution> contributions = new ArrayList<>();
        double totalDelayMax = 0.0;

        for (MlOrchestrationService.EndpointResult result : results) {
            if (!result.isSuccess() || result.getData() == null) continue;

            String process = result.getProcess();
            double factor = DELAY_FACTOR.getOrDefault(process, 1.0);
            int defectCount = extractDefectCount(result.getData());

            if (defectCount > 0) {
                double delayMax = defectCount * factor;
                double delayMin = delayMax * MIN_RATIO;

                contributions.add(DashboardPredictionDto.ProcessContribution.builder()
                        .process(process)
                        .delayMinH(Math.round(delayMin * 10.0) / 10.0)
                        .delayMaxH(Math.round(delayMax * 10.0) / 10.0)
                        .build());

                totalDelayMax += delayMax;
            }
        }

        double totalDelayMin = totalDelayMax * MIN_RATIO;
        RiskLevel riskLevel = classifyRisk(totalDelayMax);

        return new ProcessedPrediction(
                Math.round(totalDelayMin * 10.0) / 10.0,
                Math.round(totalDelayMax * 10.0) / 10.0,
                riskLevel,
                contributions
        );
    }

    private int extractDefectCount(JsonNode data) {
        // Try common response patterns from ML service
        if (data.has("defect_count")) {
            return data.get("defect_count").asInt(0);
        }
        if (data.has("data") && data.get("data").has("defect_count")) {
            return data.get("data").get("defect_count").asInt(0);
        }
        if (data.has("results") && data.get("results").isArray()) {
            int count = 0;
            for (JsonNode item : data.get("results")) {
                if (item.has("is_defect") && item.get("is_defect").asBoolean()) {
                    count++;
                }
                if (item.has("label") && !"ok".equalsIgnoreCase(item.get("label").asText())) {
                    count++;
                }
            }
            return count;
        }
        if (data.has("data") && data.get("data").has("results") && data.get("data").get("results").isArray()) {
            int count = 0;
            for (JsonNode item : data.get("data").get("results")) {
                if (item.has("is_defect") && item.get("is_defect").asBoolean()) {
                    count++;
                }
                if (item.has("label") && !"ok".equalsIgnoreCase(item.get("label").asText())) {
                    count++;
                }
            }
            return count;
        }
        // Anomaly detection: count anomalies
        if (data.has("anomaly_count")) {
            return data.get("anomaly_count").asInt(0);
        }
        return 0;
    }

    private RiskLevel classifyRisk(double totalDelayHours) {
        if (totalDelayHours < 8) return RiskLevel.LOW;
        if (totalDelayHours < 24) return RiskLevel.MEDIUM;
        if (totalDelayHours < 48) return RiskLevel.HIGH;
        return RiskLevel.CRITICAL;
    }
}
