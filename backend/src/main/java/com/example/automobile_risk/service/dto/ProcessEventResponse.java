package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.ProcessEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessEventResponse {

    private Long id;
    private String process;
    private String eventType;
    private String eventTypeLabel;
    private String eventCode;
    private Integer severity;
    private String severityLabel;
    private LocalDateTime detectedAt;
    private LocalDateTime resolvedAt;
    private boolean resolved;
    private int qtyAffected;
    private boolean lineHold;
    private String source;

    public static ProcessEventResponse from(ProcessEvent event) {
        return ProcessEventResponse.builder()
                .id(event.getId())
                .process(event.getProcess())
                .eventType(event.getEventType() != null ? event.getEventType().name() : null)
                .eventTypeLabel(event.getEventType() != null ? event.getEventType().getLabel() : null)
                .eventCode(event.getEventCode())
                .severity(event.getSeverity())
                .severityLabel(getSeverityLabel(event.getSeverity()))
                .detectedAt(event.getDetectedAt())
                .resolvedAt(event.getResolvedAt())
                .resolved(event.getResolvedAt() != null)
                .qtyAffected(event.getQtyAffected())
                .lineHold(event.isLineHold())
                .source(event.getSource() != null ? event.getSource().getLabel() : null)
                .build();
    }

    private static String getSeverityLabel(Integer severity) {
        if (severity == null || severity == 0) return "INFO";
        if (severity == 1) return "WARNING";
        return "ERROR";
    }
}
