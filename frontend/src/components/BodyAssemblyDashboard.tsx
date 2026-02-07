import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
} from "recharts";
import {
  Car,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Activity,
  Layers,
  X,
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

const API_BASE = ML_IMAGE_BASE; // 이미지용

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

function PassFailPill({ value }: { value: "PASS" | "FAIL" }) {
  const pass = value === "PASS";
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-bold border",
        pass
          ? "bg-green-200 text-green-800 border-green-300"
          : "bg-red-200 text-red-800 border-red-300"
      )}
    >
      {pass ? "합격" : "불합격"}
    </span>
  );
}

function BodyAssemblyDashboardInner({ orderId }: { orderId: number | null }) {
  const navigate = useNavigate();

  // ✅ 버튼 없이 자동 모니터링
  const [systemStatus, setSystemStatus] = useState<
    "WAITING" | "MONITORING"
  >("WAITING");

  const [results, setResults] = useState<
    Partial<Record<PartKey, BodyResult | null>>
  >({});
  const [lastUpdated, setLastUpdated] = useState<string>("--:--:--");
  const [error, setError] = useState<string | null>(null);

  // 배치 단위 히스토리(차트용)
  const [batchHistory, setBatchHistory] = useState<
    { time: string; failParts: number; totalDetections: number }[]
  >([]);

  // ✅ Real-time Logs: 5칸 “고정 슬롯”
  const [logSlots, setLogSlots] = useState<
    { time: string; part: PartKey; pass_fail: "PASS" | "FAIL"; detCount: number }[]
  >([]);

  // 모달
  const [isModalOpen, setIsModalOpen] = useState(false);


  const stats = useMemo(() => {
    const vals = Object.values(results).filter(Boolean) as BodyResult[];
    const inspected = vals.length;
    const fails = vals.filter((r) => r.pass_fail === "FAIL").length;
    const passes = vals.filter((r) => r.pass_fail === "PASS").length;
    const dets = vals.reduce((acc, r) => acc + (r.detections?.length ?? 0), 0);

    const yieldRate =
      inspected > 0 ? ((passes / inspected) * 100).toFixed(1) : "0.0";
    return { inspected, passes, fails, dets, yieldRate };
  }, [results]);

  const partsDetChart = useMemo(() => {
    return PARTS.map((p) => ({
      name: p.label,
      detections: (results[p.key]?.detections?.length ?? 0) as number,
    }));
  }, [results]);

  const ngList = useMemo(() => {
    return PARTS.map((p) => results[p.key])
      .filter((r): r is BodyResult => !!r)
      .filter((r) => r.pass_fail === "FAIL" || !!r.error);
  }, [results]);

  const getAnalysis = (r: BodyResult) => {
    if (r.error) return `모델 처리 오류: ${r.error}`;
    if ((r.detections?.length ?? 0) === 0) return "결함 탐지 없음 (PASS)";
    const top = r.detections?.[0];
    const topStr = top
      ? `${top.name} (conf ${Math.round(top.conf * 100)}%)`
      : "결함";
    return `${topStr} 포함 ${r.detections.length}건 탐지 — 시각검사/재작업 필요`;
  };

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
          setLogSlots([]);
          setLastUpdated("--:--:--");
          setSystemStatus("WAITING");
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
        setSystemStatus("MONITORING");

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

        const t = latestItem.createdDate
          ? new Date(latestItem.createdDate).toLocaleTimeString()
          : nowHHMMSS();
        const newSlots = PARTS.map((p) => {
          const r: BodyResult | undefined = nextResults[p.key] ?? undefined;
          return {
            time: t,
            part: p.key,
            pass_fail: (r?.pass_fail ?? "PASS") as "PASS" | "FAIL",
            detCount: r?.detections?.length ?? 0,
          };
        });
        setLogSlots(newSlots);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "ML 결과 조회 실패");
        setSystemStatus("WAITING");
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  // ✅ 최신 검사 결과 순서
  const latestCards = useMemo(() => {
    const get = (k: PartKey) => results[k] as BodyResult | null | undefined;
    return {
      door: get("door"),
      bumper: get("bumper"),
      headlamp: get("headlamp"),
      taillamp: get("taillamp"),
      radiator: get("radiator"),
    };
  }, [results]);

  // ✅ 이미지 잘림 방지
  const ImgBox = ({
    label,
    src,
    alt,
  }: {
    label: string;
    src?: string | null;
    alt: string;
  }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-2 py-1 text-[10px] text-gray-500 border-b border-gray-100">
        {label}
      </div>
      <div className="aspect-[16/9] w-full bg-white">
        {src ? (
          <img
            src={joinUrl(src)}
            alt={alt}
            className="w-full h-full object-contain object-center p-1"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[10px] text-gray-400">
            -
          </div>
        )}
      </div>
    </div>
  );

  const LatestPartCard = ({
    part,
    label,
    data,
    span2,
  }: {
    part: PartKey;
    label: string;
    data: BodyResult | null | undefined;
    span2?: boolean;
  }) => {
    const pf = data?.pass_fail;
    const detCount = data?.detections?.length ?? 0;

    return (
      <div
        className={cn(
          "p-4 rounded-xl border",
          span2 ? "md:col-span-2" : "",
          pf === "FAIL"
            ? "bg-red-50 border-red-100"
            : pf === "PASS"
            ? "bg-green-50 border-green-100"
            : "bg-gray-50 border-gray-200"
        )}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-[12px] font-bold text-gray-800">{label}</span>
          {pf ? (
            <PassFailPill value={pf} />
          ) : (
            <span className="text-[10px] font-bold text-gray-400">대기</span>
          )}
        </div>

        <div className="text-sm font-bold text-gray-900">
          감지: {detCount}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ImgBox label="원본" src={data?.original_image_url} alt={`${part}-orig`} />
          <ImgBox label="결과" src={data?.result_image_url} alt={`${part}-res`} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {/* 돌아가기 버튼 */}
              <button
                onClick={() => navigate("/order/production")}
                className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                title="생산 관리로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Car className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  차체 조립 모니터링
                </h2>
                <p className="text-gray-600 mt-1">
                  부품별 비전 검사 결과 자동 수집 및 결함 탐지
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  최근 갱신: <span className="font-mono">{lastUpdated}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-gray-600">양품률</p>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-2">
              {stats.yieldRate}%
            </p>
            <p className="text-xs text-green-600 font-medium">합격 비율(현재 배치)</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">검사 부품 수</p>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-2">{stats.inspected}</p>
            <p className="text-xs text-blue-600 font-medium">이번 배치 처리 파트 수</p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-left rounded-2xl shadow-sm p-6 border-2 border-transparent hover:border-red-400 hover:shadow-lg transition-all cursor-pointer z-10 block w-full outline-none"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-gray-600">불량 감지</p>
              </div>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  stats.fails > 0 ? "bg-red-500 animate-pulse" : "bg-gray-300"
                )}
              />
            </div>
            <p className="text-4xl font-bold text-red-600 mb-2">{stats.fails}</p>
            <p className="text-xs text-red-600 font-medium">불합격 상세 리포트 보기</p>
          </button>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-600">사이클 시간</p>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-2">
              {batchHistory.length}
            </p>
            <p className="text-xs text-purple-600 font-medium">저장된 결과 수</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", "bg-blue-500")} />
                <h3 className="text-lg font-bold text-gray-900">배치 불량 추이</h3>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full">
                상태: {systemStatus === "MONITORING" ? "모니터링" : "대기"}
              </span>
            </div>

            <div style={{ height: "250px" }}>
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
                  <Line
                    type="monotone"
                    dataKey="failParts"
                    stroke="#dc2626"
                    strokeWidth={3}
                    dot={{ fill: "#dc2626", r: 4 }}
                    isAnimationActive={false}
                    name="불량 부품"
                  />
                  <Line
                    type="monotone"
                    dataKey="totalDetections"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ fill: "#2563eb", r: 4 }}
                    isAnimationActive={false}
                    name="총 감지 수"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                <h3 className="text-lg font-bold text-gray-900">부위별 감지</h3>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full">
                배치 스냅샷
              </span>
            </div>

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
                  <Bar dataKey="detections" radius={[10, 10, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Latest */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 overflow-hidden mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            최신 검사 결과 (파트별)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LatestPartCard part="door" label="도어" data={latestCards.door} />
            <LatestPartCard part="bumper" label="범퍼" data={latestCards.bumper} />
            <LatestPartCard part="headlamp" label="헤드램프" data={latestCards.headlamp} />
            <LatestPartCard part="taillamp" label="테일램프" data={latestCards.taillamp} />
            <LatestPartCard part="radiator" label="라디에이터" data={latestCards.radiator} span2 />
          </div>

          {error && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 border border-red-100">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              {error}
            </div>
          )}
        </div>

        {/* Logs (5 slots) */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 overflow-hidden">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            실시간 공정 로그
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {(logSlots.length
              ? logSlots
              : PARTS.map((p) => ({
                  time: "--:--:--",
                  part: p.key,
                  pass_fail: "PASS" as "PASS" | "FAIL",
                  detCount: 0,
                }))
            ).map((d, i) => {
              const label = PARTS.find((p) => p.key === d.part)?.label ?? d.part;

              return (
                <div
                  key={`${d.part}-${i}`}
                  className={cn(
                    "p-4 rounded-xl border",
                    d.time === "--:--:--"
                      ? "bg-gray-50 border-gray-200"
                      : d.pass_fail === "PASS"
                      ? "bg-green-50 border-green-100"
                      : "bg-red-50 border-red-100"
                  )}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-gray-400">{d.time}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        d.time === "--:--:--"
                          ? "bg-gray-200 text-gray-600"
                          : d.pass_fail === "PASS"
                          ? "bg-green-200 text-green-700"
                          : "bg-red-200 text-red-700"
                      )}
                    >
                      {d.time === "--:--:--" ? "대기" : (d.pass_fail === "PASS" ? "합격" : "불합격")}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-gray-900">{label}</div>
                  <div className="text-[10px] text-gray-500">감지: {d.detCount}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Defect Modal */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-8"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999,
            }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(12px)",
              }}
              onClick={() => setIsModalOpen(false)}
            />

            <div
              className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
              style={{
                position: "relative",
                maxHeight: "85vh",
                width: "100%",
                maxWidth: "900px",
                margin: "auto",
              }}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-xl text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      불량 분석 리포트 (Body Assembly)
                    </h2>
                    <p className="text-sm text-gray-500">불합격 파트 및 탐지 정보 요약</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 outline-none"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                {ngList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                    <p>현재 불합격 파트가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ngList.map((r, idx) => {
                      const label = PARTS.find((p) => p.key === r.part)?.label ?? r.part;

                      return (
                        <div key={`${r.part}-${idx}`} className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                              {label} · {lastUpdated}
                            </span>
                            <span className="text-xs font-medium text-gray-400">
                              감지: {r.detections?.length ?? 0}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <p className="text-[10px] text-gray-500 mb-1">판정</p>
                              <p className="text-sm font-bold text-gray-900">{r.pass_fail === "PASS" ? "합격" : "불합격"}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <p className="text-[10px] text-gray-500 mb-1">탐지 수</p>
                              <p className="text-sm font-bold text-gray-900">{r.detections?.length ?? 0}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100">원본</div>
                              <div className="aspect-[16/9] w-full bg-white">
                                {r.original_image_url ? (
                                  <img
                                    src={joinUrl(r.original_image_url)}
                                    alt="orig"
                                    className="w-full h-full object-contain object-center p-2"
                                  />
                                ) : (
                                  <div className="w-full h-full grid place-items-center text-sm text-gray-400">-</div>
                                )}
                              </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100">결과</div>
                              <div className="aspect-[16/9] w-full bg-white">
                                {r.result_image_url ? (
                                  <img
                                    src={joinUrl(r.result_image_url)}
                                    alt="res"
                                    className="w-full h-full object-contain object-center p-2"
                                  />
                                ) : (
                                  <div className="w-full h-full grid place-items-center text-sm text-gray-400">-</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 bg-red-50 p-4 rounded-xl border border-red-100">
                            <AlertTriangle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-red-900 mb-1">AI 분석 결과</p>
                              <p className="text-sm text-red-800 leading-tight font-medium">{getAnalysis(r)}</p>
                            </div>
                          </div>

                          {(r.detections?.length ?? 0) > 0 && (
                            <div className="mt-4 overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-500">
                                  <tr>
                                    <th className="py-2">분류</th>
                                    <th className="py-2">신뢰도</th>
                                    <th className="py-2">BBox</th>
                                  </tr>
                                </thead>
                                <tbody className="text-gray-900">
                                  {r.detections.map((d, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                      <td className="py-2">
                                        <div className="font-semibold">{d.name}</div>
                                        <div className="text-xs text-gray-500">#{d.cls}</div>
                                      </td>
                                      <td className="py-2 font-mono">{d.conf}</td>
                                      <td className="py-2 text-xs font-mono text-gray-700">
                                        [{d.bbox.join(", ")}]
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-white flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-10 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
                >
                  확인
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
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
