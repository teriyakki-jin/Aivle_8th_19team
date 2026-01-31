import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useProduction,
  PIPELINE_STAGES,
  ProductionItem,
  StageResult,
} from "../../context/ProductionContext";
import { vehicleModelApi, VehicleModelDto } from "../../api/vehicleModel";
import {
  Factory,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronRight,
  RefreshCcw,
  Hammer,
  Car,
  Paintbrush,
  Wrench,
  ClipboardCheck,
  ExternalLink,
  XCircle,
} from "lucide-react";

const STAGE_ICONS: Record<string, any> = {
  press: Hammer,
  body: Car,
  paint: Paintbrush,
  assembly: Wrench,
  inspection: ClipboardCheck,
};

function formatSecToMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

const trafficCss = `
@keyframes greenBlinkGlow {
  0%   { opacity: 0.35; filter: drop-shadow(0 0 0px rgba(34,197,94,0)); }
  35%  { opacity: 1;    filter: drop-shadow(0 0 6px rgba(34,197,94,0.85)) drop-shadow(0 0 14px rgba(34,197,94,0.55)); }
  70%  { opacity: 0.55; filter: drop-shadow(0 0 2px rgba(34,197,94,0.35)); }
  100% { opacity: 0.35; filter: drop-shadow(0 0 0px rgba(34,197,94,0)); }
}
.traffic-green {
  animation: greenBlinkGlow 1.1s ease-in-out infinite;
}
`;

function TrafficGreenLight({ size = 10 }: { size?: number }) {
  const px = `${size}px`;
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: px, height: px }}
      aria-label="running"
      title="공정 진행 중"
    >
      <span
        className="traffic-green rounded-full"
        style={{
          width: px,
          height: px,
          background: "rgb(34 197 94)",
        }}
      />
      <span
        className="absolute rounded-full"
        style={{
          width: `calc(${px} * 2.1)`,
          height: `calc(${px} * 2.1)`,
          background:
            "radial-gradient(circle, rgba(34,197,94,0.35) 0%, rgba(34,197,94,0.10) 45%, rgba(34,197,94,0.0) 70%)",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}

function TrafficRedLight({ size = 10 }: { size?: number }) {
  const px = `${size}px`;
  return (
    <span
      className="inline-flex rounded-full"
      style={{
        width: px,
        height: px,
        background: "rgb(239 68 68)",
      }}
      aria-label="completed"
      title="공정 완료"
    />
  );
}

function StageProgressBar({ startedAt, duration }: { startedAt: number; duration: number }) {
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      setElapsedSec(Math.max(0, Math.floor(elapsed / 1000)));
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt, duration]);

  return (
    <div className="w-full flex flex-col items-center gap-0.5">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[7px] text-slate-400 leading-none">경과 {formatSecToMMSS(elapsedSec)}</span>
    </div>
  );
}

