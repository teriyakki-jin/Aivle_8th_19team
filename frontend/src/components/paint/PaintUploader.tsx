
import React, { useRef, useState } from "react";
import { usePaintStore } from "@/store/paintStore";
import { Upload } from "lucide-react";

const PaintUploader: React.FC = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const analyze = usePaintStore((s) => s.analyze);
  const loading = usePaintStore((s) => s.loading);
  const error = usePaintStore((s) => s.error);
  const clearError = usePaintStore((s) => s.clearError);

  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    clearError();
    analyze(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 min-h-40"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-10 h-4 text-slate-400 mb-2" />
        <p className="font-medium">이미지를 드래그&드롭하거나 클릭해서 선택</p>
        <p className="text-sm text-slate-500 mt-1">JPG/PNG 등 단일 이미지</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInputChange}
        />

        <button
          className="mt-3 inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "분석 중…" : "파일 선택"}
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
};

export default PaintUploader;
