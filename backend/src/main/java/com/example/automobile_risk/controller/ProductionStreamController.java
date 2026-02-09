package com.example.automobile_risk.controller;

import com.example.automobile_risk.service.ProductionSseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/production/stream")
@RequiredArgsConstructor
public class ProductionStreamController {

    private final ProductionSseService productionSseService;

    @GetMapping
    public SseEmitter stream() {
        return productionSseService.subscribe();
    }
}
