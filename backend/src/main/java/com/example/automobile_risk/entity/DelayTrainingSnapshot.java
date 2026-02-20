package com.example.automobile_risk.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.*;

import java.time.LocalDateTime;

/**
 * DelayTrainingSnapshot
 *
 * [정공법 설계 핵심]
 * - Production 1건당 Snapshot N건 (공정 종료 시점마다 1건)
 * - 각 Snapshot은 "현재 시점 상태"를 표현
 * - Stage2 회귀 타깃은
 *   → "현재 시점 기준 앞으로 남은 지연 시간"
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
public class DelayTrainingSnapshot {

    // =====================================================
    // PK
    // =====================================================
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // =====================================================
    // 식별자 (JOIN / grouping 용)
    // =====================================================
    private Long orderId;
    private Long productionId;

    // =====================================================
    // Snapshot 시점 정보 (🔥 핵심)
    // =====================================================

    /**
     * 현재 snapshot이 찍힌 공정 단계
     * 예: PRESS_DONE / WELD_DONE / PAINT_DONE / ASSEMBLY_DONE / INSPECTION_DONE
     */
    private String snapshotStage;

    /**
     * snapshot 시점 (= 해당 공정 종료 시점)
     */
    private LocalDateTime snapshotTime;

    // =====================================================
    // 주문 / 납기 기준 시간
    // =====================================================
    private LocalDateTime orderDate;
    private LocalDateTime dueDate;

    // =====================================================
    // 시간 기반 Feature (현재 시점 기준)
    // =====================================================

    /**
     * 생산 시작 시점
     * - elapsedMinutes 계산 기준
     */
    private LocalDateTime productionStart;

    /**
     * 생산 시작 ~ snapshot 시점까지 경과 시간(분)
     * → 공정 진행률 feature
     */
    private long elapsedMinutes;

    /**
     * snapshot 시점 기준 남은 납기 여유 시간(분)
     * - 음수면 이미 납기 초과 상태
     */
    private long remainingSlackMinutes;

    // =====================================================
    // 주문 / 수량 Feature
    // =====================================================
    private int orderQty;

    // =====================================================
    // 공정 이상(anomaly) Feature
    // - 누적 or stage-aware feature로 사용
    // - "미래 공정은 null"을 표현하려면 Double 사용이 필요
    // =====================================================
    private Double pressAnomalyScore;
    private Double weldAnomalyScore;
    private Double paintAnomalyScore;
    private Double assemblyAnomalyScore;
    private Double inspectionAnomalyScore;

    // =====================================================
    // 공정 중단(stop) Feature
    // =====================================================

    /**
     * snapshot 시점까지 누적 stop 발생 횟수
     */
    private int stopCountTotal;

    // =====================================================
    // ====== Labels ======
    // =====================================================

    /**
     * snapshot 시점까지 누적 지연 시간(분)
     *
     * 정의:
     * cumulativeDelayMinutes
     * = max(snapshotTime - dueDate, 0)
     */
    private long cumulativeDelayMinutes;

    /**
     * 해당 production의 최종 확정 지연 시간(분)
     * - INSPECTION_DONE snapshot 기준 값
     * - 이후 snapshot에서는 동일한 값 유지
     */
    private long finalDelayMinutes;

    /**
     * 🔥 Stage2 회귀 타깃 (가장 중요)
     *
     * snapshot 시점 기준 앞으로 "남아 있을 것으로 예상되는 지연 시간"
     *
     * 정의:
     * remainingDelayMinutes
     * = max(finalDelayMinutes - cumulativeDelayMinutes, 0)
     */
    private long remainingDelayMinutes;

    /**
     * Stage1 분류용 라벨
     * - 이 production이 최종적으로 지연되는가?
     */
    private int delayFlag;

    // =====================================================
    // Factory Method
    // =====================================================

    /**
     * 공정 종료 시점 Snapshot 생성용 팩토리 메서드
     *
     * ✅ DummyDataGeneratorService에서 호출하는 시그니처와 1:1로 맞춘 버전
     * - anomaly: Double (nullable) → 미래 공정은 null 유지 가능
     * - cumulativeDelayMinutes: 생성기에서 계산한 값을 그대로 받음 (정공법)
     *
     * ⚠️ finalDelayMinutes / remainingDelayMinutes / delayFlag는
     *   production 종료 후 applyFinalDelay()에서 최종 확정
     */

        public static DelayTrainingSnapshot of(
                Long orderId,
                Long productionId,
                String snapshotStage,
                LocalDateTime snapshotTime,
                LocalDateTime orderDate,
                LocalDateTime dueDate,
                LocalDateTime productionStart,
                int orderQty,
                Double press,
                Double weld,
                Double paint,
                Double assembly,
                Double inspection,
                int stopCountTotal
        ) {
        // 생산 경과 시간
        long elapsedMinutes =
                java.time.Duration.between(productionStart, snapshotTime).toMinutes();

        // 남은 납기 여유 (음수면 이미 지연)
        long remainingSlackMinutes =
                java.time.Duration.between(snapshotTime, dueDate).toMinutes();

        // ✅ snapshot 시점 기준 누적 지연 (정공법 핵심)
        long cumulativeDelayMinutes =
                Math.max(0,
                        java.time.Duration.between(dueDate, snapshotTime).toMinutes()
                );

        return DelayTrainingSnapshot.builder()
                .orderId(orderId)
                .productionId(productionId)

                .snapshotStage(snapshotStage)
                .snapshotTime(snapshotTime)

                .orderDate(orderDate)
                .dueDate(dueDate)
                .productionStart(productionStart)

                .elapsedMinutes(elapsedMinutes)
                .remainingSlackMinutes(remainingSlackMinutes)

                .orderQty(orderQty)

                // stage-aware anomaly (미래 공정은 null)
                .pressAnomalyScore(press)
                .weldAnomalyScore(weld)
                .paintAnomalyScore(paint)
                .assemblyAnomalyScore(assembly)
                .inspectionAnomalyScore(inspection)

                .stopCountTotal(stopCountTotal)

                // ✅ 여기서 계산
                .cumulativeDelayMinutes(cumulativeDelayMinutes)

                // 최종 라벨은 이후 applyFinalDelay에서 확정
                .finalDelayMinutes(0L)
                .remainingDelayMinutes(0L)
                .delayFlag(0)

                .build();
        }

    // =====================================================
    // 후처리용 Setter (정공법에서 매우 중요)
    // =====================================================

    /**
     * INSPECTION_DONE 이후,
     * production의 최종 지연이 확정되었을 때 호출
     */
    public void applyFinalDelay(long finalDelayMinutes) {
        this.finalDelayMinutes = Math.max(0, finalDelayMinutes);
        this.remainingDelayMinutes =
                Math.max(0, this.finalDelayMinutes - this.cumulativeDelayMinutes);
        this.delayFlag = this.finalDelayMinutes > 0 ? 1 : 0;
    }
}
