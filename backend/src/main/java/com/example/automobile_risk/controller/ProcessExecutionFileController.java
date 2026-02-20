package com.example.automobile_risk.controller;

import com.example.automobile_risk.entity.enumclass.FileType;
import com.example.automobile_risk.service.ProcessExecutionFileService;
import com.example.automobile_risk.service.dto.ProcessExecutionFileResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/process-execution-file")
@RestController
public class ProcessExecutionFileController {

    private final ProcessExecutionFileService processExecutionFileService;

    /**
     * 공정 수행 파일 업로드
     */
    @PostMapping("/{processExecutionId}")
    public ApiResponse<Long> uploadFile(
            @PathVariable Long processExecutionId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("fileType") FileType fileType
    ) {

        Long processExecutionFileId = processExecutionFileService.upload(
                processExecutionId,
                file,
                fileType
        );

        return ApiResponse.of(processExecutionId);
    }

    /**
     * 공정 수행 파일 목록 조회
     */
    @GetMapping("/{processExecutionId}")
    public ApiResponse<List<ProcessExecutionFileResponse>> getFiles(
            @PathVariable Long processExecutionId
    ) {

        List<ProcessExecutionFileResponse> files = processExecutionFileService.getFiles(processExecutionId);

        return ApiResponse.of(files);
    }
}
