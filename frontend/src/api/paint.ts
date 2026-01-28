import type { PaintPredictResponse } from "@/types/paintQuality";

export async function uploadPaintImage(file: File): Promise<PaintPredictResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/ml-api/api/v1/paint`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${msg}`);
  }
  
  const data = await res.json();
  
  // model/main.py에서 /static/detect/... 경로로 반환됨
  // 이를 localhost:8000으로 직접 접근할 수 있도록 변환
  const transformUrl = (url: string) => {
    if (url?.startsWith('/static')) {
      return `http://localhost:8000${url}`;
    }
    return url;
  };
  
  // Transform ML service response to match PaintPredictResponse format
  return {
    status: data.status,
    message: data.message,
    data: data.data ? {
      ...data.data,
      img_result: transformUrl(data.data.img_result),
      img_path: transformUrl(data.data.img_path),
      label_path: transformUrl(data.data.label_path),
    } : null,
  };
}