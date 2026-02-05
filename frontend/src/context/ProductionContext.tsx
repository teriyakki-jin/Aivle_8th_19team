import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { orderApi, OrderDto } from "../api/order";
import { ML_API_BASE } from "../config/env";

// ML API 기본 URL (Spring Boot)

// 공정 단계 정의 (✅ 라우트 + 모델 배치 최종)
const PIPELINE_STAGES = [
  {
    id: "press",
    name: "프레스",
    description: "철판 성형 및 스탬핑",
    mlEndpoints: ["/press/vibration", "/press/image"],
    detailPage: "/press",
    duration: { min: 15000, max: 20000 },
  },
  {
    id: "body",
    name: "차체",
    description: "용접 품질 검사",
    mlEndpoints: ["/welding/image/auto"], // ✅ 용접만 유지
    detailPage: "/welding-image", // ✅ 차체 클릭 시 용접 이미지 페이지로
    duration: { min: 20000, max: 30000 },
  },
  {
    id: "paint",
    name: "도장",
    description: "도장 및 코팅",
    mlEndpoints: ["/paint/auto"],
    detailPage: "/paint",
    duration: { min: 20000, max: 30000 },
  },
  {
    id: "assembly",
    name: "의장",
    description: "차체 조립 검사",
    mlEndpoints: [
      "/body/inspect/batch/auto", // ✅ 의장에 차체조립 배치 auto
      // 필요하면 단건도 추가 가능:
      // "/body/inspect/auto",
    ],
    detailPage: "/body", // ✅ 차체 조립 페이지
    duration: { min: 20000, max: 30000 },
  },
  {
    id: "inspection",
    name: "검사",
    description: "최종 품질 검사",
    mlEndpoints: ["/windshield/auto", "/engine/auto"], // ✅ 검사에 윈드실드+엔진
    detailPage: "/windshield", // ✅ 기본 진입은 윈드실드
    duration: { min: 15000, max: 25000 },
  },
];

type StageStatus = "waiting" | "running" | "completed" | "error";

type StageResult = {
  status: StageStatus;
  mlResults?: any[];
  hasAnomaly?: boolean;
  message?: string;
  startedAt?: number;
  estimatedDuration?: number;
  retryCount?: number;
  dueDatePrediction?: any;
  dueDateError?: string;
};

type ProductionItem = {
  orderId: number;
  vehicleModelId: number;
  orderQty: number;
  dueDate?: string;
  currentStage: number;
  stageResults: StageResult[];
  startedAt?: string;
  completedAt?: string;
  baseOffset?: number; // 주문별 랜덤 시작 오프셋
};

// ML API 호출 함수
async function callMLApi(endpoint: string, offset: number = 0): Promise<any> {
  try {
    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${ML_API_BASE}${endpoint}${separator}offset=${offset}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`ML API call failed: ${endpoint}`, error);
    throw error;
  }
}

