// src/components/EngineVibrationDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrderSelector } from "./OrderSelector";
import { mlResultsApi, MLAnalysisResultDto } from "../api/mlResults";
import {
  ArrowLeft,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Target,
  Timer,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

type Pred01 = 0 | 1;

type MonitorEntry = {
  time: string;
  prediction: Pred01;
  judgement: "NORMAL" | "ABNORMAL";
};

function nowHHMMSS(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad" | "info" | "purple";
}) {
  const valueClass =
    tone === "good"
      ? "text-green-600"
      : tone === "bad"
      ? "text-red-600"
      : tone === "info"
      ? "text-blue-600"
      : tone === "purple"
      ? "text-purple-600"
      : "text-gray-900";

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>
      </div>
      <p className={cn("text-4xl font-bold mb-2", valueClass)}>{value}</p>
      {sub ? <p className={cn("text-xs font-medium", valueClass)}>{sub}</p> : null}
    </div>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function EngineVibrationDashboard() {
  return (
    <OrderSelector processName="엔진 진동 검사">
      {(selectedOrderId) => <EngineVibrationDashboardContent orderId={selectedOrderId} />}
    </OrderSelector>
  );
}

function EngineVibrationDashboardContent({ orderId }: { orderId: number | null }) {
  const navigate = useNavigate();
  const [systemStatus, setSystemStatus] = useState<"WAITING" | "READY">("WAITING");

  const [result, setResult] = useState<{
    prediction: Pred01;
    judgement: "NORMAL" | "ABNORMAL";
    time: string;
  } | null>(null);

  const [stats, setStats] = useState({
    totalCount: 0,
    abnormalCount: 0,
    normalRate: 100.0,
    cycleTime: "1.0s",
  });

  const [buffer, setBuffer] = useState<MonitorEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    const parseAdditional = (item: MLAnalysisResultDto): any => {
      if (!item.additionalInfo) return null;
      try {
        return JSON.parse(item.additionalInfo);
      } catch {
        return null;
      }
    };

    const load = async () => {
      setError(null);
      try {
        const list = await mlResultsApi.list({
          orderId,
          serviceType: "engine",
          limit: 40,
        });
        if (!mounted) return;
        if (!list || list.length === 0) {
          setResult(null);
          setBuffer([]);
          setStats({ totalCount: 0, abnormalCount: 0, normalRate: 100.0, cycleTime: "-" });
          setSystemStatus("WAITING");
          return;
        }

        const entries: MonitorEntry[] = list.map((item) => {
          const info = parseAdditional(item) || {};
          const predictionRaw =
            typeof info.prediction === "number"
              ? info.prediction
              : typeof item.prediction === "number"
              ? item.prediction
              : 0;
          const prediction = predictionRaw === 1 ? 1 : 0;
          const judgementRaw = info.judgement ?? info.status ?? item.status;
          const judgement: "NORMAL" | "ABNORMAL" =
            judgementRaw === "NORMAL" || judgementRaw === "ABNORMAL"
              ? judgementRaw
              : prediction === 1
              ? "NORMAL"
              : "ABNORMAL";
          return {
            time: item.createdDate
              ? new Date(item.createdDate).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : nowHHMMSS(),
            prediction: prediction as Pred01,
            judgement,
          };
        });

        const latest = entries[0] ?? null;
        if (latest) {
          setResult({
            prediction: latest.prediction,
            judgement: latest.judgement,
            time: latest.time,
          });
        } else {
          setResult(null);
        }

        const total = entries.length;
        const abnormal = entries.filter((e) => e.judgement === "ABNORMAL").length;
        const normalRate = total === 0 ? 100 : ((total - abnormal) / total) * 100;
        setStats({
          totalCount: total,
          abnormalCount: abnormal,
          normalRate: Number(normalRate.toFixed(1)),
          cycleTime: "-",
        });

        setBuffer(entries.slice(0, 30));
        setSystemStatus("READY");
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "ML 결과 조회 실패");
        setSystemStatus("WAITING");
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const trend = useMemo(() => {
    return buffer.map((d) => ({
      시간: d.time,
      상태: d.judgement === "NORMAL" ? 1 : 0,
    }));
  }, [buffer]);

  const distBar = useMemo(() => {
    const normal = stats.totalCount - stats.abnormalCount;
    return [
      { 구분: "정상", 건수: normal },
      { 구분: "이상", 건수: stats.abnormalCount },
    ];
  }, [stats]);

  const abnormalRate = stats.totalCount === 0 ? 0 : (stats.abnormalCount / stats.totalCount) * 100;

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/order/production")}
            className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
            title="생산 관리로 돌아가기"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center">
              <Layers className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">엔진 진동 분석</h2>
              <p className="text-gray-600 mt-1">엔진 진동 이상 탐지 및 이력 관리</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <span className={cn(
            "px-3 py-1 rounded-full text-sm font-semibold",
            systemStatus === "READY" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
          )}>
            {systemStatus}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KpiCard
          icon={<Target className="w-5 h-5 text-blue-600" />}
          label="전체 검사 수"
          value={stats.totalCount.toLocaleString()}
          sub="최근 40건 기준"
          tone="info"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="이상률"
          value={`${abnormalRate.toFixed(1)}%`}
          sub={`${stats.abnormalCount}건 이상`}
          tone="bad"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="정상률"
          value={`${stats.normalRate}%`}
          sub={`${stats.totalCount - stats.abnormalCount}건 정상`}
          tone="good"
        />
        <KpiCard
          icon={<Timer className="w-5 h-5 text-purple-600" />}
          label="이상 감지 수"
          value={stats.abnormalCount.toLocaleString()}
          sub="누적 이상 건수"
          tone="purple"
        />
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Main: Left chart + Right result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left: Trend Chart */}
        <Card
          title="정상/이상 추이"
          badge={
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
              정상=1 / 이상=0
            </span>
          }
        >
          <div style={{ height: "280px" }}>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="시간" stroke="#94a3b8" style={{ fontSize: "12px" }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 1]} ticks={[0, 1]} stroke="#94a3b8" style={{ fontSize: "12px" }} />
                  <Tooltip
                    formatter={(value: any) => (Number(value) === 1 ? "정상" : "이상")}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #f1f5f9",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  <Line type="stepAfter" dataKey="상태" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                분석 데이터가 없습니다.
              </div>
            )}
          </div>
        </Card>

        {/* Right: Analysis Result */}
        <Card
          title="현재 분석 결과"
          badge={
            result ? (
              <span className={cn(
                "px-3 py-1 text-[10px] font-bold rounded-full border",
                result.judgement === "NORMAL"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : "text-red-700 bg-red-50 border-red-200"
              )}>
                {result.judgement === "NORMAL" ? "정상" : "이상"}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">대기</span>
            )
          }
        >
          {!result ? (
            <div className="text-sm text-gray-500 py-16 text-center">분석 대기 중...</div>
          ) : (
            <div className="space-y-5">
              {/* 검사 정보 */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-bold text-gray-900 mb-4">검사 정보</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">판정</div>
                    <div className="text-gray-900 font-semibold mt-1 text-2xl">
                      {result.judgement === "NORMAL" ? "정상" : "이상"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">시간</div>
                    <div className="text-gray-900 font-semibold mt-1 text-lg">{result.time}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">정상 비율</div>
                    <div className="text-gray-900 font-semibold mt-1">{stats.normalRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">이상 감지</div>
                    <div className="text-gray-900 font-semibold mt-1">{stats.abnormalCount}건</div>
                  </div>
                </div>
              </div>

              {/* 분포 차트 */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-bold text-gray-900 mb-4">정상 / 이상 분포</div>
                <div style={{ height: "150px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distBar}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="구분" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                      <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #f1f5f9",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar dataKey="건수" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* History Table */}
      <Card
        title="최근 분석 이력"
        badge={
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
            최근 {Math.min(buffer.length, 30)}건
          </span>
        }
      >
        <div className="overflow-auto max-h-[420px] rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr className="text-left text-gray-600">
                <th className="p-3 font-semibold">시간</th>
                <th className="p-3 font-semibold">상태</th>
                <th className="p-3 font-semibold">판정</th>
              </tr>
            </thead>
            <tbody>
              {buffer.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-10 text-gray-400">
                    분석 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                buffer.map((entry, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 whitespace-nowrap text-gray-700">{entry.time}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full border text-xs font-bold",
                          entry.judgement === "NORMAL"
                            ? "text-green-700 bg-green-50 border-green-200"
                            : "text-red-700 bg-red-50 border-red-200"
                        )}
                      >
                        {entry.judgement === "NORMAL" ? "정상" : "이상"}
                      </span>
                    </td>
                    <td className="p-3 text-gray-800">
                      {entry.judgement === "NORMAL" ? "정상 진동" : "이상 진동 감지"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          * 주문에 저장된 ML 결과를 표시합니다.
        </div>
      </Card>
    </div>
  );
}
