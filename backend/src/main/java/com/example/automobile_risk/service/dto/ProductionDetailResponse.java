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
    @Builder.Default
    private List<OrderProductionDetailResponse> orderProductionList = new ArrayList<>();

    // Entity -> Dto
    public static ProductionDetailResponse from(Production production) {
        return ProductionDetailResponse.builder()
                .productionId(production.getId())
                .startDate(production.getStartDate())
                .endDate(production.getEndDate())
                .productionStatus(production.getProductionStatus())
                .orderProductionList(
                        production.getOrderProductionList().stream()
                                .map(OrderProductionDetailResponse::from)
                                .toList()
                )
                .build();
    }
}
