import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Clock, RefreshCw, Package, CheckCircle, Factory, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { orderApi, OrderDto } from '../api/order';
import { productionApi, ProductionDto } from '../api/production';
import { apiUrl } from '../config/env';
import { useProduction } from '../context/ProductionContext';

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

interface OrderSummary {
  total: number;
  created: number;
  partiallyAllocated: number;
  fullyAllocated: number;
  completed: number;
  cancelled: number;
}

interface ProductionSummary {
  total: number;
  planned: number;
  inProgress: number;
  completed: number;
  stopped: number;
  cancelled: number;
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
  orderSummary?: OrderSummary;
  productionSummary?: ProductionSummary;
}

interface PredictionOverview {
  totalOrders: number;
  maxDelayHours: number;
  avgDelayHours: number;
  riskDistribution: Record<string, number>;
  orders: any[];
  processBreakdown?: ProcessDelayBreakdownItem[];
}

interface OrderListItem extends OrderDto {
  orderId?: number;
  id?: number;
  orderStatus?: string;
  orderQty?: number;
  vehicleModelName?: string;
}

interface ProductionListItem extends ProductionDto {
  productionId?: number;
  id?: number;
  productionStatus?: string;
}

interface OrderPrediction {
  order_id: number;
  delay_probability: number;
  expected_delay_hours: number;
  risk_level: string;
  total_score: number;
  process_scores: Record<string, number>;
  event_count: number;
  order_status: string;
  order_qty: number;
  vehicle_model: string;
  actual_delay_hours?: number;
}

interface DueDatePredictionRow {
  id: number;
  orderId: number;
  orderQty: number;
  snapshotStage: string;
  stopCountTotal?: number;
  elapsedMinutes?: number;
  remainingSlackMinutes?: number;
  delayFlag: number;
  delayProbability: number;
  predictedDelayMinutes: number;
  createdDate: string;
  currentUnitIndex?: number;
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

function formatMinutesToDayHourMinute(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  const total = Math.max(0, Math.round(value));
  if (total < 60) return `${total}분`;
  const totalHours = Math.floor(total / 60);
  const m = total % 60;
  if (totalHours < 24) {
    return m === 0 ? `${totalHours}시간` : `${totalHours}시간 ${m}분`;
  }
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  if (m === 0 && h === 0) return `${d}일`;
  if (m === 0) return `${d}일 ${h}시간`;
  if (h === 0) return `${d}일 ${m}분`;
  return `${d}일 ${h}시간 ${m}분`;
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [prevData, setPrevData] = useState<DashboardData | null>(null);
  const [prediction, setPrediction] = useState<PredictionOverview | null>(null);
  const [loading, setLoading] = useState(false);  // 초기값을 false로 변경해서 KPI가 바로 보이도록
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [productions, setProductions] = useState<ProductionListItem[]>([]);
  const [dueDateLatest, setDueDateLatest] = useState<DueDatePredictionRow[]>([]);
  const { productions: productionMap, getStages } = useProduction();

  const [useSSE, setUseSSE] = useState(true);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const productionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dueDatePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dueDateEsRef = useRef<EventSource | null>(null);

  // --- SAFE fetch helper (res.ok 체크 + token/credentials) ---
  const safeFetchJson = useCallback(async (url: string) => {
    const token = localStorage.getItem('token');

    const res = await fetch(apiUrl(url), {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      console.log('[Dashboard] Fetched:', next);
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
      const pred = unwrapResponse<PredictionOverview>(json);
      console.log('[Prediction] Fetched:', pred);
      setPrediction(pred);
    } catch (err) {
      console.error('Prediction fetch failed:', err);
    }
  }, [safeFetchJson]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await orderApi.listAll();
      const content: OrderListItem[] = response?.content ?? [];
      console.log('Orders fetched:', content.length, content);
      setOrders(content);
    } catch (err) {
      console.error('Order list fetch failed:', err);
    }
  }, []);

