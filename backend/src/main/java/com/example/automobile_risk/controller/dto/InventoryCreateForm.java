package com.example.automobile_risk.controller.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryCreateForm {

    @NotNull
    private Long partId;

    @PositiveOrZero
    private int initialQty;

    @PositiveOrZero
    private int safetyQty;
}
