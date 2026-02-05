import { AlertTriangle, AlertCircle, Info, Clock, CheckCircle } from 'lucide-react';
import { ProcessEventLog } from '../../types/defectSummary';

interface ErrorLogListProps {
    logs: ProcessEventLog[];
}

export const ErrorLogList = ({ logs }: ErrorLogListProps) => {
    const getSeverityIcon = (severity: number) => {
        if (severity >= 2) return <AlertTriangle className="w-5 h-5 text-red-500" />;
        if (severity === 1) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        return <Info className="w-5 h-5 text-blue-500" />;
    };

    const getSeverityBg = (severity: number) => {
        if (severity >= 2) return 'bg-red-50 border-red-200';
        if (severity === 1) return 'bg-yellow-50 border-yellow-200';
        return 'bg-blue-50 border-blue-200';
    };

    if (logs.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                오류 로그가 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {logs.map((log) => (
                <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${getSeverityBg(log.severity)}`}
                >
                    <div className="flex items-start gap-3">
                        {getSeverityIcon(log.severity)}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start flex-wrap gap-2">
                                <div>
                                    <span className="font-semibold text-gray-900">
                                        [{log.process}] {log.eventTypeLabel}
                                    </span>
                                    <span className="ml-2 text-sm text-gray-600">
                                        코드: {log.eventCode}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {log.resolved ? (
                                        <span className="flex items-center text-green-600 text-sm">
                                            <CheckCircle className="w-4 h-4 mr-1" />
                                            해결됨
                                        </span>
                                    ) : (
                                        <span className="flex items-center text-red-600 text-sm">
                                            <Clock className="w-4 h-4 mr-1" />
                                            미해결
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-4">
                                <span>심각도: {log.severityLabel}</span>
                                <span>영향 수량: {log.qtyAffected}</span>
                                {log.lineHold && (
                                    <span className="text-red-600 font-medium">라인 정지</span>
                                )}
                                {log.source && <span>출처: {log.source}</span>}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                                발생: {new Date(log.detectedAt).toLocaleString('ko-KR')}
                                {log.resolvedAt && (
                                    <span className="ml-2">
                                        해결: {new Date(log.resolvedAt).toLocaleString('ko-KR')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
