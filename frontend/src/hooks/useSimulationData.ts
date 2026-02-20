import { useState } from 'react';

// Stub for simulation data hook
export function useSimulationData(enabled: boolean) {
  const [loading] = useState(false);

  return {
    data: null,
    prediction: null,
    loading,
  };
}
import { useState, useEffect, useRef, useCallback } from 'react';

// ===== Types (mirroring MainDashboard) =====

interface ProcessContribution {
  process: string;
  delayMinH: number;
  delayMaxH: number;
}

interface SourceStatus {
  endpoint: string;
  ok: boolean;
  reason?: string;
}

interface CurrentPrediction {
  predDelayMinH: number;
  predDelayMaxH: number;
  riskLevel: string;
  contributions: ProcessContribution[];
  sources: SourceStatus[];
  status: 'OK' | 'PARTIAL';
  lastUpdated: string;
}

interface DeltaDriver {
  process: string;
  delayMaxBefore: number;
  delayMaxAfter: number;
  delayMaxDelta: number;
}

interface DeltaSincePrev {
  delayMinDelta: number;
  delayMaxDelta: number;
  riskChanged: boolean;
  drivers: DeltaDriver[];
}

interface PredictionTrendPoint {
  t: string;
  delayMax: number;
  risk: string;
}

interface ProcessStat {
  name: string;
  정상: number;
  경고: number;
  이상: number;
}

interface HistoryDataPoint {
  날짜: string;
  지연시간: number;
}

interface ProcessDelayBreakdownItem {
  process: string;
  totalDelayHours: number;
  eventCount: number;
}

interface DashboardData {
  anomalyData: any[];
  warningData: any[];
  totalAnomalies: number;
  totalWarnings: number;
  totalDelayHours: number;
  originalDeadline: string;
  overallEfficiency: number;
  productionEfficiency: number;
  overallRiskLevel?: string;
  historyData?: HistoryDataPoint[];
  processStats?: ProcessStat[];
  processDelayBreakdown?: ProcessDelayBreakdownItem[];
  currentPrediction?: CurrentPrediction;
  deltaSincePrev?: DeltaSincePrev;
  predictionTrend?: PredictionTrendPoint[];
}

interface PredictionOverview {
  totalOrders: number;
  maxDelayHours: number;
  avgDelayHours: number;
  riskDistribution: Record<string, number>;
  orders: any[];
  processBreakdown?: ProcessDelayBreakdownItem[];
}

// ===== Constants =====

const PROCESSES = [
  'press_vibration', 'press_image', 'paint', 'welding',
  'windshield', 'engine', 'body_inspect',
] as const;

const PROCESS_NAME_KR: Record<string, string> = {
  press_vibration: '프레스(진동)',
  press_image: '프레스(이미지)',
  paint: '도장',
  welding: '용접',
  windshield: '앞유리',
  engine: '엔진',
  body_inspect: '차체',
};

const BASE_ANOMALY: Record<string, number> = {
  press_vibration: 3, press_image: 2, paint: 2, welding: 4,
  windshield: 1, engine: 3, body_inspect: 2,
};

const DELAY_FACTOR: Record<string, number> = {
  press_vibration: 1.5, press_image: 1.2, paint: 2.0, welding: 2.5,
  windshield: 1.0, engine: 2.2, body_inspect: 1.8,
};

// ===== Helpers =====

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getRiskLevel(totalDelayHours: number): string {
  if (totalDelayHours < 8) return 'LOW';
  if (totalDelayHours < 24) return 'MEDIUM';
  if (totalDelayHours < 48) return 'HIGH';
  return 'CRITICAL';
}

// Fixed 7-day history baseline
const HISTORY_BASELINE: HistoryDataPoint[] = (() => {
  const days: HistoryDataPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      날짜: `${d.getMonth() + 1}/${d.getDate()}`,
      지연시간: +(5 + Math.random() * 20).toFixed(1),
    });
  }
  return days;
})();

