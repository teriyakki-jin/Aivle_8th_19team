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

    @Transactional
    public DueDatePrediction save(DueDatePrediction prediction) {
        return dueDatePredictionRepository.save(prediction);
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
}
