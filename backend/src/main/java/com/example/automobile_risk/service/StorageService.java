package com.example.automobile_risk.service;

import com.example.automobile_risk.service.dto.StoredFile;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {

    StoredFile save(MultipartFile file, String directory);

    void delete(String storedFileName);

    String getFileUrl(String storedFileName);
}
