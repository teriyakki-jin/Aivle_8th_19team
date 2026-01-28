package com.example.automobile_risk.service;

import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.ProductionVehicle;
import com.example.automobile_risk.repository.ProductionVehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Service
public class ManufacturingOrchestrationService {

    private final ProductionService productionService;
    private final OrderService orderService;
    private final ProductionVehicleRepository productionVehicleRepository;

    @Transactional
    public void completeProduction(Long productionId, LocalDateTime endDate, List<String> serialNumbers) {

        // 1. 생산 완료
        productionService.completeProduction(productionId, endDate, serialNumbers);

        // 2. 생산 차량 생성
        Production production = productionService.getEntity(productionId);

        for (String serialNumber : serialNumbers) {
            ProductionVehicle vehicle = ProductionVehicle.createProductionVehicle(serialNumber, endDate, production);

            productionVehicleRepository.save(vehicle);
        }

        /*
            이 생산에 연결된 주문들 조회
            Production -> OrderProduction -> Order 로 조회하는 것은 코드 상 가능하지만
            도메인 책임 방향이 반대로가 된다. 즉, 생산이 주문의 생명주기를 지배하는 셈이 된다.
            Order -> OrderProduction -> Production 로 조회해야 도메인 책임 방향이 맞다.

            주문이 하나도 없으면 아래 for-loop 실행 안 되고 정상 종료
         */
        List<Long> orderIds =
                orderService.findRelatedOrderIdsByProduction(productionId);

        if (orderIds.isEmpty()) {
            log.info("Production {} completed with no linked orders", productionId);
        }

        // 주문 완료 가능 여부 판단 후 완료
        for (Long orderId : orderIds) {
            orderService.tryCompleteOrder(orderId);
        }
    }
}
