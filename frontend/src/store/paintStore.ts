
import { create } from "zustand";
import type { PaintPredictData } from "@/types/paintQuality";
import { uploadPaintImage } from "@/api/paint";

type State = {
  loading: boolean;
  error: string | null;
  current: PaintPredictData | null;
  recent: PaintPredictData[]; // 최근 n개 결과 저장 (간단한 히스토리)
};

type Actions = {
  analyze: (file: File) => Promise<void>;
  clearCurrent: () => void;
  clearError: () => void;
};

export const usePaintStore = create<State & Actions>((set, get) => ({
  loading: false,
  error: null,
  current: null,
  recent: [],

  analyze: async (file: File) => {
    set({ loading: true, error: null });
    try {
      const res = await uploadPaintImage(file);
      if (res.status === "success" && res.data) {
        const data = res.data;
        const updatedRecent = [data, ...get().recent].slice(0, 10);
        set({ current: data, recent: updatedRecent, loading: false });
      } else {
        set({ error: res.message || "분석 실패", loading: false, current: null });
      }
    } catch (err: any) {
      set({ error: err?.message ?? "네트워크 오류", loading: false, current: null });
    }
  },

  clearCurrent: () => set({ current: null }),
  clearError: () => set({ error: null }),
}));
