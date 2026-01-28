package com.example.automobile_risk.controller;

import com.example.automobile_risk.controller.dto.ProductionCompleteForm;
import com.example.automobile_risk.controller.dto.ProductionCreateForm;
import com.example.automobile_risk.controller.dto.ProductionUpdateForm;
import com.example.automobile_risk.service.ManufacturingOrchestrationService;
import com.example.automobile_risk.service.ProductionService;
import com.example.automobile_risk.service.dto.ProductionDetailResponse;
import com.example.automobile_risk.service.dto.ProductionListResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/production")
@RestController
public class ProductionController {

    private final ProductionService productionService;
    private final ManufacturingOrchestrationService manufacturingOrchestrationService;

    /**
     *  1. 생산 생성
     */
    @PostMapping
    public ApiResponse<Long> createProduction(@Valid @RequestBody ProductionCreateForm form) {

        Long productionId = productionService.createProduction(form);

        return ApiResponse.of(productionId);
    }

    /**
     *  2. 생산시작일 수정
     */
    @PatchMapping("/{id}")
    public ApiResponse<Long> rescheduleStartDate(@PathVariable(name = "id") Long id,
                                         @Valid @RequestBody ProductionUpdateForm form) {

        Long productionId = productionService.rescheduleStartDate(id, form);

        return ApiResponse.of(productionId);
    }

    /**
     *  3. 생산 취소
     */
    @PatchMapping("/{id}/cancel")
    public ApiResponse<Long> cancelProduction(@PathVariable(name = "id") Long id) {

        Long productionId = productionService.cancelProduction(id);

        return ApiResponse.of(productionId);
    }

    /**
     *  4. 생산 시작
     */
    @PatchMapping("/{id}/start")
    public ApiResponse<Long> startProduction(@PathVariable(name = "id") Long id) {
        return ApiResponse.of(productionService.startProduction(id));
    }

    /**
     *  5. 생산 완료
     */
    @PatchMapping("/{id}/complete")
    public ApiResponse<Long> completeProduction(@PathVariable(name = "id") Long id,
                                                @Valid @RequestBody ProductionCompleteForm form) {

        manufacturingOrchestrationService.completeProduction(id, form.getEndDate(), form.getSerialNumbers());

        return ApiResponse.of(id);
    }

    /**
     *  6. 생산 중지
     */
    @PatchMapping("/{id}/stop")
    public ApiResponse<Long> stopProduction(@PathVariable(name = "id") Long id) {

        Long productionId = productionService.stopProduction(id);

        return ApiResponse.of(productionId);
    }

    /**
     *  7. 생산 재시작
     */
    @PatchMapping("/{id}/restart")
    public ApiResponse<Long> restartProduction(@PathVariable(name = "id") Long id) {

        Long productionId = productionService.restartProduction(id);

        return ApiResponse.of(productionId);
    }

    /**
     *  8. 생산 단건 조회
     */
    @GetMapping("/{id}")
    public ApiResponse<ProductionDetailResponse> getProduction(@PathVariable(name = "id") Long id) {

        ProductionDetailResponse productionDetailResponse = productionService.getProduction(id);

        return ApiResponse.of(productionDetailResponse);
    }

    /**
     *  9. 생산 목록 조회
     */
    @GetMapping
    public ApiResponse<List<ProductionListResponse>> getProductionList() {

        List<ProductionListResponse> productionListResponseList = productionService.getProductionList();

        return ApiResponse.of(productionListResponseList);
    }
}
