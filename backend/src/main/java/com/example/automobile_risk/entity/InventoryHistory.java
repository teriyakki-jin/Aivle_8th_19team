package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.InventoryChangeType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Entity
public class InventoryHistory extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "inventory_history_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "part_id")
    private Part part;

    private int changeQty;   // + / -
    private int afterQty;    // 변경 후 수량

    private Long referenceId;
    private String referenceType;   // PRODUCTION, PROCESS_EXECUTION, ORDER 등

    private LocalDateTime occuredAt;

    @Enumerated(EnumType.STRING)
    private InventoryChangeType changeType; // IN, OUT, ADJUST, SCRAP

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  생산 생성
     */
    public static InventoryHistory of(
            Part part,
            int changeQty, int afterQty,
            LocalDateTime occuredAt,
            InventoryChangeType changeType
    ) {

        if (changeQty + afterQty < 0) {
            throw new IllegalStateException("재고가 부족합니다.");
        }

        return InventoryHistory.builder()
                .part(part)
                .changeQty(changeQty)
                .afterQty(afterQty)
                .occuredAt(occuredAt)
                .changeType(changeType)
                .build();
    }
}
