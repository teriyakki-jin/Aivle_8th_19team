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

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

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

    @Transactional
    public void assignRandomDatasetsIfMissing(Long productionId) {
        if (productionId == null) return;
        Production production = productionRepository.findById(productionId)
                .orElseThrow(() -> new IllegalArgumentException("Production not found: " + productionId));

        assignIfMissing(production, "프레스", "press_vibration");
        assignIfMissing(production, "프레스", "press_image");
        assignIfMissing(production, "용접", "welding_image");
        assignIfMissing(production, "도장", "paint");
        assignIfMissing(production, "조립", "body_assembly");
        assignIfMissing(production, "검사", "windshield");
        assignIfMissing(production, "검사", "engine");
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

    private void assignIfMissing(Production production, String processName, String serviceType) {
        Optional<ProductionDatasetMapping> existing = mappingRepository
                .findByProductionIdAndProcessNameAndServiceType(production.getId(), processName, serviceType);
        if (existing.isPresent()) return;

        List<MlInputDataset> candidates =
                datasetRepository.findByProcessNameAndServiceTypeOrderByCreatedDateDesc(processName, serviceType);
        if (candidates == null || candidates.isEmpty()) return;

        int idx = ThreadLocalRandom.current().nextInt(candidates.size());
        MlInputDataset picked = candidates.get(idx);

        ProductionDatasetMapping mapping = new ProductionDatasetMapping();
        mapping.setProduction(production);
        mapping.setProcessName(processName);
        mapping.setServiceType(serviceType);
        mapping.setDataset(picked);
        mappingRepository.save(mapping);
    }
}
