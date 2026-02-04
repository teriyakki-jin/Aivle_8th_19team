import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Clock, AlertCircle, RefreshCw, Package, ClipboardList, CheckCircle, Factory, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { orderApi, OrderDto } from '../api/order';
import { productionApi, ProductionDto } from '../api/production';
import { apiUrl } from '../config/env';

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [prevData, setPrevData] = useState<DashboardData | null>(null);
  const [prediction, setPrediction] = useState<PredictionOverview | null>(null);
  const [loading, setLoading] = useState(false);  // 초기값을 false로 변경해서 KPI가 바로 보이도록
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [productions, setProductions] = useState<ProductionListItem[]>([]);

  const [useSSE, setUseSSE] = useState(true);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const productionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- SAFE fetch helper (res.ok 체크 + token/credentials) ---
  const safeFetchJson = useCallback(async (url: string) => {
    const token = localStorage.getItem('token');

    const res = await fetch(apiUrl(url), {
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
      console.error('Error details:', {
        message: err instanceof Error ? err.message : String(err),
        url: '/api/v1/delay-prediction/overview'
      });
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

  const activeData = data;
  const activePrediction = prediction;
  const activeLoading = loading;

  // SSE + Polling (항상 폴링 유지, SSE는 있으면 더 빠른 덮어쓰기)
  useEffect(() => {
    // 1) 항상 폴링을 켜서 "SSE 이벤트가 안 와도" 갱신되게 함
    fetchDashboard();
    pollRef.current = setInterval(fetchDashboard, 3_000);

    // 2) 예측 오버뷰도 폴링
    fetchPrediction();
    predPollRef.current = setInterval(fetchPrediction, 3_000);

    // 3) 주문/생산 목록도 폴링 (order/production 페이지와 동기화)
    fetchOrders();
    orderPollRef.current = setInterval(fetchOrders, 5_000);

    fetchProductions();
    productionPollRef.current = setInterval(fetchProductions, 5_000);

    // 4) SSE는 추가로 연결(실시간 푸시)
    if (useSSE && typeof EventSource !== 'undefined') {
      const token = localStorage.getItem('token');

      const sseUrl = token
        ? apiUrl(`/api/v1/dashboard/stream?token=${encodeURIComponent(token)}`)
        : apiUrl('/api/v1/dashboard/stream');

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
      if (orderPollRef.current) {
        clearInterval(orderPollRef.current);
        orderPollRef.current = null;
      }
      if (productionPollRef.current) {
        clearInterval(productionPollRef.current);
        productionPollRef.current = null;
      }
    };
  }, [useSSE, fetchDashboard, fetchPrediction, fetchOrders, fetchProductions]);

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
  if (error && !activeData) {
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

  // ── Data guard (API 실패/권한 문제 등) ──
  if (!activeData) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <p className="font-semibold text-yellow-800">대시보드 데이터를 불러오지 못했습니다.</p>
          <p className="text-sm text-yellow-700 mt-1">
            로그인/권한/서버 응답을 확인해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const currentPrediction = activeData?.currentPrediction;

  // ── 공정별 지연 시간 분포 — 4단계 fallback ──
  const delayContribution = (() => {
    // 1순위: currentPrediction.contributions (ML 직접 결과)
    const contribs: ProcessContribution[] = currentPrediction?.contributions ?? [];
    if (contribs.length > 0) {
      return contribs.map((c: ProcessContribution) => ({
        name: processLabel(c.process),
        지연시간: c.delayMaxH,
      }));
    }
    // 2순위: dashboard/main의 processDelayBreakdown
    const pdb: ProcessDelayBreakdownItem[] = activeData?.processDelayBreakdown ?? [];
    if (pdb.length > 0) {
      return pdb.map((b: ProcessDelayBreakdownItem) => ({
        name: processLabel(b.process),
        지연시간: b.totalDelayHours,
      }));
    }
    // 3순위: delay-prediction/overview의 processBreakdown
    const pb: ProcessDelayBreakdownItem[] = activePrediction?.processBreakdown ?? [];
    if (pb.length > 0) {
      return pb.map((b: ProcessDelayBreakdownItem) => ({
        name: processLabel(b.process),
        지연시간: b.totalDelayHours,
      }));
    }
    // 4순위: order-level process_scores 집계 (주문 예측 상세 기반)
    const orders = (activePrediction?.orders ?? []) as Array<{ process_scores?: Record<string, number> }>;
    if (orders.length > 0) {
      const scoreMap: Record<string, number> = {};
      for (const o of orders) {
        const scores = o.process_scores ?? {};
        for (const [proc, score] of Object.entries(scores)) {
          scoreMap[proc] = (scoreMap[proc] ?? 0) + (Number(score) || 0);
        }
      }
      const aggregated = Object.entries(scoreMap)
        .map(([proc, score]) => ({ name: processLabel(proc), 지연시간: score }))
        .sort((a, b) => b.지연시간 - a.지연시간);
      if (aggregated.length > 0) return aggregated;
    }
    return [];
  })();

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

  const orderInProgress = resolvedOrderSummary
    ? (resolvedOrderSummary.created + resolvedOrderSummary.partiallyAllocated + resolvedOrderSummary.fullyAllocated)
    : undefined;
  const fmtCount = (value?: number) => (value === undefined || value === null ? '—' : `${value}건`);

  const orderIndex = new Map<number, OrderListItem>(
    orders
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
    { name: '부분할당', value: resolvedOrderSummary.partiallyAllocated },
    { name: '전체할당', value: resolvedOrderSummary.fullyAllocated },
    { name: '완료', value: resolvedOrderSummary.completed },
    { name: '취소', value: resolvedOrderSummary.cancelled },
  ] : [];

  const productionStatusChart = resolvedProductionSummary ? [
    { name: '계획', value: resolvedProductionSummary.planned },
    { name: '진행', value: resolvedProductionSummary.inProgress },
    { name: '완료', value: resolvedProductionSummary.completed },
    { name: '중지', value: resolvedProductionSummary.stopped },
    { name: '취소', value: resolvedProductionSummary.cancelled },
  ] : [];


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
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
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
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            생성 {fmtCount(resolvedOrderSummary?.created)} · 일부 {fmtCount(resolvedOrderSummary?.partiallyAllocated)} · 전체 {fmtCount(resolvedOrderSummary?.fullyAllocated)}
          </p>
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


      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">공정별 지연 시간 분포</h3>
          <span className="text-xs text-gray-500">실시간 집계</span>
        </div>
        {delayContribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={delayContribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: '시간', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="지연시간" stroke="#f59e0b" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
            지연 시간 데이터가 없습니다.
          </div>
        )}
      </div>

      {/* 납기 예측 섹션 */}
      {activePrediction && (
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">납기 예측 분석</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">전체 주문</p>
                <p className="text-lg font-bold text-gray-900">{activePrediction.totalOrders ?? 0}개</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">최대 예상 지연</p>
                <p className="text-lg font-bold text-orange-600">{(activePrediction.maxDelayHours ?? 0).toFixed(1)}h</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">평균 예상 지연</p>
                <p className="text-lg font-bold text-blue-600">{(activePrediction.avgDelayHours ?? 0).toFixed(1)}h</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 위험도 분포 (좌측) */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">위험도별 주문 분포</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(activePrediction.riskDistribution ?? {}).map(([level, count]) => {
                  const style = getRiskStyle(level);
                  const totalOrders = activePrediction.totalOrders || 1;
                  return (
                    <div key={level} className={`${style.bg} rounded-lg p-4 border ${style.border}`}>
                      <p className={`text-sm font-medium ${style.text}`}>{level}</p>
                      <p className={`text-2xl font-bold ${style.text} mt-1`}>{count}개</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {((count / totalOrders) * 100).toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 주문별 예측 결과 테이블 (우측) */}
            <div className="overflow-x-auto">
              <p className="text-sm font-semibold text-gray-700 mb-3">주문별 예측 상세</p>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문 ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">차량 모델</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지연 확률</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예상 지연</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">위험도</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이벤트</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mergedPredictionOrders.slice(0, 10).map((order: OrderPrediction) => {
                    const riskStyle = getRiskStyle(order.risk_level);
                    return (
                      <tr key={order.order_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">#{order.order_id ?? 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.vehicle_model ?? 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.order_qty ?? 0}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            order.order_status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            order.order_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {order.order_status ?? 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${riskStyle.bg}`}
                                style={{ width: `${(order.delay_probability ?? 0) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600">
                              {((order.delay_probability ?? 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-orange-600">
                          {(order.expected_delay_hours ?? 0).toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                            {order.risk_level ?? 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{order.event_count ?? 0}건</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {mergedPredictionOrders.length > 10 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">
                    상위 10개 주문만 표시 (전체: {mergedPredictionOrders.length}개)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 공정별 지연 기여도 (납기 예측 기준) */}
          {activePrediction.processBreakdown && activePrediction.processBreakdown.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">공정별 지연 기여도 (전체 주문 기준)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {activePrediction.processBreakdown.map((breakdown: any) => {
                  const score = breakdown.total_score ?? breakdown.totalDelayHours ?? 0;
                  const avgScore = breakdown.avg_score ?? 0;
                  return (
                    <div key={breakdown.process} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">{processLabel(breakdown.process)}</p>
                      <p className="text-lg font-bold text-gray-900">{score.toFixed(1)}점</p>
                      <p className="text-xs text-gray-500">{breakdown.count ?? 0}건</p>
                      <p className="text-xs text-blue-600 mt-1">
                        평균 {avgScore.toFixed(1)}점
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
