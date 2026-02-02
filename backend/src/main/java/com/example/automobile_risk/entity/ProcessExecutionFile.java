package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.FileType;
import jakarta.persistence.*;
import lombok.*;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Entity
public class ProcessExecutionFile extends BaseTimeEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "process_execution_file_id")
    private Long id;

    private String originalFileName;    // 원본 파일명
    private String storedFileName;      // 저장된 파일명 (UUID 등)
    private String filePath;            // 파일 접근 경로(local path or s3 url)
    private String contentType;         // image/png, text/csv, ...
    private long fileSize;

    @Enumerated(EnumType.STRING)
    private FileType fileType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_execution_id")
    private ProcessExecution processExecution;

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  공정수행 생성
     */
    public static ProcessExecutionFile create(
            String originalFileName,
            String storedFileName,
            String filePath,
            String contentType,
            long fileSize,
            FileType fileType,
            ProcessExecution processExecution
    ) {

        return ProcessExecutionFile.builder()
                .originalFileName(originalFileName)
                .storedFileName(storedFileName)
                .filePath(filePath)
                .contentType(contentType)
                .fileSize(fileSize)
                .fileType(fileType)
                .processExecution(processExecution)
                .build();
    }
}
