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
        return datasetRepository.save(dataset);
    }
}
