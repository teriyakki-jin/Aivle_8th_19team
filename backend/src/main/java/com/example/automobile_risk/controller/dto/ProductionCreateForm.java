package com.example.automobile_risk.controller.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductionCreateForm {

    @NotNull
    private LocalDateTime startDate;
    @PositiveOrZero
    private int plannedQty;
    @NotNull
    private Long vehicleModelId;
}
