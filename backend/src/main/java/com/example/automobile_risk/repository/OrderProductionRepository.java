package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.OrderProduction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OrderProductionRepository extends JpaRepository<OrderProduction, Long> {

    // 주문 id만 조회
    @Query("""
        select distinct op.order.id
        from OrderProduction op
        where op.production.id = :productionId
    """)
    List<Long> findRelatedOrderIdsByProduction(@Param("productionId") Long productionId);

    // 생산 id만 조회
    @Query("""
        select distinct op.production.id
        from OrderProduction op
        where op.order.id = :orderId
    """)
    List<Long> findRelatedProductionIdsByOrder(@Param("orderId") Long orderId);

    /**
     *  Order + Production 같이 조회
     *  productionId로 조회하는 이유는
     *  ‘생산 이벤트(완료/중지/재시작)’가 트리거가 되는 시나리오이기 때문
     *  [Production 완료] -> 이 Production에 연결된 주문들 조회
     *  “특정 생산이 끝났을 때
     *  이 생산에 물린 주문 + 생산 정보를 한 번에 보고 싶다”
     */
    @Query("""
        select op
        from OrderProduction op
        join fetch op.order
        join fetch op.production
        where op.production.id = :productionId
    """)
    List<OrderProduction> findWithOrderByProductionId(@Param("productionId") Long productionId);

    // 주문 기준 조회
    List<OrderProduction> findByOrderId(Long orderId);

    // 생산 기준 조회
    List<OrderProduction> findByProductionId(Long productionId);
}
