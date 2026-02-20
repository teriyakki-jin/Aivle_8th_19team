package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.DashboardPredictionSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DashboardPredictionSnapshotRepository extends JpaRepository<DashboardPredictionSnapshot, Long> {

    List<DashboardPredictionSnapshot> findTop20ByOrderByCreatedAtDesc();
}
