package com.example.automobile_risk.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Table(
        uniqueConstraints = {
                @UniqueConstraint(
                        columnNames = {"order_id", "production_id"}
                )
        }
)
@Entity
public class OrderProduction extends BaseTimeEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_production_id")
    private Long id;

    private int allocatedQty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_id", nullable = false)
    private Production production;

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  주문생산 생성
     */
    public static OrderProduction createOrderProduction(
            Order order,
            Production production,
            int allocatedQty
    ) {

        if (allocatedQty <= 0) {
            throw new IllegalArgumentException("할당 수량은 1 이상이어야 합니다.");
        }

        OrderProduction op = OrderProduction.builder()
                .allocatedQty(allocatedQty)
                .build();

        // 연관관계는 Aggregate 메서드로만 설정
        order.addOrderProduction(op);
        production.addOrderProduction(op);

        return op;
    }

    /**
     *  Order 엔티티 set 메서드
     *  패키지 전용 or protected (도메인 패키지 내에서만 사용)
     */
    void assignOrder(Order order) {
        this.order = order;
    }

    /**
     *  Production 엔티티 set 메서드
     *  패키지 전용 or protected (도메인 패키지 내에서만 사용)
     */
    void assignProduction(Production production) {
        this.production = production;
    }

}