  const fetchProductions = useCallback(async () => {
    try {
      const response = await productionApi.list();
      const content: ProductionListItem[] = response?.content ?? [];
      console.log('Productions fetched:', content.length, content);
      setProductions(content);
    } catch (err) {
      console.error('Production list fetch failed:', err);
    }
  }, []);

  const fetchDueDateLatest = useCallback(async () => {
    try {
      const json = await safeFetchJson('/api/v1/duedate-predictions/latest?limit=50');
      const list = unwrapResponse<DueDatePredictionRow[]>(json) ?? [];
      setDueDateLatest(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('DueDate latest fetch failed:', err);
    }
  }, [safeFetchJson]);

  const activeData = data;
  const activePrediction = prediction;
  const activeLoading = loading;

  // SSE + Polling (항상 폴링 유지, SSE는 있으면 더 빠른 덮어쓰기)
  useEffect(() => {
    // 1) 항상 폴링을 켜서 "SSE 이벤트가 안 와도" 갱신되게 함
    fetchDashboard();
    pollRef.current = setInterval(fetchDashboard, 5_000);

    // 2) 예측 오버뷰도 폴링
    fetchPrediction();
    predPollRef.current = setInterval(fetchPrediction, 5_000);

    // 3) 주문/생산 목록도 폴링 (order/production 페이지와 동기화)
    fetchOrders();
    orderPollRef.current = setInterval(fetchOrders, 5_000);

    fetchProductions();
    productionPollRef.current = setInterval(fetchProductions, 5_000);

    fetchDueDateLatest();

    // 4) SSE는 추가로 연결(실시간 푸시)
    if (useSSE && typeof EventSource !== 'undefined') {
      const token = localStorage.getItem('token');

      const sseUrl = token
        ? apiUrl(`/api/v1/dashboard/stream?token=${encodeURIComponent(token)}`)
        : apiUrl('/api/v1/dashboard/stream');

      try {
        const es = new EventSource(sseUrl);
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

    // DueDate SSE (replaces polling)
    if (typeof EventSource !== 'undefined') {
      const dueDateUrl = apiUrl('/api/v1/duedate-predictions/stream?limit=50');
      try {
        const es = new EventSource(dueDateUrl);
        dueDateEsRef.current = es;

        const applyList = (raw: string) => {
          try {
            const parsed = JSON.parse(raw);
            const list = unwrapResponse<DueDatePredictionRow[]>(parsed) ?? parsed;
            if (Array.isArray(list)) setDueDateLatest(list);
          } catch (e) {
            console.error('DueDate SSE parse error:', e);
          }
        };

        const applySingle = (raw: string) => {
          try {
            const parsed = JSON.parse(raw);
            const item = unwrapResponse<DueDatePredictionRow>(parsed) ?? parsed;
            if (!item || !item.orderId) return;
            setDueDateLatest((prev) => {
              const next = Array.isArray(prev) ? [...prev] : [];
              const idx = next.findIndex((r) => r.orderId === item.orderId);
              if (idx >= 0) next[idx] = item;
              else next.unshift(item);
              return next.slice(0, 50);
            });
          } catch (e) {
            console.error('DueDate SSE parse error:', e);
          }
        };

        es.addEventListener('dueDateList', (e: MessageEvent) => applyList(e.data));
        es.addEventListener('dueDatePrediction', (e: MessageEvent) => applySingle(e.data));
        es.onerror = () => {
          try { es.close(); } catch {}
          dueDateEsRef.current = null;
          // fallback to polling if SSE fails
          if (!dueDatePollRef.current) {
            dueDatePollRef.current = setInterval(fetchDueDateLatest, 10_000);
          }
        };
      } catch (e) {
        if (!dueDatePollRef.current) {
          dueDatePollRef.current = setInterval(fetchDueDateLatest, 10_000);
        }
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
      if (orderPollRef.current) {
        clearInterval(orderPollRef.current);
        orderPollRef.current = null;
      }
      if (productionPollRef.current) {
        clearInterval(productionPollRef.current);
        productionPollRef.current = null;
      }
      if (dueDatePollRef.current) {
        clearInterval(dueDatePollRef.current);
        dueDatePollRef.current = null;
      }
      if (dueDateEsRef.current) {
        try { dueDateEsRef.current.close(); } catch {}
        dueDateEsRef.current = null;
      }
    };
  }, [useSSE, fetchDashboard, fetchPrediction, fetchOrders, fetchProductions, fetchDueDateLatest]);

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

  // ── Data not ready yet ──
  if (!activeData) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonChart />
      </div>
    );
  }

  const currentPrediction = activeData?.currentPrediction;

  const orderSummary = activeData?.orderSummary;
  const productionSummary = activeData?.productionSummary;
  
  const computedOrderSummary = (() => {
    if (!orders || orders.length === 0) return undefined;
    console.log('Computing order summary from', orders.length, 'orders');
    return {
      total: orders.length,
      created: orders.filter(o => o.orderStatus === 'CREATED').length,
      partiallyAllocated: orders.filter(o => o.orderStatus === 'PARTIALLY_ALLOCATED').length,
      fullyAllocated: orders.filter(o => o.orderStatus === 'FULLY_ALLOCATED').length,
      completed: orders.filter(o => o.orderStatus === 'COMPLETED').length,
      cancelled: orders.filter(o => o.orderStatus === 'CANCELLED').length,
    };
  })();
  
  const computedProductionSummary = (() => {
    if (!productions || productions.length === 0) return undefined;
    console.log('Computing production summary from', productions.length, 'productions');
    const statusOf = (p: ProductionListItem) => (p.productionStatus ?? (p as any)?.status ?? '').toString().toUpperCase();
    const planned = productions.filter(p => statusOf(p).includes('PLAN')).length;
    const inProgress = productions.filter(p => {
      const s = statusOf(p);
      return s.includes('IN_PROGRESS') || s.includes('INPROGRESS') || s.includes('RUN') || s.includes('START');
    }).length;
    const completed = productions.filter(p => {
      const s = statusOf(p);
      return s.includes('COMPLETE') || s.includes('DONE');
    }).length;
    const stopped = productions.filter(p => statusOf(p).includes('STOP')).length;
    const cancelled = productions.filter(p => statusOf(p).includes('CANCEL')).length;
    return {
      total: productions.length,
      planned,
      inProgress,
      completed,
      stopped,
      cancelled,
    };
  })();

  const resolvedOrderSummary = computedOrderSummary ?? orderSummary;
  const resolvedProductionSummary = computedProductionSummary ?? productionSummary;

  const fmtCount = (value?: number) => (value === undefined || value === null ? '—' : `${value}건`);
  const orderInProgress =
    resolvedOrderSummary
      ? (resolvedOrderSummary.partiallyAllocated ?? 0)
        + (resolvedOrderSummary.fullyAllocated ?? 0)
      : undefined;

  const orderIndex = new Map<number, OrderListItem>(
    (orders ?? [])
      .map(o => {
        const id = (o.orderId ?? o.id) as number | undefined;
        return id ? [id, o] as [number, OrderListItem] : null;
      })
      .filter((v): v is [number, OrderListItem] => !!v)
  );

  const mergedPredictionOrders = (activePrediction?.orders ?? []).map((order: any) => {
    const id = order.order_id ?? order.orderId ?? order.id;
    const mapped = orderIndex.get(id);
    return {
      ...order,
      order_id: id ?? order.order_id,
      order_status: mapped?.orderStatus ?? order.order_status,
      order_qty: mapped?.orderQty ?? order.order_qty,
      vehicle_model: mapped?.vehicleModelName ?? order.vehicle_model,
    };
  });

  const orderStatusChart = resolvedOrderSummary ? [
    { name: '생성', value: resolvedOrderSummary.created },
    { name: '진행', value: orderInProgress ?? 0 },
    { name: '완료', value: resolvedOrderSummary.completed },
  ] : [];

  const productionStatusChart = resolvedProductionSummary ? [
    { name: '계획', value: resolvedProductionSummary.planned },
    { name: '진행', value: resolvedProductionSummary.inProgress },
    { name: '완료', value: resolvedProductionSummary.completed },
  ] : [];

  const stageDefs = getStages();
  const snapshotStageLabel: Record<string, string> = {
    PRESS_DONE: "프레스",
    WELD_DONE: "차체(용접)",
    PAINT_DONE: "도장",
    ASSEMBLY_DONE: "의장",
    INSPECTION_DONE: "검사",
  };

  const productionUnitMap = new Map<number, { currentUnitIndex?: number; orderQty?: number }>(
    Array.from(productionMap?.values?.() ?? []).map((p) => [
      p.orderId,
      { currentUnitIndex: p.currentUnitIndex, orderQty: p.orderQty },
    ])
  );

  const dueDateRowsFromContext = Array.from(productionMap?.values?.() ?? [])
    .map((p) => {
      let latestIdx = -1;
      let latestPred: any = null;
      let latestErr: string | undefined = undefined;
      (p.stageResults ?? []).forEach((r, idx) => {
        if (r?.dueDatePrediction) {
          latestIdx = idx;
          latestPred = r.dueDatePrediction;
        }
        if (r?.dueDateError) {
          latestErr = r.dueDateError;
        }
      });
      if (!latestPred || latestIdx < 0) return null;
      return {
        orderId: p.orderId,
        orderQty: p.orderQty,
        currentUnitIndex: p.currentUnitIndex,
        stageName: stageDefs[latestIdx]?.name ?? `단계 ${latestIdx + 1}`,
        stopCountTotal: undefined as number | undefined,
        elapsedMinutes: undefined as number | undefined,
        remainingSlackMinutes: undefined as number | undefined,
        delayFlag: latestPred.delay_flag,
        delayProb: latestPred.delay_probability,
        delayMinutes: latestPred.predicted_delay_minutes,
        dueDateError: latestErr,
      };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .sort((a, b) => (a.orderId ?? 0) - (b.orderId ?? 0));

  const dueDateErrors = Array.from(productionMap?.values?.() ?? [])
    .map((p) => {
      const errs = (p.stageResults ?? [])
        .map((r, idx) => (r?.dueDateError ? { idx, err: r.dueDateError } : null))
        .filter((v): v is { idx: number; err: string } => !!v);
      if (errs.length === 0) return null;
      const last = errs[errs.length - 1];
      return {
        orderId: p.orderId,
        stageName: stageDefs[last.idx]?.name ?? `단계 ${last.idx + 1}`,
        err: last.err,
      };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .sort((a, b) => (a.orderId ?? 0) - (b.orderId ?? 0));

  const dueDateRowsFromServer = (dueDateLatest ?? []).map((row) => ({
    orderId: row.orderId,
    orderQty: row.orderQty,
    currentUnitIndex: productionUnitMap.get(row.orderId)?.currentUnitIndex,
    stageName: snapshotStageLabel[row.snapshotStage] ?? row.snapshotStage ?? "-",
    stopCountTotal: row.stopCountTotal,
    elapsedMinutes: row.elapsedMinutes,
    remainingSlackMinutes: row.remainingSlackMinutes,
    delayFlag: row.delayFlag,
    delayProb: row.delayProbability,
    delayMinutes: row.predictedDelayMinutes,
  }));

  const dueDateRows =
    dueDateRowsFromServer.length > 0 ? dueDateRowsFromServer : dueDateRowsFromContext;


  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">종합 대시보드</h2>
            <p className="text-gray-600 mt-1">전체 공정 상태 및 리스크 모니터링</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentPrediction && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>마지막 업데이트: {formatTimestamp(currentPrediction.lastUpdated)}</span>
            </div>
          )}
          <button
            onClick={() => {
              setLoading(true);
              fetchDashboard();
              fetchPrediction();
            }}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-900"
          >
            수동 새로고침
          </button>
        </div>
      </div>

      {currentPrediction?.status === 'PARTIAL' && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <span className="text-sm text-yellow-800">
            일부 공정 데이터를 가져오지 못했습니다 (
            {(currentPrediction?.sources ?? [])
              .filter((s: SourceStatus) => !s.ok)
              .map((s: SourceStatus) => processLabel(s.endpoint))
              .join(', ')}
            )
          </span>
        </div>
      )}

      {/* 실시간 납기 예측 (공정 진행 기반) */}
      <div className="mb-8 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">실시간 납기 예측</h3>
          </div>
        </div>

        {dueDateRows.length > 0 ? (
          <div className="grid grid-cols-1 lg:flex lg:gap-6">
            {/* 좌측: 집계 */}
            <div className="lg:w-1/3">
              <p className="text-sm font-semibold text-gray-700 mb-3">집계</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500">표시 중 주문</p>
                  <p className="text-2xl font-bold text-gray-900">{dueDateRows.length}개</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-green-600">정상</p>
                  <p className="text-2xl font-bold text-green-700">
                    {dueDateRows.filter(r => Number(r.delayFlag) !== 1).length}개
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs text-red-600">지연</p>
                  <p className="text-2xl font-bold text-red-700">
                    {dueDateRows.filter(r => Number(r.delayFlag) === 1).length}개
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <p className="text-xs text-indigo-600">평균 지연 확률</p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {(
                      dueDateRows.reduce((s, r) => s + Number(r.delayProb ?? 0), 0) /
                      Math.max(dueDateRows.length, 1) *
                      100
                    ).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* 우측: 상세 */}
            <div className="lg:flex-1 overflow-x-auto">
              <p className="text-sm font-semibold text-gray-700 mb-3">실시간 납기 예측 상세</p>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">주문 ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">차량 모델</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">진행 차량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">현재 공정</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">남은 여유(분)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">중지 누적</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">지연 여부</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">지연 확률</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">예상 지연</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dueDateRows.map((row) => {
                    const prob = Number(row.delayProb ?? 0);
                    const minutes = Number(row.delayMinutes ?? 0);
                    const model = orderIndex.get(row.orderId)?.vehicleModelName ?? "-";
                    return (
                      <tr key={row.orderId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">#{row.orderId}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{model}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.orderQty}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {row.currentUnitIndex ? `${row.currentUnitIndex} / ${row.orderQty}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.stageName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {formatMinutesToDayHourMinute(row.remainingSlackMinutes)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {row.stopCountTotal !== undefined ? Math.round(row.stopCountTotal) : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            Number(row.delayFlag) === 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {Number(row.delayFlag) === 1 ? '지연' : '정상'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{(prob * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatMinutesToDayHourMinute(minutes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="h-[140px] flex items-center justify-center text-gray-400 text-sm">
            아직 납기 예측 결과가 없습니다. 생산을 시작하면 표시됩니다.
          </div>
        )}

        {dueDateRows.length === 0 && dueDateErrors.length > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800 mb-2">duedate 호출 실패 내역</p>
            <div className="space-y-1 text-xs text-yellow-700">
              {dueDateErrors.map((e) => (
                <div key={`${e.orderId}-${e.stageName}`}>
                  주문 #{e.orderId} · {e.stageName}: {e.err}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Order / Production KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 주문</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCount(resolvedOrderSummary?.total)}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">취소 {fmtCount(resolvedOrderSummary?.cancelled)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">주문 진행</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCount(orderInProgress)}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">할당 진행 중 합산</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">주문 완료</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCount(resolvedOrderSummary?.completed)}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">전체 대비 완료율</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 생산</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCount(resolvedProductionSummary?.total)}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Factory className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">계획 {fmtCount(resolvedProductionSummary?.planned)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">생산 진행</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCount(resolvedProductionSummary?.inProgress)}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">중지 {fmtCount(resolvedProductionSummary?.stopped)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">생산 완료</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmtCount(resolvedProductionSummary?.completed)}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">취소 {fmtCount(resolvedProductionSummary?.cancelled)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">주문 상태 분포</h3>
          {orderStatusChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={orderStatusChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#6366f1" name="주문 수" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              주문 상태 데이터가 없습니다.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">생산 상태 분포</h3>
          {productionStatusChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={productionStatusChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#10b981" name="생산 수" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
              생산 상태 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
