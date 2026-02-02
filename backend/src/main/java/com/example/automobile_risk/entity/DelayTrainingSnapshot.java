package com.example.automobile_risk.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
public class DelayTrainingSnapshot {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orderId;
    private Long productionId;

    private LocalDateTime orderDate;
    private LocalDateTime dueDate;
    private LocalDateTime productionStart;
    private LocalDateTime productionEnd;

    // ====== Features (예시) ======
    private int orderQty;

    private double pressAnomalyScore;
    private double weldAnomalyScore;
    private double assemblyAnomalyScore;
    private double paintAnomalyScore;
    private double inspectionAnomalyScore;

    private int stopCountTotal;
    private long totalDurationMinutes;

    // ====== Labels ======
    private int delayFlag;          // 0/1
    private long delayMinutes;      // 0 이상

    public static DelayTrainingSnapshot of(
            Long orderId, Long productionId,
            LocalDateTime orderDate, LocalDateTime dueDate,
            LocalDateTime productionStart, LocalDateTime productionEnd,
            int orderQty,
            double press, double weld, double assembly, double paint, double inspection,
            int stopCountTotal,
            long totalDurationMinutes
    ) {
        long delayMin = Math.max(0,
                java.time.Duration.between(dueDate, productionEnd).toMinutes()
        );
        int delayFlag = delayMin > 0 ? 1 : 0;

        return DelayTrainingSnapshot.builder()
                .orderId(orderId)
                .productionId(productionId)
                .orderDate(orderDate)
                .dueDate(dueDate)
                .productionStart(productionStart)
                .productionEnd(productionEnd)
                .orderQty(orderQty)
                .pressAnomalyScore(press)
                .weldAnomalyScore(weld)
                .assemblyAnomalyScore(assembly)
                .paintAnomalyScore(paint)
                .inspectionAnomalyScore(inspection)
                .stopCountTotal(stopCountTotal)
                .totalDurationMinutes(totalDurationMinutes)
                .delayFlag(delayFlag)
                .delayMinutes(delayMin)
                .build();
    }
}

