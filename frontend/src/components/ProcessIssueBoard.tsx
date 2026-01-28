import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  Tag,
  X,
  Save
} from 'lucide-react';

// 공정 타입 정의
type ProcessType = '엔진조립' | '부품검사' | '도장' | '용접' | '최종검사' | '기타';

// 문제 상태 타입
type IssueStatus = '발생' | '처리중' | '완료';

// 심각도 타입
type Severity = '긴급' | '높음' | '보통' | '낮음';

// 게시글 인터페이스
interface IssueRecord {
  id: number;
  processType: ProcessType;
  title: string;
  issueDescription: string;
  actionTaken: string;
  status: IssueStatus;
  severity: Severity;
  author: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// 공정 색상 매핑
const PROCESS_COLORS: Record<ProcessType, string> = {
  '엔진조립': '#3b82f6',
  '부품검사': '#10b981',
  '도장': '#f59e0b',
  '용접': '#ef4444',
  '최종검사': '#8b5cf6',
  '기타': '#94a3b8'
};

// 상태 색상 매핑
const STATUS_CONFIG: Record<IssueStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  '발생': {
    bg: 'bg-red-100',
    text: 'text-red-800',
    icon: <AlertCircle className="w-4 h-4" />
  },
  '처리중': {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    icon: <Clock className="w-4 h-4" />
  },
  '완료': {
    bg: 'bg-green-100',
    text: 'text-green-800',
    icon: <CheckCircle className="w-4 h-4" />
  }
};

// 심각도 색상 매핑
const SEVERITY_CONFIG: Record<Severity, { bg: string; text: string }> = {
  '긴급': { bg: 'bg-red-500', text: 'text-white' },
  '높음': { bg: 'bg-orange-500', text: 'text-white' },
  '보통': { bg: 'bg-blue-500', text: 'text-white' },
  '낮음': { bg: 'bg-gray-500', text: 'text-white' }
};

