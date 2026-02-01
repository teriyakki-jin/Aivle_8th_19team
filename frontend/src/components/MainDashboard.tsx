import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { Switch } from '@/components/ui/switch';
import { useSimulationData } from '@/hooks/useSimulationData';

// ===== Types =====

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

interface DeltaDriver {
  process: string;
  delayMaxBefore: number;
  delayMaxAfter: number;
  delayMaxDelta: number;
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

// ===== Helpers =====

const RISK_STYLES: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  LOW: { label: '안전', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', icon: 'bg-green-100' },
  MEDIUM: { label: '주의', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', icon: 'bg-yellow-100' },
  HIGH: { label: '위험', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', icon: 'bg-red-100' },
  CRITICAL: { label: '심각', bg: 'bg-red-200', text: 'text-red-800', border: 'border-red-400', icon: 'bg-red-200' },
};

function getRiskStyle(level?: string | null) {
  return RISK_STYLES[level ?? ''] ?? RISK_STYLES['LOW'];
}

const PROCESS_NAME_KR: Record<string, string> = {
  press_vibration: '프레스(진동)',
  press_image: '프레스(이미지)',
  paint: '도장',
  welding: '용접',
  windshield: '앞유리',
  engine: '엔진',
  body_inspect: '차체',
};

function processLabel(key: string): string {
  return PROCESS_NAME_KR[key] ?? key;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** ApiResponse envelope 또는 raw 객체를 안전하게 unwrap */
function unwrapResponse<T>(json: any): T {
  return json?.data ?? json;
}

// ===== Skeleton Components =====

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-32" />
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-28 mt-4" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
      <div className="h-[300px] bg-gray-100 rounded" />
    </div>
  );
}

// ===== Component =====

export function MainDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [prevData, setPrevData] = useState<DashboardData | null>(null);
  const [prediction, setPrediction] = useState<PredictionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSimMode, setIsSimMode] = useState(false);
  const sim = useSimulationData(isSimMode);

