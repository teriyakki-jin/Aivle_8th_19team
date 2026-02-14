package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.DueDatePrediction;
import com.example.automobile_risk.repository.DueDatePredictionRepository;
import com.example.automobile_risk.service.dto.DueDatePredictionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DueDatePredictionService {

    private final DueDatePredictionRepository dueDatePredictionRepository;
    private final DueDatePredictionSseService dueDatePredictionSseService;

    @Transactional
    public DueDatePrediction save(DueDatePrediction prediction) {
        System.out.println("DUEDATE_SAVE_REACHED");
        try {
            DueDatePrediction saved = dueDatePredictionRepository.save(prediction);
            log.info("DueDatePrediction saved: id={}, orderId={}, stage={}",
                    saved.getId(), saved.getOrderId(), saved.getSnapshotStage());
            try {
                dueDatePredictionSseService.publish(
                        "dueDatePrediction",
                        DueDatePredictionResponse.from(saved)
                );
            } catch (Exception e) {
                log.warn("Failed to publish dueDatePrediction SSE: {}", e.getMessage());
            }
            return saved;
        } catch (Exception e) {
            log.error("DueDatePrediction save failed: {}", e.getMessage(), e);
            throw e;
        }
    }

    public List<DueDatePredictionResponse> getLatestPerOrder(int limit) {
        List<DueDatePrediction> all = dueDatePredictionRepository.findAllByOrderByIdDesc();
        Map<Long, DueDatePrediction> latestByOrder = new LinkedHashMap<>();

        for (DueDatePrediction p : all) {
            Long orderId = p.getOrderId();
            if (orderId == null) continue;
            if (!latestByOrder.containsKey(orderId)) {
                latestByOrder.put(orderId, p);
                if (latestByOrder.size() >= limit) break;
            }
        }

        return latestByOrder.values().stream()
                .map(DueDatePredictionResponse::from)
                .collect(Collectors.toList());
    }

    public Optional<DueDatePrediction> getLatestByOrderId(Long orderId) {
        if (orderId == null) return Optional.empty();
        return dueDatePredictionRepository.findTopByOrderIdOrderByIdDesc(orderId);
    }
}
