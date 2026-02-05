package com.example.automobile_risk.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "due_date_predictions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DueDatePrediction extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orderId;

    private Integer orderQty;

    @Column(length = 50)
    private String snapshotStage;

    private Double stopCountTotal;
    private Double elapsedMinutes;
    private Double remainingSlackMinutes;

    private Double pressAnomalyScore;
    private Double weldAnomalyScore;
    private Double paintAnomalyScore;
    private Double assemblyAnomalyScore;
    private Double inspectionAnomalyScore;

    private Integer delayFlag;
    private Double delayProbability;
    private Double predictedDelayMinutes;

    @Column(columnDefinition = "TEXT")
    private String requestJson;

    @Column(columnDefinition = "TEXT")
    private String responseJson;
}
