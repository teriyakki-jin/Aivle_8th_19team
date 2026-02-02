package com.example.automobile_risk.service;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.example.automobile_risk.service.dto.StoredFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Profile("prod")
@Service
public class S3StorageService implements StorageService {

    private final AmazonS3 amazonS3;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Override
    public StoredFile save(MultipartFile file, String directory) {

        String originalName = file.getOriginalFilename();
        String storedName = directory + "/" + UUID.randomUUID() + "_" + originalName;

        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(file.getSize());
            metadata.setContentType(file.getContentType());

            amazonS3.putObject(
                    new PutObjectRequest(
                            bucket,
                            storedName,
                            file.getInputStream(),
                            metadata
                    )
            );
        } catch (IOException e) {
            throw new RuntimeException("S3 파일 업로드 실패", e);
        }

        String fileUrl = amazonS3.getUrl(bucket, storedName).toString();

        return StoredFile.builder()
                .originalFileName(originalName)
                .storedFileName(storedName)
                .filePath(fileUrl)
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .build();
    }

    @Override
    public void delete(String storedFileName) {

    }

    @Override
    public String getFileUrl(String storedFileName) {
        return "";
    }
}
