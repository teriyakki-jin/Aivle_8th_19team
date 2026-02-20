import { useEffect, useMemo, useState } from "react";
import { mlDatasetsApi, MlInputDatasetDto } from "../../api/mlDatasets";
import { productionDatasetsApi } from "../../api/productionDatasets";
import { productionApi, ProductionDto } from "../../api/production";

const PROCESS_OPTIONS = ["프레스", "용접", "도장", "조립", "검사"] as const;
const FORMAT_OPTIONS = ["IMAGE", "JSON", "CSV", "ARFF"] as const;

export function DatasetPage() {
  const [datasets, setDatasets] = useState<MlInputDatasetDto[]>([]);
  const [productions, setProductions] = useState<ProductionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterProcess, setFilterProcess] = useState<string>("");

  const [newProcess, setNewProcess] = useState<string>("프레스");
  const [newName, setNewName] = useState<string>("");
  const [newFormat, setNewFormat] = useState<string>("IMAGE");
  const [newStorageKey, setNewStorageKey] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");

  const [assignProductionId, setAssignProductionId] = useState<number | "">("");
  const [assignProcess, setAssignProcess] = useState<string>("프레스");
  const [assignDatasetId, setAssignDatasetId] = useState<number | "">("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [datasetList, productionPage] = await Promise.all([
        mlDatasetsApi.list(),
        productionApi.list(0, 1000),
      ]);
      const prodList = Array.isArray(productionPage) ? productionPage : productionPage?.content ?? [];
      setDatasets(Array.isArray(datasetList) ? datasetList : []);
      setProductions(prodList);
    } catch (e: any) {
      setError(e?.message ?? "데이터셋 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredDatasets = useMemo(() => {
    if (!filterProcess) return datasets;
    return datasets.filter((d) => d.processName === filterProcess);
  }, [datasets, filterProcess]);

  const handleCreate = async () => {
    if (!newProcess || !newName || !newFormat || !newStorageKey) {
      setError("필수 입력값을 확인해줘.");
      return;
    }
    setError(null);
    try {
      await mlDatasetsApi.create({
        processName: newProcess,
        name: newName,
        format: newFormat as MlInputDatasetDto["format"],
        storageKey: newStorageKey,
        description: newDescription || null,
      } as any);
      setNewName("");
      setNewStorageKey("");
      setNewDescription("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "데이터셋 등록 실패");
    }
  };

  const handleAssign = async () => {
    if (!assignProductionId || !assignProcess || !assignDatasetId) {
      setError("할당 정보를 확인해줘.");
      return;
    }
    setError(null);
    try {
      await productionDatasetsApi.assign(Number(assignProductionId), {
        processName: assignProcess,
        datasetId: Number(assignDatasetId),
      });
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "데이터셋 할당 실패");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">데이터셋 관리</h1>
          <p className="text-sm text-slate-500">공정별 ML 입력 데이터셋을 등록하고 생산에 할당합니다.</p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-lg border hover:bg-slate-50 text-slate-900"
        >
          새로고침
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="text-sm font-semibold">데이터셋 등록</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">공정</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={newProcess}
                onChange={(e) => setNewProcess(e.target.value)}
              >
                {PROCESS_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">포맷</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value)}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">데이터셋 이름</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex) press_vibration_p1_01"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">스토리지 경로</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={newStorageKey}
                onChange={(e) => setNewStorageKey(e.target.value)}
                placeholder="C:\\pjt\\...\\file.json"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">설명</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            등록
          </button>
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="text-sm font-semibold">생산에 데이터셋 할당</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">생산</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={assignProductionId}
                onChange={(e) => setAssignProductionId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">선택</option>
                {productions.map((p) => (
                  <option key={p.productionId} value={p.productionId}>
                    생산 #{p.productionId} (주문 #{p.orderId ?? "-"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">공정</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={assignProcess}
                onChange={(e) => setAssignProcess(e.target.value)}
              >
                {PROCESS_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">데이터셋</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                value={assignDatasetId}
                onChange={(e) => setAssignDatasetId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">선택</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.processName}] {d.name} ({d.format})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAssign}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
          >
            할당
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">등록된 데이터셋</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">공정 필터</span>
            <select
              className="border rounded-lg px-3 py-1.5 text-sm"
              value={filterProcess}
              onChange={(e) => setFilterProcess(e.target.value)}
            >
              <option value="">전체</option>
              {PROCESS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">불러오는 중...</div>
        ) : filteredDatasets.length === 0 ? (
          <div className="text-sm text-slate-500">등록된 데이터셋이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500 border-b">
                <tr className="text-left">
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 pr-2">공정</th>
                  <th className="py-2 pr-2">이름</th>
                  <th className="py-2 pr-2">포맷</th>
                  <th className="py-2 pr-2">스토리지</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-mono">{d.id}</td>
                    <td className="py-2 pr-2">{d.processName}</td>
                    <td className="py-2 pr-2">{d.name}</td>
                    <td className="py-2 pr-2">{d.format}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{d.storageKey}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DatasetPage;
