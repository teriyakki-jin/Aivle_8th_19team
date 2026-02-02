package com.example.automobile_risk.service;

import com.example.automobile_risk.service.dto.StoredFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Profile("local")
@Service
public class LocalStorageService implements StorageService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    public StoredFile save(MultipartFile file, String directory) {

        String originalFilename = file.getOriginalFilename();
        String storedName = UUID.randomUUID() + "_" + originalFilename;

        Path savePath = Paths.get(uploadDir, directory, storedName);

        try {
            Files.createDirectories(savePath.getParent());
            file.transferTo(savePath);
        } catch (IOException e) {
            throw new RuntimeException("파일 저장 실패", e);
        }

        return StoredFile.builder()
                .originalFileName(originalFilename)
                .storedFileName(storedName)
                .filePath(savePath.toString())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .build();
    }

    @Override
    public void delete(String storedFileName) {

    }

    @Override
    public String getFileUrl(String storedFileName) {
        return "/files/" + storedFileName;
    }
}
