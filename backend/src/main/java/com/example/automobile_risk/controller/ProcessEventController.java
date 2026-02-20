package com.example.automobile_risk.controller;

import com.example.automobile_risk.controller.dto.ProcessEventCreateForm;
import com.example.automobile_risk.service.ProcessEventService;
import com.example.automobile_risk.service.dto.ProcessEventResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/process-events")
@RestController
public class ProcessEventController {

    private final ProcessEventService processEventService;

    /**
     * ProcessEvent 생성 (결함/오류 기록)
     * POST /api/v1/process-events
     */
    @PostMapping
    public ApiResponse<Long> createProcessEvent(@Valid @RequestBody ProcessEventCreateForm form) {
        Long eventId = processEventService.createProcessEvent(form);
        return ApiResponse.of(eventId);
    }

    /**
     * 주문별 ProcessEvent 목록 조회
     * GET /api/v1/process-events/order/{orderId}
     */
    @GetMapping("/order/{orderId}")
    public ApiResponse<List<ProcessEventResponse>> getEventsByOrder(@PathVariable Long orderId) {
        List<ProcessEventResponse> events = processEventService.getEventsByOrderId(orderId);
        return ApiResponse.of(events);
    }

    /**
     * 주문별 미해결 ProcessEvent 목록 조회
     * GET /api/v1/process-events/order/{orderId}/unresolved
     */
    @GetMapping("/order/{orderId}/unresolved")
    public ApiResponse<List<ProcessEventResponse>> getUnresolvedEventsByOrder(@PathVariable Long orderId) {
        List<ProcessEventResponse> events = processEventService.getUnresolvedEventsByOrderId(orderId);
        return ApiResponse.of(events);
    }
}
