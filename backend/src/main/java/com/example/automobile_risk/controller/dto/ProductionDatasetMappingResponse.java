package com.example.automobile_risk.controller.dto;

import com.example.automobile_risk.entity.ProductionDatasetMapping;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProductionDatasetMappingResponse {
    private Long id;
    private Long productionId;
    private String processName;
    private String serviceType;
    private Long datasetId;
    private String datasetName;
    private String datasetFormat;
    private String datasetStorageKey;

    public static ProductionDatasetMappingResponse from(ProductionDatasetMapping mapping) {
        return ProductionDatasetMappingResponse.builder()
                .id(mapping.getId())
                .productionId(mapping.getProduction() != null ? mapping.getProduction().getId() : null)
                .processName(mapping.getProcessName())
                .serviceType(mapping.getServiceType())
                .datasetId(mapping.getDataset() != null ? mapping.getDataset().getId() : null)
                .datasetName(mapping.getDataset() != null ? mapping.getDataset().getName() : null)
                .datasetFormat(mapping.getDataset() != null && mapping.getDataset().getFormat() != null
                        ? mapping.getDataset().getFormat().name()
                        : null)
                .datasetStorageKey(mapping.getDataset() != null ? mapping.getDataset().getStorageKey() : null)
                .build();
    }
}
