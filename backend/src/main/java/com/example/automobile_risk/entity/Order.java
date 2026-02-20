package com.example.automobile_risk.entity;

import com.example.automobile_risk.entity.enumclass.OrderStatus;
import com.example.automobile_risk.entity.enumclass.ProductionStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder(access = AccessLevel.PRIVATE)
@Table(name = "orders")
@Entity
public class Order extends BaseTimeEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long id;

    private LocalDateTime orderDate;
    private LocalDateTime dueDate;

    @Enumerated(EnumType.STRING)
    private OrderStatus orderStatus;
    private int orderQty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_model_id")
    private VehicleModel vehicleModel;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderProduction> orderProductionList = new ArrayList<>();

    /**
     *  ========================================
     *  비즈니스 로직
     *  ========================================
     */

    /**
     *  주문 생성
     */
    public static Order createOrder(
            LocalDateTime orderDate,
            LocalDateTime dueDate,
            int orderQty,
            VehicleModel vehicleModel
    ) {

        if (orderQty <= 0) {
            throw new IllegalArgumentException("주문 수량은 1 이상이어야 합니다.");
        }

        if (dueDate.isBefore(orderDate)) {
            throw new IllegalArgumentException("납기일은 주문일 이후여야 합니다.");
        }

        return Order.builder()
                .orderDate(orderDate)
                .dueDate(dueDate)
                .orderQty(orderQty)
                .orderStatus(OrderStatus.CREATED)
                .vehicleModel(vehicleModel)
                .build();
    }

    /**
     *  주문 수정
     *  주문 수정에서 vehicleModel은 수정하면 안 된다
     *  Order는 “이 주문은 어떤 차량 모델을 대상으로 한 주문인가?” 의미
     *  vehicleModel이 바뀌면 사실상 ‘다른 주문’이 된다
     *  -> 주문 취소 + 신규 주문으로 생성해야 한다.
     */
    public void changeOrderInfo(
            LocalDateTime orderDate,
            LocalDateTime dueDate,
            int orderQty
    ) {

        if (orderQty <= 0) {
            throw new IllegalArgumentException("주문 수량은 1 이상이어야 합니다.");
        }

        if (dueDate.isBefore(orderDate)) {
            throw new IllegalArgumentException("납기일은 주문일 이후여야 합니다.");
        }

        int allocatedSum = orderProductionList.stream()
                .mapToInt(OrderProduction::getAllocatedQty)
                .sum();

        if (orderQty < allocatedSum) {
            throw new IllegalStateException("이미 할당된 수량보다 주문 수량을 줄일 수 없습니다.");
        }

        this.orderDate = orderDate;
        this.dueDate = dueDate;
        this.orderQty = orderQty;
    }

    /**
     *  OrderProduction 추가
     */
    public void addOrderProduction(OrderProduction op) {

        int allocatedSum = orderProductionList.stream()
                .mapToInt(OrderProduction::getAllocatedQty)
                .sum();

        if (allocatedSum + op.getAllocatedQty() > this.orderQty) {
            throw new IllegalStateException("주문 수량을 초과하여 생산을 할당할 수 없습니다.");
        }

        orderProductionList.add(op);
        op.assignOrder(this);

        updateStatusByAllocation();
    }

    /**
     *  OrderProduction 제거
     */
    public void removeOrderProduction(OrderProduction op) {
        orderProductionList.remove(op);
        op.assignOrder(null);

        updateStatusByAllocation();
    }

    /**
     *  주문상태 자동 변경
     */
    private void updateStatusByAllocation() {

        int allocatedSum = orderProductionList.stream()
                .mapToInt(OrderProduction::getAllocatedQty)
                .sum();

        if (allocatedSum == 0) {
            this.orderStatus = OrderStatus.CREATED;
        } else if (allocatedSum < orderQty) {
            this.orderStatus = OrderStatus.PARTIALLY_ALLOCATED;
        } else {
            this.orderStatus = OrderStatus.FULLY_ALLOCATED;
        }
    }

    /**
     *  주문상태 취소
     */
    public void cancel() {

        if (this.orderStatus == OrderStatus.COMPLETED) {
            throw new IllegalStateException("생산 완료된 주문은 취소할 수 없습니다.");
        }

        this.orderStatus = OrderStatus.CANCELLED;
    }

    /**
     *  생산완료
     */
    public void complete() {

        if (this.orderStatus != OrderStatus.FULLY_ALLOCATED) {
            throw new IllegalStateException("생산이 모두 할당된 주문만 완료 처리할 수 있습니다.");
        }

        this.orderStatus = OrderStatus.COMPLETED;
    }

    /**
     *  모든 생산이 완료되었는지 판단
     */
    public boolean isAllProductionCompleted() {

        if (orderProductionList.isEmpty()) {
            return false;
        }

        return orderProductionList.stream()
                .allMatch(op ->
                        op.getProduction()
                                .getProductionStatus()
                                == ProductionStatus.COMPLETED
                );
    }
}
