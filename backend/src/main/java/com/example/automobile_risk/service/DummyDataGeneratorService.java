package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.*;
import com.example.automobile_risk.repository.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import java.time.Duration;

@Service
@RequiredArgsConstructor
@Transactional
public class DummyDataGeneratorService {

    private final EntityManager em;

    // (현재 코드에서는 repository들을 직접 쓰진 않지만,
    //  필요하면 saveAll 같은 배치 저장 방식으로 바꾸기 위해 남겨둘 수 있음)
    private final OrderRepository orderRepository;
    private final ProductionRepository productionRepository;
    private final OrderProductionRepository orderProductionRepository;
    private final ProcessExecutionRepository processExecutionRepository;
    private final DelayTrainingSnapshotRepository snapshotRepository;

    private final VehicleModelRepository vehicleModelRepository;
    private final ProcessTypeRepository processTypeRepository;
    private final EquipmentRepository equipmentRepository;

    /**
     * 더미 데이터 생성
     * 핵심 목표:
     * - Production 1건당 Snapshot N건 (공정 종료 시점마다 1건)
     * - snapshot_stage 시점에는 "현재까지 완료된 공정" anomaly만 들어가고,
     *   미래 공정 anomaly는 null로 저장 (정보 누수 방지)
     * - dueDate를 "타이트"하게 생성
     * - late production은 공정 중간부터 납기 초과 발생
     * - cumulative / remaining delay가 stage별로 변화
     *
     * @param rows     생성할 production 수
     * @param lateRate 지연 비율 (예: 0.05 = 5%)
     * @param seed     랜덤 시드
     */
    public void generate(int rows, double lateRate, long seed) {

        // -----------------------------
        // 0) 난수 생성기 (seed로 재현 가능)
        // -----------------------------
        Random r = new Random(seed);

        // -----------------------------
        // 1) 사전 데이터 로딩
        //    - 주문 생성에 필요한 VehicleModel 목록
        //    - 공정 수행 생성에 필요한 ProcessType 목록
        // -----------------------------
        List<VehicleModel> models = vehicleModelRepository.findAll();
        List<ProcessType> processTypes = processTypeRepository.findAll();

        // -----------------------------
        // 2) ProcessType 별 Equipment 매핑 (processTypeId -> equipmentList)
        //    - 설비는 processType을 FK로 갖고 있으므로 groupBy 가능
        //    - 공정 수행 생성 시 해당 공정 타입의 설비를 랜덤 선택하기 위함
        // -----------------------------
        Map<Long, List<Equipment>> equipmentsByProcessTypeId =
                equipmentRepository.findAll().stream()
                        .collect(Collectors.groupingBy(e -> e.getProcessType().getId()));

        // 사전 데이터가 없으면 더미를 만들 수 없음
        if (models.isEmpty() || processTypes.isEmpty()) {
            throw new IllegalStateException("VehicleModel / ProcessType 더미(또는 기본 데이터)가 먼저 필요합니다.");
        }

        // -----------------------------
        // 3) 지연 건수 타겟 설정
        //    - rows * lateRate 만큼의 production을 "지연"으로 만들겠다
        // -----------------------------
        int lateTarget = (int) Math.round(rows * lateRate); // 목표 지연 건수 (10,000 * 0.05 = 500개)
        int lateCount = 0;                                  // 지금까지 만든 지연 건수

        // 공정 타입을 processOrder 순으로 정렬해서 실행 순서를 만든다.
        // processOrder=1,2,3,4,5 순으로 공정이 수행되게 함
        List<ProcessType> ordered = processTypes.stream()
                .sorted(Comparator.comparingInt(ProcessType::getProcessOrder))
                .toList();

        // -----------------------------
        // 4) Production 단위 반복 
        //    rows 만큼 반복하면서
        //    "업무 테이블 + 학습 스냅샷" 생성
        // -----------------------------
        for (int i = 1; i <= rows; i++) {

            // ==========================================
            // [STEP 1] Order 생성
            // ==========================================

            // 랜덤으로 차량 모델 선택
            VehicleModel model = models.get(r.nextInt(models.size()));

            // 주문 수량(1~20)
            int orderQty = 1 + r.nextInt(20);

            // 주문일: 최근 30일 내 임의의 날짜
            LocalDateTime orderDate = LocalDateTime.now().minusDays(r.nextInt(30));

            // 생산 시작일: 주문일 + 0~1일 후
            LocalDateTime prodStart = orderDate.plusDays(r.nextInt(2));

            // ✅ 핵심: dueDate를 "타이트"하게 생성
            long expectedTotalMinutes = 900 + r.nextInt(600); // 15~25시간
            long slackMinutes =
                    (long) (expectedTotalMinutes * (1.2 + r.nextDouble() * 0.6)); // 1.2~1.8배

            LocalDateTime dueDate = prodStart.plusMinutes(slackMinutes);

            // Order 엔티티 생성 (도메인 규칙/상태 초기화는 createOrder 내부에서 처리)
            Order order = Order.createOrder(orderDate, dueDate, orderQty, model);

            // 영속화 (DB insert 대상)
            em.persist(order);

            // ==========================================
            // [STEP 2] Production 생성
            // ==========================================

            // 주문 수량 중 일부 or 전부를 이 production에 배분 (예: 1~orderQty)
            int allocated = 1 + r.nextInt(orderQty);

            // Production 생성 (PLANNED 상태로 시작하는 것이 일반적)
            Production production = Production.of(prodStart, allocated, model);
            em.persist(production);

            // 생산을 바로 IN_PROGRESS로 전환 (샘플 데이터에서 진행중 생산처럼 보이게)
            // 생산 상태: PLANNED -> IN_PROGRESS
            production.start();

            // ==========================================
            // [STEP 3] Order - Production 연결 (OrderProduction)
            // ==========================================

            // OrderProduction 생성
            // - 내부에서 order.addOrderProduction(op), production.addOrderProduction(op) 같은
            //   연관관계 완성 로직이 있다고 가정한다면,
            //   cascade 설정에 따라 persist 없이도 저장될 수 있음.
            OrderProduction op = OrderProduction.createOrderProduction(order, production, allocated);

            // cascade가 명확히 보장되지 않는다면 persist를 명시적으로 호출해주는 편이 안전
            em.persist(op);

            // ==========================================
            // [STEP 4] 공정 수행(ProcessExecution) 5개 생성
            //          + 공정별 anomaly/stop으로 생산 지연 원인을 "현실스럽게" 만들기
            // ==========================================

            // ------------------------------------------
            // [STEP 4] 공정별 anomaly score 생성 (0~1)
            //      평균이 낮은 값에 몰리게 만들고,
            //      가끔 큰 값이 나오도록(정규분포 기반 -> r.nextGaussian()) 만들었다.
            //      (대부분 낮고(정상), 가끔 높은 값(이상) 발생하도록)
            // ------------------------------------------
            double pressScore = bounded(r.nextGaussian() * 0.15 + 0.15);
            double weldScore = bounded(r.nextGaussian() * 0.18 + 0.12);
            double paintScore = bounded(r.nextGaussian() * 0.20 + 0.14);
            double assemblyScore = bounded(r.nextGaussian() * 0.12 + 0.10);
            double inspectionScore = bounded(r.nextGaussian() * 0.10 + 0.08);

            // ------------------------------------------
            // [STEP 5] 이번 production을 "지연으로 만들지" 결정
            //
            // lateTarget(목표 지연 건수)를 정확히 맞추기 위해
            // 남은 row 대비 남은 지연 슬롯에 따라 확률 p를 계산해서 선택한다.
            // lateTarget이 5%면, 전체 rows 중 정확히 lateTarget건이 지연이 되도록
            // 남은 슬롯/남은 row를 이용해 확률을 동적으로 계산함.
            // ------------------------------------------
            boolean makeLate = false;
            if (lateCount < lateTarget) {
                int remaining = rows - i + 1;                   // 아직 만들어야 하는 row 수
                int lateRemaining = lateTarget - lateCount;     // 아직 만들어야 하는 지연(late) row 수
                double p = (double) lateRemaining / remaining;  // 이번 row가 지연일 확률
                makeLate = r.nextDouble() < p;
            }

            int lateStartStageIdx = makeLate ? (2 + r.nextInt(2)) : Integer.MAX_VALUE;
            long totalLateMinutes = makeLate ? (300 + r.nextInt(1200)) : 0;
            long perStageLate = makeLate
                    ? totalLateMinutes / Math.max(1, ordered.size() - lateStartStageIdx)
                    : 0;

            // ==========================================
            // [STEP 7] 공정 수행 루프 + 스냅샷 생성
            // ==========================================

            // 공정 수행 시점 커서
            // cursor는 "현재까지 공정이 끝난 시각"을 의미
            // 초기화 : 생산 시작일자
            // 이후 갱신하면 이전 공정 종료 시점 다음부터 시작
            LocalDateTime cursor = prodStart;

            // 공정 순번 (executionOrder)
            int executionOrder = 1;

            // stop 이벤트 횟수 누적 (학습 feature로 사용)
            int stopCountTotal = 0;

            // snapshot 임시 보관 (finalDelay 확정 후 업데이트용)
            List<DelayTrainingSnapshot> snapshots = new ArrayList<>();

            // =====================================================
            // [STEP 7] 공정 수행 루프
            // =====================================================

            int stageIdx = 0;
            for (ProcessType pt : ordered) {

                // 해당 공정 타입의 설비 목록
                List<Equipment> eqs = equipmentsByProcessTypeId.get(pt.getId());

                // 공정 타입은 있는데 설비가 없으면 이 공정은 생성 불가
                // (데이터 품질을 위해서는 설비를 최소 1개씩 반드시 만들어두는 것을 권장)
                if (eqs == null || eqs.isEmpty()) {
                    // 설비가 없으면 공정수행을 만들 수 없어서 skip
                    // (단, "모든 공정 완료 후 C시점"이 목적이면
                    //  여기서 예외를 던지는 설계가 더 명확할 수 있음)
                    // 필요하면 로그 남겨서 데이터 품질 체크 가능
                    // log.warn("No equipment for processTypeId={}, name={}", pt.getId(), pt.getProcessName());
                    stageIdx++;
                    continue;
                }

                // 해당 공정 타입 중 랜덤 설비 1개 선택
                // 예) 프레스 1호기, 프레스 2호기 중 프레스 1호기 랜덤으로 선택
                Equipment eq = eqs.get(r.nextInt(eqs.size()));

                // 공정별 기본 소요시간(분)
                // 공정명 문자열로 분기하는 것은 데모에서는 OK
                // (실전에서는 processType에 baseDuration 같은 컬럼을 두는 것도 방법)
                // processName 문자열은 DB에 들어있는 값과 반드시 일치해야 함.
                // (오타나 이름 변경이 있으면 default로 빠짐)
                long base = switch (pt.getProcessName()) {
                    case "프레스" -> 120;                 // stamping
                    case "차체조립(용접)" -> 180;          // welding
                    case "도장" -> 200;                   // paint
                    case "의장" -> 240;                   // assembly
                    case "검수" -> 90;                    // inspection
                    default -> 150;
                };

                // 해당 공정의 anomaly score 선택
                // anomaly가 높으면 duration이 길어지게 설계 -> 지연 원인 생성
                double score = scoreOf(
                        pt.getProcessName(),
                        pressScore, weldScore, assemblyScore, paintScore, inspectionScore
                );

                // ---- anomaly 기반 추가 시간 -> extra
                // 현실 공정은 절대 균일하지 않다 (0.3 정도의 기본 변동성을 가짐)
                // base * score * (0.3~1.3 정도) => score가 높을수록 시간이 늘어남
                // anomaly score가 높을수록 extra가 늘어나고 duration이 길어진다
                long extra = (long) (base * score * (0.3 + r.nextDouble()));

                long duration = base + extra;

                // stop 이벤트:
                // - 기본적으로 아주 낮은 확률로 발생 -> 1% + (score * 5%) 확률
                // - score가 높을수록 확률 증가
                // - makeLate(지연 row) 케이스의 경우:
                //      15% 정도 추가 발생 확률 -> stop 확률을 추가로 높여 "지연 원인"을 강화 -> 지연 row는 stop이 더 많아짐
                boolean stop =
                        (r.nextDouble() < (0.01 + score * 0.05))    // 기본 : 1% + (score * 5%) 확률
                            || (makeLate && r.nextDouble() < 0.15); // 지연 : 15% 정도 추가 발생 확률

                if (stop) {
                    stopCountTotal++;
                    // stop 시 추가 지연 시간: 1~5시간(60~240분)
                    duration += 60 + r.nextInt(180);
                }

                // ✅ late 분산
                if (makeLate && stageIdx >= lateStartStageIdx) {
                    duration += perStageLate + r.nextInt(30);
                }

                // 공정 시작 시점: 이전 공정 종료(cursor) 이후 약간의 간격(0~9분)을 두고 시작
                LocalDateTime peStart = cursor.plusMinutes(r.nextInt(10));

                // 공정 종료 시점
                LocalDateTime peEnd = peStart.plusMinutes(duration);

                // ProcessExecution 생성
                // (createEntity에서는 startDate와 executionOrder를 받고,
                //  endDate는 complete()에서 설정되는 구조로 보임)
                // 공정 수행 상태: READY
                ProcessExecution pe = ProcessExecution.createEntity(
                        peStart, executionOrder, 1, production, pt, eq
                );
                em.persist(pe);

                // 상태 전이: READY(or STOPPED) -> IN_PROGRESS -> COMPLETED
                pe.operate();       // 공정 수행 상태: IN_PROGRESS
                pe.complete(peEnd); // 공정 수행 상태: COMPLETED

                // 누적 소요시간 업데이트
                // totalMinutes += java.time.Duration.between(peStart, peEnd).toMinutes();

                // 다음 공정은 이 공정 종료 이후부터 이어진다
                cursor = peEnd;
                executionOrder++;   // 실제 수행된 공정 순서
                stageIdx++;

                // =================================================
                // ✅ stage-aware anomaly (미래 공정 anomaly는 null)
                // =================================================
                // IMPORTANT:
                // - DelayTrainingSnapshot 컬럼 타입이 Double(래퍼)여야 null 저장 가능
                Double press = null, weld = null, paint = null, assembly = null, inspection = null;

                switch (pt.getProcessName()) {
                    case "프레스" -> press = pressScore;
                    case "차체조립(용접)" -> { press = pressScore; weld = weldScore; }
                    case "도장" -> { press = pressScore; weld = weldScore; paint = paintScore; }
                    case "의장" -> { press = pressScore; weld = weldScore; paint = paintScore; assembly = assemblyScore; }
                    case "검수" -> {
                        press = pressScore; weld = weldScore;
                        paint = paintScore; assembly = assemblyScore; inspection = inspectionScore;
                    }
                }

                // =================================================
                // 🔥 공정 종료 시점 Snapshot 생성
                // - cumulativeDelayMinutes는 엔티티 내부에서 snapshotTime/dueDate로 계산됨
                // - finalDelay/remainingDelay/delayFlag는 생성 시점엔 0 → 나중에 applyFinalDelay로 확정
                // =================================================
                DelayTrainingSnapshot snap = DelayTrainingSnapshot.of(
                        order.getId(),
                        production.getId(),

                        stageCodeOf(pt),
                        peEnd,

                        orderDate,
                        dueDate,
                        prodStart,

                        orderQty,

                        press, weld, paint, assembly, inspection,

                        stopCountTotal
                );


                em.persist(snap);
                snapshots.add(snap);
            }   // for (ProcessType pt : ordered)

            // ==========================================
            // [STEP 8] Production 완료 시점(prodEnd) 확정 + 최종 지연 확정
            // ==========================================

            // 기본은 마지막 공정 종료 시점
            LocalDateTime prodEnd = cursor;
            production.complete(prodEnd);

            long finalDelayMinutes =
                    Math.max(0, Duration.between(dueDate, prodEnd).toMinutes());

            if (finalDelayMinutes > 0) lateCount++;

            // ==========================================
            // [STEP 9] 모든 snapshot에 finalDelay 적용
            // - remainingDelayMinutes = max(finalDelay - cumulativeDelay, 0)
            // - delayFlag = finalDelay > 0 ? 1 : 0
            // ==========================================
            for (DelayTrainingSnapshot s : snapshots) {
                s.applyFinalDelay(finalDelayMinutes);
            }

            // ==========================================
            // [STEP 8] 배치 flush/clear
            // ==========================================
            // - JPA 1차 캐시에 엔티티가 계속 쌓이면 메모리/성능 문제 발생
            // - 500건마다 DB에 flush하고 영속성 컨텍스트를 비워준다
            if (i % 500 == 0) {
                em.flush();
                em.clear();
            }
        }   // for (int i = 1; i <= rows; i++)
    }   // generate()