  const [useSSE, setUseSSE] = useState(true);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- SAFE fetch helper (res.ok 체크 + token/credentials) ---
  const safeFetchJson = useCallback(async (url: string) => {
    const token = localStorage.getItem('token');

    const res = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
    }

    return await res.json();
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const json = await safeFetchJson('/api/v1/dashboard/main');
      const next = unwrapResponse<DashboardData>(json);
      setData(prev => {
        setPrevData(prev);
        return next;
      });
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
      setError('대시보드 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [safeFetchJson]);

  const fetchPrediction = useCallback(async () => {
    try {
      const json = await safeFetchJson('/api/v1/delay-prediction/overview');
      setPrediction(unwrapResponse<PredictionOverview>(json));
    } catch (err) {
      console.error('Prediction fetch failed:', err);
    } finally {
      setPredLoading(false);
    }
  }, [safeFetchJson]);

  const handleModeSwitch = useCallback((checked: boolean) => {
    setIsSimMode(checked);
    if (!checked) {
      setLoading(true);
      fetchDashboard();
      fetchPrediction();
    }
  }, [fetchDashboard, fetchPrediction]);

  // Derive active data based on mode
  const activeData = isSimMode ? sim.data : data;
  const activePrediction = isSimMode ? sim.prediction : prediction;
  const activeLoading = isSimMode ? sim.loading : loading;

  // SSE + Polling (항상 폴링 유지, SSE는 있으면 더 빠른 덮어쓰기)
  useEffect(() => {
    if (isSimMode) {
      // In simulation mode, close SSE and stop polling
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (predPollRef.current) {
        clearInterval(predPollRef.current);
        predPollRef.current = null;
      }
      return;
    }

    // 1) 항상 폴링을 켜서 "SSE 이벤트가 안 와도" 갱신되게 함
    fetchDashboard();
    pollRef.current = setInterval(fetchDashboard, 15_000);

    // 2) 예측 오버뷰도 폴링
    fetchPrediction();
    predPollRef.current = setInterval(fetchPrediction, 15_000);

    // 3) SSE는 추가로 연결(실시간 푸시)
    if (useSSE && typeof EventSource !== 'undefined') {
      const token = localStorage.getItem('token');

      const sseUrl = token
        ? `/api/v1/dashboard/stream?token=${encodeURIComponent(token)}`
        : '/api/v1/dashboard/stream';

      try {
        const es = new EventSource(sseUrl, { withCredentials: true } as any);
        esRef.current = es;

        const handleSSEData = (raw: string) => {
          try {
            const parsed = JSON.parse(raw);
            const next = unwrapResponse<DashboardData>(parsed);
            setData(prev => {
              setPrevData(prev);
              return next;
            });
            setLoading(false);
            setError(null);
          } catch (parseErr) {
            console.error('SSE parse error:', parseErr);
          }
        };

        es.addEventListener('dashboard', (e: MessageEvent) => handleSSEData(e.data));
        es.onmessage = (e: MessageEvent) => handleSSEData(e.data);

        es.onerror = () => {
          console.warn('SSE error — keep polling fallback');
          try { es.close(); } catch {}
          esRef.current = null;
          setUseSSE(false);
        };
      } catch (e) {
        console.warn('SSE init failed — keep polling fallback', e);
        setUseSSE(false);
      }
    }

    return () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (predPollRef.current) {
        clearInterval(predPollRef.current);
        predPollRef.current = null;
      }
    };
  }, [isSimMode, useSSE, fetchDashboard, fetchPrediction]);

  // ── Loading skeleton ──
  if (activeLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="mb-8"><SkeletonChart /></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (!isSimMode && (error || !activeData)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">데이터 로드 실패</p>
            <p className="text-sm text-red-600 mt-1">{error ?? '알 수 없는 오류가 발생했습니다.'}</p>
            <button
              onClick={() => {
                setLoading(true);
                fetchDashboard();
              }}
              className="mt-3 text-sm text-red-700 underline"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeData) {
    return null;
  }

  const {
    anomalyData,
    totalAnomalies,
    totalWarnings,
    totalDelayHours,
    originalDeadline: deadlineStr,
    overallEfficiency,
    productionEfficiency,
    currentPrediction,
    deltaSincePrev,
    predictionTrend,
  } = activeData;

  const delayDays = Math.floor(totalDelayHours / 24);
  const delayHours = Math.floor(totalDelayHours % 24);

  const originalDeadline = new Date(deadlineStr);
  const predictedDeadline = new Date(originalDeadline.getTime() + totalDelayHours * 60 * 60 * 1000);

  // ── Risk / delivery status (API 기반) ──
  const resolvedRiskLevel = currentPrediction?.riskLevel ?? activeData.overallRiskLevel;
  const riskStyle = getRiskStyle(resolvedRiskLevel);

  const getDeliveryStatus = () => {
    if (resolvedRiskLevel && RISK_STYLES[resolvedRiskLevel]) {
      const s = RISK_STYLES[resolvedRiskLevel];
      return { status: s.label, icon: s.icon, textColor: s.text };
    }
    // totalDelayHours 기반 fallback
    if (totalDelayHours < 24) return { status: '안전', icon: 'bg-green-100', textColor: 'text-green-600' };
    if (totalDelayHours < 72) return { status: '주의', icon: 'bg-yellow-100', textColor: 'text-yellow-600' };
    return { status: '위험', icon: 'bg-red-100', textColor: 'text-red-600' };
  };

  const deliveryStatus = getDeliveryStatus();

  // ── KPI delta 계산 (prevData 기반, 하드코딩 제거) ──
  const efficiencyDelta = prevData ? +(overallEfficiency - prevData.overallEfficiency).toFixed(1) : null;
  const prodEfficiencyDelta = prevData ? +(productionEfficiency - prevData.productionEfficiency).toFixed(1) : null;

  const overallData = (activeData.processStats ?? []).map(ps => ({
    name: ps.name,
    정상: ps.정상,
    경고: ps.경고,
    이상: ps.이상,
  }));

  const deliveryRisk = activeData.historyData ?? [];

  const processStatus = (() => {
    const stats = activeData.processStats ?? [];
    const total정상 = stats.reduce((s, p) => s + p.정상, 0);
    const total경고 = stats.reduce((s, p) => s + p.경고, 0);
    const total이상 = stats.reduce((s, p) => s + p.이상, 0);
    return [
      { name: '정상', value: total정상, color: '#22c55e' },
      { name: '경고', value: total경고, color: '#f59e0b' },
      { name: '이상', value: total이상, color: '#ef4444' },
    ];
  })();

  // ── 공정별 지연 시간 분포 — 4단계 fallback ──
  const delayContribution = (() => {
    // 1순위: currentPrediction.contributions (ML 직접 결과)
    const contribs = currentPrediction?.contributions ?? [];
    if (contribs.length > 0) {
      return contribs.map(c => ({
        name: processLabel(c.process),
        지연시간: c.delayMaxH,
      }));
    }
    // 2순위: dashboard/main의 processDelayBreakdown
    const pdb = activeData.processDelayBreakdown ?? [];
    if (pdb.length > 0) {
      return pdb.map(b => ({
        name: processLabel(b.process),
        지연시간: b.totalDelayHours,
      }));
    }
    // 3순위: delay-prediction/overview의 processBreakdown
    const pb = activePrediction?.processBreakdown ?? [];
    if (pb.length > 0) {
      return pb.map(b => ({
        name: processLabel(b.process),
        지연시간: b.totalDelayHours,
      }));
    }
    // 4순위: anomalyData 기반 계산 fallback
    return (anomalyData ?? []).map((item: any) => ({
      name: processLabel(item.process),
      지연시간: (item.count ?? 0) * (item.avgDelayPerIssue ?? 0),
    }));
  })();

  const deltaMaxH = deltaSincePrev?.delayMaxDelta ?? 0;
  const deltaSign = deltaMaxH > 0 ? '▲' : deltaMaxH < 0 ? '▼' : '—';
  const deltaColor = deltaMaxH > 0 ? 'text-red-600' : deltaMaxH < 0 ? 'text-green-600' : 'text-gray-400';
  const deltaBgColor = deltaMaxH > 0 ? 'bg-red-50' : deltaMaxH < 0 ? 'bg-green-50' : 'bg-gray-50';

  const sparkData = (predictionTrend ?? []).map((pt, i) => ({
    idx: i,
    val: pt.delayMax,
  }));

  /** KPI 카드 하단 delta 표시 헬퍼 — delta가 null이면 렌더링하지 않음 */
  const renderDelta = (delta: number | null, unit = '%', positiveIsBad = false) => {
    if (delta === null || delta === 0) return null;
    const isUp = delta > 0;
    const color = (isUp === positiveIsBad) ? 'text-red-600' : 'text-green-600';
    return (
      <p className={`text-xs ${color} mt-4`}>
        {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{delta}{unit} 이전 대비
      </p>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">종합 대시보드</h2>
            <p className="text-gray-600 mt-1">전체 공정 상태 및 리스크 모니터링</p>
          </div>
          {isSimMode && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
              시뮬레이션 모드
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-600">시뮬레이션</span>
            <Switch checked={isSimMode} onCheckedChange={handleModeSwitch} />
          </label>

          {!isSimMode && currentPrediction && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>마지막 업데이트: {formatTimestamp(currentPrediction.lastUpdated)}</span>
            </div>
          )}

          {!isSimMode && (
            <button
              onClick={() => {
                setLoading(true);
                fetchDashboard();
                fetchPrediction();
              }}
              className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
            >
              수동 새로고침
            </button>
          )}
        </div>
      </div>

      {currentPrediction?.status === 'PARTIAL' && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <span className="text-sm text-yellow-800">
            일부 공정 데이터를 가져오지 못했습니다 (
            {currentPrediction.sources
              .filter(s => !s.ok)
              .map(s => processLabel(s.endpoint))
              .join(', ')}
            )
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* 전체 가동률 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 가동률</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{overallEfficiency}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          {renderDelta(efficiencyDelta, '%', false)}
        </div>

        {/* 이상 발생 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">이상 발생</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalAnomalies}건</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          {totalWarnings > 0 && (
            <p className="text-xs text-red-600 mt-4">경고 {totalWarnings}건 포함</p>
          )}
        </div>

        {/* 예상 지연 시간 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">예상 지연 시간</p>
              {currentPrediction ? (
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {currentPrediction.predDelayMaxH.toFixed(1)}h
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({currentPrediction.predDelayMinH.toFixed(1)}~)
                  </span>
                </p>
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {delayDays > 0 ? `${delayDays}일 ` : ''}{delayHours}시간
                </p>
              )}
            </div>
            <div className={`w-12 h-12 ${deliveryStatus.icon} rounded-lg flex items-center justify-center`}>
              <Clock className={`w-6 h-6 ${deliveryStatus.textColor}`} />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <p className={`text-xs ${deliveryStatus.textColor}`}>상태: {deliveryStatus.status}</p>
            {deltaSincePrev && deltaMaxH !== 0 && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${deltaBgColor} ${deltaColor}`}>
                {deltaSign} {deltaMaxH > 0 ? '+' : ''}{deltaMaxH.toFixed(1)}h
              </span>
            )}
          </div>

          {sparkData.length > 1 && (
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 생산 효율 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">생산 효율</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{productionEfficiency}%</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          {renderDelta(prodEfficiencyDelta, '%', false)}
        </div>
      </div>

      {/* Delivery Prediction Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border-2 border-blue-200 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">납기 예측 분석</h3>
              {resolvedRiskLevel && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                  {riskStyle.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">예정 납기일</p>
                <p className="text-lg font-bold text-gray-900">
                  {originalDeadline.toLocaleDateString('ko-KR', {
                    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">예상 납기일</p>
                <p className={`text-lg font-bold ${deliveryStatus.textColor}`}>
                  {predictedDeadline.toLocaleDateString('ko-KR', {
                    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">총 지연 시간</p>
                <p className={`text-lg font-bold ${deliveryStatus.textColor}`}>
                  {totalDelayHours.toFixed(1)}시간
                </p>
                {(delayDays > 0 || delayHours > 0) && (
                  <p className="text-xs text-gray-500 mt-1">
                    ({delayDays > 0 ? `${delayDays}일 ` : ''}{delayHours}시간)
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-white rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-2">공정별 지연 기여도</p>

              {currentPrediction && currentPrediction.contributions.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {currentPrediction.contributions.map((c) => {
                    const style = getRiskStyle(
                      c.delayMaxH >= 24 ? 'CRITICAL' : c.delayMaxH >= 12 ? 'HIGH' : c.delayMaxH >= 4 ? 'MEDIUM' : 'LOW'
                    );
                    return (
                      <div key={c.process} className={`text-center p-2 rounded-lg ${style.bg}`}>
                        <p className="text-xs text-gray-600">{processLabel(c.process)}</p>
                        <p className={`text-sm font-bold ${style.text}`}>
                          {c.delayMinH.toFixed(0)}~{c.delayMaxH.toFixed(0)}h
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : anomalyData.length > 0 ? (
                <div className="grid grid-cols-5 gap-2">
                  {anomalyData.map((item: any) => {
                    const delay = (item.count ?? 0) * (item.avgDelayPerIssue ?? 0);
                    return (
                      <div key={item.process} className="text-center">
                        <p className="text-xs text-gray-600">{processLabel(item.process)}</p>
                        <p className="text-sm font-bold text-gray-900">{delay.toFixed(1)}h</p>
                        <p className="text-xs text-gray-500">({item.count}건)</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">지연 기여도 데이터가 없습니다.</p>
              )}
            </div>

            {deltaSincePrev && deltaSincePrev.drivers.length > 0 && (
              <div className="mt-4 p-4 bg-white rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">주요 변동 요인 (이전 대비)</p>
                <div className="space-y-2">
                  {deltaSincePrev.drivers.map((driver) => {
                    const isUp = driver.delayMaxDelta > 0;
                    return (
                      <div key={driver.process} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{processLabel(driver.process)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">{driver.delayMaxBefore.toFixed(1)}h</span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className={`font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                            {driver.delayMaxAfter.toFixed(1)}h
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isUp ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{driver.delayMaxDelta.toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">공정별 상태 분포</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={overallData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="정상" stackId="a" fill="#22c55e" />
              <Bar dataKey="경고" stackId="a" fill="#f59e0b" />
              <Bar dataKey="이상" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">전체 공정 상태</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {processStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">누적 지연 시간 추이</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={deliveryRisk}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="날짜" />
              <YAxis label={{ value: '시간', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="지연시간" stroke="#ef4444" strokeWidth={2} name="누적 지연 (시간)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">공정별 지연 시간 분포</h3>
          {delayContribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={delayContribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: '시간', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="지연시간" fill="#f59e0b" name="지연 시간 (h)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              지연 시간 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
