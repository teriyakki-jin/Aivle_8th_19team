package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.DueDatePrediction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DueDatePredictionRepository extends JpaRepository<DueDatePrediction, Long> {
    List<DueDatePrediction> findAllByOrderByIdDesc();
}
