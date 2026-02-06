import React, { useEffect, useState } from "react";
import { Box, RefreshCcw, History, CheckCircle2 } from "lucide-react";
import { inventoryApi, InventoryDto, InventoryHistoryDto } from "../../api/inventory";

function formatDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjustPartId, setAdjustPartId] = useState("");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] =
    useState<"IN" | "OUT" | "ADJUST" | "SCRAP">("IN");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [history, setHistory] = useState<InventoryHistoryDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await inventoryApi.list();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message ?? "재고 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (partId: number) => {
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const data = await inventoryApi.history(partId);
      setHistory(Array.isArray(data) ? data : []);
      setSelectedPartId(partId);
    } catch (e: any) {
      setHistoryError(e?.message ?? "재고 이력 조회 실패");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    setAdjustSuccess(null);

    const partIdNum = Number(adjustPartId);
    const qtyNum = Number(adjustQty);

    if (!partIdNum || Number.isNaN(partIdNum)) {
      setAdjustError("부품 ID를 입력해주세요.");
      return;
    }
    if (!adjustQty || Number.isNaN(qtyNum) || qtyNum === 0) {
      setAdjustError("수량을 0이 아닌 숫자로 입력해주세요.");
      return;
    }

    let normalizedQty = qtyNum;
    if (adjustType === "IN") normalizedQty = Math.abs(qtyNum);
    if (adjustType === "OUT" || adjustType === "SCRAP")
      normalizedQty = -Math.abs(qtyNum);

    setAdjustLoading(true);
    try {
      await inventoryApi.adjust({
        partId: partIdNum,
        qty: normalizedQty,
        changeType: adjustType,
      });
      setAdjustSuccess("재고 증감이 반영되었습니다.");
      setAdjustQty("");
      await refresh();
      if (selectedPartId === partIdNum) {
        await loadHistory(partIdNum);
      }
    } catch (e: any) {
      setAdjustError(e?.message ?? "재고 증감 처리 실패");
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Box className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">재고 관리</h1>
            <p className="text-sm text-slate-500">
              부품별 재고 현황을 확인합니다
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-slate-50 transition-colors text-slate-900"
        >
          <RefreshCcw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 재고 증감 폼 */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 rounded-t-xl">
          <span className="font-semibold text-slate-700">재고 증감(입출고)</span>
        </div>

        <form onSubmit={submitAdjust} className="p-4 space-y-3">
          {/* 입력 + 버튼 한 줄 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            {/* 부품 ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                부품 ID
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={adjustPartId}
                onChange={(e) => setAdjustPartId(e.target.value)}
                placeholder="예: 1"
                inputMode="numeric"
              />
            </div>

            {/* 수량 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                수량
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="예: 10"
                inputMode="numeric"
              />
              <p className="mt-1 text-xs text-slate-500">
                입고/출고는 부호가 자동 처리됩니다.
              </p>
            </div>

            {/* 변경 유형 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                변경 유형
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={adjustType}
                onChange={(e) =>
                  setAdjustType(e.target.value as typeof adjustType)
                }
              >
                <option value="IN">입고</option>
                <option value="OUT">출고</option>
                <option value="ADJUST">조정</option>
                <option value="SCRAP">폐기</option>
              </select>
            </div>

            {/* 재고 반영 버튼 */}
            <div className="flex lg:items-end lg:justify-end mt-6">
              <button
                type="submit"
                disabled={adjustLoading}
                className="px-4 h-10 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center"
              >
                {adjustLoading ? "처리 중..." : "재고 반영"}
              </button>
            </div>
          </div>

          {/* 에러 / 성공 메시지: grid 밖으로 분리 */}
          {adjustError && (
            <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              {adjustError}
            </div>
          )}
          {adjustSuccess && (
            <div className="mt-2 animate-pulse text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              {adjustSuccess}
            </div>
          )}
        </form>
      </div>

      {/* 재고 목록 */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">재고 목록</span>
            <span className="text-sm text-slate-500">총 {items.length}건</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  부품 ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  부품명
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  현재 수량
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  이력
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    불러오는 중...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    재고 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.inventoryId}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-slate-900">
                      #{item.partId}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {item.partName}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">
                      {item.currentQty}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => loadHistory(item.partId)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                      >
                        <History className="w-3 h-3" />
                        이력 보기
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 이력 테이블 */}
      {selectedPartId && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="px-4 py-3 border-b bg-slate-50 rounded-t-xl">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">
                재고 이력 (부품 #{selectedPartId})
              </span>
              <button
                onClick={() => loadHistory(selectedPartId)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-slate-50 transition-colors text-sm text-slate-900"
              >
                <RefreshCcw className="w-4 h-4" />
                새로고침
              </button>
            </div>
          </div>

          {historyError && (
            <div className="p-4 text-sm text-red-700 bg-red-50 border-b border-red-200">
              {historyError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    변경 유형
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    변경 수량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    변경 후 수량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    발생 시각
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {historyLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      이력 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {h.changeType}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">
                        {h.changeQty}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">
                        {h.afterQty}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {formatDateTime(h.occuredAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