export function ProcessIssueBoard() {
  // 상태 관리
  const [issues, setIssues] = useState<IssueRecord[]>([
    {
      id: 1,
      processType: '엔진조립',
      title: '크랭크샤프트 조립 불량 발생',
      issueDescription: '크랭크샤프트 베어링 조립 시 토크 값이 기준치를 초과하여 재작업 필요',
      actionTaken: '해당 부품 재검수 후 교체 완료. 토크 렌치 재교정 실시',
      status: '완료',
      severity: '높음',
      author: '김철수',
      createdAt: '2026-01-27 09:30',
      updatedAt: '2026-01-27 14:20',
      tags: ['토크', '베어링', '재작업']
    },
    {
      id: 2,
      processType: '부품검사',
      title: '도어 표면 스크래치 감지',
      issueDescription: 'AI 검사 시스템에서 도어 표면에 미세 스크래치 3건 감지',
      actionTaken: '불량 부품 분리 및 재도장 공정 투입',
      status: '처리중',
      severity: '보통',
      author: '이영희',
      createdAt: '2026-01-27 11:15',
      updatedAt: '2026-01-27 13:40',
      tags: ['도어', '스크래치', 'AI검사']
    },
    {
      id: 3,
      processType: '용접',
      title: '용접부 기공 발생',
      issueDescription: '차체 프레임 용접 시 기공 발생으로 강도 기준 미달',
      actionTaken: '해당 용접부 재용접 진행중',
      status: '처리중',
      severity: '긴급',
      author: '박민수',
      createdAt: '2026-01-27 13:00',
      updatedAt: '2026-01-27 13:00',
      tags: ['용접', '기공', '프레임']
    }
  ]);

  const [selectedIssue, setSelectedIssue] = useState<IssueRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProcess, setFilterProcess] = useState<ProcessType | '전체'>('전체');
  const [filterStatus, setFilterStatus] = useState<IssueStatus | '전체'>('전체');

  // 새 게시글 작성 폼
  const [formData, setFormData] = useState<Partial<IssueRecord>>({
    processType: '엔진조립',
    title: '',
    issueDescription: '',
    actionTaken: '',
    status: '발생',
    severity: '보통',
    tags: []
  });

  // 필터링된 이슈 목록
  const filteredIssues = issues.filter(issue => {
    const matchSearch = 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.issueDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.actionTaken.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchProcess = filterProcess === '전체' || issue.processType === filterProcess;
    const matchStatus = filterStatus === '전체' || issue.status === filterStatus;

    return matchSearch && matchProcess && matchStatus;
  });

  // 통계 계산
  const stats = {
    total: issues.length,
    open: issues.filter(i => i.status === '발생').length,
    inProgress: issues.filter(i => i.status === '처리중').length,
    resolved: issues.filter(i => i.status === '완료').length,
    urgent: issues.filter(i => i.severity === '긴급').length
  };

  // 모달 열기/닫기
  const openModal = (issue: IssueRecord | null, isCreate: boolean = false) => {
    setSelectedIssue(issue);
    setIsCreateMode(isCreate);
    if (isCreate) {
      setFormData({
        processType: '엔진조립',
        title: '',
        issueDescription: '',
        actionTaken: '',
        status: '발생',
        severity: '보통',
        tags: []
      });
    } else if (issue) {
      setFormData(issue);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedIssue(null);
    setIsCreateMode(false);
  };

  // 게시글 저장
  const handleSave = () => {
    if (!formData.title || !formData.issueDescription) {
      alert('제목과 문제 설명은 필수 입력 항목입니다.');
      return;
    }

    const now = new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (isCreateMode) {
      // 새 게시글 생성
      const newIssue: IssueRecord = {
        ...formData,
        id: Math.max(...issues.map(i => i.id), 0) + 1,
        author: '현재사용자', // 실제로는 로그인된 사용자 정보
        createdAt: now,
        updatedAt: now,
        tags: formData.tags || []
      } as IssueRecord;
      
      setIssues([newIssue, ...issues]);
    } else {
      // 기존 게시글 수정
      setIssues(issues.map(issue => 
        issue.id === formData.id 
          ? { ...formData, updatedAt: now } as IssueRecord
          : issue
      ));
    }

    closeModal();
  };

  // 게시글 삭제
  const handleDelete = (id: number) => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      setIssues(issues.filter(issue => issue.id !== id));
      closeModal();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">공정 문제 관리 게시판</h1>
          <p className="text-gray-600 mt-2">각 공정별 발생 문제 및 조치 사항 기록</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">발생</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.open}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">처리중</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.inProgress}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">완료</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.resolved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">긴급</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.urgent}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* 검색 및 필터 바 */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="제목, 내용으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 공정 필터 */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterProcess}
                onChange={(e) => setFilterProcess(e.target.value as ProcessType | '전체')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="전체">전체 공정</option>
                <option value="엔진조립">엔진조립</option>
                <option value="부품검사">부품검사</option>
                <option value="도장">도장</option>
                <option value="용접">용접</option>
                <option value="최종검사">최종검사</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* 상태 필터 */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as IssueStatus | '전체')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="전체">전체 상태</option>
              <option value="발생">발생</option>
              <option value="처리중">처리중</option>
              <option value="완료">완료</option>
            </select>

            {/* 새 글 작성 버튼 */}
            <button
              onClick={() => openModal(null, true)}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              <span>새 기록 작성</span>
            </button>
          </div>
        </div>

        {/* 게시판 리스트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {filteredIssues.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openModal(issue, false)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* 제목 및 배지들 */}
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="px-3 py-1 text-sm font-semibold rounded-lg text-white"
                          style={{ backgroundColor: PROCESS_COLORS[issue.processType] }}
                        >
                          {issue.processType}
                        </span>
                        
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${SEVERITY_CONFIG[issue.severity].bg} ${SEVERITY_CONFIG[issue.severity].text}`}>
                          {issue.severity}
                        </span>

                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${STATUS_CONFIG[issue.status].bg} ${STATUS_CONFIG[issue.status].text}`}>
                          {STATUS_CONFIG[issue.status].icon}
                          {issue.status}
                        </span>
                      </div>

                      {/* 제목 */}
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {issue.title}
                      </h3>

                      {/* 문제 설명 (미리보기) */}
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {issue.issueDescription}
                      </p>

                      {/* 태그 */}
                      {issue.tags.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <Tag className="w-4 h-4 text-gray-400" />
                          {issue.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {issue.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {issue.createdAt}
                        </span>
                        {issue.createdAt !== issue.updatedAt && (
                          <span className="text-blue-600">
                            (수정됨: {issue.updatedAt})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 아이콘 */}
                    <Eye className="w-5 h-5 text-gray-400 ml-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">검색 결과가 없습니다</p>
              <p className="text-sm">다른 검색어나 필터를 시도해보세요</p>
            </div>
          )}
        </div>
      </div>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {isCreateMode ? '새 문제 기록 작성' : '문제 기록 상세'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 space-y-6">
              {/* 공정 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  공정 구분 *
                </label>
                <select
                  value={formData.processType}
                  onChange={(e) => setFormData({ ...formData, processType: e.target.value as ProcessType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="엔진조립">엔진조립</option>
                  <option value="부품검사">부품검사</option>
                  <option value="도장">도장</option>
                  <option value="용접">용접</option>
                  <option value="최종검사">최종검사</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="문제 제목을 입력하세요"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 상태 및 심각도 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상태 *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as IssueStatus })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="발생">발생</option>
                    <option value="처리중">처리중</option>
                    <option value="완료">완료</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    심각도 *
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as Severity })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="긴급">긴급</option>
                    <option value="높음">높음</option>
                    <option value="보통">보통</option>
                    <option value="낮음">낮음</option>
                  </select>
                </div>
              </div>

              {/* 문제 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  문제 설명 *
                </label>
                <textarea
                  value={formData.issueDescription}
                  onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                  placeholder="발생한 문제에 대해 상세히 설명하세요"
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* 조치 사항 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  조치 사항
                </label>
                <textarea
                  value={formData.actionTaken}
                  onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                  placeholder="문제 해결을 위해 취한 조치를 기록하세요"
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* 태그 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  태그 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={formData.tags?.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                  })}
                  placeholder="예: 토크, 베어링, 재작업"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 작성자 정보 (수정 모드일 때만) */}
              {!isCreateMode && selectedIssue && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">작성자:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedIssue.author}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">작성일:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedIssue.createdAt}</span>
                    </div>
                    {selectedIssue.createdAt !== selectedIssue.updatedAt && (
                      <div className="col-span-2">
                        <span className="text-gray-600">최종 수정:</span>
                        <span className="ml-2 font-medium text-gray-900">{selectedIssue.updatedAt}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div>
                {!isCreateMode && selectedIssue && (
                  <button
                    onClick={() => handleDelete(selectedIssue.id)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>삭제</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>{isCreateMode ? '작성' : '저장'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
