package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.ProductionDatasetMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

@Repository
public interface ProductionDatasetMappingRepository extends JpaRepository<ProductionDatasetMapping, Long> {
    Optional<ProductionDatasetMapping> findByProductionIdAndProcessName(Long productionId, String processName);
    Optional<ProductionDatasetMapping> findByProductionIdAndProcessNameAndServiceType(
            Long productionId,
            String processName,
            String serviceType
    );

    @Query("""
            select m from ProductionDatasetMapping m
            join fetch m.dataset d
            where m.production.id = :productionId
              and m.processName = :processName
              and m.serviceType = :serviceType
            """)
    Optional<ProductionDatasetMapping> findByProductionIdAndProcessNameWithDataset(
            @Param("productionId") Long productionId,
            @Param("processName") String processName,
            @Param("serviceType") String serviceType
    );
}
