package com.example.automobile_risk.service.dto;

import com.example.automobile_risk.entity.ProcessExecutionFile;
import com.example.automobile_risk.entity.enumclass.FileType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessExecutionFileResponse {

    private Long fileId;
    private String originalFileName;
    private String fileUrl;
    private FileType fileType;
    private long fileSize;

    public static ProcessExecutionFileResponse from(ProcessExecutionFile file) {
        return ProcessExecutionFileResponse.builder()
                .fileId(file.getId())
                .originalFileName(file.getOriginalFileName())
                .fileUrl(file.getFilePath())
                .fileType(file.getFileType())
                .fileSize(file.getFileSize())
                .build();
    }
}
