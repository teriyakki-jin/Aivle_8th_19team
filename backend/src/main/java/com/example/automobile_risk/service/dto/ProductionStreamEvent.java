package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.enumclass.ProcessExecutionStatus;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductionStreamEvent {

    private String type; // "process_execution" | "production"
    private Long productionId;
    private Long orderId;

    // process execution fields
    private Long processExecutionId;
    private Integer executionOrder;
    private Integer unitIndex;
    private ProcessExecutionStatus processExecutionStatus;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;

    // production fields
    private ProductionStatus productionStatus;

    public static OffsetDateTime toOffsetDateTime(LocalDateTime value) {
        return value == null ? null : value.atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
