package com.example.automobile_risk.controller.dto;

import com.example.automobile_risk.entity.enumclass.InventoryChangeType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryAdjustForm {

    @NotNull
    private Long partId;

    @NotNull
    private int qty;    // +입고 / -출고

    @NotNull
    private InventoryChangeType changeType;

    private String remark;
}
