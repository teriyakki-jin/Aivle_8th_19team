import { api } from './client';

export interface ProcessEventCreateRequest {
    orderId: number;
    process: string;
    eventType: 'BREAKDOWN' | 'DEFECT';
    eventCode?: string;
    severity?: number;
    qtyAffected?: number;
    lineHold?: boolean;
    source?: 'SENSOR' | 'VISION' | 'OPERATOR';
    message?: string;
}

export const processEventApi = {
    create: (data: ProcessEventCreateRequest) =>
        api.post<number>('/api/v1/process-events', data),

    getByOrderId: (orderId: number) =>
        api.get<any[]>(`/api/v1/process-events/order/${orderId}`),

    getUnresolvedByOrderId: (orderId: number) =>
        api.get<any[]>(`/api/v1/process-events/order/${orderId}/unresolved`),
};
