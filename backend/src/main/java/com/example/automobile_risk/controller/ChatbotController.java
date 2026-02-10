package com.example.automobile_risk.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Chatbot Proxy Controller
 * Frontend → Spring Boot → ML-Service (FastAPI)
 *
 * 이 컨트롤러가 실패해도 다른 API에 영향을 주지 않음
 */
@RestController
@RequestMapping("/api/v1/chatbot")
@Slf4j
public class ChatbotController {

    @Value("${ml-service.base-url:http://localhost:8000}")
    private String mlServiceBaseUrl;

    private final RestTemplate restTemplate;

    public ChatbotController() {
        this.restTemplate = new RestTemplate();
    }

    @PostMapping("/query")
    public ResponseEntity<?> chatbotQuery(@RequestBody Map<String, Object> request) {
        try {
            String url = mlServiceBaseUrl + "/api/v1/smartfactory/chatbot";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            log.info("Forwarding chatbot request to ML service: {}", url);

            ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                String.class
            );

            return ResponseEntity
                .status(response.getStatusCode())
                .contentType(MediaType.APPLICATION_JSON)
                .body(response.getBody());

        } catch (ResourceAccessException e) {
            log.warn("Chatbot ML service unreachable: {}", e.getMessage());
            return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                    "content", "죄송합니다. 챗봇 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
                    "error", "ML service unreachable"
                ));

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.warn("Chatbot ML service error: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity
                .status(e.getStatusCode())
                .contentType(MediaType.APPLICATION_JSON)
                .body(e.getResponseBodyAsString());

        } catch (Exception e) {
            log.error("Chatbot proxy unexpected error: {}", e.getMessage(), e);
            return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "content", "죄송합니다. 챗봇 서비스에 문제가 발생했습니다.",
                    "error", e.getMessage()
                ));
        }
    }
}
