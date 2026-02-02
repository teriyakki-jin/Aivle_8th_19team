package com.example.automobile_risk.entity.enumclass;

public enum InventoryChangeType {

    IN("입고"),
    OUT("출고"),   // 생산 일부 계획
    ADJUST("조정"),       // 생산 계획 확정
    SCRAP("폐기");       // 생산 계획 확정

    private final String label;

    InventoryChangeType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
