package com.example.automobile_risk.controller;

import com.example.automobile_risk.controller.dto.OrderProductionAllocateForm;
import com.example.automobile_risk.service.OrderProductionService;
import com.example.automobile_risk.service.dto.OrderProductionDetailResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/order-productions")
@RestController
public class OrderProductionController {

    private final OrderProductionService orderProductionService;

    /**
     *  1. 생산에 주문 할당
     */
    @PostMapping("/allocate")
    public ApiResponse<Long> allocateOrderToProduction(@Valid @RequestBody OrderProductionAllocateForm form) {

        Long orderProductionId = orderProductionService.allocateOrderToProduction(form);

        return ApiResponse.of(orderProductionId);
    }

    /**
     *  2. 할당 해제
     *  Order와 Production 엔티티에 (orphanRemoval = true) 했기 때문에
     *  할당 해제되면 OrderProduction도 삭제된다.
     */
    @DeleteMapping("/{orderProductionId}")
    public ApiResponse<Long> deallocateOrderFromProduction(@PathVariable(name = "orderProductionId") Long orderProductionId) {

        Long findOrderProductionId = orderProductionService.deallocateOrderFromProduction(orderProductionId);

        return ApiResponse.of(findOrderProductionId);
    }

    /**
     *  3. 주문 기준 조회
     */
    @GetMapping("/order/{orderId}")
    public ApiResponse<List<OrderProductionDetailResponse>> getByOrder(@PathVariable(name = "orderId") Long orderId) {

        List<OrderProductionDetailResponse> orderProductionDetailResponseList = orderProductionService.getByOrder(orderId);

        return ApiResponse.of(orderProductionDetailResponseList);
    }

    /**
     *  4. 생산 기준 조회
     */
    @GetMapping("/production/{productionId}")
    public ApiResponse<List<OrderProductionDetailResponse>> getByProduction(@PathVariable(name = "productionId") Long productionId) {

        List<OrderProductionDetailResponse> orderProductionDetailResponseList = orderProductionService.getByProduction(productionId);

        return ApiResponse.of(orderProductionDetailResponseList);
    }

    /**
     *  4. 주문생산 단건 조회
     */
    @GetMapping("/{orderProductionId}")
    public ApiResponse<OrderProductionDetailResponse> getOrderProduction(@PathVariable(name = "orderProductionId") Long orderProductionId) {

        OrderProductionDetailResponse orderProductionDetailResponse = orderProductionService.getOrderProduction(orderProductionId);

        return ApiResponse.of(orderProductionDetailResponse);
    }

    /**
     *  5. 주문생산 목록 조회
     */
    @GetMapping
    public ApiResponse<List<OrderProductionDetailResponse>> getOrderProductionList() {

        List<OrderProductionDetailResponse> orderProductionList = orderProductionService.getOrderProductionList();

        return ApiResponse.of(orderProductionList);
    }
}
