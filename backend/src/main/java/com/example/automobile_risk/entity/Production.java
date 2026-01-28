package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Entity
public class Production extends BaseTimeEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "production_id")
    private Long id;

    private LocalDateTime startDate;
    private LocalDateTime endDate;

    @Enumerated(EnumType.STRING)
    private ProductionStatus productionStatus;

    @OneToMany(mappedBy = "production", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderProduction> orderProductionList = new ArrayList<>();

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  생산 생성
     */
    public static Production createProduction(LocalDateTime startDate) {

        return Production.builder()
                .startDate(startDate)
                .productionStatus(ProductionStatus.PLANNED)
                .build();
    }

    /**
     *  생산시작일 수정
     */
    public void rescheduleStartDate(LocalDateTime startDate) {

        if (this.productionStatus != ProductionStatus.PLANNED) {
            throw new IllegalStateException("계획 상태의 생산만 시작일을 변경할 수 있습니다.");
        }

        this.startDate = startDate;
    }

    /**
     *  OrderProduction 추가
     */
    public void addOrderProduction(OrderProduction op) {

        if (orderProductionList.contains(op)) {
            throw new IllegalStateException("이미 할당된 주문입니다.");
        }

        this.orderProductionList.add(op);
        op.assignProduction(this);
    }

    /**
     *  OrderProduction 제거
     */
    public void removeOrderProduction(OrderProduction op) {
        this.orderProductionList.remove(op);
        op.assignProduction(null);
    }

    /**
     *  생산상태 시작
     */
    public void start() {

        if (this.productionStatus != ProductionStatus.PLANNED) {
            throw new IllegalStateException("계획 상태의 생산만 시작할 수 있습니다.");
        }

        this.productionStatus = ProductionStatus.IN_PROGRESS;
    }

    /**
     *  생산상태 완료
     */
    public void complete(LocalDateTime endDate) {

        log.info("ProductionStatus : {}", productionStatus);

        if (this.productionStatus != ProductionStatus.IN_PROGRESS) {
            throw new IllegalStateException("가동 중인 생산만 완료할 수 있습니다.");
        }

        if (endDate.isBefore(this.startDate)) {
            throw new IllegalArgumentException("완료일은 시작일 이후여야 합니다.");
        }

        this.endDate = endDate;
        this.productionStatus = ProductionStatus.COMPLETED;
    }

    /**
     *  생산상태 중지
     */
    public void stop() {

        if (this.productionStatus != ProductionStatus.IN_PROGRESS) {
            throw new IllegalStateException("가동 중인 생산만 중지할 수 있습니다.");
        }

        this.productionStatus = ProductionStatus.STOPPED;
    }

    /**
     *  생산상태 재시작
     */
    public void restart() {

        if (this.productionStatus != ProductionStatus.STOPPED) {
            throw new IllegalStateException("중지된 생산만 재개할 수 있습니다.");
        }

        this.productionStatus = ProductionStatus.IN_PROGRESS;
    }

    /**
     *  생산상태 취소
     */
     public void cancel() {

        if (this.productionStatus != ProductionStatus.PLANNED) {
            throw new IllegalStateException("계획 상태의 생산만 취소할 수 있습니다.");
        }

        this.productionStatus = ProductionStatus.CANCELLED;
    }

}
