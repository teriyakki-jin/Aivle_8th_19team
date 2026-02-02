package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.InventoryHistory;
import com.example.automobile_risk.entity.enumclass.InventoryChangeType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryHistoryResponse {

    private Long id;
    private int changeQty;
    private int afterQty;
    private InventoryChangeType changeType;
    private LocalDateTime occuredAt;

    public static InventoryHistoryResponse from(InventoryHistory h) {
        return InventoryHistoryResponse.builder()
                .id(h.getId())
                .changeQty(h.getChangeQty())
                .afterQty(h.getAfterQty())
                .changeType(h.getChangeType())
                .occuredAt(h.getOccuredAt())
                .build();
    }
}
