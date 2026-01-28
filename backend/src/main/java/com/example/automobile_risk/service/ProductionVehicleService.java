package com.example.automobile_risk.service;

import com.example.automobile_risk.exception.ProductionVehicleNotFoundException;
import com.example.automobile_risk.repository.ProductionVehicleRepository;
import com.example.automobile_risk.service.dto.ProductionVehicleDetailResponse;
import com.example.automobile_risk.service.dto.ProductionVehicleListResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Service
public class ProductionVehicleService {

    private final ProductionVehicleRepository productionVehicleRepository;


    /**
     *  1. 단건 조회
     */
    public ProductionVehicleDetailResponse getDetail(Long productionVehicleId) {

        return productionVehicleRepository.findById(productionVehicleId)
                .map(ProductionVehicleDetailResponse::from)
                .orElseThrow(() -> new ProductionVehicleNotFoundException(productionVehicleId));
    }

    /**
     *  2. 목록 조회
     */
    public List<ProductionVehicleListResponse> getList() {

        return productionVehicleRepository.findAll().stream()
                .map(ProductionVehicleListResponse::from)
                .toList();
    }
}
