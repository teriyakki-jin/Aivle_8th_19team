package com.example.automobile_risk.entity.enumclass;

public enum InventoryChangeType {

    IN("입고"),
    OUT("출고"),
    IN_PLANNED("입고(예정)"),
    OUT_PLANNED("출고(예정)"),
    ADJUST("조정"),
    SCRAP("폐기");

    private final String label;

    InventoryChangeType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static boolean isPlanned(InventoryChangeType type) {
        return type == IN_PLANNED || type == OUT_PLANNED;
    }
}
