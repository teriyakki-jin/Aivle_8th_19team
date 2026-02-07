package com.example.automobile_risk.controller;

import com.example.automobile_risk.entity.MLAnalysisResult;
import com.example.automobile_risk.repository.MLAnalysisResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ml-results")
@RequiredArgsConstructor
public class MLAnalysisResultController {

    private final MLAnalysisResultRepository mlAnalysisResultRepository;

    @GetMapping
    public List<MLAnalysisResult> list(
            @RequestParam(value = "orderId", required = false) Long orderId,
            @RequestParam(value = "serviceType", required = false) String serviceType,
            @RequestParam(value = "process", required = false) String processName,
            @RequestParam(value = "limit", required = false, defaultValue = "50") Integer limit
    ) {
        int size = limit != null && limit > 0 ? Math.min(limit, 200) : 50;
        Pageable pageable = PageRequest.of(0, size);
        return mlAnalysisResultRepository.findRecent(orderId, serviceType, processName, pageable);
    }
}
