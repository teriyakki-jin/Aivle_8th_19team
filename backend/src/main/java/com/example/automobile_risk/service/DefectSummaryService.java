package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.DefectSummarySnapshot;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.ProcessEvent;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.DefectSnapshotStage;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import com.example.automobile_risk.repository.DefectSummarySnapshotRepository;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.ProcessEventRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import com.example.automobile_risk.service.dto.DefectSummaryResponse;
import com.example.automobile_risk.service.dto.ProcessDefectSummaryResponse;
import com.example.automobile_risk.service.dto.ProcessEventResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DefectSummaryService {

    private final ProductionRepository productionRepository;
    private final ProcessEventRepository processEventRepository;
    private final ProcessEventService processEventService;
    private final OrderRepository orderRepository;
    private final DefectSummarySnapshotRepository defectSummarySnapshotRepository;
    private final ObjectMapper objectMapper;

    // Use Unicode escapes to avoid encoding issues in source files.
    private static final List<String> PROCESS_NAMES = Arrays.asList(
            "\uD504\uB808\uC2A4",             // 프레스
            "\uC6A9\uC811",                   // 용접
            "\uB3C4\uC7A5",                   // 도장
            "\uC870\uB9BD",                   // 조립
            "\uAC80\uC0AC"                    // 검사
    );

    public List<DefectSummaryResponse> getCompletedProductionSummaries() {
        List<Production> completed = productionRepository.findCompletedWithDetails(ProductionStatus.COMPLETED);
        return completed.stream()
                .map(this::buildSummaryForProduction)
                .sorted((a, b) -> {
                    if (a.getCompletedAt() == null && b.getCompletedAt() == null) return 0;
                    if (a.getCompletedAt() == null) return 1;
                    if (b.getCompletedAt() == null) return -1;
                    return b.getCompletedAt().compareTo(a.getCompletedAt());
                })
                .collect(Collectors.toList());
    }

    public DefectSummaryResponse getDefectSummaryByProductionId(Long productionId) {
        Production production = productionRepository.findById(productionId)
                .orElseThrow(() -> new EntityNotFoundException("Production not found: " + productionId));

        return buildSummaryForProduction(production);
    }

    public List<ProcessEventResponse> getErrorLogsByProductionId(Long productionId) {
        Production production = productionRepository.findById(productionId)
                .orElseThrow(() -> new EntityNotFoundException("Production not found: " + productionId));

        if (production.getOrderProductionList() == null || production.getOrderProductionList().isEmpty()) {
            return new ArrayList<>();
        }

        Long orderId = production.getOrderProductionList().get(0).getOrder().getId();
        return processEventService.getEventsByOrderId(orderId);
    }

    public List<ProcessEventResponse> getErrorLogsByOrderId(Long orderId) {
        return processEventService.getEventsByOrderId(orderId);
    }

    @Transactional
    public void captureSnapshotForProduction(Long productionId, DefectSnapshotStage stage, LocalDateTime capturedAt) {
        Production production = productionRepository.findById(productionId)
                .orElseThrow(() -> new EntityNotFoundException("Production not found: " + productionId));

        Order order = null;
        if (production.getOrderProductionList() != null && !production.getOrderProductionList().isEmpty()) {
            order = production.getOrderProductionList().get(0).getOrder();
        }

        List<ProcessDefectSummaryResponse> processSummaries =
                buildProcessSummaries(order != null ? order.getId() : null);

        int totalDefects = processSummaries.stream()
                .mapToInt(ProcessDefectSummaryResponse::getDefectCount)
                .sum();

        String overallStatus = determineOverallStatus(processSummaries);

        String json = serializeProcessSummaries(processSummaries);

        DefectSummarySnapshot snapshot = DefectSummarySnapshot.create(
                production,
                order,
                stage,
                capturedAt,
                totalDefects,
                overallStatus,
                json
        );

        defectSummarySnapshotRepository.save(snapshot);
    }

    @Transactional
    public void captureSnapshotForOrder(Long orderId, DefectSnapshotStage stage, LocalDateTime capturedAt) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + orderId));

        List<ProcessDefectSummaryResponse> processSummaries =
                buildProcessSummaries(order.getId());

        int totalDefects = processSummaries.stream()
                .mapToInt(ProcessDefectSummaryResponse::getDefectCount)
                .sum();

        String overallStatus = determineOverallStatus(processSummaries);

        String json = serializeProcessSummaries(processSummaries);

        DefectSummarySnapshot snapshot = DefectSummarySnapshot.create(
                null,
                order,
                stage,
                capturedAt,
                totalDefects,
                overallStatus,
                json
        );

        defectSummarySnapshotRepository.save(snapshot);
    }

    private DefectSummaryResponse buildSummaryForProduction(Production production) {
        Long orderId = null;
        if (production.getOrderProductionList() != null && !production.getOrderProductionList().isEmpty()) {
            orderId = production.getOrderProductionList().get(0).getOrder().getId();
        }

        List<ProcessDefectSummaryResponse> processSummaries = buildProcessSummaries(orderId);
        return DefectSummaryResponse.from(production, processSummaries);
    }

    private DefectSummaryResponse buildSummaryForOrder(Order order) {
        List<ProcessDefectSummaryResponse> processSummaries = new ArrayList<>();

        List<ProcessEvent> events = processEventRepository.findByOrderId(order.getId());

        Map<String, Long> defectCountByProcess = events.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getProcess() != null ? e.getProcess() : "ETC",
                        Collectors.counting()
                ));

        for (String processName : PROCESS_NAMES) {
            int defectCount = defectCountByProcess.getOrDefault(processName, 0L).intValue();
            processSummaries.add(ProcessDefectSummaryResponse.of(processName, defectCount));
        }

        LocalDateTime completedAt = events.stream()
                .map(ProcessEvent::getDetectedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(LocalDateTime.now());

        return DefectSummaryResponse.fromOrder(order, processSummaries, completedAt);
    }

    private List<ProcessDefectSummaryResponse> buildProcessSummaries(Long orderId) {
        List<ProcessDefectSummaryResponse> processSummaries = new ArrayList<>();

        if (orderId != null) {
            Map<String, Long> defectCountByProcess = processEventRepository.findByOrderId(orderId).stream()
                    .collect(Collectors.groupingBy(
                            e -> e.getProcess() != null ? e.getProcess() : "ETC",
                            Collectors.counting()
                    ));

            for (String processName : PROCESS_NAMES) {
                int defectCount = defectCountByProcess.getOrDefault(processName, 0L).intValue();
                processSummaries.add(ProcessDefectSummaryResponse.of(processName, defectCount));
            }
        } else {
            for (String processName : PROCESS_NAMES) {
                processSummaries.add(ProcessDefectSummaryResponse.of(processName, 0));
            }
        }

        return processSummaries;
    }

    private String serializeProcessSummaries(List<ProcessDefectSummaryResponse> processSummaries) {
        try {
            return objectMapper.writeValueAsString(processSummaries);
        } catch (Exception e) {
            log.warn("Failed to serialize defect summaries", e);
            return "[]";
        }
    }

    private List<ProcessDefectSummaryResponse> deserializeProcessSummaries(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ProcessDefectSummaryResponse>>() {});
        } catch (Exception e) {
            log.warn("Failed to deserialize defect summaries", e);
            return new ArrayList<>();
        }
    }

    private String determineOverallStatus(List<ProcessDefectSummaryResponse> summaries) {
        boolean hasFail = summaries.stream().anyMatch(s -> "FAIL".equals(s.getStatus()));
        boolean hasWarning = summaries.stream().anyMatch(s -> "WARNING".equals(s.getStatus()));

        if (hasFail) return "FAIL";
        if (hasWarning) return "WARNING";
        return "PASS";
    }

    private DefectSummaryResponse toResponse(DefectSummarySnapshot snapshot) {
        List<ProcessDefectSummaryResponse> processSummaries =
                deserializeProcessSummaries(snapshot.getProcessSummariesJson());

        Long productionId = snapshot.getProduction() != null ? snapshot.getProduction().getId() : null;
        Long orderId = snapshot.getOrder() != null ? snapshot.getOrder().getId() : null;

        String vehicleModelName = "Unknown";
        if (snapshot.getProduction() != null && snapshot.getProduction().getVehicleModel() != null) {
            vehicleModelName = snapshot.getProduction().getVehicleModel().getModelName();
        } else if (snapshot.getOrder() != null && snapshot.getOrder().getVehicleModel() != null) {
            vehicleModelName = snapshot.getOrder().getVehicleModel().getModelName();
        }

        return DefectSummaryResponse.builder()
                .productionId(productionId)
                .orderId(orderId)
                .vehicleModelName(vehicleModelName)
                .completedAt(snapshot.getCapturedAt())
                .overallStatus(snapshot.getOverallStatus())
                .totalDefectCount(snapshot.getTotalDefectCount())
                .processSummaries(processSummaries)
                .build();
    }
}
