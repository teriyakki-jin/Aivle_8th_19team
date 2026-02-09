package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.ProcessExecutionStatus;
import com.example.automobile_risk.exception.ProductionNotFoundException;
import com.example.automobile_risk.repository.MLAnalysisResultRepository;
import com.example.automobile_risk.repository.OrderProductionRepository;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.ProcessExecutionRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class DueDatePredictionTriggerService {

    private final ProductionRepository productionRepository;
    private final ProcessExecutionRepository processExecutionRepository;
    private final MLAnalysisResultRepository mlAnalysisResultRepository;
    private final OrderProductionRepository orderProductionRepository;
    private final OrderRepository orderRepository;
    private final MLProxyService mlProxyService;
    private final ObjectMapper objectMapper;

    @Async("simulationExecutor")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void triggerOnStage(Long productionId, String snapshotStage) {
        log.info("DueDate trigger start: productionId={}, stage={}", productionId, snapshotStage);
        System.out.println("DUEDATE_TRIGGER_ENTER");
        if (productionId == null || snapshotStage == null || snapshotStage.isBlank()) return;
        try {
            System.out.println("DUEDATE_TRIGGER_BEFORE_FIND");
            Production production = productionRepository.findById(productionId)
                    .orElseThrow(() -> new ProductionNotFoundException(productionId));
            System.out.println("DUEDATE_TRIGGER_AFTER_FIND");

            Long orderId = orderProductionRepository.findRelatedOrderIdsByProduction(productionId)
                    .stream()
                    .findFirst()
                    .orElse(null);
            Order order = orderId != null ? orderRepository.findById(orderId).orElse(null) : null;
            System.out.println("DUEDATE_TRIGGER_AFTER_ORDER");

            int orderQty = order != null ? order.getOrderQty() : production.getPlannedQty();

            LocalDateTime now = LocalDateTime.now();
            double elapsedMinutes = production.getStartDate() != null
                    ? Duration.between(production.getStartDate(), now).toMinutes()
                    : 0.0;
            double remainingSlackMinutes = order != null && order.getDueDate() != null
                    ? Duration.between(now, order.getDueDate()).toMinutes()
                    : 0.0;

            long stopCountTotal = processExecutionRepository
                    .countByProductionIdAndStatus(productionId, ProcessExecutionStatus.STOPPED);

            ObjectNode body = objectMapper.createObjectNode();
            if (orderId != null) body.put("order_id", orderId);
            body.put("order_qty", orderQty);
            body.put("stop_count_total", stopCountTotal);
            body.put("elapsed_minutes", elapsedMinutes);
            body.put("remaining_slack_minutes", remainingSlackMinutes);
            body.put("snapshot_stage", snapshotStage);

            System.out.println("DUEDATE_TRIGGER_BEFORE_ANOMALY");
            Double press = anomalyScore(orderId, "프레스");
            Double weld = anomalyScore(orderId, "용접");
            Double paint = anomalyScore(orderId, "도장");
            Double assembly = anomalyScore(orderId, "조립");
            Double inspection = anomalyScore(orderId, "검사");
            System.out.println("DUEDATE_TRIGGER_AFTER_ANOMALY");

            if (press != null) body.put("press_anomaly_score", press);
            if (weld != null) body.put("weld_anomaly_score", weld);
            if (paint != null) body.put("paint_anomaly_score", paint);
            if (assembly != null) body.put("assembly_anomaly_score", assembly);
            if (inspection != null) body.put("inspection_anomaly_score", inspection);

            System.out.println("DUEDATE_TRIGGER_BEFORE_CALL");
            mlProxyService.analyzeDueDate(body);
            System.out.println("DUEDATE_TRIGGER_AFTER_CALL");
            log.info("DueDate trigger success: productionId={}, stage={}", productionId, snapshotStage);
        } catch (Exception e) {
            System.out.println("DUEDATE_TRIGGER_CATCH: " + e.getClass().getName() + " - " + e.getMessage());
            log.error("DueDate trigger error: productionId={}, stage={}, msg={}",
                    productionId, snapshotStage, e.getMessage(), e);
        }
    }

    private Double anomalyScore(Long orderId, String processName) {
        if (orderId == null || processName == null) return null;
        var list = mlAnalysisResultRepository.findRecent(orderId, null, processName, PageRequest.of(0, 50));
        if (list == null || list.isEmpty()) return null;
        long total = list.size();
        long abnormal = list.stream().filter(r -> r.getIsAnomaly() != null && r.getIsAnomaly() == 1).count();
        return total == 0 ? null : (double) abnormal / (double) total;
    }
}
