package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.OrderProduction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderProductionDetailResponse {

    private Long orderProductionId;
    private int allocatedQty;
    private Long orderId;
    private Long productionId;

    // Entity -> Dto
    public static OrderProductionDetailResponse from(OrderProduction orderProduction) {
        return OrderProductionDetailResponse.builder()
                .orderProductionId(orderProduction.getId())
                .allocatedQty(orderProduction.getAllocatedQty())
                .orderId(orderProduction.getOrder().getId())
                .productionId(orderProduction.getProduction().getId())
                .build();
    }
}
