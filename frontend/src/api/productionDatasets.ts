import { api } from "./client";

export type ProductionDatasetAssignPayload = {
  processName: string;
  datasetId: number;
};

export const productionDatasetsApi = {
  assign: (productionId: number, payload: ProductionDatasetAssignPayload) =>
    api.post(`/api/v1/production-datasets/production/${productionId}`, payload),
};
