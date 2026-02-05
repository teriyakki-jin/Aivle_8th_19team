import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Car, CheckCircle, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';
import { defectSummaryApi } from '../../api/defectSummary';
import { DefectSummaryItem, ProcessEventLog } from '../../types/defectSummary';
import { ErrorLogList } from './ErrorLogList';

// 각 summary의 고유 키 생성 (productionId 또는 orderId 사용)
const getSummaryKey = (summary: DefectSummaryItem): string => {
    if (summary.productionId) return `prod_${summary.productionId}`;
    if (summary.orderId) return `order_${summary.orderId}`;
    return `unknown_${Math.random()}`;
};

export const DefectSummarySection = () => {
    const [summaries, setSummaries] = useState<DefectSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [logs, setLogs] = useState<Record<string, ProcessEventLog[]>>({});
    const [logsLoading, setLogsLoading] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchSummaries();
    }, []);

    const fetchSummaries = async () => {
        try {
            setLoading(true);
            const data = await defectSummaryApi.list();
            setSummaries(data || []);
        } catch (err: any) {
            setError(err.message || '결함 요약을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = async (summary: DefectSummaryItem) => {
        const key = getSummaryKey(summary);

        if (expandedKey === key) {
            setExpandedKey(null);
            return;
        }

        setExpandedKey(key);

        if (!logs[key]) {
            setLogsLoading(prev => ({ ...prev, [key]: true }));
            try {
                let logData: ProcessEventLog[];
                if (summary.productionId) {
                    logData = await defectSummaryApi.getLogs(summary.productionId);
                } else if (summary.orderId) {
                    logData = await defectSummaryApi.getLogsByOrderId(summary.orderId);
                } else {
                    logData = [];
                }
                setLogs(prev => ({ ...prev, [key]: logData || [] }));
            } catch (err) {
                console.error('Failed to fetch logs:', err);
                setLogs(prev => ({ ...prev, [key]: [] }));
            } finally {
                setLogsLoading(prev => ({ ...prev, [key]: false }));
            }
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PASS': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'WARNING': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'FAIL': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return null;
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'PASS': return 'bg-green-100 text-green-800';
            case 'WARNING': return 'bg-yellow-100 text-yellow-800';
            case 'FAIL': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getProcessStatusClass = (status: string) => {
        switch (status) {
            case 'PASS': return 'bg-green-50 border-green-200 text-green-700';
            case 'WARNING': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
            case 'FAIL': return 'bg-red-50 border-red-200 text-red-700';
            default: return 'bg-gray-50 border-gray-200 text-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-8 p-6 bg-red-50 rounded-xl text-red-600">
                {error}
            </div>
        );
    }

    if (summaries.length === 0) {
        return (
            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">공정별 결함 요약</h2>
                </div>
                <p className="text-gray-500 text-center py-8">완료된 생산이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="mt-8">
            <div className="border-t border-gray-300 my-8"></div>

            <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">공정별 결함 요약</h2>
                <span className="text-sm text-gray-500">({summaries.length}건)</span>
            </div>

            <div className="space-y-4">
                {summaries.map((summary) => {
                    const key = getSummaryKey(summary);
                    return (
                    <div
                        key={key}
                        className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden"
                    >
                        <div
                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleExpand(summary)}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <Car className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <span className="font-semibold text-gray-900">
                                            {summary.vehicleModelName}
                                        </span>
                                        <span className="text-gray-500 text-sm ml-2">
                                            {summary.productionId
                                                ? `생산 #${summary.productionId}`
                                                : `주문 #${summary.orderId}`}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusBadgeClass(summary.overallStatus)}`}>
                                        {getStatusIcon(summary.overallStatus)}
                                        {summary.overallStatus}
                                    </span>
                                    {expandedKey === key ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                                <span>
                                    완료: {new Date(summary.completedAt).toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                                <span>총 결함: {summary.totalDefectCount}건</span>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {summary.processSummaries.map((ps) => (
                                    <div
                                        key={ps.processName}
                                        className={`p-2 rounded-lg border text-center ${getProcessStatusClass(ps.status)}`}
                                    >
                                        <div className="font-medium text-sm">{ps.processName}</div>
                                        <div className="flex items-center justify-center gap-1 mt-1">
                                            {getStatusIcon(ps.status)}
                                            <span className="font-bold">{ps.defectCount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {expandedKey === key && (
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    오류 로그
                                </h4>
                                {logsLoading[key] ? (
                                    <div className="animate-pulse">
                                        <div className="h-16 bg-gray-200 rounded"></div>
                                    </div>
                                ) : (
                                    <ErrorLogList logs={logs[key] || []} />
                                )}
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
        </div>
    );
};
