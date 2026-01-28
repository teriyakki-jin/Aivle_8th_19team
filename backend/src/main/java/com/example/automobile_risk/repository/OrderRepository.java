package com.example.automobile_risk.repository;

import com.example.automobile_risk.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("""
        select o
        from Order o
        left join fetch o.orderProductionList op
        left join fetch op.production
        where o.id = :orderId
    """)
    Optional<Order> findDetailById(@Param("orderId") Long orderId);
}
