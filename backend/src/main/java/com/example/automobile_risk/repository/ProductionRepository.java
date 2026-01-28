package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.Production;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionRepository extends JpaRepository<Production, Long> {
}
