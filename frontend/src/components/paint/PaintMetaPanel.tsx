import React from "react";
import { usePaintStore } from "@/store/paintStore";
import CLASS_COLOR from "@/utils/classColor";

const PaintMetaPanel: React.FC = () => {
  const current = usePaintStore((s) => s.current);
  const recent = usePaintStore((s) => s.recent);

  const isNoDefect = current?.defect_type === -1;
  const color = current && !isNoDefect ? CLASS_COLOR[current.defect_type] : "#10b981";

  return (
    <div className="space-y-4">
      {/* Meta Info - Horizontal layout */}
      {current && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-md border p-3">
            <div className="text-sm text-slate-500">결함 유형</div>
            <div className="text-lg font-semibold" style={{ color }}>
              {current.label_name_text} 
              {!isNoDefect && `(#${current.defect_type})`}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-sm text-slate-500">신뢰도</div>
            <div className="text-lg font-semibold">
              {(current.defect_score * 100).toFixed(1)}%
            </div>
          </div>
          {current.label_path && (
            <div className="rounded-md border p-3">
              <div className="text-sm text-slate-500">라벨 파일</div>
              <a
                href={current.label_path}
                download={current.label_name}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-sm break-all"
              >
                {current.label_name}
              </a>
            </div>
          )}
          {current.img_id && (
            <div className="rounded-md border p-3">
              <div className="text-sm text-slate-500">이미지 ID</div>
              <div className="text-lg font-semibold text-slate-700">{current.img_id}</div>
            </div>
          )}
        </div>
      )}

      {/* Recent Results */}
      {recent.length > 0 && (
        <div className="rounded-lg border p-4">
          <div className="font-semibold mb-3">최근 결과</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-2">결함 유형</th>
                  <th className="text-left p-2">신뢰도</th>
                  <th className="text-left p-2">이미지명</th>
                  <th className="text-left p-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.img_id} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-medium">{r.label_name_text}</td>
                    <td className="p-2">{(r.defect_score * 100).toFixed(1)}%</td>
                    <td className="p-2 text-slate-600 truncate max-w-xs" title={r.img_name}>
                      {r.img_name}
                    </td>
                    <td className="p-2 text-slate-500">{r.img_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaintMetaPanel;