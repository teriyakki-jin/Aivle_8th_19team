package com.example.automobile_risk.service;

import com.example.automobile_risk.controller.dto.OrderCreateForm;
import com.example.automobile_risk.controller.dto.OrderUpdateForm;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.VehicleModel;
import com.example.automobile_risk.entity.enumclass.OrderStatus;
import com.example.automobile_risk.exception.OrderNotFoundException;
import com.example.automobile_risk.exception.VehicleModelNotFoundException;
import com.example.automobile_risk.repository.OrderProductionRepository;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.VehicleModelRepository;
import com.example.automobile_risk.service.dto.OrderDetailResponse;
import com.example.automobile_risk.service.dto.OrderListResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final OrderProductionRepository orderProductionRepository;

    /**
     *  1. 주문 생성
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

        return savedOrder.getId();
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
