import axios from 'axios';

const API_BASE_URL = '/api';

export interface SimulationConfig {
    name: string;
    scenario: string;
    press_params?: Record<string, number>;
    welding_params?: Record<string, number>;
    body_params?: Record<string, number>;
    paint_params?: Record<string, number>;
    engine_params?: Record<string, number>;
    windshield_params?: Record<string, number>;
}

export interface ProcessState {
    process_type: string;
    status: string;
    progress: number;
    cycle_time: number;
    quality_score: number;
    defect_rate: number;
    utilization: number;
    current_params: Record<string, number>;
    units_processed: number;
    units_failed: number;
    total_time: number;
}

export interface SimulationState {
    simulation_id: string;
    timestamp: string;
    is_running: boolean;
    simulation_speed: number;
    simulation_time: number;
    processes: Record<string, ProcessState>;
    overall_quality: number;
    throughput: number;
    total_cost: number;
    oee: number;
    total_units_produced: number;
    total_units_failed: number;
    current_wip: number;
}

export interface OptimizationRequest {
    objectives: string[];
    current_params: Record<string, Record<string, number>>;
    constraints?: Record<string, any>;
    generations?: number;
    population_size?: number;
}

export interface OptimizationResult {
    optimization_id?: string;
    timestamp: string;
    optimized_params: Record<string, Record<string, number>>;
    predicted_quality: number;
    predicted_speed: number;
    predicted_cost: number;
    quality_improvement: number;
    speed_improvement: number;
    cost_reduction: number;
    pareto_frontier: Array<Record<string, any>>;
    recommendations: string[];
    sensitivity: Record<string, number>;
}

class SimulationAPI {
    async createSimulation(config: SimulationConfig): Promise<{ simulation_id: string }> {
        const response = await axios.post(`${API_BASE_URL}/simulation/create`, config);
        return response.data;
    }

    async startSimulation(simulationId: string): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/simulation/${simulationId}/start`);
        return response.data;
    }

    async pauseSimulation(simulationId: string): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/simulation/${simulationId}/pause`);
        return response.data;
    }

    async stopSimulation(simulationId: string): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/simulation/${simulationId}/stop`);
        return response.data;
    }

    async resetSimulation(simulationId: string): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/simulation/${simulationId}/reset`);
        return response.data;
    }

    async getSimulationState(simulationId: string): Promise<SimulationState> {
        const response = await axios.get(`${API_BASE_URL}/simulation/${simulationId}/state`);
        return response.data;
    }

    async updateParameters(simulationId: string, params: Record<string, any>): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/simulation/${simulationId}/update-params`, params);
        return response.data;
    }

    async setSpeed(simulationId: string, speed: number): Promise<any> {
        const response = await axios.post(`${API_BASE_URL}/simulation/${simulationId}/speed?speed=${speed}`);
        return response.data;
    }

    async runOptimization(request: OptimizationRequest): Promise<OptimizationResult> {
        const response = await axios.post(`${API_BASE_URL}/optimization/analyze`, request);
        return response.data;
    }

    async getMetricsHistory(simulationId: string, limit: number = 100): Promise<any> {
        const response = await axios.get(`${API_BASE_URL}/metrics/${simulationId}/history?limit=${limit}`);
        return response.data;
    }
}

export const simulationAPI = new SimulationAPI();
