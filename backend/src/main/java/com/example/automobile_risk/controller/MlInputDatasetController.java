package com.example.automobile_risk.controller;

import com.example.automobile_risk.entity.MlInputDataset;
import com.example.automobile_risk.repository.MlInputDatasetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ml-datasets")
@RequiredArgsConstructor
public class MlInputDatasetController {

    private final MlInputDatasetRepository datasetRepository;

    @GetMapping
    public List<MlInputDataset> list(@RequestParam(value = "processName", required = false) String processName) {
        if (processName == null || processName.isBlank()) {
            return datasetRepository.findAll();
        }
        return datasetRepository.findByProcessNameOrderByCreatedDateDesc(processName);
    }

    @PostMapping
    public MlInputDataset create(@RequestBody MlInputDataset dataset) {
        if (dataset.getServiceType() == null || dataset.getServiceType().isBlank()) {
            dataset.setServiceType(resolveServiceType(dataset.getProcessName(), dataset.getFormat()));
        }
        return datasetRepository.save(dataset);
    }

    private String resolveServiceType(String processName, com.example.automobile_risk.entity.enumclass.DatasetFormat format) {
        String p = processName == null ? "" : processName.trim();
        String f = format != null ? format.name() : "";
        if ("프레스".equals(p)) {
            return "IMAGE".equals(f) ? "press_image" : "press_vibration";
        }
        if ("용접".equals(p)) return "welding_image";
        if ("도장".equals(p)) return "paint";
        if ("조립".equals(p)) return "body_assembly";
        if ("검사".equals(p)) {
            return "CSV".equals(f) ? "windshield" : "engine";
        }
        return p;
    }
}
