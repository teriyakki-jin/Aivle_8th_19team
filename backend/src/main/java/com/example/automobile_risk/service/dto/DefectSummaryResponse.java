package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.Production;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DefectSummaryResponse {

    private Long productionId;
    private Long orderId;
    private String vehicleModelName;
    private LocalDateTime completedAt;
    private String overallStatus; // PASS, WARNING, FAIL
    private int totalDefectCount;

    @Builder.Default
    private List<ProcessDefectSummaryResponse> processSummaries = new ArrayList<>();

    public static DefectSummaryResponse from(Production production, List<ProcessDefectSummaryResponse> processSummaries) {
        int totalDefects = processSummaries.stream()
                .mapToInt(ProcessDefectSummaryResponse::getDefectCount)
                .sum();

        String overallStatus = determineOverallStatus(processSummaries);

        Long orderId = null;
        if (production.getOrderProductionList() != null && !production.getOrderProductionList().isEmpty()) {
            orderId = production.getOrderProductionList().get(0).getOrder().getId();
        }

        String vehicleModelName = production.getVehicleModel() != null
                ? production.getVehicleModel().getModelName()
                : "Unknown";

        return DefectSummaryResponse.builder()
                .productionId(production.getId())
                .orderId(orderId)
                .vehicleModelName(vehicleModelName)
                .completedAt(production.getEndDate())
                .overallStatus(overallStatus)
                .totalDefectCount(totalDefects)
                .processSummaries(processSummaries)
                .build();
    }

    public static DefectSummaryResponse fromOrder(Order order, List<ProcessDefectSummaryResponse> processSummaries, LocalDateTime completedAt) {
        int totalDefects = processSummaries.stream()
                .mapToInt(ProcessDefectSummaryResponse::getDefectCount)
                .sum();

        String overallStatus = determineOverallStatus(processSummaries);

        String vehicleModelName = order.getVehicleModel() != null
                ? order.getVehicleModel().getModelName()
                : "Unknown";

        return DefectSummaryResponse.builder()
                .productionId(null)
                .orderId(order.getId())
                .vehicleModelName(vehicleModelName)
                .completedAt(completedAt)
                .overallStatus(overallStatus)
                .totalDefectCount(totalDefects)
                .processSummaries(processSummaries)
                .build();
    }

    private static String determineOverallStatus(List<ProcessDefectSummaryResponse> summaries) {
        boolean hasFail = summaries.stream().anyMatch(s -> "FAIL".equals(s.getStatus()));
        boolean hasWarning = summaries.stream().anyMatch(s -> "WARNING".equals(s.getStatus()));

        if (hasFail) return "FAIL";
        if (hasWarning) return "WARNING";
        return "PASS";
    }
}
