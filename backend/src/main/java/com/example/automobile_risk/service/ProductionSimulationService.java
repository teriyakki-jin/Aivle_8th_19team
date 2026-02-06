package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.Equipment;
import com.example.automobile_risk.entity.ProcessExecution;
import com.example.automobile_risk.entity.ProcessType;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.EquipmentStatus;
import com.example.automobile_risk.exception.ProductionNotFoundException;
import com.example.automobile_risk.repository.EquipmentRepository;
import com.example.automobile_risk.repository.ProcessExecutionRepository;
import com.example.automobile_risk.repository.ProcessTypeRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import com.example.automobile_risk.service.dto.ProductionStreamEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductionSimulationService {

    private final ProductionRepository productionRepository;
    private final ProcessTypeRepository processTypeRepository;
    private final EquipmentRepository equipmentRepository;
    private final ProcessExecutionRepository processExecutionRepository;
    private final PlatformTransactionManager transactionManager;
    private final ProductionSseService productionSseService;
    private final OrderService orderService;

    @Async("simulationExecutor")
    public void simulate(Long productionId) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);

        Integer allocatedQty = tx.execute(status -> {
            Production production = productionRepository.findById(productionId)
                    .orElseThrow(() -> new ProductionNotFoundException(productionId));
            int sum = production.getOrderProductionList().stream()
                    .mapToInt(op -> op.getAllocatedQty())
                    .sum();
            return sum > 0 ? sum : production.getPlannedQty();
        });

        if (allocatedQty == null || allocatedQty <= 0) {
            log.warn("Production {} has no allocated quantity. skip simulation.", productionId);
            return;
        }

        long existingCount = tx.execute(status ->
                processExecutionRepository.countByProductionId(productionId)
        );
        if (existingCount > 0) {
            log.info("Production {} already has process executions. skip simulation.", productionId);
            return;
        }

        List<ProcessType> processTypes = tx.execute(status ->
                processTypeRepository.findByIsActiveTrueOrderByProcessOrderAsc()
        );
        if (processTypes == null || processTypes.isEmpty()) {
            log.warn("No active process types. productionId={}", productionId);
            return;
        }

        for (ProcessType processType : processTypes) {
            Long peId = tx.execute(status -> {
                Production production = productionRepository.findById(productionId)
                        .orElseThrow(() -> new ProductionNotFoundException(productionId));

                Equipment equipment = pickEquipment(processType.getId());
                if (equipment == null) {
                    throw new IllegalStateException("설비를 찾을 수 없습니다. processType=" + processType.getProcessName());
                }

                ProcessExecution pe = ProcessExecution.createEntity(
                        LocalDateTime.now(),
                        processType.getProcessOrder(),
                        production,
                        processType,
                        equipment
                );
                processExecutionRepository.save(pe);
                pe.operate(); // READY -> IN_PROGRESS
                productionSseService.publish(ProductionStreamEvent.builder()
                        .type("process_execution")
                        .productionId(productionId)
                        .orderId(getOrderId(production))
                        .processExecutionId(pe.getId())
                        .executionOrder(pe.getExecutionOrder())
                        .processExecutionStatus(pe.getStatus())
                        .startDate(pe.getStartDate())
                        .build());
                return pe.getId();
            });

            sleepMillis(5000L * allocatedQty);

            tx.execute(status -> {
                ProcessExecution pe = processExecutionRepository.findById(peId)
                        .orElseThrow(() -> new IllegalStateException("ProcessExecution not found: " + peId));
                pe.complete(LocalDateTime.now());
                Production production = pe.getProduction();
                productionSseService.publish(ProductionStreamEvent.builder()
                        .type("process_execution")
                        .productionId(productionId)
                        .orderId(getOrderId(production))
                        .processExecutionId(pe.getId())
                        .executionOrder(pe.getExecutionOrder())
                        .processExecutionStatus(pe.getStatus())
                        .startDate(pe.getStartDate())
                        .endDate(pe.getEndDate())
                        .build());
                return null;
            });
        }

        tx.execute(status -> {
            Production production = productionRepository.findById(productionId)
                    .orElseThrow(() -> new ProductionNotFoundException(productionId));
            long remaining = processExecutionRepository.countNotCompletedByProductionId(productionId);
            if (remaining == 0) {
                production.complete(LocalDateTime.now());
                // 연관 주문 완료 처리
                List<Long> orderIds = orderService.findRelatedOrderIdsByProduction(productionId);
                for (Long orderId : orderIds) {
                    orderService.tryCompleteOrder(orderId);
                }
                productionSseService.publish(ProductionStreamEvent.builder()
                        .type("production")
                        .productionId(productionId)
                        .orderId(getOrderId(production))
                        .productionStatus(production.getProductionStatus())
                        .endDate(production.getEndDate())
                        .build());
            }
            return null;
        });
    }

    private Equipment pickEquipment(Long processTypeId) {
        List<Equipment> normals = equipmentRepository.findByProcessTypeAndStatus(processTypeId, EquipmentStatus.NORMAL);
        if (normals != null && !normals.isEmpty()) return normals.get(0);
        List<Equipment> any = equipmentRepository.findByProcessTypeId(processTypeId);
        if (any != null && !any.isEmpty()) return any.get(0);
        return null;
    }

    private void sleepMillis(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private Long getOrderId(Production production) {
        if (production.getOrderProductionList() == null || production.getOrderProductionList().isEmpty()) {
            return null;
        }
        return production.getOrderProductionList().get(0).getOrder().getId();
    }
}
