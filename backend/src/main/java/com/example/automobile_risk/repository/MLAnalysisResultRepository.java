package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.MLAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
