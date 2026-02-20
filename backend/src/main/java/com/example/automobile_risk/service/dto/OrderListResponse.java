package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.enumclass.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderListResponse {

    private Long orderId;
    private LocalDateTime orderDate;
    private LocalDateTime dueDate;
    private OrderStatus orderStatus;
    private int orderQty;
    private Long vehicleModelId;
    private String vehicleModelName;

    // Entity -> Dto
    public static OrderListResponse from(Order order) {
        return OrderListResponse.builder()
                .orderId(order.getId())
                .orderDate(order.getOrderDate())
                .dueDate(order.getDueDate())
                .orderStatus(order.getOrderStatus())
                .orderQty(order.getOrderQty())
                .vehicleModelId(order.getVehicleModel().getId())
                .vehicleModelName(order.getVehicleModel().getModelName())
                .build();
    }
}
