
import React, { useEffect, useState } from "react";
import PaintUploader from "@/components/paint/PaintUploader";
import PaintResult from "@/components/paint/PaintResult";
import PaintMetaPanel from "@/components/paint/PaintMetaPanel";
import {MetricCard}  from "@/components/paint/MetricCard";
import { AlertTriangle, CheckCircle, TrendingDown, Target, Eye } from "lucide-react";
import { usePaintStore } from "@/store/paintStore";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { 
  getTodayStatistics, 
  getAnalysisHistory, 
  getAnalysisDetail, 
  type PaintStatistics, 
  type AnalysisHistory,
  type AnalysisDetail 
} from "@/services/paintAnalysis";

const PaintQualityDashboard: React.FC = () => {
  const current = usePaintStore((s) => s.current);
  const recent = usePaintStore((s) => s.recent);
  
  const [stats, setStats] = useState<PaintStatistics>({
    totalInspections: 0,
    passedInspections: 0,
    failedInspections: 0,
    warningInspections: 0,
    defectCount: 0,
    defectRate: 0,
    passRate: 0,
    avgConfidence: 0,
  });
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<AnalysisDetail | null>(null);

  // DB에서 통계 가져오기
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await getTodayStatistics();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // 30초마다 통계 갱신
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // 분석 이력 가져오기
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getAnalysisHistory();
        setHistory(data);
      } catch (error) {
        console.error('Failed to fetch analysis history:', error);
      }
    };

    fetchHistory();
    
    // 10초마다 이력 갱신
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // 상세 정보 조회
  const handleViewDetail = async (resultId: string) => {
    try {
      const detail = await getAnalysisDetail(resultId);
      if (detail) {
        setSelectedDetail(detail);
      }
    } catch (error) {
      console.error('Failed to fetch detail:', error);
    }
  };
  
  // 결함 유형별 색상 매핑
  const getColorForDefect = (name: string): string => {
    const colorMap: { [key: string]: string } = {
      "정상": "#10b981",
      "오렌지 필": "#ef4444",
      "러닝 및 쇠갈음": "#f97316",
      "용제 팝": "#eab308",
      "워터 스팟팅": "#6366f1",
    };
    return colorMap[name] || "#999";
  };

  // 최근 결과에서 결함 유형별 비율 계산 (DB 히스토리 기반)
  const getDefectRatio = () => {
    if (history.length === 0) return [];
    
    const defectMap: { [key: string]: number } = {};
    history.forEach((h) => {
      h.detectedDefects.forEach((d) => {
        defectMap[d.defectNameKo] = (defectMap[d.defectNameKo] || 0) + 1;
      });
    });
    
    // 결함이 없는 경우 추가
    const defectCount = Object.values(defectMap).reduce((a, b) => a + b, 0);
    const passCount = history.length - defectCount;
    if (passCount > 0) {
      defectMap["정상"] = passCount;
    }
    
    return Object.entries(defectMap).map(([name, value]) => ({
      name,
      value,
      fill: getColorForDefect(name),
      percentage: ((value / history.length) * 100).toFixed(1),
    }));
  };
  
  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PASS": return "text-green-600 bg-green-50";
      case "FAIL": return "text-red-600 bg-red-50";
      case "WARNING": return "text-yellow-600 bg-yellow-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case "PASS": return "정상";
      case "FAIL": return "결함";
      case "WARNING": return "경고";
      default: return status;
    }
  };
  
  // DB 데이터 기반 메트릭 (실시간 통계)
  const metrics = [
    { 
      label: "전체 검사 수", 
      value: loading ? "..." : stats.totalInspections.toLocaleString(), 
      subtitle: "오늘 검사 완료", 
      icon: Target, 
      iconBg: "bg-[#dbeafe]", 
      iconColor: "text-[#155dfc]" 
    },
    { 
      label: "결함률",     
      value: loading ? "..." : `${stats.defectRate.toFixed(1)}%`,  
      subtitle: `${stats.failedInspections}건 결함 발견`, 
      icon: AlertTriangle, 
      iconBg: "bg-[#ffedd4]", 
      iconColor: "text-[#f54900]" 
    },
    { 
      label: "정상률",     
      value: loading ? "..." : `${stats.passRate.toFixed(1)}%`, 
      subtitle: `${stats.passedInspections}건 정상`,   
      icon: CheckCircle, 
      iconBg: "bg-[#dcfce7]", 
      iconColor: "text-[#00a63e]" 
    },
    { 
      label: "평균 신뢰도", 
      value: loading ? "..." : `${stats.avgConfidence.toFixed(1)}%`, 
      subtitle: "AI 판단 정확도",   
      icon: TrendingDown, 
      iconBg: "bg-[#f3e8ff]", 
      iconColor: "text-[#9810fa]" 
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">도장 품질 관리</h2>
        <p className="text-gray-600 mt-1">AI 기반 결함 검출 및 품질 분석</p>
      </div>

      {/* Metrics - Single Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {metrics.map((m, i) => (
          <MetricCard key={i} {...m} />
        ))}
      </div>

      {/* Uploader & Defect Ratio Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64">
        {/* Uploader */}
        <div className="rounded-lg border p-3 bg-white">
          <div className="text-xs text-slate-500 mb-2 font-medium">이미지 등록</div>
          <PaintUploader />
        </div>

        {/* Defect Ratio Chart */}
        {getDefectRatio().length > 0 && (
          <div className="rounded-lg border p-3 bg-white">
            <div className="text-xs text-slate-500 mb-2 font-medium">결함 비율</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={getDefectRatio()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.percentage}%`}
                  outerRadius={60}
                  dataKey="value"
                >
                  {getDefectRatio().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}건`} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Result & Meta - Show when image uploaded */}
      {current && (
        <div className="rounded-lg border p-4 bg-white">
          <div className="text-sm font-semibold mb-3 text-gray-900">현재 분석 결과</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="text-xs text-slate-600 mb-2 font-medium">검출 결과</div>
              <div className="flex-1 overflow-auto">
                <PaintResult />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-xs text-slate-600 mb-2 font-medium">검사 정보</div>
              <div className="flex-1 overflow-auto">
                <PaintMetaPanel />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Analysis History Table */}
      <div className="rounded-lg border p-3 bg-white">
        <h3 className="text-sm font-semibold mb-3">분석 이력</h3>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b sticky top-0">
              <tr>
                <th className="text-left p-2 font-semibold">시간</th>
                <th className="text-left p-2 font-semibold">상태</th>
                <th className="text-left p-2 font-semibold">결함</th>
                <th className="text-left p-2 font-semibold">신뢰도</th>
                <th className="text-left p-2 font-semibold">위치</th>
                <th className="text-center p-2 font-semibold">보기</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-400 text-xs">
                    분석 이력이 없습니다
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <React.Fragment key={item.resultId}>
                    <tr 
                      className="border-b hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (selectedDetail?.resultId === item.resultId) {
                          setSelectedDetail(null);
                        } else {
                          handleViewDetail(item.resultId);
                        }
                      }}
                    >
                      <td className="p-2 text-xs whitespace-nowrap">
                        {new Date(item.analyzedAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </td>
                      <td className="p-2 text-xs">
                        {item.primaryDefectType ? item.primaryDefectType.substring(0, 10) : '-'}
                      </td>
                      <td className="p-2 text-xs font-medium">
                        {item.confidence.toFixed(0)}%
                      </td>
                      <td className="p-2 text-xs">
                        {item.locationCode || '-'}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedDetail?.resultId === item.resultId) {
                              setSelectedDetail(null);
                            } else {
                              handleViewDetail(item.resultId);
                            }
                          }}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        >
                          {selectedDetail?.resultId === item.resultId ? '닫기' : '보기'}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Row */}
                    {selectedDetail?.resultId === item.resultId && (
                      <tr className="border-b bg-blue-50">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Left: Analysis Result Image */}
                            <div>
                              <h4 className="text-xs font-semibold mb-2">분석 이미지</h4>
                              <img 
                                src={`http://localhost:8000${selectedDetail.resultImageUrl}`} 
                                alt="분석 결과" 
                                className="max-w-[250px] rounded border"
                              />
                            </div>
                            
                            {/* Middle & Right: Analysis Info and Defects */}
                            <div className="lg:col-span-2 space-y-3">
                              {/* Info */}
                              <div className="p-3 bg-white rounded border text-xs">
                                <h5 className="text-xs font-semibold mb-2">분석 정보</h5>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <div className="text-slate-500">시간</div>
                                    <div className="font-medium">{new Date(selectedDetail.analyzedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500">상태</div>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedDetail.status)}`}>
                                      {getStatusText(selectedDetail.status)}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="text-slate-500">신뢰도</div>
                                    <div className="font-medium">{selectedDetail.confidence.toFixed(1)}%</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500">처리시간</div>
                                    <div className="font-medium">{selectedDetail.inferenceTimeMs}ms</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Detected Defects */}
                              {selectedDetail.detectedDefects.length > 0 && (
                                <div className="p-3 bg-white rounded border text-xs">
                                  <h5 className="text-xs font-semibold mb-2">검출 결함</h5>
                                  <div className="space-y-1">
                                    {selectedDetail.detectedDefects.map((defect, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-50 rounded text-xs">
                                        <div>
                                          <div className="font-medium">{defect.defectNameKo}</div>
                                          <div className="text-slate-500 text-xs">{defect.defectClass}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-medium">{defect.confidence.toFixed(0)}%</div>
                                          <div className={`text-xs font-medium ${
                                            defect.severityLevel === 'CRITICAL' ? 'text-red-600' :
                                            defect.severityLevel === 'HIGH' ? 'text-orange-600' :
                                            defect.severityLevel === 'MEDIUM' ? 'text-yellow-600' :
                                            'text-blue-600'
                                          }`}>
                                            {defect.severityLevel}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaintQualityDashboard;