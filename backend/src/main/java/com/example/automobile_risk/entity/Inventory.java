package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.InventoryStatus;
import jakarta.persistence.*;
import lombok.*;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Entity
public class Inventory extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "inventory_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "part_id")
    private Part part;

    private int currentQty;   // 현재 가용 수량
    private int safetyQty;    // 안전 재고 수량

    @Enumerated(EnumType.STRING)
    private InventoryStatus status;

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  생산 생성
     */
    public static Inventory of(Part part, int currentQty) {
        return of(part, currentQty, 0);
    }

    public static Inventory of(Part part, int currentQty, int safetyQty) {
        return Inventory.builder()
                .part(part)
                .currentQty(currentQty)
                .safetyQty(safetyQty)
                .status(InventoryStatus.AVAILABLE)
                .build();
    }

    public void adjust(int qty) {
        if (currentQty + qty < 0) {
            throw new IllegalStateException("재고 부족");
        }

        this.currentQty += qty;
    }

    public void updateSafetyQty(int safetyQty) {
        if (safetyQty < 0) {
            throw new IllegalArgumentException("안전 재고는 0 이상이어야 합니다.");
        }
        this.safetyQty = safetyQty;
    }
}