// ===== Generator =====

interface PrevState {
  anomalyCounts: Record<string, number>;
  trendPoints: PredictionTrendPoint[];
  prevTotalDelayHours: number;
  prevContributions: ProcessContribution[];
}

function generateSimulationData(prev?: PrevState): {
  data: DashboardData;
  prediction: PredictionOverview;
  nextState: PrevState;
} {
  // 1. anomaly counts
  const anomalyCounts: Record<string, number> = {};
  for (const proc of PROCESSES) {
    const base = BASE_ANOMALY[proc];
    const prevCount = prev?.anomalyCounts[proc] ?? base;
    anomalyCounts[proc] = clamp(prevCount + randInt(-1, 1), 0, base * 3);
  }

  // 2. warning counts
  const warningCounts: Record<string, number> = {};
  for (const proc of PROCESSES) {
    warningCounts[proc] = Math.round(anomalyCounts[proc] * 0.4);
  }

  // Build anomalyData / warningData arrays
  const anomalyData = PROCESSES.map(proc => ({
    process: proc,
    name: PROCESS_NAME_KR[proc],
    count: anomalyCounts[proc],
    avgDelayPerIssue: DELAY_FACTOR[proc],
  }));

  const warningData = PROCESSES.map(proc => ({
    process: proc,
    name: PROCESS_NAME_KR[proc],
    count: warningCounts[proc],
  }));

  const totalAnomalies = Object.values(anomalyCounts).reduce((s, v) => s + v, 0);
  const totalWarnings = Object.values(warningCounts).reduce((s, v) => s + v, 0);

  // 3. totalDelayHours
  const totalDelayHours = +PROCESSES.reduce(
    (sum, proc) => sum + anomalyCounts[proc] * DELAY_FACTOR[proc], 0
  ).toFixed(1);

  // 4. risk level
  const overallRiskLevel = getRiskLevel(totalDelayHours);

  // 5-6. efficiency
  const overallEfficiency = +clamp(95 - totalAnomalies * 0.5, 80, 98).toFixed(1);
  const productionEfficiency = +clamp(92 - totalAnomalies * 0.4, 80, 98).toFixed(1);

  // 7. processStats
  const processStats: ProcessStat[] = PROCESSES.map(proc => {
    const warn = warningCounts[proc];
    const anomaly = anomalyCounts[proc];
    const normal = Math.max(0, 100 - warn - anomaly);
    return { name: PROCESS_NAME_KR[proc], 정상: normal, 경고: warn, 이상: anomaly };
  });

  // 8. historyData — fixed baseline + today
  const today = new Date();
  const historyData: HistoryDataPoint[] = [
    ...HISTORY_BASELINE,
    { 날짜: `${today.getMonth() + 1}/${today.getDate()}`, 지연시간: totalDelayHours },
  ];

  // 9. processDelayBreakdown
  const processDelayBreakdown: ProcessDelayBreakdownItem[] = PROCESSES.map(proc => ({
    process: proc,
    totalDelayHours: +(anomalyCounts[proc] * DELAY_FACTOR[proc]).toFixed(1),
    eventCount: anomalyCounts[proc],
  }));

  // 10. currentPrediction
  const contributions: ProcessContribution[] = PROCESSES.map(proc => ({
    process: proc,
    delayMinH: +(anomalyCounts[proc] * DELAY_FACTOR[proc] * 0.6).toFixed(1),
    delayMaxH: +(anomalyCounts[proc] * DELAY_FACTOR[proc]).toFixed(1),
  }));

  const sources: SourceStatus[] = PROCESSES.map(proc => ({
    endpoint: proc,
    ok: true,
  }));

  const nowIso = new Date().toISOString();
  const predDelayMaxH = totalDelayHours;
  const predDelayMinH = +(totalDelayHours * 0.6).toFixed(1);

  const currentPrediction: CurrentPrediction = {
    predDelayMinH,
    predDelayMaxH,
    riskLevel: overallRiskLevel,
    contributions,
    sources,
    status: 'OK',
    lastUpdated: nowIso,
  };

  // 11. deltaSincePrev
  const prevTotalDelay = prev?.prevTotalDelayHours ?? totalDelayHours;
  const prevContribs = prev?.prevContributions ?? contributions;

  const drivers: DeltaDriver[] = PROCESSES
    .map(proc => {
      const before = prevContribs.find(c => c.process === proc)?.delayMaxH ?? 0;
      const after = contributions.find(c => c.process === proc)?.delayMaxH ?? 0;
      return {
        process: proc,
        delayMaxBefore: before,
        delayMaxAfter: after,
        delayMaxDelta: +(after - before).toFixed(1),
      };
    })
    .filter(d => d.delayMaxDelta !== 0)
    .sort((a, b) => Math.abs(b.delayMaxDelta) - Math.abs(a.delayMaxDelta))
    .slice(0, 3);

  const deltaSincePrev: DeltaSincePrev = {
    delayMinDelta: +(predDelayMinH - prevTotalDelay * 0.6).toFixed(1),
    delayMaxDelta: +(predDelayMaxH - prevTotalDelay).toFixed(1),
    riskChanged: getRiskLevel(prevTotalDelay) !== overallRiskLevel,
    drivers,
  };

  // 12. predictionTrend — FIFO max 20
  const prevTrend = prev?.trendPoints ?? [];
  const newPoint: PredictionTrendPoint = {
    t: nowIso,
    delayMax: predDelayMaxH,
    risk: overallRiskLevel,
  };
  const predictionTrend = [...prevTrend, newPoint].slice(-20);

  // 13. originalDeadline — 7 days from now
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  const originalDeadline = deadline.toISOString();

  const dashboardData: DashboardData = {
    anomalyData,
    warningData,
    totalAnomalies,
    totalWarnings,
    totalDelayHours,
    originalDeadline,
    overallEfficiency,
    productionEfficiency,
    overallRiskLevel,
    historyData,
    processStats,
    processDelayBreakdown,
    currentPrediction,
    deltaSincePrev,
    predictionTrend,
  };

  const predictionOverview: PredictionOverview = {
    totalOrders: 12,
    maxDelayHours: predDelayMaxH,
    avgDelayHours: +(predDelayMaxH * 0.7).toFixed(1),
    riskDistribution: {
      LOW: overallRiskLevel === 'LOW' ? 8 : 4,
      MEDIUM: overallRiskLevel === 'MEDIUM' ? 5 : 3,
      HIGH: overallRiskLevel === 'HIGH' ? 3 : 2,
      CRITICAL: overallRiskLevel === 'CRITICAL' ? 2 : 1,
    },
    orders: [],
    processBreakdown: processDelayBreakdown,
  };

  return {
    data: dashboardData,
    prediction: predictionOverview,
    nextState: {
      anomalyCounts,
      trendPoints: predictionTrend,
      prevTotalDelayHours: totalDelayHours,
      prevContributions: contributions,
    },
  };
}

// ===== Hook =====

export function useSimulationData(enabled: boolean): {
  data: DashboardData | null;
  prediction: PredictionOverview | null;
  loading: boolean;
} {
  const [data, setData] = useState<DashboardData | null>(null);
  const [prediction, setPrediction] = useState<PredictionOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const stateRef = useRef<PrevState | undefined>(undefined);

  const tick = useCallback(() => {
    const result = generateSimulationData(stateRef.current);
    stateRef.current = result.nextState;
    setData(result.data);
    setPrediction(result.prediction);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setPrediction(null);
      stateRef.current = undefined;
      return;
    }

    // Initial generation
    setLoading(true);
    tick();

    const interval = setInterval(tick, 5_000);
    return () => clearInterval(interval);
  }, [enabled, tick]);

  return { data, prediction, loading };
}
