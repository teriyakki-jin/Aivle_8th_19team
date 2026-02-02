package com.example.automobile_risk.entity.enumclass;

public enum InventoryStatus {

    AVAILABLE("가용"),
    SHORTAGE("부족"),   // 생산 일부 계획
    RESERVED("예약");       // 생산 계획 확정

    private final String label;

    InventoryStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
