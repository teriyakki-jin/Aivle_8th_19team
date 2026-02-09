package com.example.automobile_risk.controller;

import com.example.automobile_risk.service.DueDatePredictionService;
import com.example.automobile_risk.service.DueDatePredictionSseService;
import com.example.automobile_risk.service.dto.DueDatePredictionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/duedate-predictions")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DueDatePredictionController {

    private final DueDatePredictionService dueDatePredictionService;
    private final DueDatePredictionSseService dueDatePredictionSseService;

    @GetMapping("/latest")
    public ApiResponse<List<DueDatePredictionResponse>> latest(
            @RequestParam(value = "limit", required = false, defaultValue = "20") Integer limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return ApiResponse.of(dueDatePredictionService.getLatestPerOrder(safeLimit));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam(value = "limit", required = false, defaultValue = "20") Integer limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        SseEmitter emitter = dueDatePredictionSseService.subscribe();
        try {
            List<DueDatePredictionResponse> init = dueDatePredictionService.getLatestPerOrder(safeLimit);
            dueDatePredictionSseService.sendTo(emitter, "dueDateList", init);
        } catch (Exception ignored) {
        }
        return emitter;
    }
}
