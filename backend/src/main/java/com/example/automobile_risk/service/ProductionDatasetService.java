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
    public MlInputDataset findDatasetForProductionProcess(Long productionId, String processName, String serviceType) {
        if (productionId == null || processName == null || serviceType == null) return null;
        return mappingRepository.findByProductionIdAndProcessNameWithDataset(productionId, processName, serviceType)
                .map(ProductionDatasetMapping::getDataset)
                .orElse(null);
    }

    @Transactional
    public ProductionDatasetMapping assignDataset(Long productionId, String processName, Long datasetId) {
        Production production = productionRepository.findById(productionId)
                .orElseThrow(() -> new IllegalArgumentException("Production not found: " + productionId));
        MlInputDataset dataset = datasetRepository.findById(datasetId)
                .orElseThrow(() -> new IllegalArgumentException("Dataset not found: " + datasetId));

        String resolvedServiceType = resolveServiceType(dataset);
        Optional<ProductionDatasetMapping> existing = mappingRepository
                .findByProductionIdAndProcessNameAndServiceType(productionId, processName, resolvedServiceType);
        ProductionDatasetMapping mapping = existing.orElseGet(ProductionDatasetMapping::new);
        mapping.setProduction(production);
        mapping.setProcessName(processName);
        mapping.setServiceType(resolvedServiceType);
        mapping.setDataset(dataset);
        return mappingRepository.save(mapping);
    }

    private String resolveServiceType(MlInputDataset dataset) {
        if (dataset.getServiceType() != null && !dataset.getServiceType().isBlank()) {
            return dataset.getServiceType();
        }
        String processName = dataset.getProcessName() == null ? "" : dataset.getProcessName().trim();
        String format = dataset.getFormat() != null ? dataset.getFormat().name() : "";
        if ("프레스".equals(processName)) {
            return "IMAGE".equals(format) ? "press_image" : "press_vibration";
        }
        if ("용접".equals(processName)) return "welding_image";
        if ("도장".equals(processName)) return "paint";
        if ("조립".equals(processName)) return "body_assembly";
        if ("검사".equals(processName)) {
            return "CSV".equals(format) ? "windshield" : "engine";
        }
        return processName;
    }
}
