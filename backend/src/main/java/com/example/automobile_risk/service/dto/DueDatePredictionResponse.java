package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.DueDatePrediction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DueDatePredictionResponse {
    private Long id;
    private Long orderId;
    private Integer orderQty;
    private String snapshotStage;
    private Double stopCountTotal;
    private Double elapsedMinutes;
    private Double remainingSlackMinutes;
    private Integer delayFlag;
    private Double delayProbability;
    private Double predictedDelayMinutes;
    private LocalDateTime createdDate;

    public static DueDatePredictionResponse from(DueDatePrediction e) {
        return DueDatePredictionResponse.builder()
                .id(e.getId())
                .orderId(e.getOrderId())
                .orderQty(e.getOrderQty())
                .snapshotStage(e.getSnapshotStage())
                .stopCountTotal(e.getStopCountTotal())
                .elapsedMinutes(e.getElapsedMinutes())
                .remainingSlackMinutes(e.getRemainingSlackMinutes())
                .delayFlag(e.getDelayFlag())
                .delayProbability(e.getDelayProbability())
                .predictedDelayMinutes(e.getPredictedDelayMinutes())
                .createdDate(e.getCreatedDate())
                .build();
    }
}
