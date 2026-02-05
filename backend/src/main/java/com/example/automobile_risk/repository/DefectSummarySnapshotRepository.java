package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.DefectSummarySnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DefectSummarySnapshotRepository extends JpaRepository<DefectSummarySnapshot, Long> {

    List<DefectSummarySnapshot> findAllByOrderByCapturedAtDesc();

    List<DefectSummarySnapshot> findByProductionIdOrderByCapturedAtDesc(Long productionId);
}
