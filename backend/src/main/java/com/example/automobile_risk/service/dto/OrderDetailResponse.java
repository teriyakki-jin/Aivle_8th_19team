package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.enumclass.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderDetailResponse {

    private Long orderId;
    private LocalDateTime orderDate;
    private LocalDateTime dueDate;
    private OrderStatus orderStatus;
    private int orderQty;
    private Long vehicleModelId;
    private String vehicleModelName;
    @Builder.Default
    private List<OrderProductionDetailResponse> orderProductionList = new ArrayList<>();

    // Entity -> Dto
    public static OrderDetailResponse from(Order order) {
        return OrderDetailResponse.builder()
                .orderId(order.getId())
                .orderDate(order.getOrderDate())
                .dueDate(order.getDueDate())
                .orderStatus(order.getOrderStatus())
                .orderQty(order.getOrderQty())
                .vehicleModelId(order.getVehicleModel().getId())
                .vehicleModelName(order.getVehicleModel().getModelName())
                .orderProductionList(
                        order.getOrderProductionList().stream()
                                .map(OrderProductionDetailResponse::from)
                                .toList()
                )
                .build();
    }
}
