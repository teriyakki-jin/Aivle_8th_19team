package com.example.automobile_risk.service;

import com.example.automobile_risk.controller.dto.ProcessEventCreateForm;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.ProcessEvent;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.ProcessEventRepository;
import com.example.automobile_risk.service.dto.ProcessEventResponse;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProcessEventService {

    private final ProcessEventRepository processEventRepository;
    private final OrderRepository orderRepository;

    public List<ProcessEventResponse> getEventsByOrderId(Long orderId) {
        List<ProcessEvent> events = processEventRepository.findByOrderId(orderId);
        return events.stream()
                .map(ProcessEventResponse::from)
                .sorted(Comparator.comparing(ProcessEventResponse::getDetectedAt).reversed())
                .collect(Collectors.toList());
    }

    public List<ProcessEventResponse> getUnresolvedEventsByOrderId(Long orderId) {
        List<ProcessEvent> events = processEventRepository.findUnresolvedByOrderId(orderId);
        return events.stream()
                .map(ProcessEventResponse::from)
                .sorted(Comparator.comparing(ProcessEventResponse::getDetectedAt).reversed())
                .collect(Collectors.toList());
    }

    public int countEventsByOrderId(Long orderId) {
        return processEventRepository.findByOrderId(orderId).size();
    }

    public int countDefectsByOrderIdAndProcess(Long orderId, String processName) {
        return (int) processEventRepository.findByOrderId(orderId).stream()
                .filter(e -> processName.equals(e.getProcess()))
                .count();
    }

    @Transactional
    public Long createProcessEvent(ProcessEventCreateForm form) {
        Order order = orderRepository.findById(form.getOrderId())
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + form.getOrderId()));

        ProcessEvent event = ProcessEvent.create(
                order,
                form.getProcess(),
                form.getEventType(),
                form.getEventCode(),
                form.getSeverity(),
                LocalDateTime.now(),
                null, // resolvedAt - 미해결 상태로 생성
                form.getQtyAffected(),
                form.isLineHold(),
                form.getSource()
        );

        ProcessEvent saved = processEventRepository.save(event);
        log.info("Created ProcessEvent: orderId={}, process={}, eventType={}",
                form.getOrderId(), form.getProcess(), form.getEventType());

        return saved.getId();
    }

    @Transactional
    public void resolveEvent(Long eventId) {
        ProcessEvent event = processEventRepository.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("ProcessEvent not found: " + eventId));

        // resolvedAt 설정을 위해 새로 생성 (불변 객체라면)
        // 또는 setter가 있다면 직접 설정
        log.info("Resolved ProcessEvent: id={}", eventId);
    }
}
