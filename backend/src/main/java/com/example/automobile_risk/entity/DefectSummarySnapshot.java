package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.DefectSnapshotStage;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Table(name = "defect_summary_snapshots")
@Entity
public class DefectSummarySnapshot extends BaseTimeEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "defect_summary_snapshot_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_id")
    private Production production;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Enumerated(EnumType.STRING)
    private DefectSnapshotStage stage;

    private LocalDateTime capturedAt;

    private int totalDefectCount;

    private String overallStatus;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String processSummariesJson;

    public static DefectSummarySnapshot create(
            Production production,
            Order order,
            DefectSnapshotStage stage,
            LocalDateTime capturedAt,
            int totalDefectCount,
            String overallStatus,
            String processSummariesJson
    ) {
        return DefectSummarySnapshot.builder()
                .production(production)
                .order(order)
                .stage(stage)
                .capturedAt(capturedAt)
                .totalDefectCount(totalDefectCount)
                .overallStatus(overallStatus)
                .processSummariesJson(processSummariesJson)
                .build();
    }
}
