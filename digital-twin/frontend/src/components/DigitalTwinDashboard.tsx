import { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Play, Pause, Square, RotateCcw, Zap, Settings, TrendingUp, Activity } from 'lucide-react';
import { simulationAPI, SimulationState, ProcessState, OptimizationResult } from '../services/api';
import './DigitalTwinDashboard.css';

// 3D Process Box Component
function ProcessBox({ position, color, label, status, progress }: any) {
    const meshRef = useRef<any>();

    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
        }
    });

    const getStatusColor = () => {
        switch (status) {
            case 'running': return '#10b981';
            case 'warning': return '#f59e0b';
            case 'error': return '#ef4444';
            case 'completed': return '#3b82f6';
            default: return '#64748b';
        }
    };

    return (
        <group position={position}>
            <mesh ref={meshRef}>
                <boxGeometry args={[1.5, 1, 1]} />
                <meshStandardMaterial color={getStatusColor()} opacity={0.8} transparent />
            </mesh>
            <Text
                position={[0, 1.2, 0]}
                fontSize={0.2}
                color="white"
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>
            <Text
                position={[0, -0.8, 0]}
                fontSize={0.15}
                color="white"
                anchorX="center"
                anchorY="middle"
            >
                {progress.toFixed(0)}%
            </Text>
        </group>
    );
}

// 3D Scene Component
function ProductionLineScene({ processes }: { processes: Record<string, ProcessState> }) {
    const processPositions = [
        { key: 'press', position: [-6, 0, 0], label: 'Press' },
        { key: 'welding', position: [-3.5, 0, 0], label: 'Welding' },
        { key: 'body_assembly', position: [-1, 0, 0], label: 'Body' },
        { key: 'paint', position: [1.5, 0, 0], label: 'Paint' },
        { key: 'engine', position: [4, 0, 0], label: 'Engine' },
        { key: 'windshield', position: [6.5, 0, 0], label: 'Windshield' },
    ];

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 5, 10]} />
            <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />

            {/* Ground plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
                <planeGeometry args={[20, 10]} />
                <meshStandardMaterial color="#1e293b" opacity={0.5} transparent />
            </mesh>

            {/* Process boxes */}
            {processPositions.map(({ key, position, label }) => {
                const process = processes[key];
                if (!process) return null;

                return (
                    <ProcessBox
                        key={key}
                        position={position}
                        label={label}
                        status={process.status}
                        progress={process.progress}
                    />
                );
            })}

            {/* Connecting lines */}
            {processPositions.slice(0, -1).map((pos, idx) => {
                const nextPos = processPositions[idx + 1];
                return (
                    <line key={`line-${idx}`}>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array([
                                    pos.position[0] + 0.75, pos.position[1], pos.position[2],
                                    nextPos.position[0] - 0.75, nextPos.position[1], nextPos.position[2]
                                ])}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#3b82f6" linewidth={2} />
                    </line>
                );
            })}
        </>
    );
}

