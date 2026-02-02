package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.ProcessExecution;
import com.example.automobile_risk.entity.ProcessExecutionFile;
import com.example.automobile_risk.entity.enumclass.FileType;
import com.example.automobile_risk.exception.ProcessExecutionFileNotFoundException;
import com.example.automobile_risk.exception.ProcessExecutionNotFoundException;
import com.example.automobile_risk.repository.ProcessExecutionFileRepository;
import com.example.automobile_risk.repository.ProcessExecutionRepository;
import com.example.automobile_risk.service.dto.ProcessExecutionFileResponse;
import com.example.automobile_risk.service.dto.StoredFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Service
public class ProcessExecutionFileService {

    private final ProcessExecutionRepository processExecutionRepository;
    private final ProcessExecutionFileRepository processExecutionFileRepository;
    private final StorageService storageService;

    @Transactional
    public Long upload(
            Long processExecutionId,
            MultipartFile file,
            FileType fileType
    ) {

        ProcessExecution processExecution = processExecutionRepository.findById(processExecutionId)
                .orElseThrow(() -> new ProcessExecutionNotFoundException(processExecutionId));

        StoredFile storedFile = storageService.save(
                file,
                "process-execution/" + processExecutionId
        );

        ProcessExecutionFile processExecutionFile = ProcessExecutionFile.create(
                storedFile.getOriginalFileName(),
                storedFile.getStoredFileName(),
                storedFile.getFilePath(),
                storedFile.getContentType(),
                storedFile.getFileSize(),
                fileType,
                processExecution
        );

        ProcessExecutionFile saved = processExecutionFileRepository.save(processExecutionFile);

        return saved.getId();
    }

    /**
     * 공정 수행 파일 목록 조회
     */
    public List<ProcessExecutionFileResponse> getFiles(Long processExecutionId) {

        return processExecutionFileRepository.findByProcessExecutionId(processExecutionId)
                .stream()
                .map(ProcessExecutionFileResponse::from)
                .toList();
    }

    /**
     * 파일 삭제 (선택)
     */
    @Transactional
    public Long deleteFile(Long fileId) {

        ProcessExecutionFile file = processExecutionFileRepository.findById(fileId)
                .orElseThrow(() -> new ProcessExecutionFileNotFoundException(fileId));

        storageService.delete(file.getStoredFileName());

        processExecutionFileRepository.delete(file);

        return fileId;
    }
}
