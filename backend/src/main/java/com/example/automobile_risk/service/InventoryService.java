package com.example.automobile_risk.service;

import com.example.automobile_risk.controller.dto.InventoryAdjustForm;
import com.example.automobile_risk.controller.dto.InventoryCreateForm;
import com.example.automobile_risk.entity.Inventory;
import com.example.automobile_risk.entity.InventoryHistory;
import com.example.automobile_risk.entity.Part;
import com.example.automobile_risk.entity.enumclass.InventoryChangeType;
import com.example.automobile_risk.exception.PartNotFoundException;
import com.example.automobile_risk.repository.InventoryHistoryRepository;
import com.example.automobile_risk.repository.InventoryRepository;
import com.example.automobile_risk.repository.PartRepository;
import com.example.automobile_risk.service.dto.InventoryHistoryResponse;
import com.example.automobile_risk.service.dto.InventoryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventoryHistoryRepository inventoryHistoryRepository;
    private final PartRepository partRepository;

    /**
     *  1. 재고 생성
     */
    @Transactional
    public Long create(InventoryCreateForm form) {

        Long partId = form.getPartId();
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new PartNotFoundException(partId));

        Inventory inventory = Inventory.of(part, form.getInitialQty());
        Inventory savedInventory = inventoryRepository.save(inventory);

        InventoryHistory inventoryHistory = InventoryHistory.of(
                part,
                form.getInitialQty(),
                inventory.getCurrentQty(),
                LocalDateTime.now(),
                InventoryChangeType.IN
        );

        inventoryHistoryRepository.save(inventoryHistory);

        return savedInventory.getId();
    }

    /**
     *  2. 재고 증감
     */
    @Transactional
    public void adjustInventory(InventoryAdjustForm form) {

        Inventory inventory = inventoryRepository.findByPartId(form.getPartId())
                .orElseThrow(() -> new IllegalStateException("재고가 존재하지 않습니다."));

        inventory.adjust(form.getQty());

        InventoryHistory history = InventoryHistory.of(
                inventory.getPart(),
                form.getQty(),
                inventory.getCurrentQty(),
                LocalDateTime.now(),
                form.getChangeType()
        );

        inventoryHistoryRepository.save(history);
    }

    /**
     *  재고 단건 조회
     */
    public InventoryResponse getInventory(Long partId) {

        Inventory inventory = inventoryRepository.findByPartId(partId)
                .orElseThrow(() -> new IllegalStateException("재고가 존재하지 않습니다."));

        return InventoryResponse.from(inventory);
    }

    /**
     *  재고 이력 조회
     */
    public List<InventoryHistoryResponse> getHistory(Long partId) {

        return inventoryHistoryRepository.findByPartIdOrderByOccuredAtDesc(partId)
                .stream()
                .map(InventoryHistoryResponse::from)
                .toList();
    }
}
