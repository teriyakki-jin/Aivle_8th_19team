package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.RiskLevel;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "dashboard_prediction_snapshot")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardPredictionSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private double predDelayMinH;
    private double predDelayMaxH;

    @Enumerated(EnumType.STRING)
    private RiskLevel riskLevel;

    @Column(columnDefinition = "TEXT")
    private String contributionsJson;

    @Column(columnDefinition = "TEXT")
    private String sourcesJson;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    private LocalDateTime createdAt;

    public static DashboardPredictionSnapshot create(
            double delayMinH,
            double delayMaxH,
            RiskLevel riskLevel,
            String contributionsJson,
            String sourcesJson,
            String metadata
    ) {
        return DashboardPredictionSnapshot.builder()
                .predDelayMinH(delayMinH)
                .predDelayMaxH(delayMaxH)
                .riskLevel(riskLevel)
                .contributionsJson(contributionsJson)
                .sourcesJson(sourcesJson)
                .metadata(metadata)
                .createdAt(LocalDateTime.now())
                .build();
    }
}
