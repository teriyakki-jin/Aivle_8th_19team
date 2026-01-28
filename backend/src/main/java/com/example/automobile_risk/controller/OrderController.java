package com.example.automobile_risk.controller;

import com.example.automobile_risk.controller.dto.OrderCreateForm;
import com.example.automobile_risk.controller.dto.OrderUpdateForm;
import com.example.automobile_risk.service.OrderService;
import com.example.automobile_risk.service.dto.OrderDetailResponse;
import com.example.automobile_risk.service.dto.OrderListResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/order")
@RestController
public class OrderController {

    private final OrderService orderService;

    /**
     *  1. 주문 생성
     */
    @PostMapping
    public ApiResponse<Long> createOrder(@Valid @RequestBody OrderCreateForm orderCreateForm) {

        Long orderId = orderService.createOrder(orderCreateForm);

        return ApiResponse.of(orderId);
    }

    /**
     *  2. 주문 수정
     */
    @PatchMapping("/{id}")
    public ApiResponse<Long> updateOrder(@PathVariable(name = "id") Long id,
                                         @Valid @RequestBody OrderUpdateForm orderUpdateForm) {

        Long orderId = orderService.updateOrder(id, orderUpdateForm);

        return ApiResponse.of(orderId);
    }

    /**
     *  3. 주문 취소
     */
    @PatchMapping("/{id}/cancel")
    public ApiResponse<Long> cancelOrder(@PathVariable(name = "id") Long id) {

        Long orderId = orderService.cancelOrder(id);

        return ApiResponse.of(orderId);
    }

    /**
     *  4. 생산 완료(주문 완료)
     *  자동 상태 관리가 아닌 관리자 수동 보정용
     */
    @PatchMapping("/{id}/complete")
    public ApiResponse<Long> completeOrder(@PathVariable(name = "id") Long id) {
        return ApiResponse.of(orderService.completeOrder(id));
    }

    /**
     *  4. 주문 단건 조회
     */
    @GetMapping("/{id}")
    public ApiResponse<OrderDetailResponse> getOrder(@PathVariable(name = "id") Long id) {

        OrderDetailResponse orderDetailResponse = orderService.getOrder(id);

        return ApiResponse.of(orderDetailResponse);
    }

    /**
     *  5. 주문 목록 조회
     */
    @GetMapping
    public ApiResponse<List<OrderListResponse>> getOrderList() {

        List<OrderListResponse> orderListResponseList = orderService.getOrderList();

        return ApiResponse.of(orderListResponseList);
    }
}
