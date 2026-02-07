package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.MlInputDataset;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.ProductionDatasetMapping;
import com.example.automobile_risk.repository.MlInputDatasetRepository;
import com.example.automobile_risk.repository.ProductionDatasetMappingRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductionDatasetService {

    private final ProductionDatasetMappingRepository mappingRepository;
    private final ProductionRepository productionRepository;
    private final MlInputDatasetRepository datasetRepository;

    @Transactional(readOnly = true)
    public MlInputDataset findDatasetForProductionProcess(Long productionId, String processName) {
        if (productionId == null || processName == null) return null;
        return mappingRepository.findByProductionIdAndProcessNameWithDataset(productionId, processName)
                .map(ProductionDatasetMapping::getDataset)
                .orElse(null);
    }

    @Transactional
    public ProductionDatasetMapping assignDataset(Long productionId, String processName, Long datasetId) {
        Production production = productionRepository.findById(productionId)
                .orElseThrow(() -> new IllegalArgumentException("Production not found: " + productionId));
        MlInputDataset dataset = datasetRepository.findById(datasetId)
                .orElseThrow(() -> new IllegalArgumentException("Dataset not found: " + datasetId));

        Optional<ProductionDatasetMapping> existing = mappingRepository.findByProductionIdAndProcessName(productionId, processName);
        ProductionDatasetMapping mapping = existing.orElseGet(ProductionDatasetMapping::new);
        mapping.setProduction(production);
        mapping.setProcessName(processName);
        mapping.setDataset(dataset);
        return mappingRepository.save(mapping);
    }
}
