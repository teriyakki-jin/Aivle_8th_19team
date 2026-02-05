package com.example.automobile_risk.controller;

import com.example.automobile_risk.entity.enumclass.DefectSnapshotStage;
import com.example.automobile_risk.service.DefectSummaryService;
import com.example.automobile_risk.service.dto.DefectSummaryResponse;
import com.example.automobile_risk.service.dto.ProcessEventResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/defect-summary")
@RestController
public class DefectSummaryController {

    private final DefectSummaryService defectSummaryService;

    /**
     * 완료된 생산 목록 + 결함 요약 리스트 조회
     */
    @GetMapping
    public ApiResponse<List<DefectSummaryResponse>> getDefectSummaries() {
        List<DefectSummaryResponse> summaries = defectSummaryService.getCompletedProductionSummaries();
        return ApiResponse.of(summaries);
    }

    /**
     * 특정 생산의 상세 결함 요약 조회
     */
    @GetMapping("/{productionId}")
    public ApiResponse<DefectSummaryResponse> getDefectSummary(@PathVariable Long productionId) {
        DefectSummaryResponse summary = defectSummaryService.getDefectSummaryByProductionId(productionId);
        return ApiResponse.of(summary);
    }

    /**
     * 특정 생산의 오류 로그 목록 조회
     */
    @GetMapping("/{productionId}/logs")
    public ApiResponse<List<ProcessEventResponse>> getErrorLogs(@PathVariable Long productionId) {
        List<ProcessEventResponse> logs = defectSummaryService.getErrorLogsByProductionId(productionId);
        return ApiResponse.of(logs);
    }

    /**
     * 특정 주문의 오류 로그 목록 조회 (Order 기반)
     */
    @GetMapping("/order/{orderId}/logs")
    public ApiResponse<List<ProcessEventResponse>> getErrorLogsByOrderId(@PathVariable Long orderId) {
        List<ProcessEventResponse> logs = defectSummaryService.getErrorLogsByOrderId(orderId);
        return ApiResponse.of(logs);
    }

    /**
     * 주문 완료 시점에 공정별 결함 요약 스냅샷 저장 (Order 기준)
     */
    @PostMapping("/order/{orderId}/snapshot")
    public ApiResponse<Long> createSnapshotByOrder(@PathVariable Long orderId) {
        defectSummaryService.captureSnapshotForOrder(
                orderId,
                DefectSnapshotStage.COMPLETED,
                LocalDateTime.now()
        );
        return ApiResponse.of(orderId);
    }

}
