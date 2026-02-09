package com.example.automobile_risk.controller;

import com.example.automobile_risk.service.MLProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Chatbot 프록시 컨트롤러
 * Frontend → Spring Boot → FastAPI(ml-service) 프록시
 */
@RestController
@RequestMapping("/api/v1/chatbot")
@RequiredArgsConstructor
@Slf4j
public class ChatbotController {

    private final MLProxyService mlProxyService;

    /**
     * Chatbot 쿼리
     * POST /api/v1/chatbot/query
     */
    @PostMapping("/query")
    public ResponseEntity<JsonNode> query(@RequestBody Map<String, String> request) {
        try {
            String sessionId = request.get("session_id");
            String message = request.get("message");

            if (sessionId == null || sessionId.isBlank()) {
                return ResponseEntity.badRequest().build();
            }
            if (message == null || message.isBlank()) {
                return ResponseEntity.badRequest().build();
            }

            log.info("Chatbot query - sessionId: {}, message: {}", sessionId, message.substring(0, Math.min(50, message.length())));
            JsonNode result = mlProxyService.chatbotQuery(sessionId, message);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error in chatbot query: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
