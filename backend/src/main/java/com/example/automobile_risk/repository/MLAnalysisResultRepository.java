package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.MLAnalysisResult;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MLAnalysisResultRepository extends JpaRepository<MLAnalysisResult, Long> {

    /**
     * 서비스 타입별 결과 조회
     */
    List<MLAnalysisResult> findByServiceTypeOrderByCreatedDateDesc(String serviceType);

    /**
     * 서비스 타입과 상태별 결과 조회
     */
    List<MLAnalysisResult> findByServiceTypeAndStatusOrderByCreatedDateDesc(String serviceType, String status);

    /**
     * 최근 N개 결과 조회
     */
    List<MLAnalysisResult> findTop10ByServiceTypeOrderByCreatedDateDesc(String serviceType);

    @Query("""
            select r from MLAnalysisResult r
            where (:orderId is null or r.orderId = :orderId)
              and (:serviceType is null or r.serviceType = :serviceType)
              and (:processName is null or r.processName = :processName)
            order by r.createdDate desc
            """)
    List<MLAnalysisResult> findRecent(
            @Param("orderId") Long orderId,
            @Param("serviceType") String serviceType,
            @Param("processName") String processName,
            Pageable pageable
    );
}
