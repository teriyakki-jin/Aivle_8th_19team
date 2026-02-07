package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.DatasetFormat;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "ml_input_datasets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MlInputDataset extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 공정명 (예: 프레스, 용접, 도장, 조립, 검사, 엔진 등)
     */
    @Column(nullable = false, length = 100)
    private String processName;

    /**
     * 데이터셋 이름
     */
    @Column(nullable = false, length = 200)
    private String name;

    /**
     * 데이터 포맷
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DatasetFormat format;

    /**
     * 로컬 파일 경로 또는 스토리지 키
     */
    @Column(nullable = false, length = 1000)
    private String storageKey;

    /**
     * 설명
     */
    @Column(length = 500)
    private String description;
}
