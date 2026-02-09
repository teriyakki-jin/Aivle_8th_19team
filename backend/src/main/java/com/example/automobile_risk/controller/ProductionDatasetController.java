package com.example.automobile_risk.controller;

import com.example.automobile_risk.controller.dto.ProductionDatasetAssignForm;
import com.example.automobile_risk.controller.dto.ProductionDatasetMappingResponse;
import com.example.automobile_risk.entity.ProductionDatasetMapping;
import com.example.automobile_risk.service.ProductionDatasetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/production-datasets")
@RequiredArgsConstructor
public class ProductionDatasetController {

    private final ProductionDatasetService productionDatasetService;

    @PostMapping("/production/{productionId}")
    public ProductionDatasetMappingResponse assign(
            @PathVariable Long productionId,
            @RequestBody ProductionDatasetAssignForm form
    ) {
        if (form.getProcessName() == null || form.getDatasetId() == null) {
            throw new IllegalArgumentException("processName and datasetId are required");
        }
        ProductionDatasetMapping mapping =
                productionDatasetService.assignDataset(productionId, form.getProcessName(), form.getDatasetId());
        return ProductionDatasetMappingResponse.from(mapping);
    }
}
