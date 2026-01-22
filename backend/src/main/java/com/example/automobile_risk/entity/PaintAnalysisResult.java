package com.example.automobile_risk.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "paint_analysis_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaintAnalysisResult {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "result_id", unique = true, nullable = false)
    private String resultId;
    
    @Column(name = "session_id")
    private String sessionId;
    
    // 이미지 정보
    @Column(name = "image_filename", nullable = false)
    private String imageFilename;
    
    @Column(name = "image_path")
    private String imagePath;
    
    @Column(name = "image_url")
    private String imageUrl;
    
    @Column(name = "result_image_url")
    private String resultImageUrl;
    
    @Column(name = "image_size_kb")
    private Integer imageSizeKb;
    
    // 분석 결과
    @Column(name = "status", nullable = false)
    private String status; // 'PASS', 'FAIL', 'WARNING'
    
    @Column(name = "primary_defect_type")
    private String primaryDefectType;
    
    @Column(name = "confidence")
    private Double confidence;
    
    // 메타데이터
    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;
    
    @Column(name = "model_version")
    private String modelVersion;
    
    @Column(name = "inference_time_ms")
    private Integer inferenceTimeMs;
    
    @Column(name = "inspector_id")
    private String inspectorId;
    
    @Column(name = "inspector_name")
    private String inspectorName;
    
    @Column(name = "location_code")
    private String locationCode;
    
    // 상세 결함 정보 (1:N 관계)
    @OneToMany(mappedBy = "paintAnalysisResult", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetectedDefect> detectedDefects = new ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        if (analyzedAt == null) {
            analyzedAt = LocalDateTime.now();
        }
    }
}
