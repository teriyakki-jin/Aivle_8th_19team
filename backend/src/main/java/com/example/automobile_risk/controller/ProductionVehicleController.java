package com.example.automobile_risk.controller;

import com.example.automobile_risk.service.ProductionVehicleService;
import com.example.automobile_risk.service.dto.ProductionVehicleDetailResponse;
import com.example.automobile_risk.service.dto.ProductionVehicleListResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/production-vehicle")
@RestController
public class ProductionVehicleController {

    private final ProductionVehicleService productionVehicleService;

    /**
     *  1. 단건 조회
     */
    @GetMapping("/{id}")
    public ApiResponse<ProductionVehicleDetailResponse> getDetail(@PathVariable(name = "id") Long id) {

        ProductionVehicleDetailResponse detail = productionVehicleService.getDetail(id);

        return ApiResponse.of(detail);
    }

    /**
     *  2. 목록 조회
     */
    @GetMapping
    public ApiResponse<List<ProductionVehicleListResponse>> getProductionList() {

        List<ProductionVehicleListResponse> list = productionVehicleService.getList();

        return ApiResponse.of(list);
    }
}