export default function DigitalTwinDashboard() {
    const [simulationId, setSimulationId] = useState<string | null>(null);
    const [simulationState, setSimulationState] = useState<SimulationState | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [showOptimization, setShowOptimization] = useState(false);
    const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [metricsHistory, setMetricsHistory] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'3d' | 'metrics' | 'optimization'>('3d');

    // Initialize simulation
    useEffect(() => {
        initializeSimulation();
    }, []);

    // Poll simulation state
    useEffect(() => {
        if (!simulationId) return;

        const interval = setInterval(async () => {
            try {
                const state = await simulationAPI.getSimulationState(simulationId);
                setSimulationState(state);
                setIsRunning(state.is_running);

                // Update metrics history
                const history = await simulationAPI.getMetricsHistory(simulationId, 50);
                setMetricsHistory(history);
            } catch (error) {
                console.error('Failed to fetch simulation state:', error);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [simulationId]);

    const initializeSimulation = async () => {
        try {
            const { simulation_id } = await simulationAPI.createSimulation({
                name: 'Production Line Simulation',
                scenario: 'normal'
            });
            setSimulationId(simulation_id);

            // 생성 직후 초기 상태 가져오기
            const initialState = await simulationAPI.getSimulationState(simulation_id);
            setSimulationState(initialState);
        } catch (error) {
            console.error('Failed to create simulation:', error);
        }
    };

    const handleStart = async () => {
        if (!simulationId) return;
        try {
            await simulationAPI.startSimulation(simulationId);
            setIsRunning(true);
        } catch (error) {
            console.error('Failed to start simulation:', error);
        }
    };

    const handlePause = async () => {
        if (!simulationId) return;
        try {
            await simulationAPI.pauseSimulation(simulationId);
            setIsRunning(false);
        } catch (error) {
            console.error('Failed to pause simulation:', error);
        }
    };

    const handleStop = async () => {
        if (!simulationId) return;
        try {
            await simulationAPI.stopSimulation(simulationId);
            setIsRunning(false);
        } catch (error) {
            console.error('Failed to stop simulation:', error);
        }
    };

    const handleReset = async () => {
        if (!simulationId) return;
        try {
            await simulationAPI.resetSimulation(simulationId);
            setIsRunning(false);
        } catch (error) {
            console.error('Failed to reset simulation:', error);
        }
    };

    const handleSpeedChange = async (newSpeed: number) => {
        if (!simulationId) return;
        try {
            await simulationAPI.setSpeed(simulationId, newSpeed);
            setSpeed(newSpeed);
        } catch (error) {
            console.error('Failed to change speed:', error);
        }
    };

    const handleOptimize = async () => {
        if (!simulationState) return;

        setIsOptimizing(true);
        try {
            const currentParams: Record<string, Record<string, number>> = {};
            Object.entries(simulationState.processes).forEach(([key, process]) => {
                currentParams[`${key}_params`] = process.current_params;
            });

            const result = await simulationAPI.runOptimization({
                objectives: ['balanced'],
                current_params: currentParams,
                generations: 30,
                population_size: 50
            });

            setOptimizationResult(result);
            setShowOptimization(true);
        } catch (error) {
            console.error('Failed to run optimization:', error);
        } finally {
            setIsOptimizing(false);
        }
    };

    const applyOptimization = async () => {
        if (!simulationId || !optimizationResult) return;

        try {
            await simulationAPI.updateParameters(simulationId, optimizationResult.optimized_params);
            setShowOptimization(false);
        } catch (error) {
            console.error('Failed to apply optimization:', error);
        }
    };

    if (!simulationState) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>시뮬레이션 초기화 중...</p>
            </div>
        );
    }

    const chartData = metricsHistory ? metricsHistory.timestamps.map((time: string, idx: number) => ({
        time: new Date(time).toLocaleTimeString(),
        quality: metricsHistory.quality[idx],
        throughput: metricsHistory.throughput[idx],
        cost: metricsHistory.cost[idx] / 10, // Scale for visibility
        oee: metricsHistory.oee[idx]
    })) : [];

    const radarData = simulationState ? Object.entries(simulationState.processes).map(([key, process]) => ({
        process: key.replace('_', ' '),
        quality: process.quality_score,
        utilization: process.utilization,
        speed: 100 - (process.cycle_time / 180 * 100) // Normalized
    })) : [];

    return (
        <div className="digital-twin-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>🚗 자동차 공정 디지털 트윈</h1>
                    <div className="status-badge">
                        <div className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></div>
                        <span>{isRunning ? '실행 중' : '정지'}</span>
                    </div>
                </div>

                <div className="header-controls">
                    <button onClick={handleStart} disabled={isRunning} className="btn btn-success">
                        <Play size={18} /> 시작
                    </button>
                    <button onClick={handlePause} disabled={!isRunning} className="btn btn-warning">
                        <Pause size={18} /> 일시정지
                    </button>
                    <button onClick={handleStop} className="btn btn-danger">
                        <Square size={18} /> 정지
                    </button>
                    <button onClick={handleReset} className="btn btn-secondary">
                        <RotateCcw size={18} /> 리셋
                    </button>

                    <div className="speed-control">
                        <Zap size={18} />
                        <select value={speed} onChange={(e) => handleSpeedChange(Number(e.target.value))}>
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={5}>5x</option>
                            <option value={10}>10x</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="dashboard-content">
                {/* Left Sidebar - KPIs */}
                <aside className="sidebar-left">
                    <div className="kpi-card">
                        <div className="kpi-header">
                            <Activity size={20} />
                            <h3>전체 KPI</h3>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">OEE</span>
                            <span className="kpi-value">{simulationState.oee.toFixed(1)}%</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">품질</span>
                            <span className="kpi-value">{simulationState.overall_quality.toFixed(1)}%</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">처리량</span>
                            <span className="kpi-value">{simulationState.throughput.toFixed(1)} u/h</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">비용</span>
                            <span className="kpi-value">₩{simulationState.total_cost.toFixed(0)}</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">생산량</span>
                            <span className="kpi-value">{simulationState.total_units_produced}</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">불량</span>
                            <span className="kpi-value danger">{simulationState.total_units_failed}</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">WIP</span>
                            <span className="kpi-value">{simulationState.current_wip}</span>
                        </div>

                        <div className="kpi-item">
                            <span className="kpi-label">시뮬레이션 시간</span>
                            <span className="kpi-value">{(simulationState.simulation_time / 60).toFixed(1)}분</span>
                        </div>
                    </div>

                    <button
                        onClick={handleOptimize}
                        disabled={isOptimizing}
                        className="btn btn-primary btn-optimize"
                    >
                        <TrendingUp size={18} />
                        {isOptimizing ? '최적화 중...' : '최적화 실행'}
                    </button>
                </aside>

                {/* Center - 3D View / Charts */}
                <main className="main-content">
                    <div className="tab-buttons">
                        <button
                            className={`tab-btn ${activeTab === '3d' ? 'active' : ''}`}
                            onClick={() => setActiveTab('3d')}
                        >
                            3D 뷰
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
                            onClick={() => setActiveTab('metrics')}
                        >
                            메트릭
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'optimization' ? 'active' : ''}`}
                            onClick={() => setActiveTab('optimization')}
                        >
                            최적화
                        </button>
                    </div>

                    {activeTab === '3d' && (
                        <div className="canvas-container">
                            <Canvas>
                                <ProductionLineScene processes={simulationState.processes} />
                            </Canvas>
                        </div>
                    )}

                    {activeTab === 'metrics' && (
                        <div className="metrics-container">
                            <div className="chart-section">
                                <h3>실시간 메트릭</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="time" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip
                                            contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="quality" stroke="#10b981" strokeWidth={2} />
                                        <Line type="monotone" dataKey="throughput" stroke="#3b82f6" strokeWidth={2} />
                                        <Line type="monotone" dataKey="oee" stroke="#8b5cf6" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-section">
                                <h3>공정별 성능</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={radarData}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="process" stroke="#94a3b8" />
                                        <PolarRadiusAxis stroke="#94a3b8" />
                                        <Radar name="Quality" dataKey="quality" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                                        <Radar name="Utilization" dataKey="utilization" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {activeTab === 'optimization' && optimizationResult && (
                        <div className="optimization-results">
                            <h3>최적화 결과</h3>

                            <div className="improvement-cards">
                                <div className="improvement-card">
                                    <span className="improvement-label">품질 개선</span>
                                    <span className="improvement-value positive">
                                        +{optimizationResult.quality_improvement.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="improvement-card">
                                    <span className="improvement-label">속도 개선</span>
                                    <span className="improvement-value positive">
                                        +{optimizationResult.speed_improvement.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="improvement-card">
                                    <span className="improvement-label">비용 절감</span>
                                    <span className="improvement-value positive">
                                        -{optimizationResult.cost_reduction.toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            <div className="recommendations">
                                <h4>추천사항</h4>
                                <ul>
                                    {optimizationResult.recommendations.map((rec, idx) => (
                                        <li key={idx}>{rec}</li>
                                    ))}
                                </ul>
                            </div>

                            <button onClick={applyOptimization} className="btn btn-success">
                                최적화 적용
                            </button>
                        </div>
                    )}
                </main>

                {/* Right Sidebar - Process Details */}
                <aside className="sidebar-right">
                    <h3><Settings size={20} /> 공정 상태</h3>

                    {Object.entries(simulationState.processes).map(([key, process]) => (
                        <div key={key} className="process-card">
                            <div className="process-header">
                                <h4>{key.replace('_', ' ').toUpperCase()}</h4>
                                <span className={`status-badge ${process.status}`}>
                                    {process.status}
                                </span>
                            </div>

                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${process.progress}%` }}
                                ></div>
                            </div>

                            <div className="process-stats">
                                <div className="stat">
                                    <span>품질:</span>
                                    <span>{process.quality_score.toFixed(1)}%</span>
                                </div>
                                <div className="stat">
                                    <span>사이클:</span>
                                    <span>{process.cycle_time.toFixed(0)}s</span>
                                </div>
                                <div className="stat">
                                    <span>가동률:</span>
                                    <span>{process.utilization.toFixed(1)}%</span>
                                </div>
                                <div className="stat">
                                    <span>처리:</span>
                                    <span>{process.units_processed}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </aside>
            </div>
        </div>
    );
}
