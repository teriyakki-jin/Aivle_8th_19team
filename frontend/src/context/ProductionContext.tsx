import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { productionApi, ProductionDto } from "../api/production";
import { processExecutionApi, ProcessExecutionDto } from "../api/processExecution";
import { apiUrl } from "../config/env";

// ML API 기본 URL (Spring Boot)

// 공정 단계 정의 (✅ 라우트 + 모델 배치 최종)
const PIPELINE_STAGES = [
  {
    id: "press",
    name: "\uD504\uB808\uC2A4",
    description: "\uCCA0\uD310 \uC131\uD615 \uBC0F \uC2A4\uD0EC\uD551",
    mlEndpoints: ["/press/vibration", "/press/image"],
    detailPage: "/press",
    duration: { min: 15000, max: 20000 },
  },
  {
    id: "body",
    name: "\uC6A9\uC811",
    description: "\uC6A9\uC811 \uC2E0\uD638 \uAC10\uC9C0",
    mlEndpoints: ["/welding/image/auto"],
    detailPage: "/welding-image",
    duration: { min: 20000, max: 30000 },
  },
  {
    id: "paint",
    name: "\uB3C4\uC7A5",
    description: "\uB3C4\uC7A5 \uBC0F \uCF54\uD305",
    mlEndpoints: ["/paint/auto"],
    detailPage: "/paint",
    duration: { min: 20000, max: 30000 },
  },
  {
    id: "assembly",
    name: "\uC870\uB9BD",
    description: "\uCC28\uCCB4 \uC870\uB9BD \uAC80\uC0AC",
    mlEndpoints: ["/body/inspect/batch/auto"],
    detailPage: "/body",
    duration: { min: 20000, max: 30000 },
  },
  {
    id: "inspection",
    name: "\uAC80\uC0AC",
    description: "\uCD5C\uC885 \uAC80\uC0AC",
    mlEndpoints: ["/windshield/auto", "/engine/auto"],
    detailPage: "/windshield",
    duration: { min: 15000, max: 25000 },
  },
];

type StageStatus = "waiting" | "running" | "completed" | "error";

type StageResult = {
  status: StageStatus;
  hasAnomaly?: boolean;
  message?: string;
  startedAt?: number;
  estimatedDuration?: number;
};

type ProductionStreamEvent = {
  type: "process_execution" | "production";
  productionId?: number;
  orderId?: number;
  processExecutionId?: number;
  executionOrder?: number;
  unitIndex?: number;
  processExecutionStatus?: "READY" | "IN_PROGRESS" | "COMPLETED" | "STOPPED";
  startDate?: string;
  endDate?: string;
  productionStatus?: string;
};

type ProductionItem = {
  orderId: number;
  vehicleModelId: number;
  vehicleModelName?: string;
  orderQty: number;
  dueDate?: string;
  currentStage: number;
  stageResults: StageResult[];
  startedAt?: string;
  completedAt?: string;
  baseOffset?: number; // 주문별 랜덤 시작 오프셋
  productionId?: number;
  productionStatus?: string;
  currentUnitIndex?: number;
};

function mapExecutionStatus(status?: ProcessExecutionDto["status"]): StageStatus {
  switch (status) {
    case "IN_PROGRESS":
      return "running";
    case "COMPLETED":
      return "completed";
    case "STOPPED":
      return "error";
    case "READY":
    default:
      return "waiting";
  }
}

interface ProductionContextType {
  productions: Map<number, ProductionItem>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startProduction: (orderId: number) => Promise<void>;
  applyStreamEvent: (event: ProductionStreamEvent) => void;
  getStages: () => typeof PIPELINE_STAGES;
}