async function callDueDateApi(payload: any): Promise<any> {
  try {
    const url = `${ML_API_BASE}/duedate`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`DueDate API Error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("DueDate API call failed:", error);
    throw error;
  }
}

const SNAPSHOT_STAGE_BY_ID: Record<string, string> = {
  press: "PRESS_DONE",
  body: "WELD_DONE",
  paint: "PAINT_DONE",
  assembly: "ASSEMBLY_DONE",
  inspection: "INSPECTION_DONE",
};

function toMinutes(ms: number) {
  return Math.max(0, Math.floor(ms / 60000));
}

function parseDueDateToLocalEnd(dueDate?: string): Date | null {
  if (!dueDate) return null;
  const direct = new Date(dueDate);
  if (!Number.isNaN(direct.getTime())) return direct;
  const fallback = new Date(`${dueDate}T23:59:59`);
  if (Number.isNaN(fallback.getTime())) return null;
  return fallback;
}

function buildDueDatePayload(
  production: ProductionItem,
  stageId: string,
  stageHasAnomaly: boolean
) {
  const startedAt = production.startedAt ? new Date(production.startedAt).getTime() : Date.now();
  const elapsedMinutes = toMinutes(Date.now() - startedAt);

  const dueDateEnd = parseDueDateToLocalEnd(production.dueDate);
  const remainingSlackMinutes = dueDateEnd
    ? toMinutes(dueDateEnd.getTime() - Date.now())
    : 300;

  const stopCountTotal = production.stageResults.reduce(
    (sum, r) => sum + (r?.retryCount ?? 0),
    0
  );

  const stageAnomalyMap: Record<string, number | null> = {
    press: null,
    body: null,
    paint: null,
    assembly: null,
    inspection: null,
  };

  // 완료된 단계들의 이상 여부(재시도 발생 여부)를 0/1로 저장
  PIPELINE_STAGES.forEach((s, idx) => {
    const r = production.stageResults[idx];
    if (!r || r.status === "waiting") return;
    stageAnomalyMap[s.id] = (r.retryCount ?? 0) > 0 ? 1 : 0;
  });

  // 현재 단계는 이번 결과 기준으로 갱신
  stageAnomalyMap[stageId] = stageHasAnomaly ? 1 : 0;

  return {
    order_id: production.orderId,
    order_qty: production.orderQty,
    stop_count_total: stopCountTotal,
    elapsed_minutes: elapsedMinutes,
    remaining_slack_minutes: remainingSlackMinutes,

    press_anomaly_score: stageAnomalyMap.press,
    weld_anomaly_score: stageAnomalyMap.body,
    paint_anomaly_score: stageAnomalyMap.paint,
    assembly_anomaly_score: stageAnomalyMap.assembly,
    inspection_anomaly_score: stageAnomalyMap.inspection,

    snapshot_stage: SNAPSHOT_STAGE_BY_ID[stageId] ?? "PRESS_DONE",
  };
}

// ✅ ML 결과에서 이상 여부 판단 (prediction=1 같은 단순 규칙 제거)
function checkAnomaly(result: any): boolean {
  if (!result) return false;

  // press vibration 스타일
  if (result.is_anomaly === 1) return true;

  // welding/paint 등 status 기반
  const status = String(result.status ?? "").toUpperCase();
  if (status === "DEFECT" || status === "FAIL" || status === "ABNORMAL") return true;

  // judgement 기반 (windshield/engine 포함)
  const judgement = String(result.judgement ?? "").toUpperCase();
  if (judgement === "FAIL" || judgement === "ABNORMAL") return true;

  // body inspect
  const passFail = String(result.pass_fail ?? "").toUpperCase();
  if (passFail === "FAIL") return true;

  // batch 결과(차체조립)
  if (result.results) {
    const parts = Object.values(result.results);
    return parts.some((p: any) => String(p?.pass_fail ?? "").toUpperCase() === "FAIL");
  }

  return false;
}

interface ProductionContextType {
  productions: Map<number, ProductionItem>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startProduction: (orderId: number) => Promise<void>;
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
      const data = await orderApi.listAll();
      // 페이징 응답에서 content 추출
      const orderList: OrderDto[] = Array.isArray(data) ? data : (data?.content ?? []);

      setProductions((prev) => {
        const newMap = new Map(prev);
        orderList.forEach((o) => {
          const orderId = (o as any)?.id ?? (o as any)?.orderId;
          if (!orderId) return;
          const dueDate = (o as any)?.dueDate ?? (o as any)?.deadline ?? undefined;
          if (!newMap.has(orderId)) {
            newMap.set(orderId, {
              orderId,
              vehicleModelId: (o as any)?.vehicleModelId ?? (o as any)?.modelId ?? 0,
              orderQty: (o as any)?.orderQty ?? (o as any)?.quantity ?? 0,
              dueDate,
              currentStage: 0,
              stageResults: PIPELINE_STAGES.map(() => ({ status: "waiting" as StageStatus })),
            });
          } else {
            const existing = newMap.get(orderId)!;
            existing.orderQty = (o as any)?.orderQty ?? (o as any)?.quantity ?? existing.orderQty;
            existing.vehicleModelId = (o as any)?.vehicleModelId ?? (o as any)?.modelId ?? existing.vehicleModelId;
            existing.dueDate = dueDate ?? existing.dueDate;
            newMap.set(orderId, { ...existing });
          }
        });
        productionsRef.current = newMap;
        return newMap;
      });
    } catch (e: any) {
      setError(e?.message ?? "주문 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  // 자동 재시도 포함 파이프라인 실행
  const startProduction = useCallback(async (orderId: number) => {
    if (runningProductions.current.has(orderId)) {
      console.log(`Production ${orderId} is already running`);
      return;
    }
    runningProductions.current.add(orderId);

    const baseOffset = Math.floor(Math.random() * 100);
    console.log(`Production ${orderId}: Starting with base offset ${baseOffset}`);

    // 시작 상태로 변경
    setProductions((prev) => {
      const newMap = new Map(prev);
      const production = newMap.get(orderId);
      if (production) {
        production.stageResults[0] = { status: "running" };
        production.startedAt = new Date().toISOString();
        production.baseOffset = baseOffset;
        newMap.set(orderId, { ...production });
      }
      productionsRef.current = newMap;
      return newMap;
    });

    for (let stageIdx = 0; stageIdx < PIPELINE_STAGES.length; stageIdx++) {
      const stage = PIPELINE_STAGES[stageIdx];
      let retryCount = 0;
      let stageSuccess = false;

      const stageStartTime = Date.now();

      while (!stageSuccess) {
        const stageDuration =
          stage.duration.min + Math.random() * (stage.duration.max - stage.duration.min);
        const retryStartTime = Date.now();

        setProductions((prev) => {
          const newMap = new Map(prev);
          const production = newMap.get(orderId);
          if (production) {
            production.currentStage = stageIdx;
            production.stageResults[stageIdx] = {
              status: "running",
              startedAt: stageStartTime,
              estimatedDuration: stageDuration,
              retryCount,
            };
            newMap.set(orderId, { ...production });
          }
          productionsRef.current = newMap;
          return newMap;
        });

        let hasAnomaly = false;
        const mlResults: any[] = [];
        const totalOffset = baseOffset + stageIdx * 10 + retryCount;

        if (stage.mlEndpoints.length > 0) {
          for (const endpoint of stage.mlEndpoints) {
            try {
              const result = await callMLApi(endpoint, totalOffset);
              mlResults.push(result);
              if (checkAnomaly(result)) hasAnomaly = true;
            } catch (error) {
              console.error(`Stage ${stage.id} ML call failed:`, error);
              // 실패는 "이상"으로 치지 않고, 메시지로만 남김
            }
          }
        }

        const elapsed = Date.now() - retryStartTime;
        const remainingTime = Math.max(0, stageDuration - elapsed);
        if (remainingTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }

        if (hasAnomaly) {
          retryCount++;
          console.log(
            `Production ${orderId}: Anomaly at ${stage.name}, auto-retry ${retryCount}`
          );
        } else {
          let dueDatePrediction: any = null;
          let dueDateError: string | undefined = undefined;
          try {
            const production = productionsRef.current.get(orderId);

            if (production) {
              const payload = buildDueDatePayload(production, stage.id, retryCount > 0);
              dueDatePrediction = await callDueDateApi(payload);
            }
          } catch (e: any) {
            dueDateError = e?.message ?? "duedate 호출 실패";
            // duedate 실패는 공정 완료를 막지 않음
          }

          setProductions((prev) => {
            const newMap = new Map(prev);
            const production = newMap.get(orderId);
            if (production) {
              production.stageResults[stageIdx] = {
                status: "completed",
                mlResults,
                hasAnomaly: retryCount > 0,
                message: retryCount > 0 ? `정상 (${retryCount}회 재시도 후)` : "정상",
                retryCount,
                dueDatePrediction,
                dueDateError,
              };

              if (stageIdx === PIPELINE_STAGES.length - 1) {
                production.completedAt = new Date().toISOString();
              }

              newMap.set(orderId, { ...production });
            }
            productionsRef.current = newMap;
            return newMap;
          });
          stageSuccess = true;
        }
      }
    }

    runningProductions.current.delete(orderId);
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
