package com.example.automobile_risk.service;

import com.example.automobile_risk.controller.dto.OrderProductionAllocateForm;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.OrderProduction;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.exception.OrderNotFoundException;
import com.example.automobile_risk.exception.OrderProductionNotFoundException;
import com.example.automobile_risk.exception.ProductionNotFoundException;
import com.example.automobile_risk.repository.OrderProductionRepository;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import com.example.automobile_risk.service.dto.OrderProductionDetailResponse;
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
public class OrderProductionService {

    private final OrderProductionRepository orderProductionRepository;
    private final OrderRepository orderRepository;
    private final ProductionRepository productionRepository;

    /**
     *  1. 생산에 주문 할당
     */
    @Transactional
    public Long allocateOrderToProduction(OrderProductionAllocateForm form) {

        Order order = orderRepository.findById(form.getOrderId())
                .orElseThrow(() -> new OrderNotFoundException(form.getOrderId()));

        Production production = productionRepository.findById(form.getProductionId())
                .orElseThrow(() -> new ProductionNotFoundException(form.getProductionId()));

        OrderProduction orderProduction = OrderProduction.createOrderProduction(order, production, form.getAllocatedQty());

//        order.addOrderProduction(orderProduction);
//        production.addOrderProduction(orderProduction);

        log.info("Allocate order {} to production {} qty={}",
                order.getId(), production.getId(), form.getAllocatedQty());

        OrderProduction savedOrderProduction = orderProductionRepository.save(orderProduction);

        return savedOrderProduction.getId();
    }

    /**
     *  2. 할당 해제
     *  Order와 Production 엔티티에 (orphanRemoval = true) 했기 때문에
     *  할당 해제되면 OrderProduction도 삭제된다.
     */
    @Transactional
    public Long deallocateOrderFromProduction(Long orderProductionId) {

        OrderProduction orderProduction = orderProductionRepository.findById(orderProductionId)
                .orElseThrow(() -> new OrderProductionNotFoundException(orderProductionId));

        orderProduction.getOrder().removeOrderProduction(orderProduction);
        orderProduction.getProduction().removeOrderProduction(orderProduction);

        return orderProduction.getId();
    }

    /**
     *  3. 주문 기준 조회
     */
    public List<OrderProductionDetailResponse> getByOrder(Long orderId) {
        return orderProductionRepository.findByOrderId(orderId)
                .stream()
                .map(OrderProductionDetailResponse::from)
                .toList();
    }

    /**
     *  4. 생산 기준 조회
     */
    public List<OrderProductionDetailResponse> getByProduction(Long productionId) {
        return orderProductionRepository.findWithOrderByProductionId(productionId)
                .stream()
                .map(OrderProductionDetailResponse::from)
                .toList();
    }

    /**
     *  5. 주문생산 단건 조회
     */
    public OrderProductionDetailResponse getOrderProduction(Long orderProductionId) {

        return orderProductionRepository.findById(orderProductionId)
                .map(OrderProductionDetailResponse::from)
                .orElseThrow(() -> new OrderProductionNotFoundException(orderProductionId));
    }

    /**
     *  6. 주문생산 목록 조회
     */
    public List<OrderProductionDetailResponse> getOrderProductionList() {

        List<OrderProduction> orderProductionList = orderProductionRepository.findAll();

        return orderProductionList.stream()
                .map(OrderProductionDetailResponse::from)
                .collect(Collectors.toList());
    }
}
