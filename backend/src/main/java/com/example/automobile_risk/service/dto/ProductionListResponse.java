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

    // Entity -> Dto
    public static ProductionListResponse from(Production production) {
        return ProductionListResponse.builder()
                .productionId(production.getId())
                .startDate(production.getStartDate())
                .endDate(production.getEndDate())
                .productionStatus(production.getProductionStatus())
                .build();
    }
}
