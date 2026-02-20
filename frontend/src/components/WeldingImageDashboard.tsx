import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Factory, Image as ImageIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { OrderSelector } from "./OrderSelector";
import { ML_IMAGE_BASE } from "../config/env";
import { mlResultsApi, MLAnalysisResultDto } from "../api/mlResults";

/* =====================
   Types
===================== */

type Defect = {
  class: string;
  confidence: number;
  bbox: number[];
};

type WeldingAutoResponse = {
  status: "NORMAL" | "DEFECT";
  defects: Defect[];
  original_image_url: string;
  result_image_url: string | null;
  source?: string;
  sequence?: { index_next: number; count: number };
};

type HistoryRow = {
  id: string;
  time: string;
  judgement: "양품" | "불량";
  status: "NORMAL" | "DEFECT";
  defectType: string;
  confidencePct: number;
  defects: Defect[];
  originalUrl?: string;
  resultUrl?: string;
  source?: string;
};

/* =====================
   Constants
===================== */

const SERVER_BASE = ML_IMAGE_BASE; // 이미지는 ML 서비스에서 제공

/* =====================
   Defect name translation
===================== */

const DEFECT_NAME_KO: Record<string, string> = {
  // 용접 결함 (YOLO 모델 클래스)
  "porosity": "기공",
  "crack": "균열",
  "spatter": "용접 튐",
  "spatters": "용접 튐",
  "undercut": "용접 언더컷",
  "burn_through": "관통 용접 결함",
  "overlap": "오버랩",
  "slag_inclusion": "슬래그 혼입",
  "incomplete_fusion": "용융 불량",
  "excess_reinforcement": "과잉 보강",
  "bad_weld": "불량 용접",
  "good_weld": "양품 용접",
  "defect": "결함",
  "normal": "정상",
};

function toKo(name: string): string {
  const raw = name ?? "";
  const lower = raw.toLowerCase();
  const normalized = lower.replace(/[\s-]+/g, "_");
  return (
    DEFECT_NAME_KO[raw] ??
    DEFECT_NAME_KO[lower] ??
    DEFECT_NAME_KO[normalized] ??
    name
  );
}

/* =====================
   Utils
===================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function nowHHMMSS() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function topDefect(defects: Defect[]) {
  if (!defects.length) return null;
  return defects.reduce((a, b) => (a.confidence > b.confidence ? a : b));
}

function confidenceToPct(x: number) {
  return Math.max(0, Math.min(100, Math.round(x * 1000) / 10));
}

function publicUrl(path?: string | null) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${SERVER_BASE}${path}`;
}

/* =====================
   UI Components
===================== */

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
  tone?: "default" | "good" | "bad" | "info";
}) {
  const valueClass =
    tone === "good"
      ? "text-green-600"
      : tone === "bad"
      ? "text-red-600"
      : tone === "info"
      ? "text-blue-600"
      : "text-gray-900";

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <p className="text-sm font-medium text-gray-600">{label}</p>
      </div>
      <p className={cn("text-4xl font-bold mb-2", valueClass)}>{value}</p>
      {sub ? <p className={cn("text-xs font-medium", valueClass)}>{sub}</p> : null}
    </div>
  );
}

