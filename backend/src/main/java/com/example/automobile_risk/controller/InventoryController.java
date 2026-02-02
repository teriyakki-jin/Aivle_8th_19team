package com.example.automobile_risk.controller;

import com.example.automobile_risk.controller.dto.InventoryAdjustForm;
import com.example.automobile_risk.controller.dto.InventoryCreateForm;
import com.example.automobile_risk.service.InventoryService;
import com.example.automobile_risk.service.dto.InventoryHistoryResponse;
import com.example.automobile_risk.service.dto.InventoryResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/inventory")
@RestController
public class InventoryController {

    private final InventoryService inventoryService;

    /**
     *  1. 재고 생성
     */
    @PostMapping
    public ApiResponse<Long> createEquipment(@Valid @RequestBody InventoryCreateForm form) {

        return ApiResponse.of(inventoryService.create(form));
    }

    /**
     *  2. 재고 증감
     */
    @PostMapping("/adjust")
    public ApiResponse<Long> updateEquipment(@Valid @RequestBody InventoryAdjustForm form) {

        inventoryService.adjustInventory(form);

        return ApiResponse.of(form.getPartId());
    }

    /**
     *  3. 재고 조회
     */
    @GetMapping("/{partId}")
    public ApiResponse<InventoryResponse> get(@PathVariable Long partId) {
        return ApiResponse.of(inventoryService.getInventory(partId));
    }

    /**
     *  4. 재고 이력 조회
     */
    @GetMapping("/{partId}/history")
    public ApiResponse<List<InventoryHistoryResponse>> history(@PathVariable Long partId) {
        return ApiResponse.of(inventoryService.getHistory(partId));
    }
}
