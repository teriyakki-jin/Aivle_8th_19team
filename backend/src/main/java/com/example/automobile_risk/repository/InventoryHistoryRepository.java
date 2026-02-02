package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.InventoryHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryHistoryRepository extends JpaRepository<InventoryHistory, Long> {

    List<InventoryHistory> findByPartIdOrderByOccuredAtDesc(Long partId);
}