function JudgeBadge({ judgement }: { judgement: "양품" | "불량" | "대기" }) {
  if (judgement === "양품") {
    return (
      <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 font-bold text-xs inline-flex items-center gap-1">
        <CheckCircle2 className="w-4 h-4" />
        양품
      </span>
    );
  }
  if (judgement === "불량") {
    return (
      <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 font-bold text-xs inline-flex items-center gap-1">
        <AlertTriangle className="w-4 h-4" />
        불량
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs">
      대기
    </span>
  );
}

/* =====================
   Main Component
===================== */

export function WeldingImageDashboard() {
  return (
    <OrderSelector processName="용접 공정">
      {(selectedOrderId) => <WeldingImageDashboardContent orderId={selectedOrderId} />}
    </OrderSelector>
  );
}

function WeldingImageDashboardContent({ orderId }: { orderId: number | null }) {
  const navigate = useNavigate();
  const [result, setResult] = useState<WeldingAutoResponse | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("--:--:--");

  const latest = history[0];
  const selectedHistory = useMemo(
    () => history.find((h) => h.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId]
  );
  const current = selectedHistory ?? latest ?? null;
  const displayTime = current?.time ?? lastUpdated;

  const hasDefects = (current?.defects?.length ?? 0) > 0;
  const resultStatus: "NORMAL" | "DEFECT" | undefined =
    current?.status ?? result?.status ?? (hasDefects ? "DEFECT" : "NORMAL");

  const latestDefect = useMemo(() => {
    if (!hasDefects || !current?.defects) return null;
    return topDefect(current.defects);
  }, [hasDefects, current]);

  const total = history.length;
  const bad = useMemo(() => history.filter((h) => h.judgement === "불량").length, [history]);
  const good = total - bad;
  const rate = total === 0 ? 100 : (good / total) * 100;

  const mainImage = useMemo(() => {
    if (current?.resultUrl) return current.resultUrl;
    if (current?.originalUrl) return current.originalUrl;
    if (result?.result_image_url) return publicUrl(result.result_image_url);
    if (result?.original_image_url) return publicUrl(result.original_image_url);
    return "";
  }, [current, result]);

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
      setLoading(true);
      try {
        const list = await mlResultsApi.list({
          orderId,
          serviceType: "welding_image",
          limit: 50,
        });
        if (!mounted) return;

        if (!list || list.length === 0) {
          setResult(null);
          setHistory([]);
          setSelectedHistoryId(null);
          setLastUpdated("--:--:--");
          return;
        }

        const rows: HistoryRow[] = list.map((item) => {
          const info = parseAdditional(item) || {};
          const defects = info.defects ?? [];
          const hasDefects = (defects?.length ?? 0) > 0;
          const top = hasDefects ? topDefect(defects) : null;
          return {
            id: String(item.id),
            time: item.createdDate ? new Date(item.createdDate).toLocaleTimeString() : nowHHMMSS(),
            judgement: info.status === "DEFECT" || hasDefects ? "불량" : "양품",
            status: info.status === "DEFECT" || hasDefects ? "DEFECT" : "NORMAL",
            defectType: top?.class ?? "-",
            confidencePct: top ? confidenceToPct(top.confidence) : 0,
            defects: defects,
            originalUrl: publicUrl(info.original_image_url),
            resultUrl: publicUrl(info.result_image_url),
            source: info.source,
          };
        });
        setHistory(rows);
        setSelectedHistoryId(rows[0]?.id ?? null);

        const latestItem = list[0];
        const latestInfo = parseAdditional(latestItem) || {};
        setResult({
          status: latestInfo.status ?? "NORMAL",
          defects: latestInfo.defects ?? [],
          original_image_url: latestInfo.original_image_url ?? "",
          result_image_url: latestInfo.result_image_url ?? null,
          source: latestInfo.source,
          sequence: latestInfo.sequence,
        });
        setLastUpdated(
          latestItem.createdDate ? new Date(latestItem.createdDate).toLocaleTimeString() : nowHHMMSS()
        );
        setError("");
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "ML 결과 조회 실패");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const latestJudgement: "양품" | "불량" | "대기" = latest
    ? (current?.judgement ?? latest.judgement)
    : result
    ? resultStatus === "DEFECT"
      ? "불량"
      : "양품"
    : "대기";

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Header (Battery/Press 톤) */}
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
              <h2 className="text-3xl font-bold text-gray-900">용접 이미지 검사</h2>
              <p className="text-xs text-gray-500 mt-1">
                최근 갱신: <span className="font-mono">{displayTime}</span>
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* KPI (Battery 스타일) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <KpiCard
          icon={<Factory className="w-5 h-5 text-blue-600" />}
          label="전체 검사 수"
          value={total.toString()}
          sub="누적 검사 수량"
          tone="info"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="불량 수량"
          value={bad.toString()}
          sub="NG 누적"
          tone="bad"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="양품 수량"
          value={good.toString()}
          sub="OK 누적"
          tone="good"
        />
        <KpiCard
          icon={<ImageIcon className="w-5 h-5 text-purple-600" />}
          label="양품률"
          value={`${rate.toFixed(2)}%`}
          sub="누적 기준"
          tone="info"
        />
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Main Grid: 좌 이미지 / 우 결과 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Image */}
        <Card
          title="이미지 분석"
          badge={
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
              {loading ? "로딩 중" : "자동"}
            </span>
          }
        >
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <div className="text-[11px] text-gray-500 mb-2 flex items-center justify-between">
              <span className="font-mono">{displayTime}</span>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden bg-black">
              {/* ✅ 잘림 방지: 16:9 박스 + object-contain */}
              <div className="aspect-[16/9] w-full">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt="welding"
                    className="w-full h-full object-contain object-center"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">
                    이미지 없음
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-600">최근 판정</div>
              <JudgeBadge judgement={latestJudgement} />
            </div>
          </div>
        </Card>

        {/* Result */}
        <Card
          title="분석 결과"
          badge={
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
              {current || result ? (resultStatus === "DEFECT" ? "불량" : "양품") : "대기"}
            </span>
          }
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">판정</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">
                {current ? (resultStatus === "DEFECT" ? "불량" : "양품") : result ? (resultStatus === "DEFECT" ? "불량" : "양품") : "-"}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">대표 불량</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900 truncate">
                {latestDefect?.class ? toKo(latestDefect.class) : current?.defectType ? toKo(current.defectType) : "-"}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">신뢰도</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">
                {latestDefect ? `${confidenceToPct(latestDefect.confidence)}%` : "-"}
              </div>
            </div>
          </div>

          {hasDefects && current && (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-gray-900">검출 목록</div>
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
                  top 6
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {current.defects
                  .slice()
                  .sort((a, b) => b.confidence - a.confidence)
                  .slice(0, 6)
                  .map((d, i) => (
                    <div key={`${d.class}-${i}`} className="flex items-center justify-between">
                      <span className="text-gray-800">{toKo(d.class)}</span>
                      <span className="font-mono text-gray-900">
                        {confidenceToPct(d.confidence)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {!current && !result && (
            <div className="mt-5 text-sm text-gray-500">
              데이터 수신 대기 중...
            </div>
          )}
        </Card>
      </div>

      {/* Table */}
      <Card
        title="최근 분석 이력"
        badge={
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gray-900 text-white">
            최근 {Math.min(history.length, 50)}건
          </span>
        }
      >
        {history.length === 0 ? (
          <div className="text-sm text-gray-500">기록 없음</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr className="text-left">
                  <th className="py-3 pr-3 font-semibold">ID</th>
                  <th className="py-3 pr-3 font-semibold">시간</th>
                  <th className="py-3 pr-3 font-semibold">판정</th>
                  <th className="py-3 pr-3 font-semibold">불량</th>
                  <th className="py-3 pr-3 font-semibold">신뢰도</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr
                    key={h.id}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-gray-50",
                      selectedHistoryId === h.id && "bg-blue-50"
                    )}
                    onClick={() => setSelectedHistoryId(h.id)}
                    title="클릭하면 해당 분석 결과를 상단에 표시합니다"
                  >
                    <td className="py-3 pr-3 font-mono text-gray-900">{h.id}</td>
                    <td className="py-3 pr-3 text-gray-700">{h.time}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full border text-xs font-bold",
                          h.judgement === "양품"
                            ? "bg-green-50 text-green-700 border-green-100"
                            : "bg-red-50 text-red-700 border-red-100"
                        )}
                      >
                        {h.judgement}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-gray-800">{toKo(h.defectType)}</td>
                    <td className="py-3 pr-3 font-mono text-gray-900">
                      {h.confidencePct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default WeldingImageDashboard;
