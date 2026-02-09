import { useSearchParams, useNavigate } from "react-router-dom";
import { useProduction, ProductionItem } from "../context/ProductionContext";
import { Factory, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { vehicleModelApi, VehicleModelDto } from "../api/vehicleModel";

interface OrderSelectorProps {
  processName: string;
  children: (orderId: number | null) => React.ReactNode;
}

export function OrderSelector({ processName, children }: OrderSelectorProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { productions, loading } = useProduction();
  const [vehicleModels, setVehicleModels] = useState<VehicleModelDto[]>([]);

  const orderIdParam = searchParams.get("orderId");
  const orderId = orderIdParam ? parseInt(orderIdParam, 10) : null;

  useEffect(() => {
    vehicleModelApi.list().then((data) => {
      setVehicleModels(Array.isArray(data) ? data : []);
    }).catch(console.error);
  }, []);

  const getModelName = (modelId: number | string) => {
    const id = Number(modelId);
    const model = vehicleModels.find((m) => m.vehicleModelId === id);
    return model?.modelName ?? `모델 ${modelId}`;
  };

  // orderId가 있으면 해당 주문의 컨텐츠 렌더링
  if (orderId !== null) {
    const production = productions.get(orderId);
    return (
      <div>
        {/* 상단 주문 정보 배너 */}
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Factory className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              주문 #{orderId} - {production ? getModelName(production.vehicleModelId) : ""}
            </span>
            {production && (
              <span className="text-sm text-blue-600">
                ({production.orderQty}대)
                {production.currentUnitIndex ? (
                  <> · {production.currentUnitIndex}번째 차량 (총 {production.orderQty}대)</>
                ) : null}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate(window.location.pathname)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            전체 주문 보기
          </button>
        </div>
        {children(orderId)}
      </div>
    );
  }

  // orderId가 없으면 진행 중인 주문 목록 표시
  const runningProductions = Array.from(productions.values())
    .filter((p) => p.stageResults.some((r) => r.status === "running" || r.status === "completed"))
    .sort((a, b) => a.orderId - b.orderId);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
        불러오는 중...
      </div>
    );
  }

  if (runningProductions.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          <Factory className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <div className="font-medium">진행 중인 생산이 없습니다</div>
          <div className="text-sm mt-1">생산 페이지에서 생산을 시작하세요</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">{processName} - 주문 선택</h2>
        <p className="text-sm text-slate-500 mt-1">
          확인할 주문을 선택하세요. 현재 {runningProductions.length}개의 생산이 진행 중입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {runningProductions.map((production) => (
          <OrderCard
            key={production.orderId}
            production={production}
            getModelName={getModelName}
            onClick={() => navigate(`?orderId=${production.orderId}`)}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  production,
  getModelName,
  onClick,
}: {
  production: ProductionItem;
  getModelName: (modelId: number | string) => string;
  onClick: () => void;
}) {
  const isRunning = production.stageResults.some((r) => r.status === "running");
  const isCompleted = production.stageResults.every((r) => r.status === "completed");
  const hasAnomaly = production.stageResults.some((r) => r.hasAnomaly);
  const completedCount = production.stageResults.filter((r) => r.status === "completed").length;
  const totalStages = production.stageResults.length;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:border-blue-300 ${
        hasAnomaly ? "border-orange-300" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isCompleted && !hasAnomaly
                ? "bg-green-100"
                : isCompleted && hasAnomaly
                ? "bg-orange-100"
                : isRunning
                ? "bg-blue-100"
                : "bg-slate-100"
            }`}
          >
            <Factory
              className={`w-5 h-5 ${
                isCompleted && !hasAnomaly
                  ? "text-green-600"
                  : isCompleted && hasAnomaly
                  ? "text-orange-600"
                  : isRunning
                  ? "text-blue-600"
                  : "text-slate-600"
              }`}
            />
          </div>
          <div>
            <div className="font-semibold text-slate-900">주문 #{production.orderId}</div>
            <div className="text-xs text-slate-500">
              {getModelName(production.vehicleModelId)} · {production.orderQty}대
              {production.currentUnitIndex ? (
                <> · {production.currentUnitIndex}번째 차량 (총 {production.orderQty}대)</>
              ) : null}
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        {isCompleted ? (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" />
            완료
          </span>
        ) : isRunning ? (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3" />
            진행 중
          </span>
        ) : null}

        {hasAnomaly && (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">
            <AlertTriangle className="w-3 h-3" />
            이상 감지
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>공정 진행률</span>
          <span>{completedCount}/{totalStages}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              hasAnomaly ? "bg-orange-500" : "bg-blue-500"
            }`}
            style={{ width: `${(completedCount / totalStages) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
