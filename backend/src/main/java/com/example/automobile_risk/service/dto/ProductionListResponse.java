package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductionListResponse {

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

    // Entity -> Dto
    public static ProductionListResponse from(Production production) {
        var orderProductionList = production.getOrderProductionList();
        var order = (orderProductionList != null && !orderProductionList.isEmpty())
                ? orderProductionList.get(0).getOrder()
                : null;
        return ProductionListResponse.builder()
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
                .build();
    }
}
