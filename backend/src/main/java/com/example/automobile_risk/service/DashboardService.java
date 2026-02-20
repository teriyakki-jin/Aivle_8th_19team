package com.example.automobile_risk.service;

import com.example.automobile_risk.dto.DashboardPredictionDto;
import com.example.automobile_risk.dto.DashboardResponse;
import com.example.automobile_risk.entity.Anomaly;
import com.example.automobile_risk.entity.DashboardHistory;
import com.example.automobile_risk.entity.DashboardPredictionSnapshot;
import com.example.automobile_risk.entity.MLAnalysisResult;
import com.example.automobile_risk.entity.ProcessEntity;
import com.example.automobile_risk.entity.ProcessEvent;
import com.example.automobile_risk.entity.enumclass.RiskLevel;
import com.example.automobile_risk.repository.AnomalyRepository;
import com.example.automobile_risk.repository.DashboardHistoryRepository;
import com.example.automobile_risk.repository.DashboardPredictionSnapshotRepository;
import com.example.automobile_risk.repository.MLAnalysisResultRepository;
import com.example.automobile_risk.repository.ProcessEventRepository;
import com.example.automobile_risk.repository.ProcessRepository;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.enumclass.OrderStatus;
import com.example.automobile_risk.repository.OrderRepository;
import com.example.automobile_risk.repository.ProductionRepository;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final double BASE_OVERALL_EFFICIENCY = 95.0;
    private static final double BASE_PRODUCTION_EFFICIENCY = 98.0;
    private static final double LINE_HOLD_PENALTY = 3.0;
    private static final double UNRESOLVED_EVENT_PENALTY = 1.5;
    private static final double SEVERITY_HIGH_PENALTY = 1.0;
    private static final double DELAY_EFFICIENCY_FACTOR = 0.5;
    private static final double MIN_RATIO = 0.6;

    // ML process name → ProcessEntity Korean name
    private static final Map<String, String> ML_PROCESS_TO_ENTITY = Map.of(
            "press_vibration", "프레스",
            "press_image", "프레스",
            "paint", "도장",
            "welding", "차체",
            "welding_image", "차체",
            "windshield", "설비",
            "engine", "엔진",
            "body_inspect", "차체",
            "body_assembly", "차체"
    );

    private static final Map<String, Double> DELAY_FACTOR = Map.of(
            "press_vibration", 1.5,
            "press_image", 1.2,
            "paint", 2.0,
            "welding", 2.5,
            "windshield", 1.0,
            "engine", 2.2,
            "body_inspect", 1.8
    );

    private static final List<String> DASHBOARD_SERVICES = List.of(
            "press_vibration",
            "press_image",
            "paint",
            "welding",
            "windshield",
            "engine",
            "body_inspect"
    );

    // ML result cache (avoid 7 HTTP calls on every dashboard request)
    private static final long ML_CACHE_TTL_MS = 10_000; // 10 seconds
    private volatile MlCacheEntry mlCache;
    private volatile long mlCacheTimestamp = 0;

    private final ProcessRepository processRepository;
    private final AnomalyRepository anomalyRepository;
    private final DashboardHistoryRepository historyRepository;
    private final ProcessEventRepository processEventRepository;
    private final DelayPredictionService delayPredictionService;
    private final MLAnalysisResultRepository mlAnalysisResultRepository;
    private final DashboardPredictionSnapshotRepository dashboardSnapshotRepository;
    private final OrderRepository orderRepository;
    private final ProductionRepository productionRepository;
    private final ObjectMapper objectMapper;

    // ── ML Cache ──

    private record MlCacheEntry(
            DefectDelayRuleEngine.ProcessedPrediction processed,
            List<DashboardPredictionDto.SourceStatus> sources,
            boolean fresh
    ) {}

    private MlCacheEntry getOrRefreshMlResult() {
        long now = System.currentTimeMillis();
        MlCacheEntry cached = this.mlCache;

        // Return cached (non-fresh) if within TTL
        if (cached != null && (now - mlCacheTimestamp) < ML_CACHE_TTL_MS) {
            return new MlCacheEntry(cached.processed(), cached.sources(), false);
        }

        // Build from stored ML results
        try {
            MlCacheEntry fresh = buildFromStoredMlResults();
            this.mlCache = fresh;
            this.mlCacheTimestamp = now;
            return fresh;
        } catch (Exception e) {
            log.warn("Stored ML aggregation failed, using stale cache or empty", e);
            // Return stale cache if available, else null
            if (cached != null) {
                return new MlCacheEntry(cached.processed(), cached.sources(), false);
            }
            return null;
        }
    }

    private MlCacheEntry buildFromStoredMlResults() {
        List<MLAnalysisResult> recent = mlAnalysisResultRepository.findRecent(
                null, null, null, PageRequest.of(0, 1000));
        Map<String, MLAnalysisResult> latestByService = new HashMap<>();
        for (MLAnalysisResult row : recent) {
            String service = normalizeServiceForDashboard(row.getServiceType());
            if (service == null || !DASHBOARD_SERVICES.contains(service)) continue;
            latestByService.putIfAbsent(service, row);
        }

        List<DashboardPredictionDto.ProcessContribution> contributions = new ArrayList<>();
        List<DashboardPredictionDto.SourceStatus> sources = new ArrayList<>();
        double totalDelayMax = 0.0;

        for (String service : DASHBOARD_SERVICES) {
            MLAnalysisResult latest = latestByService.get(service);
            boolean hasStored = latest != null;

            sources.add(DashboardPredictionDto.SourceStatus.builder()
                    .endpoint(service)
                    .ok(hasStored)
                    .reason(hasStored ? "from_db" : "no_stored_result")
                    .build());

            if (!hasStored || !isAbnormal(latest)) continue;

            int defectCount = extractDefectCount(latest);
            if (defectCount <= 0) continue;

            double factor = DELAY_FACTOR.getOrDefault(service, 1.0);
            double delayMax = defectCount * factor;
            double delayMin = delayMax * MIN_RATIO;

            contributions.add(DashboardPredictionDto.ProcessContribution.builder()
                    .process(service)
                    .delayMinH(Math.round(delayMin * 10.0) / 10.0)
                    .delayMaxH(Math.round(delayMax * 10.0) / 10.0)
                    .build());
            totalDelayMax += delayMax;
        }

        double totalDelayMin = totalDelayMax * MIN_RATIO;
        DefectDelayRuleEngine.ProcessedPrediction processed = new DefectDelayRuleEngine.ProcessedPrediction(
                Math.round(totalDelayMin * 10.0) / 10.0,
                Math.round(totalDelayMax * 10.0) / 10.0,
                classifyRisk(totalDelayMax),
                contributions
        );
        return new MlCacheEntry(processed, sources, true);
    }

    private boolean isAbnormal(MLAnalysisResult row) {
        if (row == null) return false;
        if (row.getIsAnomaly() != null && row.getIsAnomaly() == 1) return true;
        String status = row.getStatus();
        if (status == null) return false;
        String s = status.toUpperCase(Locale.ROOT);
        return "ABNORMAL".equals(s) || "FAIL".equals(s) || "NG".equals(s);
    }

    private String normalizeServiceForDashboard(String serviceType) {
        if (serviceType == null) return null;
        return switch (serviceType) {
            case "welding_image" -> "welding";
            case "body_assembly" -> "body_inspect";
            default -> serviceType;
        };
    }

    private int extractDefectCount(MLAnalysisResult row) {
        if (row == null) return 0;
        String info = row.getAdditionalInfo();
        if (info == null || info.isBlank()) return 1;
        try {
            JsonNode data = objectMapper.readTree(info);
            int count = extractDefectCountFromJson(data);
            return count > 0 ? count : 1;
        } catch (Exception e) {
            return 1;
        }
    }

    private int extractDefectCountFromJson(JsonNode data) {
        if (data == null || data.isNull()) return 0;
        if (data.has("defect_count")) return data.get("defect_count").asInt(0);
        if (data.has("anomaly_count")) return data.get("anomaly_count").asInt(0);
        if (data.has("data") && data.get("data").has("defect_count")) {
            return data.get("data").get("defect_count").asInt(0);
        }
        if (data.has("data") && data.get("data").has("detected_defects")
                && data.get("data").get("detected_defects").isArray()) {
            return data.get("data").get("detected_defects").size();
        }
        if (data.has("results") && data.get("results").isArray()) {
            int count = 0;
            for (JsonNode item : data.get("results")) {
                if (item.has("is_defect") && item.get("is_defect").asBoolean()) count++;
                if (item.has("label") && !"ok".equalsIgnoreCase(item.get("label").asText())) count++;
            }
            return count;
        }
        if (data.has("data") && data.get("data").has("results") && data.get("data").get("results").isArray()) {
            int count = 0;
            for (JsonNode item : data.get("data").get("results")) {
                if (item.has("is_defect") && item.get("is_defect").asBoolean()) count++;
                if (item.has("label") && !"ok".equalsIgnoreCase(item.get("label").asText())) count++;
            }
            return count;
        }
        return 0;
    }

    private RiskLevel classifyRisk(double totalDelayHours) {
        if (totalDelayHours < 8) return RiskLevel.LOW;
        if (totalDelayHours < 24) return RiskLevel.MEDIUM;
        if (totalDelayHours < 48) return RiskLevel.HIGH;
        return RiskLevel.CRITICAL;
    }

    // ── Main Dashboard ──

    @Transactional
    public DashboardResponse getMainDashboardData() {
        List<ProcessEntity> processes = processRepository.findAll();
        List<Anomaly> anomalies = anomalyRepository.findByType("anomaly");
        List<Anomaly> warnings = anomalyRepository.findByType("warning");
        List<DashboardHistory> history = historyRepository.findAllByOrderByIdAsc();
        List<ProcessEvent> allEvents = processEventRepository.findAll();
        List<Order> orders = orderRepository.findAll();
        List<Production> productions = productionRepository.findAll();

        // ── Legacy base counts ──
        int legacyAnomalies = anomalies.stream().mapToInt(Anomaly::getCount).sum();
        int legacyWarnings = warnings.stream().mapToInt(Anomaly::getCount).sum();

        // ── ProcessEvent counts by process ──
        Map<String, Long> eventAnomalyByProcess = allEvents.stream()
                .filter(e -> e.getSeverity() != null && e.getSeverity() >= 2)
                .collect(Collectors.groupingBy(ProcessEvent::getProcess, Collectors.counting()));
        Map<String, Long> eventWarningByProcess = allEvents.stream()
                .filter(e -> e.getSeverity() == null || e.getSeverity() < 2)
                .collect(Collectors.groupingBy(ProcessEvent::getProcess, Collectors.counting()));

        int eventAnomalyTotal = eventAnomalyByProcess.values().stream().mapToInt(Long::intValue).sum();
        int eventWarningTotal = eventWarningByProcess.values().stream().mapToInt(Long::intValue).sum();

        // ── ML prediction (cached, SOLE source of delivery delay) ──
        MlCacheEntry ml = getOrRefreshMlResult();
        DefectDelayRuleEngine.ProcessedPrediction processed = (ml != null) ? ml.processed() : null;
        List<DashboardPredictionDto.SourceStatus> sources = (ml != null) ? ml.sources() : List.of();

        double totalDelayHours = 0.0;
        String overallRiskLevel = RiskLevel.LOW.name();
        int mlAnomalyCount = 0;

        if (processed != null && processed.getDelayMaxH() > 0) {
            totalDelayHours = processed.getDelayMaxH();
            overallRiskLevel = processed.getRiskLevel().name();
            mlAnomalyCount = processed.getContributions().size();
        }

        // ── Anomaly/Warning totals (legacy + ProcessEvent + ML) ──
        int totalAnomalies = legacyAnomalies + eventAnomalyTotal + mlAnomalyCount;
        int totalWarnings = legacyWarnings + eventWarningTotal;

        // ── Efficiency (ProcessEvent-driven + ML delay penalty) ──
        double overallEfficiency = BASE_OVERALL_EFFICIENCY;
        double productionEfficiency = BASE_PRODUCTION_EFFICIENCY;

        if (!allEvents.isEmpty()) {
            long lineHoldCount = allEvents.stream().filter(ProcessEvent::isLineHold).count();
            long unresolvedCount = allEvents.stream().filter(e -> e.getResolvedAt() == null).count();
            overallEfficiency -= (lineHoldCount * LINE_HOLD_PENALTY)
                    + (unresolvedCount * UNRESOLVED_EVENT_PENALTY);
            overallEfficiency = Math.max(0, Math.round(overallEfficiency * 10.0) / 10.0);

            productionEfficiency -= (eventAnomalyTotal * SEVERITY_HIGH_PENALTY);
        }
        // ML delay also reduces production efficiency
        productionEfficiency -= (totalDelayHours * DELAY_EFFICIENCY_FACTOR);
        productionEfficiency = Math.max(0, Math.round(productionEfficiency * 10.0) / 10.0);

        // ── anomalyData / warningData ──
        List<DashboardResponse.AnomalyData> anomalyData;
        List<DashboardResponse.AnomalyData> warningData;

        // ML contribution delay map for avgDelayPerIssue
        Map<String, Double> mlDelayByProcess = new HashMap<>();
        if (processed != null) {
            for (var c : processed.getContributions()) {
                String krName = ML_PROCESS_TO_ENTITY.getOrDefault(c.getProcess(), c.getProcess());
                mlDelayByProcess.merge(krName, c.getDelayMaxH(), Double::sum);
            }
        }

        if (!allEvents.isEmpty()) {
            anomalyData = eventAnomalyByProcess.entrySet().stream()
                    .map(entry -> {
                        int count = entry.getValue().intValue();
                        double avgDelay = mlDelayByProcess.getOrDefault(entry.getKey(), 0.0);
                        if (count > 0 && avgDelay > 0) avgDelay = avgDelay / count;
                        return DashboardResponse.AnomalyData.builder()
                                .process(entry.getKey())
                                .count(count)
                                .avgDelayPerIssue(Math.round(avgDelay * 100.0) / 100.0)
                                .build();
                    })
                    .collect(Collectors.toList());

            warningData = eventWarningByProcess.entrySet().stream()
                    .map(entry -> DashboardResponse.AnomalyData.builder()
                            .process(entry.getKey())
                            .count(entry.getValue().intValue())
                            .avgDelayPerIssue(0.5)
                            .build())
                    .collect(Collectors.toList());
        } else {
            // Seed data fallback
            anomalyData = anomalies.stream()
                    .map(a -> DashboardResponse.AnomalyData.builder()
                            .process(a.getProcessName())
                            .count(a.getCount())
                            .avgDelayPerIssue(a.getAvgDelay())
                            .build())
                    .collect(Collectors.toList());

            warningData = warnings.stream()
                    .map(w -> DashboardResponse.AnomalyData.builder()
                            .process(w.getProcessName())
                            .count(w.getCount())
                            .avgDelayPerIssue(w.getAvgDelay())
                            .build())
                    .collect(Collectors.toList());
        }

        // ── historyData ──
        List<DashboardResponse.HistoryData> historyData = history.stream()
                .map(h -> DashboardResponse.HistoryData.builder()
                        .날짜(h.getDate())
                        .지연시간(h.getTotalDelay())
                        .build())
                .collect(Collectors.toList());
        historyData.add(DashboardResponse.HistoryData.builder()
                .날짜("오늘")
                .지연시간(Math.round(totalDelayHours * 10.0) / 10.0)
                .build());

        // ── processStats: ProcessEntity + ProcessEvent + ML overlay ──
        Map<String, Integer> mlAnomalyByKrProcess = new HashMap<>();
        if (processed != null) {
            for (var contrib : processed.getContributions()) {
                String krName = ML_PROCESS_TO_ENTITY.getOrDefault(contrib.getProcess(), contrib.getProcess());
                mlAnomalyByKrProcess.merge(krName, 1, Integer::sum);
            }
        }

        List<DashboardResponse.ProcessStat> processStats = processes.stream()
                .map(p -> {
                    int extraAnomalies = eventAnomalyByProcess.getOrDefault(p.getName(), 0L).intValue();
                    int extraWarnings = eventWarningByProcess.getOrDefault(p.getName(), 0L).intValue();
                    int mlExtra = mlAnomalyByKrProcess.getOrDefault(p.getName(), 0);
                    return DashboardResponse.ProcessStat.builder()
                            .name(p.getName())
                            .정상(p.getNormalCount())
                            .경고(p.getWarningCount() + extraWarnings)
                            .이상(p.getAnomalyCount() + extraAnomalies + mlExtra)
                            .build();
                })
                .collect(Collectors.toList());

            // ── order summary ──
            Map<OrderStatus, Long> orderCounts = orders.stream()
                .collect(Collectors.groupingBy(Order::getOrderStatus, Collectors.counting()));
            DashboardResponse.OrderSummary orderSummary = DashboardResponse.OrderSummary.builder()
                .total(orders.size())
                .created(orderCounts.getOrDefault(OrderStatus.CREATED, 0L).intValue())
                .partiallyAllocated(orderCounts.getOrDefault(OrderStatus.PARTIALLY_ALLOCATED, 0L).intValue())
                .fullyAllocated(orderCounts.getOrDefault(OrderStatus.FULLY_ALLOCATED, 0L).intValue())
                .completed(orderCounts.getOrDefault(OrderStatus.COMPLETED, 0L).intValue())
                .cancelled(orderCounts.getOrDefault(OrderStatus.CANCELLED, 0L).intValue())
                .build();

            // ── production summary ──
            Map<ProductionStatus, Long> productionCounts = productions.stream()
                .collect(Collectors.groupingBy(Production::getProductionStatus, Collectors.counting()));
            DashboardResponse.ProductionSummary productionSummary = DashboardResponse.ProductionSummary.builder()
                .total(productions.size())
                .planned(productionCounts.getOrDefault(ProductionStatus.PLANNED, 0L).intValue())
                .inProgress(productionCounts.getOrDefault(ProductionStatus.IN_PROGRESS, 0L).intValue())
                .completed(productionCounts.getOrDefault(ProductionStatus.COMPLETED, 0L).intValue())
                .stopped(productionCounts.getOrDefault(ProductionStatus.STOPPED, 0L).intValue())
                .cancelled(productionCounts.getOrDefault(ProductionStatus.CANCELLED, 0L).intValue())
                .build();

        // ── processDelayBreakdown from ML contributions, with DelayPredictionService fallback ──
        List<DashboardResponse.ProcessDelayBreakdown> processDelayBreakdown = new ArrayList<>();
        if (processed != null && !processed.getContributions().isEmpty()) {
            // ML 기반 (기존 로직)
            processDelayBreakdown = processed.getContributions().stream()
                    .map(c -> DashboardResponse.ProcessDelayBreakdown.builder()
                            .process(c.getProcess())
                            .totalDelayHours(c.getDelayMaxH())
                            .eventCount(1)
                            .build())
                    .collect(Collectors.toList());
        } else {
            // Fallback: DelayPredictionService (ProcessEvent 기반)
            try {
                var overview = delayPredictionService.getOverview();
                if (overview.getProcessBreakdown() != null) {
                    processDelayBreakdown = overview.getProcessBreakdown().stream()
                            .map(pb -> DashboardResponse.ProcessDelayBreakdown.builder()
                                    .process(pb.getProcess())
                                    .totalDelayHours(pb.getTotalDelayHours())
                                    .eventCount(pb.getEventCount())
                                    .build())
                            .collect(Collectors.toList());
                }
            } catch (Exception e) {
                log.warn("Fallback processDelayBreakdown failed", e);
            }
        }

        // ── ML prediction DTO + snapshot (only on fresh ML result) ──
        DashboardPredictionDto.CurrentPrediction currentPrediction = null;
        DashboardPredictionDto.DeltaSincePrev deltaSincePrev = null;
        List<DashboardPredictionDto.PredictionTrendPoint> predictionTrend = null;

        if (processed != null) {
            String statusStr = "OK";
            String now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

            currentPrediction = DashboardPredictionDto.CurrentPrediction.builder()
                    .predDelayMinH(processed.getDelayMinH())
                    .predDelayMaxH(processed.getDelayMaxH())
                    .riskLevel(processed.getRiskLevel().name())
                    .contributions(processed.getContributions())
                    .sources(sources)
                    .status(statusStr)
                    .lastUpdated(now)
                    .build();

            // Save snapshot only when ML result is freshly fetched
            if (ml != null && ml.fresh()) {
                try {
                    String contribJson = objectMapper.writeValueAsString(processed.getContributions());
                    String sourcesJson = objectMapper.writeValueAsString(sources);

                    DashboardPredictionSnapshot snapshot = DashboardPredictionSnapshot.create(
                            processed.getDelayMinH(),
                            processed.getDelayMaxH(),
                            processed.getRiskLevel(),
                            contribJson, sourcesJson, null
                    );
                    dashboardSnapshotRepository.save(snapshot);
                } catch (Exception snapEx) {
                    log.warn("Failed to save prediction snapshot", snapEx);
                }
            }

            // Delta + trend from recent snapshots
            try {
                List<DashboardPredictionSnapshot> recentSnapshots =
                        dashboardSnapshotRepository.findTop20ByOrderByCreatedAtDesc();

                if (recentSnapshots.size() >= 2) {
                    DashboardPredictionSnapshot prev = recentSnapshots.get(1);
                    double delayMinDelta = processed.getDelayMinH() - prev.getPredDelayMinH();
                    double delayMaxDelta = processed.getDelayMaxH() - prev.getPredDelayMaxH();
                    boolean riskChanged = !processed.getRiskLevel().name()
                            .equals(prev.getRiskLevel() != null ? prev.getRiskLevel().name() : "");

                    List<DashboardPredictionDto.DeltaDriver> drivers =
                            computeDrivers(processed.getContributions(), prev.getContributionsJson());

                    deltaSincePrev = DashboardPredictionDto.DeltaSincePrev.builder()
                            .delayMinDelta(Math.round(delayMinDelta * 100.0) / 100.0)
                            .delayMaxDelta(Math.round(delayMaxDelta * 100.0) / 100.0)
                            .riskChanged(riskChanged)
                            .drivers(drivers)
                            .build();
                }

                List<DashboardPredictionSnapshot> reversed = new ArrayList<>(recentSnapshots);
                Collections.reverse(reversed);
                predictionTrend = reversed.stream()
                        .map(s -> DashboardPredictionDto.PredictionTrendPoint.builder()
                                .t(s.getCreatedAt() != null
                                        ? s.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                                        : "")
                                .delayMax(s.getPredDelayMaxH())
                                .risk(s.getRiskLevel() != null ? s.getRiskLevel().name() : "LOW")
                                .build())
                        .collect(Collectors.toList());
            } catch (Exception trendEx) {
                log.warn("Failed to compute prediction trend/delta", trendEx);
            }
        }

        // ── originalDeadline from nearest active order ──
        String originalDeadline = resolveOriginalDeadline();

        return DashboardResponse.builder()
                .anomalyData(anomalyData)
                .warningData(warningData)
                .totalAnomalies(totalAnomalies)
                .totalWarnings(totalWarnings)
                .totalDelayHours(totalDelayHours)
                .originalDeadline(originalDeadline)
                .overallEfficiency(overallEfficiency)
                .productionEfficiency(productionEfficiency)
                .historyData(historyData)
                .processStats(processStats)
                .processDelayBreakdown(processDelayBreakdown)
                .overallRiskLevel(overallRiskLevel)
                .orderSummary(orderSummary)
                .productionSummary(productionSummary)
                .currentPrediction(currentPrediction)
                .deltaSincePrev(deltaSincePrev)
                .predictionTrend(predictionTrend)
                .build();
    }

    private String resolveOriginalDeadline() {
        try {
            List<Order> activeOrders = orderRepository.findByOrderStatusNotInOrderByDueDateAsc(
                    List.of(OrderStatus.CANCELLED, OrderStatus.COMPLETED));
            if (!activeOrders.isEmpty()) {
                LocalDateTime nearest = activeOrders.get(0).getDueDate();
                return nearest.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
        } catch (Exception e) {
            log.warn("Failed to resolve original deadline from orders", e);
        }
        return LocalDateTime.now().plusDays(7).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    @SuppressWarnings("unchecked")
    private List<DashboardPredictionDto.DeltaDriver> computeDrivers(
            List<DashboardPredictionDto.ProcessContribution> currentContribs,
            String prevContribJson
    ) {
        Map<String, Double> prevMap = new HashMap<>();
        if (prevContribJson != null && !prevContribJson.isBlank()) {
            try {
                List<Map<String, Object>> prevList = objectMapper.readValue(prevContribJson,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
                for (Map<String, Object> item : prevList) {
                    String process = (String) item.get("process");
                    Object maxH = item.get("delayMaxH");
                    if (process != null && maxH != null) {
                        prevMap.put(process, ((Number) maxH).doubleValue());
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse previous contributions JSON", e);
            }
        }

        Map<String, Double> currentMap = new HashMap<>();
        for (var c : currentContribs) {
            currentMap.put(c.getProcess(), c.getDelayMaxH());
        }

        Set<String> allProcesses = new HashSet<>();
        allProcesses.addAll(prevMap.keySet());
        allProcesses.addAll(currentMap.keySet());

        List<DashboardPredictionDto.DeltaDriver> drivers = new ArrayList<>();
        for (String proc : allProcesses) {
            double before = prevMap.getOrDefault(proc, 0.0);
            double after = currentMap.getOrDefault(proc, 0.0);
            double delta = after - before;
            if (Math.abs(delta) > 0.01) {
                drivers.add(DashboardPredictionDto.DeltaDriver.builder()
                        .process(proc)
                        .delayMaxBefore(before)
                        .delayMaxAfter(after)
                        .delayMaxDelta(Math.round(delta * 100.0) / 100.0)
                        .build());
            }
        }

        drivers.sort(Comparator.comparingDouble(
                (DashboardPredictionDto.DeltaDriver d) -> Math.abs(d.getDelayMaxDelta())).reversed());
        return drivers.size() > 3 ? drivers.subList(0, 3) : drivers;
    }
}
