package com.example.automobile_risk.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "detected_defects")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DetectedDefect {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "result_id", nullable = false)
    private String resultId;
    
    @Column(name = "defect_class", nullable = false)
    private String defectClass;
    
    @Column(name = "defect_name_ko")
    private String defectNameKo;
    
    @Column(name = "defect_name_en")
    private String defectNameEn;
    
    @Column(name = "confidence")
    private Double confidence;
    
    @Column(name = "bbox_x1")
    private Integer bboxX1;
    
    @Column(name = "bbox_y1")
    private Integer bboxY1;
    
    @Column(name = "bbox_x2")
    private Integer bboxX2;
    
    @Column(name = "bbox_y2")
    private Integer bboxY2;
    
    @Column(name = "bbox_area")
    private Integer bboxArea;
    
    @Column(name = "severity_level")
    private String severityLevel;
    
    @Column(name = "detected_at")
    private LocalDateTime detectedAt;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_id", referencedColumnName = "result_id", insertable = false, updatable = false)
    @JsonIgnore
    private PaintAnalysisResult paintAnalysisResult;
    
    @PrePersist
    protected void onCreate() {
        if (detectedAt == null) {
            detectedAt = LocalDateTime.now();
        }
    }
}
