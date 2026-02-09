package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.Inventory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryResponse {

    private Long inventoryId;
    private Long partId;
    private String partName;
    private int currentQty;
    private int safetyQty;

    // Entity -> Dto
    public static InventoryResponse from(Inventory inventory) {
        return InventoryResponse.builder()
                .inventoryId(inventory.getId())
                .partId(inventory.getPart().getId())
                .partName(inventory.getPart().getPartName())
                .currentQty(inventory.getCurrentQty())
                .safetyQty(inventory.getSafetyQty())
                .build();
    }
}
