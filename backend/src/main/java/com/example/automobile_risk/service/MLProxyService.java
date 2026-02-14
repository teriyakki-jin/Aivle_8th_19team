package com.example.automobile_risk.service;

import com.example.automobile_risk.controller.dto.ProcessEventCreateForm;
import com.example.automobile_risk.entity.DueDatePrediction;
import com.example.automobile_risk.entity.MLAnalysisResult;
import com.example.automobile_risk.entity.enumclass.EventSource;
import com.example.automobile_risk.entity.enumclass.EventType;
import com.example.automobile_risk.repository.MLAnalysisResultRepository;
import com.example.automobile_risk.service.DueDatePredictionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MLProxyService {

    private final RestTemplate restTemplate;
    private final MLAnalysisResultRepository mlAnalysisResultRepository;
    private final DueDatePredictionService dueDatePredictionService;
    private final ObjectMapper objectMapper;
    private final ProcessEventService processEventService;

    @Value("${ml-service.base-url:http://localhost:8000}")
    private String mlServiceBaseUrl;

    @Value("${ml-service.press-image-dir:}")
    private String pressImageDirOverride;

    @RequiredArgsConstructor
    public static class MlContext {
        public final Long orderId;
        public final Long productionId;
        public final Long processExecutionId;
        public final String processName;
    }

    /**
     * FastAPI 엔드포인트 호출 및 결과 저장
     */
    public JsonNode callMLServiceAndSave(String endpoint, MultiValueMap<String, Object> body, String serviceType) {
        return callMLServiceAndSave(endpoint, body, serviceType, null);
    }

    public JsonNode callMLServiceAndSave(String endpoint, MultiValueMap<String, Object> body, String serviceType, MlContext context) {
        try {
            // 1. FastAPI 호출
            String url = mlServiceBaseUrl + endpoint;
            log.info("Calling ML Service: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            // 2. 응답 파싱
            JsonNode jsonResponse = objectMapper.readTree(response.getBody());

            // 3. DB에 저장
            saveAnalysisResult(jsonResponse, serviceType, context);

            log.info("ML Service call successful for {}: {}", serviceType, jsonResponse);

            return jsonResponse;

        } catch (Exception e) {
            log.error("Error calling ML service for {}: {}", serviceType, e.getMessage(), e);
            throw new RuntimeException("ML 서비스 호출 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 파일 없이 FastAPI 호출 (프레스 진동 등)
     */
    public JsonNode callMLServiceWithoutFile(String endpoint, String serviceType) {
        return callMLServiceWithoutFile(endpoint, serviceType, 0);
    }

    /**
     * 파일 없이 FastAPI 호출 (offset 지원)
     */
    public JsonNode callMLServiceWithoutFile(String endpoint, String serviceType, int offset) {
        return callMLServiceWithoutFile(endpoint, serviceType, offset, null);
    }

    public JsonNode callMLServiceWithoutFile(String endpoint, String serviceType, int offset, MlContext context) {
        try {
            // offset 파라미터 추가
            String separator = endpoint.contains("?") ? "&" : "?";
            String url = mlServiceBaseUrl + endpoint + separator + "offset=" + offset;
            log.info("Calling ML Service (no file): {} with offset: {}", url, offset);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> requestEntity = new HttpEntity<>("{}", headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            JsonNode jsonResponse = objectMapper.readTree(response.getBody());
            saveAnalysisResult(jsonResponse, serviceType, context);

            return jsonResponse;

        } catch (Exception e) {
            log.error("Error calling ML service for {}: {}", serviceType, e.getMessage(), e);
            throw new RuntimeException("ML 서비스 호출 실패: " + e.getMessage(), e);
        }
    }

    /**
     * JSON 바디로 FastAPI 호출
     */
    public JsonNode callMLServiceWithJson(String endpoint, JsonNode body, String serviceType) {
        return callMLServiceWithJson(endpoint, body, serviceType, null);
    }

    public JsonNode callMLServiceWithJson(String endpoint, JsonNode body, String serviceType, MlContext context) {
        try {
            String url = mlServiceBaseUrl + endpoint;
            log.info("Calling ML Service (json): {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> requestEntity = new HttpEntity<>(body.toString(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            JsonNode jsonResponse = objectMapper.readTree(response.getBody());
            saveAnalysisResult(jsonResponse, serviceType, context);

            return jsonResponse;
        } catch (Exception e) {
            log.error("Error calling ML service for {}: {}", serviceType, e.getMessage(), e);
            throw new RuntimeException("ML 서비스 호출 실패: " + e.getMessage(), e);
        }
    }

    /**
     * ML 분석 결과를 DB에 저장
     */
    private void saveAnalysisResult(JsonNode jsonResponse, String serviceType) {
        saveAnalysisResult(jsonResponse, serviceType, null);
    }

    private void saveAnalysisResult(JsonNode jsonResponse, String serviceType, MlContext context) {
        try {
            MLAnalysisResult result = MLAnalysisResult.builder()
                    .serviceType(serviceType)
                    .build();

            if (context != null) {
                result.setOrderId(context.orderId);
                result.setProductionId(context.productionId);
                result.setProcessExecutionId(context.processExecutionId);
                result.setProcessName(context.processName);
            }

            // === paint 서비스 전용 파싱 (응답 구조가 다름) ===
            if ("paint".equals(serviceType) && jsonResponse.has("data")) {
                JsonNode data = jsonResponse.get("data");
                // 결함 유무로 PASS/FAIL 판정
                boolean hasDefects = data.has("detected_defects")
                        && data.get("detected_defects").isArray()
                        && data.get("detected_defects").size() > 0;
                result.setStatus(hasDefects ? "FAIL" : "PASS");
                result.setIsAnomaly(hasDefects ? 1 : 0);

                if (data.has("defect_score")) {
                    result.setConfidence(data.get("defect_score").asDouble());
                } else if (hasDefects) {
                    // detected_defects[0].confidence (percent)
                    JsonNode firstDefect = data.get("detected_defects").get(0);
                    if (firstDefect.has("confidence")) {
                        result.setConfidence(firstDefect.get("confidence").asDouble() / 100.0);
                    }
                } else {
                    result.setConfidence(1.0);
                }
                if (data.has("img_path")) {
                    result.setOriginalImageUrl(data.get("img_path").asText());
                }
                if (data.has("img_result")) {
                    result.setResultImageUrl(data.get("img_result").asText());
                }
                if (data.has("inference_time_ms")) {
                    result.setInferenceTimeMs((long) data.get("inference_time_ms").asInt());
                }
                if (data.has("defect_type") && data.get("defect_type").asInt(-1) >= 0) {
                    result.setPrediction(data.get("defect_type").asInt());
                }
                if (data.has("label_name_text")) {
                    result.setTarget(data.get("label_name_text").asText());
                }
                if (jsonResponse.has("message")) {
                    result.setMessage(jsonResponse.get("message").asText());
                }
            } else {
                // === 기존 공통 파싱 ===
                if (jsonResponse.has("status")) {
                    result.setStatus(jsonResponse.get("status").asText());
                }
                if (jsonResponse.has("judgement")) {
                    result.setStatus(jsonResponse.get("judgement").asText());
                }
                if (jsonResponse.has("prediction")) {
                    result.setPrediction(jsonResponse.get("prediction").asInt());
                }
                if (jsonResponse.has("confidence")) {
                    result.setConfidence(jsonResponse.get("confidence").asDouble());
                }
                if (jsonResponse.has("reconstruction_error")) {
                    result.setReconstructionError(jsonResponse.get("reconstruction_error").asDouble());
                }
                if (jsonResponse.has("threshold")) {
                    result.setThreshold(jsonResponse.get("threshold").asDouble());
                }
                if (jsonResponse.has("is_anomaly")) {
                    result.setIsAnomaly(jsonResponse.get("is_anomaly").asInt());
                }
                if (jsonResponse.has("original_image_url")) {
                    result.setOriginalImageUrl(jsonResponse.get("original_image_url").asText());
                }
                if (jsonResponse.has("result_image_url")) {
                    result.setResultImageUrl(jsonResponse.get("result_image_url").asText());
                }
                if (jsonResponse.has("message")) {
                    result.setMessage(jsonResponse.get("message").asText());
                }

                // status가 비어있으면 is_anomaly 기반으로 기본값 부여
                if (result.getStatus() == null || result.getStatus().isBlank()) {
                    Integer isAnomaly = result.getIsAnomaly();
                    if (isAnomaly != null) {
                        result.setStatus(isAnomaly == 1 ? "ABNORMAL" : "NORMAL");
                    } else if (result.getPrediction() != null) {
                        result.setStatus(result.getPrediction() == 1 ? "NORMAL" : "ABNORMAL");
                    } else {
                        result.setStatus("UNKNOWN");
                    }
                }
            }

            // 전체 JSON을 additionalInfo에 저장
            result.setAdditionalInfo(jsonResponse.toString());

            mlAnalysisResultRepository.save(result);
            log.info("Saved ML analysis result for {}: ID={}", serviceType, result.getId());

            // 이상 판정 시 ProcessEvent 생성
            if (isAbnormal(result) && context != null && context.orderId != null) {
                createDefectEvent(result, context, serviceType);
            }

        } catch (Exception e) {
            log.error("Error saving ML analysis result: {}", e.getMessage(), e);
            // DB 저장 실패해도 API 응답은 반환
        }
    }

    /**
     * ML 분석 결과가 이상인지 판단
     */
    private boolean isAbnormal(MLAnalysisResult result) {
        String status = result.getStatus();
        if (status == null) return false;

        return "ABNORMAL".equalsIgnoreCase(status)
                || "NG".equalsIgnoreCase(status)
                || "FAIL".equalsIgnoreCase(status);
    }

    /**
     * 이상 판정 시 ProcessEvent 생성
     */
    private void createDefectEvent(MLAnalysisResult result, MlContext context, String serviceType) {
        try {
            ProcessEventCreateForm form = new ProcessEventCreateForm();
            form.setOrderId(context.orderId);
            form.setProcess(context.processName);
            form.setEventType(EventType.DEFECT);
            form.setEventCode("ML_" + serviceType.toUpperCase());
            form.setSeverity(determineSeverity(result));
            form.setQtyAffected(1);
            form.setLineHold(false);
            form.setSource(EventSource.VISION);
            form.setMessage(buildDefectMessage(result, serviceType));

            Long eventId = processEventService.createProcessEvent(form);
            log.info("Created ProcessEvent for ML defect: eventId={}, orderId={}, process={}, serviceType={}",
                    eventId, context.orderId, context.processName, serviceType);
        } catch (Exception e) {
            log.warn("Failed to create ProcessEvent for ML defect: {}", e.getMessage());
        }
    }

    /**
     * 결함 심각도 결정 (confidence 기반)
     */
    private Integer determineSeverity(MLAnalysisResult result) {
        Double confidence = result.getConfidence();
        if (confidence == null) return 3; // 기본값

        if (confidence >= 0.9) return 5; // 매우 높은 확신
        if (confidence >= 0.7) return 4;
        if (confidence >= 0.5) return 3;
        return 2;
    }

    /**
     * 결함 메시지 생성
     */
    private String buildDefectMessage(MLAnalysisResult result, String serviceType) {
        StringBuilder sb = new StringBuilder();
        sb.append("[ML 자동 탐지] ").append(serviceType);

        if (result.getConfidence() != null) {
            sb.append(" (신뢰도: ").append(String.format("%.1f%%", result.getConfidence() * 100)).append(")");
        }
        if (result.getMessage() != null && !result.getMessage().isBlank()) {
            sb.append(" - ").append(result.getMessage());
        }

        return sb.toString();
    }

    /**
     * MultipartFile을 임시 파일로 변환
     */
    public File convertMultipartFileToFile(MultipartFile multipartFile) throws IOException {
        File tempFile = File.createTempFile("upload_", "_" + multipartFile.getOriginalFilename());
        try (FileOutputStream fos = new FileOutputStream(tempFile)) {
            fos.write(multipartFile.getBytes());
        }
        return tempFile;
    }

    /**
     * 윈드실드 분석
     */
    public JsonNode analyzeWindshield(String side, MultipartFile file) throws IOException {
        return analyzeWindshield(side, file, null);
    }

    public JsonNode analyzeWindshield(String side, MultipartFile file, MlContext context) throws IOException {
        File tempFile = convertMultipartFileToFile(file);
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("side", side);
            body.add("file", new FileSystemResource(tempFile));

            return callMLServiceAndSave("/api/v1/smartfactory/windshield", body, "windshield", context);
        } finally {
            tempFile.delete();
        }
    }

    /**
     * 엔진 진동 분석
     */
    public JsonNode analyzeEngine(MultipartFile file) throws IOException {
        return analyzeEngine(file, null);
    }

    public JsonNode analyzeEngine(MultipartFile file, MlContext context) throws IOException {
        File tempFile = convertMultipartFileToFile(file);
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new FileSystemResource(tempFile));

            return callMLServiceAndSave("/api/v1/smartfactory/engine", body, "engine", context);
        } finally {
            tempFile.delete();
        }
    }

    /**
     * 용접 이미지 분석 (자동)
     */
    public JsonNode analyzeWeldingImageAuto(int offset) {
        return analyzeWeldingImageAuto(offset, null);
    }

    public JsonNode analyzeWeldingImageAuto(int offset, MlContext context) {
        return callMLServiceWithoutFile("/api/v1/smartfactory/welding/image/auto", "welding_image", offset, context);
    }

    public JsonNode analyzeWeldingImageFile(File file, MlContext context) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(file));
        return callMLServiceAndSave("/api/v1/welding/image", body, "welding_image", context);
    }

    /**
     * 도장 품질 분석 (자동)
     */
    public JsonNode analyzePaintAuto(int offset) {
        return analyzePaintAuto(offset, null);
    }

    public JsonNode analyzePaintAuto(int offset, MlContext context) {
        return callMLServiceWithoutFile("/api/v1/smartfactory/paint/auto", "paint", offset, context);
    }

    public JsonNode analyzePaintFile(File file, MlContext context) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(file));
        return callMLServiceAndSave("/api/v1/smartfactory/paint", body, "paint", context);
    }

    /**
     * 프레스 진동 분석
     */
    public JsonNode analyzePressVibration(int offset) {
        return analyzePressVibration(offset, null);
    }

    public JsonNode analyzePressVibration(int offset, MlContext context) {
        return callMLServiceWithoutFile("/api/v1/smartfactory/press/vibration", "press_vibration", offset, context);
    }

    public JsonNode analyzePressVibrationJson(JsonNode bodyJson, MlContext context) {
        return callMLServiceWithJson("/api/v1/smartfactory/press/vibration", bodyJson, "press_vibration", context);
    }

    /**
     * 프레스 이미지 분석
     */
    public JsonNode analyzePressImage(int offset) {
        return analyzePressImage(offset, null);
    }

    public JsonNode analyzePressImage(int offset, MlContext context) {
        return callMLServiceWithoutFile("/api/v1/smartfactory/press/image", "press_image", offset, context);
    }

    public JsonNode analyzePressImageFile(File file, int offset, MlContext context) {
        try {
            Path sampleDir = resolvePressSampleDir();
            if (sampleDir != null) {
                Files.createDirectories(sampleDir);
                String fileName = "dataset_press_image" + getExtension(file.getName());
                Path target = sampleDir.resolve(fileName);
                Files.copy(file.toPath(), target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            log.warn("Failed to sync press image dataset: {}", e.getMessage());
        }
        return analyzePressImage(offset, context);
    }

    private Path resolvePressSampleDir() {
        if (pressImageDirOverride != null && !pressImageDirOverride.isBlank()) {
            return Paths.get(pressImageDirOverride);
        }
        Path base = Paths.get(System.getProperty("user.dir"));
        Path root = base.getParent() != null ? base.getParent() : base;
        return root.resolve("ml-service").resolve("press").resolve("sample_images");
    }

    private String getExtension(String name) {
        int idx = name.lastIndexOf('.');
        if (idx < 0) return ".jpg";
        return name.substring(idx);
    }

    /**
     * 윈드실드 분석 (자동)
     */
    public JsonNode analyzeWindshieldAuto(int offset) {
        return analyzeWindshieldAuto(offset, null);
    }

    public JsonNode analyzeWindshieldAuto(int offset, MlContext context) {
        return callMLServiceWithoutFile("/api/v1/smartfactory/windshield/auto", "windshield", offset, context);
    }

    public JsonNode analyzeWindshieldFile(String side, File file, MlContext context) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("side", side);
        body.add("file", new FileSystemResource(file));
        return callMLServiceAndSave("/api/v1/smartfactory/windshield", body, "windshield", context);
    }

    /**
     * 엔진 진동 분석 (자동)
     */
    public JsonNode analyzeEngineAuto(int offset) {
        return analyzeEngineAuto(offset, null);
    }

    public JsonNode analyzeEngineAuto(int offset, MlContext context) {
        return callMLServiceWithoutFile("/api/v1/smartfactory/engine/auto", "engine", offset, context);
    }

    public JsonNode analyzeEngineFile(File file, MlContext context) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new FileSystemResource(file));
        return callMLServiceAndSave("/api/v1/smartfactory/engine", body, "engine", context);
    }

    /**
     * 차체 조립 분석 (자동 배치)
     */
    public JsonNode analyzeBodyAssemblyBatchAuto(Double confidence, int offset) {
        return analyzeBodyAssemblyBatchAuto(confidence, offset, null);
    }

    public JsonNode analyzeBodyAssemblyBatchAuto(Double confidence, int offset, MlContext context) {
        try {
            String url = mlServiceBaseUrl + "/api/v1/smartfactory/body/inspect/batch/auto?offset=" + offset;
            log.info("Calling ML Service (body batch auto): {} with offset: {}", url, offset);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("conf", confidence != null ? confidence : 0.5);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );

            JsonNode jsonResponse = objectMapper.readTree(response.getBody());
            saveAnalysisResult(jsonResponse, "body_assembly", context);

            return jsonResponse;

        } catch (Exception e) {
            log.error("Error calling ML service for body assembly: {}", e.getMessage(), e);
            throw new RuntimeException("ML 서비스 호출 실패: " + e.getMessage(), e);
        }
    }

    public JsonNode analyzeBodyAssemblyBatchFiles(
            Map<String, File> partFiles,
            Double confidence,
            MlContext context
    ) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("conf", confidence != null ? confidence : 0.5);
        addIfPresent(body, "door_file", partFiles.get("door"));
        addIfPresent(body, "bumper_file", partFiles.get("bumper"));
        addIfPresent(body, "headlamp_file", partFiles.get("headlamp"));
        addIfPresent(body, "taillamp_file", partFiles.get("taillamp"));
        addIfPresent(body, "radiator_file", partFiles.get("radiator"));
        return callMLServiceAndSave("/api/v1/smartfactory/body/inspect/batch", body, "body_assembly", context);
    }

    public JsonNode analyzeBodyAssemblyFile(File file, MlContext context) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("part", "door");
        body.add("file", new FileSystemResource(file));
        return callMLServiceAndSave("/api/v1/smartfactory/body/inspect", body, "body_assembly", context);
    }

    private void addIfPresent(MultiValueMap<String, Object> body, String key, File file) {
        if (file == null) return;
        body.add(key, new FileSystemResource(file));
    }

    /**
     * 납기 지연 예측
     */
    public JsonNode analyzeDueDate(JsonNode body) {
        System.out.println("DUEDATE_ANALYZE_START");
        JsonNode result = callMLServiceWithJson("/api/v1/smartfactory/duedate", body, "duedate");
        System.out.println("DUEDATE_ANALYZE_AFTER_CALL");
        try {
            DueDatePrediction prediction = buildDueDatePrediction(body, result);
            dueDatePredictionService.save(prediction);
            log.info("DueDate ML saved: orderId={}, stage={}, delayFlag={}, delayProb={}",
                    prediction.getOrderId(),
                    prediction.getSnapshotStage(),
                    prediction.getDelayFlag(),
                    prediction.getDelayProbability());
        } catch (Exception e) {
            log.warn("Failed to save due date prediction: {}", e.getMessage());
        }
        return result;
    }

    private DueDatePrediction buildDueDatePrediction(JsonNode body, JsonNode result) {
        Long orderId = asLong(body.get("order_id"));
        Double predictedDelayMinutes = asDouble(result.get("predicted_remaining_delay_minutes"));
        if (predictedDelayMinutes == null) {
            // backward compatibility for older payloads
            predictedDelayMinutes = asDouble(result.get("predicted_delay_minutes"));
        }
        Double remainingSlackMinutes = asDouble(body.get("remaining_slack_minutes"));
        Integer delayFlag = asInt(result.get("delay_flag"));
        Double delayProbability = asDouble(result.get("delay_probability"));

        // If slack is exhausted, keep delayed state stable across refreshes.
        if (remainingSlackMinutes != null && remainingSlackMinutes <= 1.0) {
            delayFlag = 1;
            delayProbability = 1.0;
            if (predictedDelayMinutes == null || predictedDelayMinutes <= 0.0) {
                predictedDelayMinutes = estimateDelayMinutesFallback(body);
            }
            double latestStored = dueDatePredictionService.getLatestByOrderId(orderId)
                    .map(DueDatePrediction::getPredictedDelayMinutes)
                    .filter(v -> v != null && v > 0.0)
                    .orElse(0.0);
            predictedDelayMinutes = Math.max(
                    Optional.ofNullable(predictedDelayMinutes).orElse(0.0),
                    latestStored
            );
        }

        return DueDatePrediction.builder()
                .orderId(orderId)
                .orderQty(asInt(body.get("order_qty")))
                .snapshotStage(asText(body.get("snapshot_stage")))
                .stopCountTotal(asDouble(body.get("stop_count_total")))
                .elapsedMinutes(asDouble(body.get("elapsed_minutes")))
                .remainingSlackMinutes(remainingSlackMinutes)
                .pressAnomalyScore(asDouble(body.get("press_anomaly_score")))
                .weldAnomalyScore(asDouble(body.get("weld_anomaly_score")))
                .paintAnomalyScore(asDouble(body.get("paint_anomaly_score")))
                .assemblyAnomalyScore(asDouble(body.get("assembly_anomaly_score")))
                .inspectionAnomalyScore(asDouble(body.get("inspection_anomaly_score")))
                .delayFlag(delayFlag)
                .delayProbability(delayProbability)
                .predictedDelayMinutes(predictedDelayMinutes)
                .requestJson(body != null ? body.toString() : null)
                .responseJson(result != null ? result.toString() : null)
                .build();
    }

    private Double estimateDelayMinutesFallback(JsonNode body) {
        double stopCount = Optional.ofNullable(asDouble(body.get("stop_count_total"))).orElse(0.0);
        double anomalySum = Optional.ofNullable(asDouble(body.get("press_anomaly_score"))).orElse(0.0)
                + Optional.ofNullable(asDouble(body.get("weld_anomaly_score"))).orElse(0.0)
                + Optional.ofNullable(asDouble(body.get("paint_anomaly_score"))).orElse(0.0)
                + Optional.ofNullable(asDouble(body.get("assembly_anomaly_score"))).orElse(0.0)
                + Optional.ofNullable(asDouble(body.get("inspection_anomaly_score"))).orElse(0.0);
        double estimated = 5.0 + (stopCount * 3.0) + (anomalySum * 30.0);
        return Math.max(1.0, Math.round(estimated * 10.0) / 10.0);
    }

    private Integer asInt(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isInt() || node.isLong()) return node.asInt();
        if (node.isNumber()) return (int) Math.round(node.asDouble());
        return null;
    }

    private Long asLong(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isLong() || node.isInt()) return node.asLong();
        if (node.isNumber()) return Math.round(node.asDouble());
        return null;
    }

    private Double asDouble(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isNumber()) return node.asDouble();
        return null;
    }

    private String asText(JsonNode node) {
        if (node == null || node.isNull()) return null;
        return node.asText();
    }
}
