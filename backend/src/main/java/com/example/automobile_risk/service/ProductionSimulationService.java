package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.Equipment;
import com.example.automobile_risk.entity.MlInputDataset;
import com.example.automobile_risk.entity.ProcessExecution;
import com.example.automobile_risk.entity.ProcessType;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.DatasetFormat;
import com.example.automobile_risk.entity.enumclass.EquipmentStatus;
import com.example.automobile_risk.exception.ProductionNotFoundException;
import com.example.automobile_risk.repository.EquipmentRepository;
import com.example.automobile_risk.repository.ProcessExecutionRepository;
import com.example.automobile_risk.repository.ProcessTypeRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import com.example.automobile_risk.service.dto.ProductionStreamEvent;
import com.fasterxml.jackson.databind.JsonNode;
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
    private final MLProxyService mlProxyService;
    private final ProductionDatasetService productionDatasetService;

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

            Long orderId = tx.execute(status -> {
                Production production = productionRepository.findById(productionId)
                        .orElseThrow(() -> new ProductionNotFoundException(productionId));
                return getOrderId(production);
            });

            triggerMlForProcess(orderId, productionId, processType.getProcessName(), peId);

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

    private void triggerMlForProcess(Long orderId, Long productionId, String processName, Long processExecutionId) {
        if (orderId == null || processName == null || processExecutionId == null) return;

        int offset = (int) (Math.abs(processExecutionId) % 10);
        String normalizedProcess = normalizeProcessName(processName);
        MLProxyService.MlContext context = new MLProxyService.MlContext(
                orderId,
                productionId,
                processExecutionId,
                normalizedProcess
        );
        MlInputDataset dataset = productionDatasetService.findDatasetForProductionProcess(productionId, normalizedProcess);

        try {
            switch (processName) {
                case "프레스" -> {
                    if (dataset != null && dataset.getFormat() == DatasetFormat.JSON) {
                        JsonNode body = loadJsonDataset(dataset);
                        if (body != null) {
                            mlProxyService.analyzePressVibrationJson(body, context);
                        } else {
                            mlProxyService.analyzePressVibration(offset, context);
                        }
                    } else {
                        mlProxyService.analyzePressVibration(offset, context);
                    }
                    mlProxyService.analyzePressImage(offset, context);
                }
                case "차체조립(용접)" -> {
                    if (dataset != null && dataset.getFormat() == DatasetFormat.IMAGE) {
                        java.io.File file = pickDatasetFile(dataset);
                        if (file != null) {
                            mlProxyService.analyzeWeldingImageFile(file, context);
                        } else {
                            mlProxyService.analyzeWeldingImageAuto(offset, context);
                        }
                    } else {
                        mlProxyService.analyzeWeldingImageAuto(offset, context);
                    }
                }
                case "도장" -> {
                    if (dataset != null && dataset.getFormat() == DatasetFormat.IMAGE) {
                        java.io.File file = pickDatasetFile(dataset);
                        if (file != null) {
                            mlProxyService.analyzePaintFile(file, context);
                        } else {
                            mlProxyService.analyzePaintAuto(offset, context);
                        }
                    } else {
                        mlProxyService.analyzePaintAuto(offset, context);
                    }
                }
                case "의장" -> {
                    if (dataset != null && dataset.getFormat() == DatasetFormat.IMAGE) {
                        java.io.File file = pickDatasetFile(dataset);
                        if (file != null) {
                            mlProxyService.analyzeBodyAssemblyFile(file, context);
                        } else {
                            mlProxyService.analyzeBodyAssemblyBatchAuto(0.5, offset, context);
                        }
                    } else {
                        mlProxyService.analyzeBodyAssemblyBatchAuto(0.5, offset, context);
                    }
                }
                case "검수" -> {
                    if (dataset != null && dataset.getFormat() == DatasetFormat.CSV) {
                        java.io.File file = pickDatasetFile(dataset);
                        if (file != null) {
                            mlProxyService.analyzeWindshieldFile("left", file, context);
                        } else {
                            mlProxyService.analyzeWindshieldAuto(offset, context);
                        }
                    } else {
                        mlProxyService.analyzeWindshieldAuto(offset, context);
                    }
                    if (dataset != null && dataset.getFormat() == DatasetFormat.ARFF) {
                        java.io.File file = pickDatasetFile(dataset);
                        if (file != null) {
                            mlProxyService.analyzeEngineFile(file, context);
                        } else {
                            mlProxyService.analyzeEngineAuto(offset, context);
                        }
                    } else {
                        mlProxyService.analyzeEngineAuto(offset, context);
                    }
                }
                default -> {
                }
            }
        } catch (Exception e) {
            log.warn("ML call failed for process {} (productionId={}): {}", processName, productionId, e.getMessage());
        }
    }

    private String normalizeProcessName(String processTypeName) {
        return switch (processTypeName) {
            case "차체조립(용접)" -> "용접";
            case "의장" -> "조립";
            case "검수" -> "검사";
            default -> processTypeName;
        };
    }

    private JsonNode loadJsonDataset(MlInputDataset dataset) {
        try {
            java.nio.file.Path path = java.nio.file.Paths.get(dataset.getStorageKey());
            if (!java.nio.file.Files.exists(path)) {
                log.warn("Dataset file not found: {}", dataset.getStorageKey());
                return null;
            }
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readTree(java.nio.file.Files.newBufferedReader(path));
        } catch (Exception e) {
            log.warn("Failed to load JSON dataset: {} ({})", dataset.getStorageKey(), e.getMessage());
            return null;
        }
    }

    private java.io.File pickDatasetFile(MlInputDataset dataset) {
        try {
            java.nio.file.Path path = java.nio.file.Paths.get(dataset.getStorageKey());
            if (!java.nio.file.Files.exists(path)) {
                log.warn("Dataset path not found: {}", dataset.getStorageKey());
                return null;
            }
            if (java.nio.file.Files.isDirectory(path)) {
                try (java.util.stream.Stream<java.nio.file.Path> stream = java.nio.file.Files.list(path)) {
                    return stream
                            .filter(p -> !java.nio.file.Files.isDirectory(p))
                            .sorted()
                            .findFirst()
                            .map(java.nio.file.Path::toFile)
                            .orElse(null);
                }
            }
            return path.toFile();
        } catch (Exception e) {
            log.warn("Failed to pick dataset file: {} ({})", dataset.getStorageKey(), e.getMessage());
            return null;
        }
    }
}
