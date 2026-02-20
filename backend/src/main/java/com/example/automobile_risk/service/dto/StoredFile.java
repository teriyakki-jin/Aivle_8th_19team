package com.example.automobile_risk.service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoredFile {

    private String originalFileName;
    private String storedFileName;
    private String filePath;
    private long fileSize;
    private String contentType;
}
