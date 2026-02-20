package com.example.automobile_risk.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "production_dataset_mappings",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "production_dataset_mappings_production_id_process_name_service_type_key",
                        columnNames = {"production_id", "process_name", "service_type"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductionDatasetMapping extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_id")
    private Production production;

    /**
     * 공정명 (프레스, 용접, 도장, 조립, 검사, 엔진 등)
     */
    @Column(name = "process_name", nullable = false, length = 100)
    private String processName;

    /**
     * 서비스 타입 (press_vibration, press_image, welding_image, paint, body_assembly, windshield, engine 등)
     */
    @Column(name = "service_type", nullable = false, length = 100)
    private String serviceType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ml_input_dataset_id")
    private MlInputDataset dataset;
}
