import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Factory,
  ArrowLeft,
  Target,
  Timer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OrderSelector } from "./OrderSelector";
import { mlResultsApi, MLAnalysisResultDto } from "../api/mlResults";

interface DefectData {
  predicted_class: string;
  confidence: number;
  all_scores: Record<string, number>;
  image_base64?: string | null;
  note?: string | null;
  model_input_shape?: number[];
  sim_image_shape?: number[];
  source?: string;
  sequence?: { index_next: number; count: number };
}

interface VibrationData {
  reconstruction_error: number;
  is_anomaly: number;
  threshold: number;
  sensor_values?: Record<string, number>;
  mode?: string;
  note?: string;
  model_input_shape?: number[];
}

const DEFECT_TYPES = [
  "Scratches",
  "Pitted Surface",
  "Rolled-in Scale",
  "Inclusion",
  "Crazing",
  "Patches",
];

const DEFECT_NAME_KO: Record<string, string> = {
  "Scratches": "표면 긁힘",
  "Pitted Surface": "점상 부식",
  "Rolled-in Scale": "산화물 포함",
  "Inclusion": "개재물",
  "Crazing": "미세 균열",
  "Patches": "국부 결함",
};

function toKo(name: string): string {
  return DEFECT_NAME_KO[name] ?? name;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function nowHHMMSS() {
  const now = new Date();
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}:${String(
    now.getSeconds()
  ).padStart(2, "0")}`;
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

export function PressMachineDashboard() {
  return (
    <OrderSelector processName="프레스 공정">
      {(selectedOrderId) => <PressMachineDashboardContent orderId={selectedOrderId} />}
    </OrderSelector>
  );
}

function PressMachineDashboardContent({ orderId }: { orderId: number | null }) {
  const navigate = useNavigate();

  const [autoImage, setAutoImage] = useState<DefectData | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageLastUpdated, setImageLastUpdated] = useState<string>("--:--:--");

  const [defectAccum, setDefectAccum] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    DEFECT_TYPES.forEach((k) => (init[k] = 0));
    return init;
  });

  const [vibration, setVibration] = useState<VibrationData | null>(null);
  const [vibrationHistory, setVibrationHistory] = useState<
    { time: string; value: number }[]
  >([]);
  const [sensorHistory, setSensorHistory] = useState<
    { time: string; sensor_0: number; sensor_1: number; sensor_2: number }[]
  >([]);
  const [lastUpdated, setLastUpdated] = useState<string>("--:--:--");
  const [historyBuffer, setHistoryBuffer] = useState<
    { time: string; sortKey: number; type: string; status: string; detail: string; statusTone: "green" | "red" | "blue" }[]
  >([]);

  const defectDistribution = useMemo(() => {
    return DEFECT_TYPES.map((type) => ({
      name: toKo(type),
      value: Number(defectAccum[type] ?? 0),
    }));
  }, [defectAccum]);

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
      setIsImageLoading(true);
      try {
        const [imageList, vibList] = await Promise.all([
          mlResultsApi.list({ orderId, serviceType: "press_image", limit: 30 }),
          mlResultsApi.list({ orderId, serviceType: "press_vibration", limit: 30 }),
        ]);
        if (!mounted) return;

        if (imageList && imageList.length > 0) {
          const info = parseAdditional(imageList[0]) || {};
          const data: DefectData = {
            predicted_class: info.predicted_class ?? info.prediction_class ?? "-",
            confidence: info.confidence ?? 0,
            all_scores: info.all_scores ?? {},
            image_base64: info.image_base64 ?? null,
            note: info.note,
            model_input_shape: info.model_input_shape,
            sim_image_shape: info.sim_image_shape,
            source: info.source,
            sequence: info.sequence,
          };
          setAutoImage(data);
          setImageLastUpdated(
            imageList[0].createdDate ? new Date(imageList[0].createdDate).toLocaleTimeString() : nowHHMMSS()
          );

          setDefectAccum(() => {
            const init: Record<string, number> = {};
            DEFECT_TYPES.forEach((k) => (init[k] = 0));
            imageList.forEach((item) => {
              const infoItem = parseAdditional(item) || {};
              const scores = infoItem.all_scores ?? {};
              for (const k of DEFECT_TYPES) {
                const add = typeof scores[k] === "number" ? scores[k] : 0;
                init[k] = (init[k] ?? 0) + add;
              }
            });
            return init;
          });
        } else {
          setAutoImage(null);
          setImageLastUpdated("--:--:--");
        }

        if (vibList && vibList.length > 0) {
          const info = parseAdditional(vibList[0]) || {};
          const data: VibrationData = {
            reconstruction_error: info.reconstruction_error ?? vibList[0].reconstructionError ?? 0,
            is_anomaly: info.is_anomaly ?? vibList[0].isAnomaly ?? 0,
            threshold: info.threshold ?? vibList[0].threshold ?? 0,
            sensor_values: info.sensor_values ?? undefined,
            mode: info.mode,
            note: info.note,
            model_input_shape: info.model_input_shape,
          };
          setVibration(data);
          setLastUpdated(
            vibList[0].createdDate ? new Date(vibList[0].createdDate).toLocaleTimeString() : nowHHMMSS()
          );

          const vibHist = vibList
            .slice()
            .reverse()
            .map((item) => {
              const infoItem = parseAdditional(item) || {};
              const err = infoItem.reconstruction_error ?? item.reconstructionError ?? 0;
              const time = item.createdDate
                ? new Date(item.createdDate).toLocaleTimeString()
                : nowHHMMSS();
              return { time, value: err };
            });
          setVibrationHistory(vibHist.slice(-30));

          const sensorHist = vibList
            .slice()
            .reverse()
            .map((item) => {
              const infoItem = parseAdditional(item) || {};
              const sv = infoItem.sensor_values || {};
              const time = item.createdDate
                ? new Date(item.createdDate).toLocaleTimeString()
                : nowHHMMSS();
              return {
                time,
                sensor_0: typeof sv.sensor_0 === "number" ? sv.sensor_0 : 0,
                sensor_1: typeof sv.sensor_1 === "number" ? sv.sensor_1 : 0,
                sensor_2: typeof sv.sensor_2 === "number" ? sv.sensor_2 : 0,
              };
            });
          setSensorHistory(sensorHist.slice(-30));
        } else {
          setVibration(null);
          setLastUpdated("--:--:--");
          setVibrationHistory([]);
          setSensorHistory([]);
        }

        // Build combined history
        const histEntries: typeof historyBuffer = [];
        if (imageList) {
          imageList.forEach((item) => {
            const info = parseAdditional(item) || {};
            const predClass = info.predicted_class ?? info.prediction_class ?? "-";
            const conf = info.confidence ?? 0;
            const time = item.createdDate
              ? new Date(item.createdDate).toLocaleTimeString()
              : nowHHMMSS();
            const sortKey = item.createdDate ? new Date(item.createdDate).getTime() : Date.now();
            histEntries.push({
              time,
              sortKey,
              type: "이미지",
              status: toKo(predClass),
              detail: `신뢰도 ${(conf * 100).toFixed(1)}%`,
              statusTone: "blue",
            });
          });
        }
        if (vibList) {
          vibList.forEach((item) => {
            const info = parseAdditional(item) || {};
            const isAnom = info.is_anomaly ?? 0;
            const err = info.reconstruction_error ?? item.reconstructionError ?? 0;
            const time = item.createdDate
              ? new Date(item.createdDate).toLocaleTimeString()
              : nowHHMMSS();
            const sortKey = item.createdDate ? new Date(item.createdDate).getTime() : Date.now();
            histEntries.push({
              time,
              sortKey,
              type: "진동",
              status: isAnom ? "이상" : "정상",
              detail: `복원 오차 ${Number(err).toFixed(4)}`,
              statusTone: isAnom ? "red" : "green",
            });
          });
        }
        histEntries.sort((a, b) => b.sortKey - a.sortKey);
        setHistoryBuffer(histEntries.slice(0, 30));
      } catch (e) {
        console.error("Failed to fetch press results:", e);
      } finally {
        if (!mounted) return;
        setIsImageLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const kpi = useMemo(() => {
    const pred = autoImage?.predicted_class ? toKo(autoImage.predicted_class) : "-";
    const conf = typeof autoImage?.confidence === "number" ? autoImage.confidence : null;
    const err = vibration?.reconstruction_error ?? null;
    const th = vibration?.threshold ?? null;

    return {
      predicted: pred,
      confidencePct: conf === null ? "-" : `${(conf * 100).toFixed(1)}%`,
      vibStatus: vibration ? (vibration.is_anomaly ? "이상" : "정상") : "대기",
      err: err === null ? "-" : err.toFixed(4),
      th: th === null ? "-" : th.toFixed(4),
    };
  }, [autoImage, vibration]);

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
              <Factory className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">프레스 공정 모니터링</h2>
              <p className="text-gray-600 mt-1">이미지 결함 검출 및 진동 이상 감지</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KpiCard
          icon={<Target className="w-5 h-5 text-blue-600" />}
          label="최신 분류"
          value={kpi.predicted}
          sub="최근 이미지 예측 결과"
          tone="info"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="신뢰도"
          value={kpi.confidencePct}
          sub="모델 확신도"
          tone="good"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="진동 상태"
          value={kpi.vibStatus}
          sub={`복원 오차: ${kpi.err}`}
          tone={vibration?.is_anomaly ? "bad" : "default"}
        />
        <KpiCard
          icon={<Timer className="w-5 h-5 text-purple-600" />}
          label="복원 오차"
          value={kpi.err}
          sub={`threshold: ${kpi.th}`}
          tone="purple"
        />
      </div>

      {/* Main: Left image + Right vibration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left: Image Analysis */}
        <Card
          title="이미지 결함 검출 (CNN)"
          badge={
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
              {isImageLoading ? "로딩 중" : imageLastUpdated}
            </span>
          }
        >
          <div className="space-y-5">
            {/* Image */}
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-black">
              <div className="aspect-[16/9] w-full">
                {autoImage?.image_base64 ? (
                  <img
                    src={`data:image/jpeg;base64,${autoImage.image_base64}`}
                    alt="Auto"
                    className="w-full h-full object-contain object-center"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-white/70 text-sm">
                    이미지 없음
                  </div>
                )}
              </div>
            </div>

            {/* Result info */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-gray-900 mb-4">검사 정보</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">예측 결과</div>
                  <div className="text-gray-900 font-semibold mt-1 text-xl">
                    {autoImage?.predicted_class ? toKo(autoImage.predicted_class) : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">신뢰도</div>
                  <div className={cn(
                    "font-semibold mt-1 text-xl",
                    (autoImage?.confidence ?? 0) >= 0.8 ? "text-green-700" : "text-amber-700"
                  )}>
                    {typeof autoImage?.confidence === "number"
                      ? `${(autoImage.confidence * 100).toFixed(1)}%`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Scores */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-gray-900 mb-3">전체 결함 확률</div>
              <div className="space-y-2">
                {Object.entries(autoImage?.all_scores || {}).map(([className, score]) => (
                  <div key={className} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-700 w-24 truncate">{toKo(className)}</span>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden flex-1">
                        <div className="h-full bg-blue-600" style={{ width: `${(score || 0) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-gray-800 w-14 text-right">
                        {((score || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                {!autoImage && (
                  <div className="text-sm text-gray-500">데이터 수신 대기 중...</div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Vibration */}
        <Card
          title="진동 이상 감지 (LSTM)"
          badge={
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
              {lastUpdated}
            </span>
          }
        >
          <div className="space-y-5">
            {/* Status + Error */}
            <div className="grid grid-cols-2 gap-4">
              <div className={cn(
                "rounded-2xl border p-5",
                vibration?.is_anomaly ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"
              )}>
                <div className="flex items-center gap-2">
                  {vibration?.is_anomaly
                    ? <AlertTriangle className="w-5 h-5 text-red-600" />
                    : <CheckCircle2 className="w-5 h-5 text-green-600" />
                  }
                  <span className="font-bold text-gray-900">
                    {vibration?.is_anomaly ? "이상" : "정상"}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">상태</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-xs text-gray-600">복원 오차</p>
                <p className="text-2xl font-mono font-bold text-gray-900 mt-2">
                  {typeof vibration?.reconstruction_error === "number"
                    ? vibration.reconstruction_error.toFixed(4)
                    : "0.0000"}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  threshold: <span className="font-mono text-gray-900">
                    {typeof vibration?.threshold === "number" ? vibration.threshold.toFixed(4) : "0.0000"}
                  </span>
                </p>
              </div>
            </div>

            {/* Sensor chart */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-gray-900 mb-3">센서 데이터 추이 (3개 센서)</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensorHistory} margin={{ bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={6} />
                    <YAxis stroke="#94a3b8" domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #f1f5f9", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} labelStyle={{ color: "#111827" }} itemStyle={{ color: "#111827" }} />
                    <Legend />
                    <Line type="monotone" dataKey="sensor_0" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="sensor_1" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="sensor_2" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Reconstruction error chart */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-bold text-gray-900 mb-3">복원 오차 추이</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vibrationHistory} margin={{ bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={6} />
                    <YAxis stroke="#94a3b8" domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #f1f5f9", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} labelStyle={{ color: "#111827" }} itemStyle={{ color: "#111827" }} />
                    <Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} dot={false} isAnimationActive={false} name="복원 오차" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom: Defect Distribution */}
      <div className="mb-8">
      <Card
        title="결함 유형 분포"
      >
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={defectDistribution} margin={{ left: 20, right: 20, top: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#111827" }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: "#111827" }} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.06)" }}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #f1f5f9",
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827" }}
                itemStyle={{ color: "#111827" }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={28} name="누적 확률" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </Card>
      </div>

      {/* History Table */}
      <Card
        title="최근 분석 이력"
        badge={
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
            최근 {Math.min(historyBuffer.length, 30)}건
          </span>
        }
      >
        <div className="overflow-auto max-h-[420px] rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr className="text-left text-gray-600">
                <th className="p-3 font-semibold">시간</th>
                <th className="p-3 font-semibold">유형</th>
                <th className="p-3 font-semibold">상태</th>
                <th className="p-3 font-semibold">상세</th>
              </tr>
            </thead>
            <tbody>
              {historyBuffer.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-10 text-gray-400">
                    분석 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                historyBuffer.map((entry, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 whitespace-nowrap text-gray-700">{entry.time}</td>
                    <td className="p-3">
                      <span className={cn(
                        "px-2 py-1 rounded-full border text-xs font-bold",
                        entry.type === "이미지"
                          ? "text-blue-700 bg-blue-50 border-blue-200"
                          : "text-purple-700 bg-purple-50 border-purple-200"
                      )}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        "px-2 py-1 rounded-full border text-xs font-bold",
                        entry.statusTone === "green"
                          ? "text-green-700 bg-green-50 border-green-200"
                          : entry.statusTone === "red"
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-blue-700 bg-blue-50 border-blue-200"
                      )}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-800">{entry.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default PressMachineDashboard;
