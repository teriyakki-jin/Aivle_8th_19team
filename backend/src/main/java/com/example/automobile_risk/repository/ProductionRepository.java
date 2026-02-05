package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductionRepository extends JpaRepository<Production, Long> {

    List<Production> findByProductionStatusOrderByEndDateDesc(ProductionStatus status);

    @Query("""
        SELECT DISTINCT p FROM Production p
        LEFT JOIN FETCH p.vehicleModel
        LEFT JOIN FETCH p.orderProductionList op
        LEFT JOIN FETCH op.order
        WHERE p.productionStatus = :status
        ORDER BY p.endDate DESC
    """)
    List<Production> findCompletedWithDetails(@Param("status") ProductionStatus status);
}
