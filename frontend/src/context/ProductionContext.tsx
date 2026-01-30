import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { orderApi, OrderDto } from "../api/order";

// ML API 기본 URL (Spring Boot)
const ML_API_BASE = "http://localhost:3001/api/v1/ml";

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
};

type ProductionItem = {
  orderId: number;
  vehicleModelId: number;
  orderQty: number;
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

  // 실행 중인 생산 추적 (중복 실행 방지)
  const runningProductions = useRef<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await orderApi.list();
      const orderList: OrderDto[] = Array.isArray(data) ? data : [];

      setProductions((prev) => {
        const newMap = new Map(prev);
        orderList.forEach((o) => {
          const orderId = (o as any)?.id ?? (o as any)?.orderId;
          if (orderId && !newMap.has(orderId)) {
            newMap.set(orderId, {
              orderId,
              vehicleModelId: (o as any)?.vehicleModelId ?? (o as any)?.modelId ?? 0,
              orderQty: (o as any)?.orderQty ?? (o as any)?.quantity ?? 0,
              currentStage: 0,
              stageResults: PIPELINE_STAGES.map(() => ({ status: "waiting" as StageStatus })),
            });
          }
        });
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
          setProductions((prev) => {
            const newMap = new Map(prev);
            const production = newMap.get(orderId);
            if (production) {
              production.stageResults[stageIdx] = {
                status: "completed",
                mlResults,
                hasAnomaly: false,
                message: retryCount > 0 ? `정상 (${retryCount}회 재시도 후)` : "정상",
                retryCount,
              };

              if (stageIdx === PIPELINE_STAGES.length - 1) {
                production.completedAt = new Date().toISOString();
              }

              newMap.set(orderId, { ...production });
            }
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