    /**
     * 값을 0~1로 클램핑(clamping)
     * - 정규분포 난수는 음수/1초과 값이 나올 수 있어서 안정적으로 feature 범위를 맞춘다.
     */
    private static double bounded(double x) {
        if (x < 0) return 0;
        if (x > 1) return 1;
        return x;
    }

    /**
     * 공정명에 따라 해당 공정의 score를 반환
     * - 공정 타입 이름 문자열에 의존하므로, 추후 enum/코드값으로 바꾸는 것이 더 안전
     */
    private static double scoreOf(
            String processName,
            double press, double weld, double assembly, double paint, double inspection
    ) {
        return switch (processName) {
            case "프레스" -> press;
            case "차체조립(용접)" -> weld;
            case "도장" -> paint;
            case "의장" -> assembly;
            case "검수" -> inspection;
            default -> 0.1;
        };
    }

    /**
     * ProcessType 이름 → 표준 snapshot_stage 코드 매핑
     *
     * 반드시 "모델 / 파이프라인 / Python"과 동일한 값 사용
     */
    private static String stageCodeOf(ProcessType pt) {
        return switch (pt.getProcessName()) {
            case "프레스" -> "PRESS_DONE";
            case "차체조립(용접)" -> "WELD_DONE";
            case "도장" -> "PAINT_DONE";
            case "의장" -> "ASSEMBLY_DONE";
            case "검수" -> "INSPECTION_DONE";
            default -> "UNKNOWN_DONE";
        };
    }

}


