package com.example.automobile_risk.service;

import com.example.automobile_risk.controller.dto.OrderCreateForm;
import com.example.automobile_risk.controller.dto.OrderUpdateForm;
import com.example.automobile_risk.dto.DashboardPredictionDto;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.ProcessEvent;
import com.example.automobile_risk.entity.VehicleModel;
import com.example.automobile_risk.entity.enumclass.EventSource;
import com.example.automobile_risk.entity.enumclass.EventType;
import com.example.automobile_risk.entity.enumclass.OrderStatus;
import com.example.automobile_risk.exception.OrderNotFoundException;
import com.example.automobile_risk.exception.VehicleModelNotFoundException;
import com.example.automobile_risk.repository.OrderProductionRepository;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.ProcessEventRepository;
import com.example.automobile_risk.repository.VehicleModelRepository;
import com.example.automobile_risk.service.dto.OrderDetailResponse;
import com.example.automobile_risk.service.dto.OrderListResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final OrderProductionRepository orderProductionRepository;
    private final ProcessEventRepository processEventRepository;
    private final MlOrchestrationService mlOrchestrationService;
    private final DefectDelayRuleEngine defectDelayRuleEngine;

    // ML eventCode → DelayRule eventCode mapping
    private static final Map<String, String> PROCESS_EVENT_CODE_MAP = Map.of(
            "press_vibration", "press_major",
            "press_image",     "press_minor",
            "paint",           "paint_orange_peel",
            "welding",         "welding_crack",
            "windshield",      "windshield_crack",
            "engine",          "engine_vibration",
            "body_inspect",    "body_gap"
    );

    private static final Map<String, String> PROCESS_NAME_MAP = Map.of(
            "press_vibration", "press",
            "press_image",     "press",
            "paint",           "paint",
            "welding",         "welding",
            "windshield",      "windshield",
            "engine",          "engine",
            "body_inspect",    "body"
    );

    /**
     *  1. 주문 생성
     *  ML 엔드포인트를 호출하여 공정별 결함/이상을 감지하고,
     *  결과를 ProcessEvent로 생성하여 대시보드에 반영합니다.
     */
    @Transactional
    public Long createOrder(OrderCreateForm orderCreateForm) {

        Long vehicleModelId = orderCreateForm.getVehicleModelId();
        VehicleModel vehicleModel = vehicleModelRepository.findById(vehicleModelId)
                .orElseThrow(() -> new VehicleModelNotFoundException(vehicleModelId));

        Order order = Order.createOrder(
                orderCreateForm.getOrderDate(),
                orderCreateForm.getDueDate(),
                orderCreateForm.getOrderQty(),
                vehicleModel
        );

        Order savedOrder = orderRepository.save(order);

        // ML 기반 공정 이벤트 자동 생성
        generateProcessEventsFromMl(savedOrder);

        return savedOrder.getId();
    }

    /**
     *  ML 엔드포인트 호출 → 결함 감지 시 ProcessEvent 생성
     */
    private void generateProcessEventsFromMl(Order order) {
        try {
            MlOrchestrationService.OrchestrationResult orchResult =
                    mlOrchestrationService.callAllEndpoints();

            DefectDelayRuleEngine.ProcessedPrediction prediction =
                    defectDelayRuleEngine.evaluate(orchResult.getResults());

            for (DashboardPredictionDto.ProcessContribution contrib : prediction.getContributions()) {
                String processName = PROCESS_NAME_MAP.getOrDefault(contrib.getProcess(), contrib.getProcess());
                String eventCode = PROCESS_EVENT_CODE_MAP.getOrDefault(contrib.getProcess(), contrib.getProcess() + "_defect");

                // severity: delayMaxH 기반 (>=24h→3, >=12h→2, else→1)
                int severity = contrib.getDelayMaxH() >= 24 ? 3
                             : contrib.getDelayMaxH() >= 12 ? 2 : 1;

                boolean lineHold = severity >= 3;

                ProcessEvent event = ProcessEvent.create(
                        order,
                        processName,
                        EventType.DEFECT,
                        eventCode,
                        severity,
                        LocalDateTime.now(),
                        null, // unresolved
                        order.getOrderQty(),
                        lineHold,
                        EventSource.VISION
                );
                processEventRepository.save(event);
            }

            if (!prediction.getContributions().isEmpty()) {
                log.info("Order {} : {} ProcessEvents created from ML prediction",
                        order.getId(), prediction.getContributions().size());
            }
        } catch (Exception e) {
            log.warn("Failed to generate ML-based ProcessEvents for order {}: {}",
                    order.getId(), e.getMessage());
            // 주문 생성 자체는 실패하지 않도록 예외를 삼킴
        }
    }

    /**
     *  2. 주문 수정
     */
    @Transactional
    public Long updateOrder(Long id, OrderUpdateForm orderUpdateForm) {

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));

        // 수정 (변경 감지)
        order.changeOrderInfo(
                orderUpdateForm.getOrderDate(),
                orderUpdateForm.getDueDate(),
                orderUpdateForm.getOrderQty()
        );

        return order.getId();
    }

    /**
     *  3. 주문 취소
     */
    @Transactional
    public Long cancelOrder(Long orderId) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));

        order.cancel();

        return order.getId();
    }

    /**
     *  4. 생산 완료
     *  Production 완료(COMPLETE) 이후에 호출한다.
     */
    @Transactional
    public Long completeOrder(Long orderId) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));

        order.complete();

        return order.getId();
    }

    /**
     *  5. 주문 단건 조회
     */
    public OrderDetailResponse getOrder(Long orderId) {

        return orderRepository.findById(orderId)
                .map(OrderDetailResponse::from)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    /**
     *  6. 주문 목록 조회
     */
    public List<OrderListResponse> getOrderList() {

        List<Order> orderList = orderRepository.findAll();

        return orderList.stream()
                .map(OrderListResponse::from)
                .collect(Collectors.toList());
    }

    /**
     *  생산 id로 주문 id 찾기
     */
    public List<Long> findRelatedOrderIdsByProduction(Long productionId) {
        return orderProductionRepository
                .findRelatedOrderIdsByProduction(productionId);
    }

    /**
     *  주문 완료 시도
     */
    @Transactional
    public void tryCompleteOrder(Long orderId) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));

        // 이미 완료/취소된 주문은 무시
        if (order.getOrderStatus() == OrderStatus.COMPLETED
                || order.getOrderStatus() == OrderStatus.CANCELLED) {
            return;
        }

        // 모든 생산이 완료된 경우만 완료 처리
        if (order.isAllProductionCompleted()) {
            order.complete();
        }
    }
}
