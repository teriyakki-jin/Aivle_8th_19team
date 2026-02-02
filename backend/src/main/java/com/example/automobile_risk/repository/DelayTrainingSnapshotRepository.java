package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.DelayTrainingSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DelayTrainingSnapshotRepository extends JpaRepository<DelayTrainingSnapshot, Long> {
}
