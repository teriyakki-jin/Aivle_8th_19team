import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Car,
  AlertTriangle,
  CheckCircle2,
  Target,
  Timer,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OrderSelector } from "./OrderSelector";
import { ML_IMAGE_BASE } from "../config/env";
import { mlResultsApi, MLAnalysisResultDto } from "../api/mlResults";

type PartKey = "door" | "bumper" | "headlamp" | "taillamp" | "radiator";

type Detection = {
  cls: number;
  name: string;
  conf: number;
  bbox: [number, number, number, number];
};

type BodyResult = {
  part: PartKey;
  pass_fail: "PASS" | "FAIL";
  detections: Detection[];
  original_image_url?: string | null;
  result_image_url?: string | null;
  error?: string;
  source?: string;
  sequence?: { index_next: number; count: number };
};

const API_BASE = ML_IMAGE_BASE;

const PARTS: { key: PartKey; label: string }[] = [
  { key: "door", label: "도어" },
  { key: "bumper", label: "범퍼" },
  { key: "headlamp", label: "헤드램프" },
  { key: "taillamp", label: "테일램프" },
  { key: "radiator", label: "라디에이터" },
];

function joinUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function nowHHMMSS() {
  const now = new Date();
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}:${String(
    now.getSeconds()
  ).padStart(2, "0")}`;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function BodyAssemblyDashboardInner({ orderId }: { orderId: number | null }) {
  const navigate = useNavigate();

  const [results, setResults] = useState<
    Partial<Record<PartKey, BodyResult | null>>
  >({});
  const [lastUpdated, setLastUpdated] = useState<string>("--:--:--");
  const [error, setError] = useState<string | null>(null);

  const [batchHistory, setBatchHistory] = useState<
    { time: string; failParts: number; totalDetections: number }[]
  >([]);

  const stats = useMemo(() => {
    const vals = Object.values(results).filter(Boolean) as BodyResult[];
    const inspected = vals.length;
    const fails = vals.filter((r) => r.pass_fail === "FAIL").length;
    const passes = vals.filter((r) => r.pass_fail === "PASS").length;
    const dets = vals.reduce((acc, r) => acc + (r.detections?.length ?? 0), 0);
    const yieldRate =
      inspected > 0 ? ((passes / inspected) * 100).toFixed(1) : "0.0";
    const defectRate =
      inspected > 0 ? ((fails / inspected) * 100).toFixed(1) : "0.0";
    return { inspected, passes, fails, dets, yieldRate, defectRate };
  }, [results]);

  const partsDetChart = useMemo(() => {
    return PARTS.map((p) => ({
      name: p.label,
      detections: (results[p.key]?.detections?.length ?? 0) as number,
    }));
  }, [results]);

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

    const normalizeBodyResult = (raw: any): BodyResult | null => {
      if (!raw) return null;
      return {
        part: raw.part as PartKey,
        pass_fail: (raw.pass_fail ?? raw.status ?? raw.judgement ?? "PASS") as "PASS" | "FAIL",
        detections: Array.isArray(raw.detections) ? raw.detections : [],
        original_image_url: raw.original_image_url ?? null,
        result_image_url: raw.result_image_url ?? null,
        error: raw.error,
        source: raw.source,
        sequence: raw.sequence,
      };
    };

    const load = async () => {
      setError(null);
      try {
        const list = await mlResultsApi.list({
          orderId,
          serviceType: "body_assembly",
          limit: 30,
        });
        if (!mounted) return;

        if (!list || list.length === 0) {
          setResults({});
          setBatchHistory([]);
          setLastUpdated("--:--:--");
          return;
        }

        const latestItem = list[0];
        const latestInfo = parseAdditional(latestItem);

        let nextResults: Partial<Record<PartKey, BodyResult | null>> = {};
        if (latestInfo?.results) {
          const rawResults = latestInfo.results as Record<string, any>;
          PARTS.forEach((p) => {
            const normalized = normalizeBodyResult(rawResults[p.key]);
            if (normalized) {
              nextResults[p.key] = normalized;
            }
          });
        } else if (latestInfo) {
          const normalized = normalizeBodyResult(latestInfo);
          if (normalized?.part) {
            nextResults[normalized.part] = normalized;
          }
        }

        setResults(nextResults);
        setLastUpdated(
          latestItem.createdDate
            ? new Date(latestItem.createdDate).toLocaleTimeString()
            : nowHHMMSS()
        );

        const history = list
          .slice()
          .reverse()
          .map((item) => {
            const info = parseAdditional(item);
            if (info?.results) {
              const rawResults = info.results as Record<string, any>;
              const failParts = PARTS.filter(
                (p) => rawResults?.[p.key]?.pass_fail === "FAIL"
              ).length;
              const totalDetections = PARTS.reduce(
                (acc, p) => acc + (rawResults?.[p.key]?.detections?.length ?? 0),
                0
              );
              return {
                time: item.createdDate
                  ? new Date(item.createdDate).toLocaleTimeString()
                  : nowHHMMSS(),
                failParts,
                totalDetections,
              };
            }
            if (info) {
              const normalized = normalizeBodyResult(info);
              const failParts = normalized?.pass_fail === "FAIL" ? 1 : 0;
              const totalDetections = normalized?.detections?.length ?? 0;
              return {
                time: item.createdDate
                  ? new Date(item.createdDate).toLocaleTimeString()
                  : nowHHMMSS(),
                failParts,
                totalDetections,
              };
            }
            return null;
          })
          .filter((row): row is { time: string; failParts: number; totalDetections: number } => !!row)
          .slice(-30);
        setBatchHistory(history);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "ML 결과 조회 실패");
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
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
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Car className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">차체 조립 모니터링</h2>
              <p className="text-gray-600 mt-1">부품별 비전 검사 결과 및 결함 탐지</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KpiCard
          icon={<Target className="w-5 h-5 text-blue-600" />}
          label="검사 부품 수"
          value={stats.inspected.toLocaleString()}
          sub="이번 배치 처리 파트"
          tone="info"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="불량률"
          value={`${stats.defectRate}%`}
          sub={`${stats.fails}건 불합격`}
          tone="bad"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="양품률"
          value={`${stats.yieldRate}%`}
          sub={`${stats.passes}건 합격`}
          tone="good"
        />
        <KpiCard
          icon={<Timer className="w-5 h-5 text-purple-600" />}
          label="총 검출 수"
          value={stats.dets.toLocaleString()}
          sub="누적 결함 감지"
          tone="purple"
        />
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Main: Left parts result + Right charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left: Part-by-part results */}
        <Card
          title="최신 검사 결과 (파트별)"
          badge={
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
              {lastUpdated}
            </span>
          }
        >
          <div className="space-y-4">
            {PARTS.map((p) => {
              const data = results[p.key] as BodyResult | null | undefined;
              const pf = data?.pass_fail;
              const detCount = data?.detections?.length ?? 0;

              return (
                <div
                  key={p.key}
                  className={cn(
                    "p-4 rounded-xl border",
                    pf === "FAIL"
                      ? "bg-red-50 border-red-100"
                      : pf === "PASS"
                      ? "bg-green-50 border-green-100"
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-800">{p.label}</span>
                    {pf ? (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold border",
                          pf === "PASS"
                            ? "bg-green-200 text-green-800 border-green-300"
                            : "bg-red-200 text-red-800 border-red-300"
                        )}
                      >
                        {pf === "PASS" ? "합격" : "불합격"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400">대기</span>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">감지: {detCount}건</div>

                  {(data?.original_image_url || data?.result_image_url) && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {data?.original_image_url && (
                        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                          <div className="px-2 py-1 text-[10px] text-gray-500 border-b border-gray-100">원본</div>
                          <div className="aspect-[16/9] w-full bg-white">
                            <img
                              src={joinUrl(data.original_image_url)}
                              alt={`${p.key}-orig`}
                              className="w-full h-full object-contain object-center p-1"
                            />
                          </div>
                        </div>
                      )}
                      {data?.result_image_url && (
                        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                          <div className="px-2 py-1 text-[10px] text-gray-500 border-b border-gray-100">결과</div>
                          <div className="aspect-[16/9] w-full bg-white">
                            <img
                              src={joinUrl(data.result_image_url)}
                              alt={`${p.key}-res`}
                              className="w-full h-full object-contain object-center p-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Analysis summary + charts */}
        <div className="space-y-6">
          <Card
            title="배치 불량 추이"
            badge={
              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
                최근 {batchHistory.length}건
              </span>
            }
          >
            <div style={{ height: "250px" }}>
              {batchHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={batchHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} domain={[0, 5]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #f1f5f9",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="failParts" stroke="#dc2626" strokeWidth={3} dot={{ fill: "#dc2626", r: 4 }} isAnimationActive={false} name="불량 부품" />
                    <Line type="monotone" dataKey="totalDetections" stroke="#2563eb" strokeWidth={3} dot={{ fill: "#2563eb", r: 4 }} isAnimationActive={false} name="총 감지 수" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  배치 데이터가 없습니다.
                </div>
              )}
            </div>
          </Card>

          <Card
            title="부위별 감지 분포"
            badge={
              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
                배치 스냅샷
              </span>
            }
          >
            <div style={{ height: "250px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partsDetChart} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #f1f5f9",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar dataKey="detections" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={28} name="감지 수" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* History Table */}
      <Card
        title="최근 분석 이력"
        badge={
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
            최근 {batchHistory.length}건
          </span>
        }
      >
        <div className="overflow-auto max-h-[420px] rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr className="text-left text-gray-600">
                <th className="p-3 font-semibold">시간</th>
                <th className="p-3 font-semibold">불량 부품 수</th>
                <th className="p-3 font-semibold">총 감지 수</th>
                <th className="p-3 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {batchHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-10 text-gray-400">
                    분석 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                [...batchHistory].reverse().map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 whitespace-nowrap text-gray-700">{row.time}</td>
                    <td className="p-3 text-gray-800">{row.failParts}건</td>
                    <td className="p-3 text-gray-800">{row.totalDetections}건</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full border text-xs font-bold",
                          row.failParts > 0
                            ? "text-red-700 bg-red-50 border-red-200"
                            : "text-green-700 bg-green-50 border-green-200"
                        )}
                      >
                        {row.failParts > 0 ? "불량" : "정상"}
                      </span>
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

export function BodyAssemblyDashboard() {
  return (
    <OrderSelector processName="차체 조립">
      {(_orderId) => <BodyAssemblyDashboardInner orderId={_orderId} />}
    </OrderSelector>
  );
}

export default BodyAssemblyDashboard;
