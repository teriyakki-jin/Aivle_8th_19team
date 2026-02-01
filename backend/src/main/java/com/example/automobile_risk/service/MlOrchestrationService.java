package com.example.automobile_risk.service;

import com.example.automobile_risk.dto.DashboardPredictionDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
public class MlOrchestrationService {

    private final RestTemplate mlRestTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ml-service.base-url:http://localhost:8000}")
    private String mlBaseUrl;

    private static final Map<String, String> ENDPOINT_MAP = Map.of(
            "press_vibration", "/api/v1/smartfactory/press/auto",
            "press_image",     "/api/v1/smartfactory/press_image/auto",
            "paint",           "/api/v1/smartfactory/paint/auto",
            "welding",         "/api/v1/smartfactory/welding/auto",
            "windshield",      "/api/v1/smartfactory/windshield/auto",
            "engine",          "/api/v1/smartfactory/engine/auto",
            "body_inspect",    "/api/v1/smartfactory/body/auto"
    );

    public MlOrchestrationService(
            @Qualifier("mlRestTemplate") RestTemplate mlRestTemplate,
            ObjectMapper objectMapper
    ) {
        this.mlRestTemplate = mlRestTemplate;
        this.objectMapper = objectMapper;
    }

    @Getter
    @AllArgsConstructor
    public static class EndpointResult {
        private final String process;
        private final boolean success;
        private final JsonNode data;
        private final String errorReason;
    }

    @Getter
    public static class OrchestrationResult {
        private final List<EndpointResult> results;
        private final List<DashboardPredictionDto.SourceStatus> sources;
        private final boolean partial;

        public OrchestrationResult(List<EndpointResult> results) {
            this.results = results;
            this.sources = new ArrayList<>();
            int failCount = 0;
            for (EndpointResult r : results) {
                sources.add(DashboardPredictionDto.SourceStatus.builder()
                        .endpoint(r.getProcess())
                        .ok(r.isSuccess())
                        .reason(r.getErrorReason())
                        .build());
                if (!r.isSuccess()) failCount++;
            }
            this.partial = failCount > 0 && failCount < results.size();
        }
    }

    public OrchestrationResult callAllEndpoints() {
        List<EndpointResult> results = new ArrayList<>();

        for (Map.Entry<String, String> entry : ENDPOINT_MAP.entrySet()) {
            String process = entry.getKey();
            String endpoint = entry.getValue();
            try {
                String url = mlBaseUrl + endpoint;
                ResponseEntity<String> response = mlRestTemplate.getForEntity(url, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode data = objectMapper.readTree(response.getBody());
                    results.add(new EndpointResult(process, true, data, null));
                } else {
                    results.add(new EndpointResult(process, false, null,
                            "HTTP " + response.getStatusCode()));
                }
            } catch (Exception e) {
                log.warn("ML endpoint {} failed: {}", process, e.getMessage());
                results.add(new EndpointResult(process, false, null, e.getMessage()));
            }
        }

        return new OrchestrationResult(results);
    }
}
