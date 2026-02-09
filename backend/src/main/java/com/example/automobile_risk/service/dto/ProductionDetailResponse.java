package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
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
public class ProductionDetailResponse {

    private Long productionId;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private ProductionStatus productionStatus;
    private Integer plannedQty;
    private Long vehicleModelId;
    private String vehicleModelName;
    private Long orderId;
    private Integer orderQty;
    private LocalDateTime dueDate;
    @Builder.Default
    private List<OrderProductionDetailResponse> orderProductionList = new ArrayList<>();

    // Entity -> Dto
    public static ProductionDetailResponse from(Production production) {
        var orderProductionList = production.getOrderProductionList();
        var order = (orderProductionList != null && !orderProductionList.isEmpty())
                ? orderProductionList.get(0).getOrder()
                : null;
        return ProductionDetailResponse.builder()
                .productionId(production.getId())
                .startDate(production.getStartDate())
                .endDate(production.getEndDate())
                .productionStatus(production.getProductionStatus())
                .plannedQty(production.getPlannedQty())
                .vehicleModelId(production.getVehicleModel() != null ? production.getVehicleModel().getId() : null)
                .vehicleModelName(production.getVehicleModel() != null ? production.getVehicleModel().getModelName() : null)
                .orderId(order != null ? order.getId() : null)
                .orderQty(order != null ? order.getOrderQty() : null)
                .dueDate(order != null ? order.getDueDate() : null)
                .orderProductionList(
                        production.getOrderProductionList().stream()
                                .map(OrderProductionDetailResponse::from)
                                .toList()
                )
                .build();
    }
}
