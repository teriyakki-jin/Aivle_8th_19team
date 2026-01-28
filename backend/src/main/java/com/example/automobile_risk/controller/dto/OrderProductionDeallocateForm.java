package com.example.automobile_risk.controller.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderProductionDeallocateForm {

    @NotNull
    private Long orderProductionId;
    @NotNull
    private Long orderId;
    @NotNull
    private Long productionId;
    @NotNull
    private int allocatedQty;
}
