package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.MlInputDataset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MlInputDatasetRepository extends JpaRepository<MlInputDataset, Long> {
    List<MlInputDataset> findByProcessNameOrderByCreatedDateDesc(String processName);
    List<MlInputDataset> findByProcessNameAndServiceTypeOrderByCreatedDateDesc(String processName, String serviceType);
}
