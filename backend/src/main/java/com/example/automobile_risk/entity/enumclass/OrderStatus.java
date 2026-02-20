package com.example.automobile_risk.entity.enumclass;

public enum OrderStatus {

    CREATED("주문 생성"),
    PARTIALLY_ALLOCATED("일부 생산 할당"),   // 생산 일부 계획
    FULLY_ALLOCATED("전체 생산 할당"),       // 생산 계획 확정
    CANCELLED("주문 취소"),
    COMPLETED("생산 완료");      // 생산 완료

    private final String label;

    OrderStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
