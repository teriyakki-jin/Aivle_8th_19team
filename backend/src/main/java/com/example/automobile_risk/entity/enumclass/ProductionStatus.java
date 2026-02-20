package com.example.automobile_risk.entity.enumclass;

public enum ProductionStatus {

    PLANNED("생산 계획중"),
    IN_PROGRESS("생산 가동중"),
    COMPLETED("생산 완료"),
    STOPPED("생산 중지"),
    CANCELLED("생산 취소");

    private final String label;

    ProductionStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