function StageElapsed({ startedAt }: { startedAt: number }) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedSec(Math.max(0, Math.floor(elapsed / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [startedAt]);

  return <span className="text-[7px] text-slate-400 leading-none">경과 {formatSecToMMSS(elapsedSec)}</span>;
}

function StageIcon({
  stage,
  result,
  isActive,
}: {
  stage: (typeof PIPELINE_STAGES)[0];
  result: StageResult;
  isActive: boolean;
}) {
  const Icon = STAGE_ICONS[stage.id] || ClipboardCheck;
  const baseClass =
    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md";

  if (result.status === "completed" && !result.hasAnomaly) {
    return (
      <div className={`${baseClass} bg-green-500 text-white`}>
        <CheckCircle2 className="w-6 h-6" />
      </div>
    );
  }
  if (result.status === "completed" && result.hasAnomaly) {
    return (
      <div className={`${baseClass} bg-orange-500 text-white`}>
        <AlertTriangle className="w-6 h-6" />
      </div>
    );
  }
  if (result.status === "running") {
    return (
      <div className={`${baseClass} bg-slate-700 text-white relative`}>
        <Icon className="w-6 h-6" />
        <div className="absolute -top-1 -right-1">
          <TrafficGreenLight size={8} />
        </div>
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <div className={`${baseClass} bg-red-500 text-white`}>
        <XCircle className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className={`${baseClass} ${isActive ? "bg-slate-300" : "bg-slate-200"} text-slate-500`}>
      <Icon className="w-6 h-6" />
    </div>
  );
}

function PipelineView({
  production,
  onStageClick,
}: {
  production: ProductionItem;
  onStageClick: (stageId: string, stage: (typeof PIPELINE_STAGES)[0]) => void;
}) {
  const stages = PIPELINE_STAGES;

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-4 px-2">
      {stages.map((stage, idx) => {
        const result = production.stageResults[idx];
        const isActive = idx === production.currentStage;
        const isClickable = result.status !== "waiting";

        return (
          <div key={stage.id} className="flex items-center">
            <div
              className={`flex flex-col items-center min-w-[90px] p-2 rounded-lg transition-all ${
                isClickable ? "cursor-pointer hover:bg-slate-50" : ""
              } ${isActive ? "bg-blue-50" : ""}`}
              onClick={() => isClickable && onStageClick(stage.id, stage)}
            >
              <StageIcon stage={stage} result={result} isActive={isActive} />

              <div className={`mt-2 text-xs font-semibold ${isActive ? "text-blue-600" : "text-slate-700"}`}>
                {stage.name}
              </div>
              <div className="text-[10px] text-slate-400 text-center">{stage.description}</div>

              {result.status === "completed" && (
                <div
                  className={`mt-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                    result.hasAnomaly ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                  }`}
                >
                  {result.hasAnomaly ? "완료 (이상)" : "완료"}
                </div>
              )}

              {result.status === "running" && (
                <div className="mt-1 flex flex-col items-center gap-1">
                  <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                    공정 중...
                  </div>

                  {result.estimatedDuration && result.startedAt ? (
                    <StageProgressBar startedAt={result.startedAt} duration={result.estimatedDuration} />
                  ) : result.startedAt ? (
                    <StageElapsed startedAt={result.startedAt} />
                  ) : null}
                </div>
              )}

              {result.status === "error" && (
                <div className="mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                  오류
                </div>
              )}
            </div>

            {idx < stages.length - 1 && (
              <ChevronRight
                className={`w-5 h-5 mx-1 flex-shrink-0 ${
                  result.status === "completed"
                    ? result.hasAnomaly
                      ? "text-orange-400"
                      : "text-green-500"
                    : "text-slate-300"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProductionCard({
  production,
  onStart,
  onStageClick,
  onViewDetail,
  getModelName,
}: {
  production: ProductionItem;
  onStart: () => void;
  onStageClick: (stageId: string, stage: (typeof PIPELINE_STAGES)[0]) => void;
  onViewDetail: (page: string) => void;
  getModelName: (modelId: number | string) => string;
}) {
  const stages = PIPELINE_STAGES;
  const isRunning = production.stageResults.some((r) => r.status === "running");
  const isCompleted = production.stageResults.every((r) => r.status === "completed");
  const hasAnyAnomaly = production.stageResults.some((r) => r.hasAnomaly);
  const hasError = production.stageResults.some((r) => r.status === "error");
  const isWaiting = production.stageResults.every((r) => r.status === "waiting");

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${hasAnyAnomaly ? "border-orange-300" : ""}`}>
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isCompleted && !hasAnyAnomaly
                ? "bg-green-100"
                : isCompleted && hasAnyAnomaly
                ? "bg-orange-100"
                : isRunning
                ? "bg-blue-100"
                : hasError
                ? "bg-red-100"
                : "bg-slate-100"
            }`}
          >
            <Factory
              className={`w-5 h-5 ${
                isCompleted && !hasAnyAnomaly
                  ? "text-green-600"
                  : isCompleted && hasAnyAnomaly
                  ? "text-orange-600"
                  : isRunning
                  ? "text-blue-600"
                  : hasError
                  ? "text-red-600"
                  : "text-slate-600"
              }`}
            />
          </div>

          <div>
            <div className="font-semibold text-slate-900">주문 #{production.orderId}</div>
            <div className="text-xs text-slate-500">
              {getModelName(production.vehicleModelId)} · {production.orderQty}대
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && !hasAnyAnomaly ? (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 inline-flex items-center gap-2">
              <TrafficRedLight size={10} />
              생산 완료
            </span>
          ) : isCompleted && hasAnyAnomaly ? (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700 inline-flex items-center gap-2">
              <TrafficRedLight size={10} />
              생산 완료 (이상 {production.stageResults.filter((r) => r.hasAnomaly).length}건)
            </span>
          ) : isRunning ? (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 inline-flex items-center gap-2">
              <TrafficGreenLight size={10} />
              {stages[production.currentStage]?.name} 공정 중
            </span>
          ) : hasError ? (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">오류 발생</span>
          ) : isWaiting ? (
            <button
              onClick={onStart}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
            >
              <Play className="w-4 h-4" />
              생산 시작
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <PipelineView production={production} onStageClick={onStageClick} />

        {production.startedAt && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                시작: {new Date(production.startedAt).toLocaleString("ko-KR")}
              </span>
              {production.completedAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  완료: {new Date(production.completedAt).toLocaleString("ko-KR")}
                </span>
              )}
            </div>

            {hasAnyAnomaly && (
              <div className="flex gap-2">
                {production.stageResults.map((r, idx) =>
                  r.hasAnomaly ? (
                    <button
                      key={idx}
                      onClick={() => onViewDetail(stages[idx].detailPage)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-100"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {stages[idx].name} 상세
                    </button>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductionPage() {
  const navigate = useNavigate();
  const { productions, loading, error, refresh, startProduction } = useProduction();
  const [vehicleModels, setVehicleModels] = useState<VehicleModelDto[]>([]);

  // 차량 모델 ID -> 이름 매핑
  const getModelName = (modelId: number | string) => {
    const id = Number(modelId);
    const model = vehicleModels.find((m) => m.vehicleModelId === id);
    return model?.modelName ?? `모델 ${modelId}`;
  };

  useEffect(() => {
    refresh();
    // 차량 모델 목록 로드
    vehicleModelApi.list().then((data) => {
      setVehicleModels(Array.isArray(data) ? data : []);
    }).catch(console.error);
  }, [refresh]);

  // ✅ 클릭 이동 로직 보정:
  // - 검사 클릭은 기본 윈드실드로
  const handleStageClick = (_stageId: string, stage: (typeof PIPELINE_STAGES)[0]) => {
    if (stage.id === "inspection") {
      navigate("/windshield");
      return;
    }
    navigate(stage.detailPage);
  };

  const handleViewDetail = (page: string) => {
    // 검사 “상세” 버튼이 눌리면 기본 page를 따르되,
    // 필요하면 여기서 검사도 분기 가능
    navigate(page);
  };

  const productionList = Array.from(productions.values()).sort((a, b) => {
    const aRunning = a.stageResults.some((r) => r.status === "running");
    const bRunning = b.stageResults.some((r) => r.status === "running");
    if (aRunning && !bRunning) return -1;
    if (!aRunning && bRunning) return 1;
    return b.orderId - a.orderId;
  });

  return (
    <div className="p-6 space-y-6">
      <style>{trafficCss}</style>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Factory className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">생산 관리</h1>
            <p className="text-sm text-slate-500">자동차 제조 공정 파이프라인</p>
          </div>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-slate-50">
          <RefreshCcw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
            불러오는 중...
          </div>
        ) : productionList.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
            <Factory className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <div className="font-medium">생산 대기 중인 주문이 없습니다</div>
            <div className="text-sm mt-1">주문 페이지에서 새 주문을 등록하세요</div>
          </div>
        ) : (
          productionList.map((production) => (
            <ProductionCard
              key={production.orderId}
              production={production}
              onStart={() => startProduction(production.orderId)}
              onStageClick={handleStageClick}
              onViewDetail={handleViewDetail}
              getModelName={getModelName}
            />
          ))
        )}
      </div>
    </div>
  );
}