const ProductionContext = createContext<ProductionContextType | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [productions, setProductions] = useState<Map<number, ProductionItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const productionsRef = useRef<Map<number, ProductionItem>>(new Map());

  // 실행 중인 생산 추적 (중복 실행 방지)
  const runningProductions = useRef<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await productionApi.list(0, 1000);
      const productionList: ProductionDto[] = Array.isArray(data) ? data : (data?.content ?? []);

      const execMap = new Map<number, ProcessExecutionDto[]>();
      await Promise.all(
        productionList.map(async (p) => {
          if (!p.productionId) return;
          try {
            const list = await processExecutionApi.listByProduction(p.productionId);
            execMap.set(p.productionId, Array.isArray(list) ? list : []);
          } catch (e) {
            execMap.set(p.productionId, []);
          }
        })
      );

      setProductions((prev) => {
        const newMap = new Map(prev);
        productionList.forEach((p) => {
          const orderId = p.orderId ?? p.productionId;
          if (!orderId) return;
          const executions = p.productionId ? execMap.get(p.productionId) ?? [] : [];
          const maxCompletedUnit = executions
            .filter((e) => e.status === "COMPLETED" && e.unitIndex != null)
            .reduce((max, e) => Math.max(max, e.unitIndex ?? 0), 0);
          const unitIndex =
            maxCompletedUnit > 0
              ? maxCompletedUnit
              : executions[0]?.unitIndex ?? undefined;

          const stageResults: StageResult[] = PIPELINE_STAGES.map(() => ({ status: "waiting" }));
          const executionsForUnit =
            unitIndex != null
              ? executions.filter((e) => e.unitIndex === unitIndex)
              : executions;
          const lastCompleted = executionsForUnit.filter((e) => e.status === "COMPLETED").pop();
          executionsForUnit.forEach((e) => {
            const order = (e.executionOrder ?? 0) - 1;
            if (order >= 0 && order < stageResults.length) {
              stageResults[order] = {
                status: mapExecutionStatus(e.status),
                startedAt: e.startDate ? new Date(e.startDate).getTime() : undefined,
                estimatedDuration:
                  e.status === "IN_PROGRESS"
                    ? 5000
                    : undefined,
              };
            }
          });
          const runningIdx = stageResults.findIndex((r) => r.status === "running");
          const completedIdx = stageResults.reduce((idx, r, i) => (r.status === "completed" ? i : idx), -1);
          const currentStage = runningIdx >= 0 ? runningIdx : Math.max(0, completedIdx);
          const startedAt = executions[0]?.startDate ?? undefined;
          const existing = newMap.get(orderId);
          const dueDate = p.dueDate ?? undefined;
          if (!existing) {
            newMap.set(orderId, {
              orderId,
              vehicleModelId: p.vehicleModelId ?? 0,
              vehicleModelName: p.vehicleModelName,
              orderQty: p.orderQty ?? p.plannedQty ?? 0,
              dueDate,
              currentStage,
              stageResults,
              productionId: p.productionId,
              productionStatus: p.productionStatus,
              startedAt,
              completedAt: lastCompleted?.endDate,
              currentUnitIndex: unitIndex,
            });
          } else {
            const next = { ...existing };
            next.vehicleModelId = p.vehicleModelId ?? next.vehicleModelId;
            next.vehicleModelName = p.vehicleModelName ?? next.vehicleModelName;
            next.orderQty = p.orderQty ?? p.plannedQty ?? next.orderQty;
            next.dueDate = dueDate ?? next.dueDate;
            next.productionId = p.productionId ?? next.productionId;
            next.productionStatus = p.productionStatus ?? next.productionStatus;
            next.stageResults = stageResults;
            next.currentStage = currentStage;
            next.startedAt = startedAt ?? next.startedAt;
            next.completedAt = lastCompleted?.endDate ?? next.completedAt;
            next.currentUnitIndex = unitIndex ?? next.currentUnitIndex;
            newMap.set(orderId, next);
          }
        });
        productionsRef.current = newMap;
        return newMap;
      });
    } catch (e: any) {
      setError(e?.message ?? "생산 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyStreamEvent = useCallback((event: ProductionStreamEvent) => {
    setProductions((prev) => {
      const newMap = new Map(prev);
      const keyFromOrder = event.orderId ? Number(event.orderId) : null;
      let targetKey: number | null = null;

      if (keyFromOrder && newMap.has(keyFromOrder)) {
        targetKey = keyFromOrder;
      } else if (event.productionId) {
        for (const [k, v] of newMap.entries()) {
          if (v.productionId === event.productionId) {
            targetKey = k;
            break;
          }
        }
      }

      if (targetKey === null) return prev;
      const item = newMap.get(targetKey);
      if (!item) return prev;

      const next = { ...item };

      if (event.type === "process_execution" && event.executionOrder) {
        if (event.unitIndex && event.unitIndex !== next.currentUnitIndex) {
          next.stageResults = PIPELINE_STAGES.map(() => ({ status: "waiting" }));
          next.currentStage = 0;
        }
        const idx = event.executionOrder - 1;
        if (idx >= 0 && idx < next.stageResults.length) {
          const status = mapExecutionStatus(event.processExecutionStatus);
          next.stageResults = [...next.stageResults];
          next.stageResults[idx] = {
            ...next.stageResults[idx],
            status,
            startedAt: event.startDate ? new Date(event.startDate).getTime() : next.stageResults[idx].startedAt,
            estimatedDuration: status === "running" ? 5000 : next.stageResults[idx].estimatedDuration,
          };
        }
        if (event.unitIndex) {
          next.currentUnitIndex = Math.max(next.currentUnitIndex ?? 0, event.unitIndex);
        }
      }

      if (event.type === "production") {
        if (event.productionStatus) next.productionStatus = event.productionStatus;
        if (event.startDate) next.startedAt = event.startDate;
        if (event.endDate) next.completedAt = event.endDate;
      }

      const runningIdx = next.stageResults.findIndex((r) => r.status === "running");
      const completedIdx = next.stageResults.reduce((idx, r, i) => (r.status === "completed" ? i : idx), -1);
      next.currentStage = runningIdx >= 0 ? runningIdx : Math.max(0, completedIdx);

      newMap.set(targetKey, next);
      productionsRef.current = newMap;
      return newMap;
    });
  }, []);

  // SSE 스트림 연결 (전역)
  useEffect(() => {
    const source = new EventSource(apiUrl("/api/v1/production/stream"));
    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        applyStreamEvent(data);
      } catch {
        // ignore
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => {
      source.close();
    };
  }, [applyStreamEvent]);

  // 자동 재시도 포함 파이프라인 실행
  const startProduction = useCallback(async (orderId: number) => {
    if (runningProductions.current.has(orderId)) {
      console.log(`Production ${orderId} is already running`);
      return;
    }
    runningProductions.current.add(orderId);

    try {
      const production = productionsRef.current.get(orderId);
      const productionId = production?.productionId;
      if (!productionId) {
        setError("productionId를 찾을 수 없습니다.");
        return;
      }
      await productionApi.start(productionId);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "생산 시작 실패");
    } finally {
      runningProductions.current.delete(orderId);
    }
  }, []);

  const getStages = useCallback(() => PIPELINE_STAGES, []);

  return (
    <ProductionContext.Provider
      value={{
        productions,
        loading,
        error,
        refresh,
        startProduction,
        applyStreamEvent,
        getStages,
      }}
    >
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction() {
  const context = useContext(ProductionContext);
  if (!context) {
    throw new Error("useProduction must be used within a ProductionProvider");
  }
  return context;
}

export { PIPELINE_STAGES };
export type { ProductionItem, StageResult, StageStatus };
