import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Filter, Search } from 'lucide-react';

interface DefectData {
  id: string;
  timestamp: string;
  vehicleId: string;
  location: string;
  status: 'normal' | 'defect';
  defectType?: string;
  confidence: number;
  inspector: string;
  action?: string;
}

export function DefectDataList() {
  const [sortField, setSortField] = useState<keyof DefectData>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'normal' | 'defect'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const data: DefectData[] = [
    {
      id: 'INS-2401',
      timestamp: '2026-01-19 13:45:12',
      vehicleId: '차량-001',
      location: '구역 A',
      status: 'normal',
      confidence: 99.2,
      inspector: 'AI 검사 시스템',
      action: '통과'
    },
    {
      id: 'INS-2402',
      timestamp: '2026-01-19 13:42:08',
      vehicleId: '차량-023',
      location: '구역 B',
      status: 'defect',
      defectType: '스크래치',
      confidence: 96.8,
      inspector: 'AI 검사 시스템',
      action: '재작업 요청'
    },
    {
      id: 'INS-2403',
      timestamp: '2026-01-19 13:38:22',
      vehicleId: '차량-045',
      location: '구역 C',
      status: 'defect',
      defectType: '먼지 오염',
      confidence: 94.5,
      inspector: 'AI 검사 시스템',
      action: '재작업 요청'
    },
    {
      id: 'INS-2404',
      timestamp: '2026-01-19 13:35:45',
      vehicleId: '차량-012',
      location: '구역 A',
      status: 'normal',
      confidence: 98.7,
      inspector: 'AI 검사 시스템',
      action: '통과'
    },
    {
      id: 'INS-2405',
      timestamp: '2026-01-19 13:32:11',
      vehicleId: '차량-067',
      location: '구역 D',
      status: 'normal',
      confidence: 97.3,
      inspector: 'AI 검사 시스템',
      action: '통과'
    },
    {
      id: 'INS-2406',
      timestamp: '2026-01-19 13:28:37',
      vehicleId: '차량-089',
      location: '구역 B',
      status: 'defect',
      defectType: '색상 불균일',
      confidence: 91.2,
      inspector: 'AI 검사 시스템',
      action: '재작업 요청'
    },
    {
      id: 'INS-2407',
      timestamp: '2026-01-19 13:25:19',
      vehicleId: '차량-102',
      location: '구역 C',
      status: 'normal',
      confidence: 99.5,
      inspector: 'AI 검사 시스템',
      action: '통과'
    },
    {
      id: 'INS-2408',
      timestamp: '2026-01-19 13:22:44',
      vehicleId: '차량-115',
      location: '구역 A',
      status: 'defect',
      defectType: '기포',
      confidence: 92.8,
      inspector: 'AI 검사 시스템',
      action: '재작업 요청'
    },
    {
      id: 'INS-2409',
      timestamp: '2026-01-19 13:19:33',
      vehicleId: '차량-128',
      location: '구역 D',
      status: 'normal',
      confidence: 98.1,
      inspector: 'AI 검사 시스템',
      action: '통과'
    },
    {
      id: 'INS-2410',
      timestamp: '2026-01-19 13:16:52',
      vehicleId: '차량-134',
      location: '구역 B',
      status: 'normal',
      confidence: 97.9,
      inspector: 'AI 검사 시스템',
      action: '통과'
    }
  ];

  // Filter and sort data
  const filteredData = data
    .filter(item => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (searchTerm && !item.vehicleId.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.location.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * direction;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }
      return 0;
    });

  const handleSort = (field: keyof DefectData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: keyof DefectData }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="bg-white rounded-[14px] border border-[#e5e7eb] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[#101828] text-[18px] font-bold leading-[28px]">
            검사 데이터 목록
          </h3>
          <p className="text-[#4a5565] text-[14px] leading-[20px] mt-1">
            전체 {filteredData.length}건
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#155dfc] text-white rounded-lg hover:bg-[#1248c9] transition-colors">
          <Download className="w-4 h-4" />
          <span className="text-[14px] font-medium">데이터 내보내기</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#4a5565]" />
          <input
            type="text"
            placeholder="차량 ID 또는 위치 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#e5e7eb] rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#4a5565]" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'normal' | 'defect')}
            className="px-4 py-2 border border-[#e5e7eb] rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:border-transparent bg-white"
          >
            <option value="all">전체</option>
            <option value="normal">정상</option>
            <option value="defect">결함</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#f8fafc]">
              <th 
                className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center gap-1">
                  검사 ID
                  <SortIcon field="id" />
                </div>
              </th>
              <th 
                className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                onClick={() => handleSort('timestamp')}
              >
                <div className="flex items-center gap-1">
                  시간
                  <SortIcon field="timestamp" />
                </div>
              </th>
              <th 
                className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                onClick={() => handleSort('vehicleId')}
              >
                <div className="flex items-center gap-1">
                  차량 ID
                  <SortIcon field="vehicleId" />
                </div>
              </th>
              <th 
                className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                onClick={() => handleSort('location')}
              >
                <div className="flex items-center gap-1">
                  위치
                  <SortIcon field="location" />
                </div>
              </th>
              <th 
                className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  상태
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase">
                결함 유형
              </th>
              <th 
                className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                onClick={() => handleSort('confidence')}
              >
                <div className="flex items-center gap-1">
                  신뢰도
                  <SortIcon field="confidence" />
                </div>
              </th>
              <th className="text-left px-4 py-3 text-[#4a5565] text-[12px] font-bold uppercase">
                조치
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => (
              <tr 
                key={item.id}
                className={`border-b border-[#e5e7eb] hover:bg-[#f8fafc] transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                }`}
              >
                <td className="px-4 py-3 text-[#101828] text-[14px] font-medium">
                  {item.id}
                </td>
                <td className="px-4 py-3 text-[#4a5565] text-[14px]">
                  {item.timestamp}
                </td>
                <td className="px-4 py-3 text-[#101828] text-[14px] font-medium">
                  {item.vehicleId}
                </td>
                <td className="px-4 py-3 text-[#4a5565] text-[14px]">
                  {item.location}
                </td>
                <td className="px-4 py-3">
                  {item.status === 'normal' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#dcfce7] text-[#00a63e] rounded-full text-[12px] font-bold">
                      <div className="w-1.5 h-1.5 bg-[#00a63e] rounded-full"></div>
                      정상
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#fee2e2] text-[#f54900] rounded-full text-[12px] font-bold">
                      <div className="w-1.5 h-1.5 bg-[#f54900] rounded-full"></div>
                      결함
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#4a5565] text-[14px]">
                  {item.defectType || '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[60px] h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#155dfc] rounded-full"
                        style={{ width: `${item.confidence}%` }}
                      ></div>
                    </div>
                    <span className="text-[#101828] text-[12px] font-medium min-w-[40px]">
                      {item.confidence}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#4a5565] text-[14px]">
                  {item.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-6 flex items-center justify-between p-4 bg-[#f8fafc] rounded-lg border border-[#e5e7eb]">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[#4a5565] text-[12px]">전체</span>
            <p className="text-[#101828] text-[16px] font-bold">{filteredData.length}건</p>
          </div>
          <div>
            <span className="text-[#4a5565] text-[12px]">정상</span>
            <p className="text-[#00a63e] text-[16px] font-bold">
              {filteredData.filter(item => item.status === 'normal').length}건
            </p>
          </div>
          <div>
            <span className="text-[#4a5565] text-[12px]">결함</span>
            <p className="text-[#f54900] text-[16px] font-bold">
              {filteredData.filter(item => item.status === 'defect').length}건
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[#4a5565] text-[12px]">정상률</span>
          <p className="text-[#101828] text-[16px] font-bold">
            {((filteredData.filter(item => item.status === 'normal').length / filteredData.length) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
