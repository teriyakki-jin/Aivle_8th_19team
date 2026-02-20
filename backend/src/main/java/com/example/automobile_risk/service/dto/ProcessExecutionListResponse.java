package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.ProcessExecution;
import com.example.automobile_risk.entity.enumclass.ProcessExecutionStatus;
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
public class ProcessExecutionListResponse {

    private Long processExecutionId;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;
    private Long executionOrder;
    private Integer unitIndex;
    private ProcessExecutionStatus status;

    // Entity -> Dto
    public static ProcessExecutionListResponse from(ProcessExecution processExecution) {
        return ProcessExecutionListResponse.builder()
                .processExecutionId(processExecution.getId())
                .startDate(toOffsetDateTime(processExecution.getStartDate()))
                .endDate(toOffsetDateTime(processExecution.getEndDate()))
                .executionOrder((long) processExecution.getExecutionOrder())
                .unitIndex(processExecution.getUnitIndex())
                .status(processExecution.getStatus())
                .build();
    }

    private static OffsetDateTime toOffsetDateTime(LocalDateTime value) {
        return value == null ? null : value.atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
