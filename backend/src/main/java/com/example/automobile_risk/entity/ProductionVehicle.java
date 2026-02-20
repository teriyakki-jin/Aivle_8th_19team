package com.example.automobile_risk.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Table(
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"serialNumber"})
        }
)
@Entity
public class ProductionVehicle extends BaseTimeEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "production_vehicle_id")
    private Long id;

    @Column(nullable = false, unique = true)
    private String serialNumber;
    private LocalDateTime completedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_id")
    private Production production;

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  생산차량 생성
     */
    public static ProductionVehicle createProductionVehicle(
            String serialNumber, LocalDateTime completedAt, Production production
    ) {

        if (serialNumber == null || serialNumber.isBlank()) {
            throw new IllegalArgumentException("차량 시리얼 번호는 필수입니다.");
        }

        return ProductionVehicle.builder()
                .serialNumber(serialNumber)
                .completedAt(completedAt)
                .production(production)
                .build();
    }
}
