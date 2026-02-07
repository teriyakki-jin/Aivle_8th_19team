import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { OrderSelector } from "./OrderSelector";
import { mlResultsApi, MLAnalysisResultDto } from "../api/mlResults";
import {
  ArrowLeft,
  Layers,
  Gauge,
  AlertCircle,
  CheckCircle2,
  X,
  Activity,
  AlertTriangle,
  Cpu,
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

type Side = "Left" | "Right";
type Pred01 = 0 | 1;

type MonitorEntry = {
  time: string; // HH:MM:SS
  side: Side;
  prediction: Pred01; // 내부용
  judgement: "PASS" | "FAIL"; // 화면 표시용
};

function nowHHMMSS(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function WindShieldDashboard() {
  return (
    <OrderSelector processName="윈드실드 검사">
      {(_orderId) => <WindShieldDashboardContent orderId={_orderId} />}
    </OrderSelector>
  );
}

function WindShieldDashboardContent({ orderId }: { orderId: number | null }) {
  const navigate = useNavigate();
  const [side, setSide] = useState<Side>("Left");

  const [systemStatus, setSystemStatus] = useState<
    "WAITING" | "READY"
  >("WAITING");

  // ✅ 최신 결과
  const [result, setResult] = useState<{
    prediction: Pred01;
    judgement: "PASS" | "FAIL";
    time: string;
  } | null>(null);

  // ✅ 통계
  const [stats, setStats] = useState({
    totalCount: 0,
    failCount: 0,
    passRate: 100.0,
    cycleTime: "0.5s",
  });

  // ✅ 차트/로그 버퍼
  const [buffer, setBuffer] = useState<MonitorEntry[]>([]);
  const [failHistory, setFailHistory] = useState<MonitorEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

    const normalizeEntry = (item: MLAnalysisResultDto, raw: any): MonitorEntry | null => {
      const predictionRaw =
        typeof raw?.prediction === "number"
          ? raw.prediction
          : typeof item.prediction === "number"
          ? item.prediction
          : null;
      const prediction = predictionRaw === 1 ? 1 : 0;
      const judgementRaw = raw?.judgement ?? raw?.status ?? item.status;
      const judgement: "PASS" | "FAIL" =
        judgementRaw === "PASS" || judgementRaw === "FAIL"
          ? judgementRaw
          : prediction === 1
          ? "PASS"
          : "FAIL";
      const sideRaw = raw?.side ?? "left";
      const sideNormalized = String(sideRaw).toLowerCase();
      const sideLabel: Side = sideNormalized === "right" ? "Right" : "Left";
      return {
        time: item.createdDate
          ? new Date(item.createdDate).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : nowHHMMSS(),
        side: sideLabel,
        prediction: prediction as Pred01,
        judgement,
      };
    };

    const load = async () => {
      setError(null);
      try {
        const list = await mlResultsApi.list({
          orderId,
          serviceType: "windshield",
          limit: 40,
        });
        if (!mounted) return;
        if (!list || list.length === 0) {
          setResult(null);
          setBuffer([]);
          setFailHistory([]);
          setStats({ totalCount: 0, failCount: 0, passRate: 100.0, cycleTime: "-" });
          setSystemStatus("WAITING");
          return;
        }

        const entries: MonitorEntry[] = [];
        for (const item of list) {
          const info = parseAdditional(item);
          if (Array.isArray(info?.results)) {
            info.results.forEach((row: any) => {
              const entry = normalizeEntry(item, row);
              if (entry) entries.push(entry);
            });
          } else {
            const entry = normalizeEntry(item, info);
            if (entry) entries.push(entry);
          }
        }

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
        const fail = entries.filter((e) => e.judgement === "FAIL").length;
        const passRate = total === 0 ? 100 : ((total - fail) / total) * 100;
        setStats({
          totalCount: total,
          failCount: fail,
          passRate: Number(passRate.toFixed(1)),
          cycleTime: "-",
        });

        setBuffer(entries.slice(0, 30));
        setFailHistory(entries.filter((e) => e.judgement === "FAIL").slice(0, 30));
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

  // Charts
  const passFailTrend = useMemo(() => {
    return buffer.map((d) => ({
      시간: d.time,
      상태: d.judgement === "PASS" ? 1 : 0,
    }));
  }, [buffer]);

  const passFailBar = useMemo(() => {
    const pass = stats.totalCount - stats.failCount;
    return [
      { 구분: "PASS", 건수: pass },
      { 구분: "FAIL", 건수: stats.failCount },
    ];
  }, [stats]);

  const alerts = useMemo(() => {
    const lastFail = failHistory[0];
    const list: {
      id: number;
      issue: string;
      severity: "경고" | "주의";
      time: string;
    }[] = [];

    if (lastFail) {
      list.push({
        id: 1,
        issue: `${lastFail.side} 공정 FAIL 감지`,
        severity: "경고",
        time: lastFail.time,
      });
    }

    if (systemStatus === "READY") {
      list.push({
        id: 2,
        issue: "ML 결과 수신 완료",
        severity: "주의",
        time: nowHHMMSS(),
      });
    }

    if (systemStatus === "WAITING") {
      list.push({
        id: 4,
        issue: "아직 저장된 결과가 없습니다.",
        severity: "주의",
        time: nowHHMMSS(),
      });
    }

    return list;
  }, [failHistory, systemStatus]);

  const statusBadge = useMemo(() => {
    if (systemStatus === "WAITING") return "bg-gray-100 text-gray-700";
    return "bg-green-100 text-green-700";
  }, [systemStatus]);

  return (
    <>
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
              <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl flex items-center justify-center">
                <Layers className="w-7 h-7 text-black" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  윈드실드 사이드 몰딩 공정
                </h2>
                <p className="text-gray-600 mt-1">
                  윈드실드 실시간 품질 판정
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-sm">
              <span
                className={`px-3 py-1 rounded-full font-semibold ${statusBadge}`}
              >
                {systemStatus}
              </span>
              <span className="text-gray-500">Time: {nowHHMMSS()}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제품 구분
              </label>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                {(["Left", "Right"] as Side[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                      side === s
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <div className="font-semibold text-gray-900">표시 정책</div>
              <div>
                prediction(0/1) 수신, 화면은 PASS/FAIL만 표시 · 차트/알림은 초
                단위
              </div>
            </div>
          </div>

          {/* KPIs + Latest Result */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-gray-700" />
                  <h3 className="text-base font-bold text-gray-900">
                    최신 판정
                  </h3>
                </div>

                {result ? (
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                      result.judgement === "PASS"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {result.judgement === "PASS" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    {result.judgement}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-600">판정</div>
                  <div className="text-3xl font-bold text-gray-900 mt-1">
                    {result ? result.judgement : "-"}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    prediction(0/1)은 내부 처리
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-600">시각</div>
                  <div className="text-xl font-bold text-gray-900 mt-1">
                    {result ? result.time : "-"}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">HH:MM:SS</div>
                </div>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-white text-left rounded-xl shadow-sm p-4 border-2 border-transparent hover:border-red-400 hover:shadow-md transition-all cursor-pointer outline-none"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <p className="text-sm font-medium text-gray-600">
                        FAIL History
                      </p>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        failHistory.length > 0
                          ? "bg-red-500 animate-pulse"
                          : "bg-gray-300"
                      }`}
                    />
                  </div>
                  <p className="text-3xl font-bold text-red-600 mb-1">
                    {stats.failCount}
                  </p>
                  <p className="text-xs text-red-600 font-medium">
                    상세 리포트 보기
                  </p>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-gray-600">PASS Rate</p>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {stats.passRate}%
              </p>
              <p className="text-xs text-green-600 font-medium">
                누적 PASS 비율
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-medium text-gray-600">
                  Total Inspected
                </p>
              </div>
              <p className="text-4xl font-bold text-gray-900 mb-2">
                {stats.totalCount}
              </p>
              <p className="text-xs text-blue-600 font-medium">
                누적 판정 수량
              </p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                <h3 className="text-lg font-bold text-gray-900">
                  PASS/FAIL Trend (초 단위)
                </h3>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full">
                PASS=1 / FAIL=0
              </span>
            </div>

            <div style={{ height: "250px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={passFailTrend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f0f0f0"
                  />
                  <XAxis
                    dataKey="시간"
                    stroke="#94a3b8"
                    style={{ fontSize: "12px" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 1]}
                    ticks={[0, 1]}
                    stroke="#94a3b8"
                    style={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    formatter={(value: any) =>
                      Number(value) === 1 ? "PASS" : "FAIL"
                    }
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #f1f5f9",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="stepAfter"
                    dataKey="상태"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <h3 className="text-lg font-bold text-gray-900">
                  PASS / FAIL Distribution
                </h3>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full">
                누적 기준
              </span>
            </div>

            <div style={{ height: "250px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={passFailBar}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f0f0f0"
                  />
                  <XAxis
                    dataKey="구분"
                    stroke="#94a3b8"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    style={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #f1f5f9",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="건수" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 overflow-hidden mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            실시간 공정 로그 (최근 5개)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {buffer
              .slice(-5)
              .reverse()
              .map((d, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border ${
                    d.judgement === "PASS"
                      ? "bg-green-50 border-green-100"
                      : "bg-red-50 border-red-100"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-gray-400">
                      {d.time}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.judgement === "PASS"
                          ? "bg-green-200 text-green-700"
                          : "bg-red-200 text-red-700"
                      }`}
                    >
                      {d.judgement}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {d.side} 공정
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            실시간 알림 및 이슈 (초 단위)
          </h3>
          <div className="space-y-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div
                  className={`w-2 h-2 mt-2 rounded-full ${
                    a.severity === "경고" ? "bg-red-500" : "bg-yellow-500"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">
                      {side} 공정
                    </span>
                    <span className="text-sm text-gray-500">{a.time}</span>
                  </div>
                  <p className="text-sm text-gray-700">{a.issue}</p>
                  <span
                    className={`inline-flex mt-2 px-2 py-1 rounded-full text-xs ${
                      a.severity === "경고"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-600">Cycle Time</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.cycleTime}
            </p>
            <p className="text-xs text-purple-600 font-medium">스트리밍 주기</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">Monitoring</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {systemStatus === "READY" ? "ON" : "OFF"}
            </p>
            <p className="text-xs text-blue-600 font-medium">결과 수신 상태</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-gray-600">FAIL Count</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.failCount}
            </p>
            <p className="text-xs text-red-600 font-medium">누적 FAIL 건수</p>
          </div>
        </div>
      </div>

      {/* FAIL 모달 */}
      {isModalOpen &&
        createPortal(
          <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-8">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setIsModalOpen(false)}
            />
            <div
              className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-xl text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      FAIL 분석 리포트
                    </h2>
                    <p className="text-sm text-gray-500">최근 FAIL 이력</p>
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
                {failHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                    <p>현재 FAIL 이력이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {failHistory.map((item, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                            DETECTED AT {item.time} ({item.side})
                          </span>
                        </div>

                        <div className="flex items-start gap-2 bg-red-50 p-4 rounded-xl border border-red-100">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-red-900 mb-1">
                              분석(예시)
                            </p>
                            <p className="text-sm text-red-800 leading-tight font-medium">
                              샘플링 스트리밍 중 FAIL 판정 발생 → 공정 조건 점검 및
                              원인 분석 권고
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
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
