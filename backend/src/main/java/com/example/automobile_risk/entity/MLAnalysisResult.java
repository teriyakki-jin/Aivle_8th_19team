package com.example.automobile_risk.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "ml_analysis_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MLAnalysisResult extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * ML 서비스 타입: windshield, engine, welding, paint, press_vibration, press_image, body
     */
    @Column(nullable = false, length = 50)
    private String serviceType;

    /**
     * 분석 결과 상태: NORMAL, ABNORMAL, PASS, FAIL, DEFECT 등
     */
    @Column(nullable = false, length = 50)
    private String status;

    /**
     * 예측 값 (0, 1 등)
     */
    private Integer prediction;

    /**
     * 신뢰도 점수
     */
    private Double confidence;

    /**
     * 재구성 에러 (오토인코더용)
     */
    private Double reconstructionError;

    /**
     * 임계값
     */
    private Double threshold;

    /**
     * 이상 여부 (0: 정상, 1: 이상)
     */
    private Integer isAnomaly;

    /**
     * 원본 이미지 URL
     */
    @Column(length = 500)
    private String originalImageUrl;

    /**
     * 결과 이미지 URL
     */
    @Column(length = 500)
    private String resultImageUrl;

    /**
     * 추가 정보 (JSON 형태)
     */
    @Column(columnDefinition = "TEXT")
    private String additionalInfo;

    /**
     * 분석 시간 (밀리초)
     */
    private Long inferenceTimeMs;

    /**
     * 분석 대상 (부품명, 측면 등)
     */
    @Column(length = 100)
    private String target;

    /**
     * 결과 메시지
     */
    @Column(length = 500)
    private String message;
}
