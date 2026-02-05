package com.example.automobile_risk.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
public class PressFeatureAggregationService {

    /**
     * Stub implementation to keep InitDb wiring valid.
     * Replace with real feature aggregation logic when available.
     */
    public void generateTimeSeriesFeature(
            Long processExecutionId,
            Long equipmentId,
            LocalDateTime startDate,
            LocalDateTime endDate
    ) {
        log.info(
                "PressFeatureAggregationService stub: processExecutionId={}, equipmentId={}, startDate={}, endDate={}",
                processExecutionId, equipmentId, startDate, endDate
        );
    }
}
