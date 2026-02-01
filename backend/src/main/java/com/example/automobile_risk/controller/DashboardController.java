package com.example.automobile_risk.controller;

import com.example.automobile_risk.dto.DashboardResponse;
import com.example.automobile_risk.service.DashboardService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final ObjectMapper objectMapper;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final AtomicBoolean broadcastLoopStarted = new AtomicBoolean(false);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "dashboard-sse");
        t.setDaemon(true);
        return t;
    });

    @GetMapping("/main")
    public ApiResponse<DashboardResponse> getMainDashboard() {
        return ApiResponse.of(dashboardService.getMainDashboardData());
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamDashboard() {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.add(emitter);

        Runnable cleanup = () -> emitters.remove(emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        // Send first event immediately in background so the method returns the emitter fast
        scheduler.submit(() -> sendToEmitter(emitter));

        // Start the tick loop exactly once (survives subscriber churn)
        if (broadcastLoopStarted.compareAndSet(false, true)) {
            startBroadcastLoop();
        }

        return emitter;
    }

    private void startBroadcastLoop() {
        scheduler.scheduleWithFixedDelay(() -> {
            if (emitters.isEmpty()) return;

            String json;
            try {
                DashboardResponse data = dashboardService.getMainDashboardData();
                json = objectMapper.writeValueAsString(data);
            } catch (Exception e) {
                log.warn("SSE: failed to build dashboard data", e);
                // Send error event but keep connection alive
                for (SseEmitter em : emitters) {
                    try {
                        em.send(SseEmitter.event()
                                .name("error")
                                .data("{\"message\":\"" + e.getMessage().replace("\"", "'") + "\"}"));
                    } catch (IOException | IllegalStateException ignored) {
                        emitters.remove(em);
                    }
                }
                return;
            }

            for (SseEmitter em : emitters) {
                try {
                    em.send(SseEmitter.event().name("dashboard").data(json, MediaType.APPLICATION_JSON));
                } catch (IOException | IllegalStateException e) {
                    emitters.remove(em);
                }
            }
        }, 15, 15, TimeUnit.SECONDS);
    }

    private void sendToEmitter(SseEmitter emitter) {
        try {
            DashboardResponse data = dashboardService.getMainDashboardData();
            String json = objectMapper.writeValueAsString(data);
            emitter.send(SseEmitter.event().name("dashboard").data(json, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            log.warn("SSE: initial send failed", e);
            emitters.remove(emitter);
        }
    }
}
