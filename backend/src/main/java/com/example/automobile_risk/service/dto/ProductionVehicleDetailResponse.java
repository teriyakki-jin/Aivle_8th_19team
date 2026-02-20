package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.ProductionVehicle;
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
public class ProductionVehicleDetailResponse {

    private Long productionVehicleId;
    private String serialNumber;
    private LocalDateTime completedAt;
    private Long productionId;
    private ProductionStatus productionStatus;

    // Entity -> Dto
    public static ProductionVehicleDetailResponse from(ProductionVehicle productionVehicle) {
        return ProductionVehicleDetailResponse.builder()
                .productionVehicleId(productionVehicle.getId())
                .serialNumber(productionVehicle.getSerialNumber())
                .completedAt(productionVehicle.getCompletedAt())
                .productionId(productionVehicle.getProduction().getId())
                .productionStatus(productionVehicle.getProduction().getProductionStatus())
                .build();
    }
}
