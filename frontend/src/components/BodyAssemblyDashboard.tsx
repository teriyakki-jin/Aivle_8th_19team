import { useEffect, useMemo, useRef, useState } from "react";
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
  PlayCircle,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Activity,
  Layers,
  X,
} from "lucide-react";

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

type BatchResponse = {
  results: Record<PartKey, BodyResult | null | any>;
};

const API_BASE = "http://localhost:8000";
const POLL_MS = 5000;

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
      {value}
    </span>
  );
}

export function BodyAssemblyDashboard() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [systemStatus, setSystemStatus] = useState<
    "WAITING" | "MONITORING" | "ANALYZING"
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

  // ✅ Real-time Logs: 5칸 “고정 슬롯” (배치마다 통째로 갱신)
  const [logSlots, setLogSlots] = useState<
    { time: string; part: PartKey; pass_fail: "PASS" | "FAIL"; detCount: number }[]
  >([]);

  // 모달
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 중복 요청 방지
  const inFlightRef = useRef(false);

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

  // ✅ 자동 배치(서버가 이미지 자동 선택) — 업로드/Confidence 없음
  const fetchAutoBatch = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setError(null);
    try {
      // 서버가 자동으로 이미지 선택하는 auto 엔드포인트 가정
      const res = await fetch(
        `${API_BASE}/api/v1/smartfactory/body/inspect/batch/auto`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${t || res.statusText}`);
      }

      const data: BatchResponse = await res.json();
      const next = (data.results ?? {}) as any;

      const t = nowHHMMSS();

      // 결과 반영
      setResults(next);
      setLastUpdated(t);

      // 배치 히스토리(최근 30개)
      const failParts = PARTS.filter(
        (p) => next?.[p.key]?.pass_fail === "FAIL"
      ).length;

      const totalDetections = PARTS.reduce(
        (acc, p) => acc + (next?.[p.key]?.detections?.length ?? 0),
        0
      );

      setBatchHistory((prev) =>
        [...prev, { time: t, failParts, totalDetections }].slice(-30)
      );

      // ✅ 로그 슬롯: 배치마다 5개로 “갱신”
      const newSlots = PARTS.map((p) => {
        const r: BodyResult | undefined = next?.[p.key];
        return {
          time: t,
          part: p.key,
          pass_fail: (r?.pass_fail ?? "PASS") as "PASS" | "FAIL",
          detCount: r?.detections?.length ?? 0,
        };
      });

      setLogSlots(newSlots);
    } catch (e: any) {
      setError(e?.message ?? "자동 배치 분석 중 오류가 발생했습니다.");
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
    setSystemStatus("MONITORING");
    setTimeout(() => setSystemStatus("ANALYZING"), 1200);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    setSystemStatus("WAITING");
  };

  // ✅ 5초 폴링 (모니터링 ON일 때만)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isMonitoring) {
      fetchAutoBatch(); // 즉시 1회
      interval = setInterval(fetchAutoBatch, POLL_MS);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoring]);

  // ✅ 최신 검사 결과 “초콜릿” 레이아웃 순서용
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

  // ✅ 이미지 잘림 방지: aspect box + object-contain
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
            <span className="text-[10px] font-bold text-gray-400">WAIT</span>
          )}
        </div>

        <div className="text-sm font-bold text-gray-900">
          detections: {detCount}
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
                  Polling: {POLL_MS / 1000}s · Last update:{" "}
                  <span className="font-mono">{lastUpdated}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
              style={{ backgroundColor: isMonitoring ? "#dc2626" : "#2563eb" }}
              className={cn(
                "px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl flex items-center gap-2 outline-none focus:ring-4",
                isMonitoring
                  ? "hover:bg-red-700 focus:ring-red-200"
                  : "hover:bg-blue-700 focus:ring-blue-200"
              )}
            >
              {isMonitoring ? (
                <Pause className="w-5 h-5" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              {isMonitoring ? "STOP MONITORING" : "START MONITORING"}
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-gray-600">Yield Rate</p>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-2">
              {stats.yieldRate}%
            </p>
            <p className="text-xs text-green-600 font-medium">PASS 비율(현재 배치)</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">Inspected Parts</p>
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
                <p className="text-sm font-medium text-gray-600">Defect Detected</p>
              </div>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  stats.fails > 0 ? "bg-red-500 animate-pulse" : "bg-gray-300"
                )}
              />
            </div>
            <p className="text-4xl font-bold text-red-600 mb-2">{stats.fails}</p>
            <p className="text-xs text-red-600 font-medium">FAIL 상세 리포트 보기</p>
          </button>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-600">Cycle Time</p>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-2">
              {(POLL_MS / 1000).toFixed(0)}s
            </p>
            <p className="text-xs text-purple-600 font-medium">자동 배치 검사 주기</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isMonitoring ? "bg-blue-500" : "bg-gray-300"
                  )}
                />
                <h3 className="text-lg font-bold text-gray-900">Batch Fail Trend</h3>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full">
                status: {systemStatus}
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
                    name="FAIL parts"
                  />
                  <Line
                    type="monotone"
                    dataKey="totalDetections"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ fill: "#2563eb", r: 4 }}
                    isAnimationActive={false}
                    name="Total detections"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                <h3 className="text-lg font-bold text-gray-900">Detections by Part</h3>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full">
                batch snapshot
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

        {/* Latest (Chocolate layout) */}
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
            Real-time Process Logs
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
                      {d.time === "--:--:--" ? "WAIT" : d.pass_fail}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-gray-900">{label}</div>
                  <div className="text-[10px] text-gray-500">detections: {d.detCount}</div>
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
                    <p className="text-sm text-gray-500">FAIL 파트 및 탐지 정보 요약</p>
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
                    <p>현재 FAIL 파트가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ngList.map((r, idx) => {
                      const label = PARTS.find((p) => p.key === r.part)?.label ?? r.part;

                      return (
                        <div
                          key={`${r.part}-${idx}`}
                          className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                              {label} · {lastUpdated}
                            </span>
                            <span className="text-xs font-medium text-gray-400">
                              detections: {r.detections?.length ?? 0}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <p className="text-[10px] text-gray-500 mb-1">판정</p>
                              <p className="text-sm font-bold text-gray-900">{r.pass_fail}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <p className="text-[10px] text-gray-500 mb-1">탐지 수</p>
                              <p className="text-sm font-bold text-gray-900">
                                {r.detections?.length ?? 0}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100">
                                원본
                              </div>
                              <div className="aspect-[16/9] w-full bg-white">
                                {r.original_image_url ? (
                                  <img
                                    src={joinUrl(r.original_image_url)}
                                    alt="orig"
                                    className="w-full h-full object-contain object-center p-2"
                                  />
                                ) : (
                                  <div className="w-full h-full grid place-items-center text-sm text-gray-400">
                                    -
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100">
                                결과
                              </div>
                              <div className="aspect-[16/9] w-full bg-white">
                                {r.result_image_url ? (
                                  <img
                                    src={joinUrl(r.result_image_url)}
                                    alt="res"
                                    className="w-full h-full object-contain object-center p-2"
                                  />
                                ) : (
                                  <div className="w-full h-full grid place-items-center text-sm text-gray-400">
                                    -
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 bg-red-50 p-4 rounded-xl border border-red-100">
                            <AlertTriangle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-red-900 mb-1">AI 분석 결과</p>
                              <p className="text-sm text-red-800 leading-tight font-medium">
                                {getAnalysis(r)}
                              </p>
                            </div>
                          </div>

                          {(r.detections?.length ?? 0) > 0 && (
                            <div className="mt-4 overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-500">
                                  <tr>
                                    <th className="py-2">Class</th>
                                    <th className="py-2">Conf</th>
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

export default BodyAssemblyDashboard;
