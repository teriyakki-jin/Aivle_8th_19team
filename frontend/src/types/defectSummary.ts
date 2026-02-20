export interface ProcessDefectSummary {
    processName: string;
    defectCount: number;
    status: 'PASS' | 'WARNING' | 'FAIL';
}

export interface DefectSummaryItem {
    productionId: number;
    orderId?: number;
    vehicleModelName: string;
    completedAt: string;
    overallStatus: 'PASS' | 'WARNING' | 'FAIL';
    totalDefectCount: number;
    processSummaries: ProcessDefectSummary[];
}

export interface ProcessEventLog {
    id: number;
    process: string;
    eventType: string;
    eventTypeLabel: string;
    eventCode: string;
    severity: number;
    severityLabel: string;
    detectedAt: string;
    resolvedAt?: string;
    resolved: boolean;
    qtyAffected: number;
    lineHold: boolean;
    source?: string;
}
