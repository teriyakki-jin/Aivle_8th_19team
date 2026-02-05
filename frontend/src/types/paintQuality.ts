
export type DefectClassName = "orange_peel" | "runs_sags" | "solvent_pop" | "water_spotting";

export interface PaintPredictData {
  img_id: string;
  img_name: string;
  img_path: string | null;      // 원본 이미지 URL (/static/..)
  img_result: string | null;    // 결과 이미지 URL (/static/..)
  img_base64?: string | null;   // 원본 이미지 base64
  img_result_base64?: string | null; // 결과 이미지 base64
  defect_type: 0 | 1 | 2 | 3;
  defect_score: number;  // 0~1
  label_name: string | null;
  label_path: string | null;    // /static/.. 경로
  label_name_text: DefectClassName | null;
}

export interface PaintPredictResponse {
  status: "success" | "error";
  message: string;
  data: PaintPredictData | null;
}
