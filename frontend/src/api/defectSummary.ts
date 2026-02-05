import { api } from './client';
import { DefectSummaryItem, ProcessEventLog } from '../types/defectSummary';

export const defectSummaryApi = {
    list: () => api.get<DefectSummaryItem[]>('/api/v1/defect-summary'),
    getDetail: (productionId: number) => api.get<DefectSummaryItem>(`/api/v1/defect-summary/${productionId}`),
    getLogs: (productionId: number) => api.get<ProcessEventLog[]>(`/api/v1/defect-summary/${productionId}/logs`),
    getLogsByOrderId: (orderId: number) => api.get<ProcessEventLog[]>(`/api/v1/defect-summary/order/${orderId}/logs`),
    createSnapshotByOrder: (orderId: number) =>
        api.post<number>(`/api/v1/defect-summary/order/${orderId}/snapshot`, {}),
};
