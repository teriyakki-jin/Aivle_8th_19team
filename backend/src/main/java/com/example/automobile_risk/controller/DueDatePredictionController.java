package com.example.automobile_risk.controller;

import com.example.automobile_risk.service.DueDatePredictionService;
import com.example.automobile_risk.service.dto.DueDatePredictionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/duedate-predictions")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DueDatePredictionController {

    private final DueDatePredictionService dueDatePredictionService;

    @GetMapping("/latest")
    public ApiResponse<List<DueDatePredictionResponse>> latest(
            @RequestParam(value = "limit", required = false, defaultValue = "20") Integer limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return ApiResponse.of(dueDatePredictionService.getLatestPerOrder(safeLimit));
    }
}
