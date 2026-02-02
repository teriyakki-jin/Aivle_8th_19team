package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByPartId(Long partId);
}
