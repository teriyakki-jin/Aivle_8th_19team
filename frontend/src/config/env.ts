function normalizeBase(value?: string) {
  if (!value) return "";
  return value.replace(/\/+$/, "");
}



const API_BASE = normalizeBase(
  import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL
);

const DEFAULT_ML_API_BASE = import.meta.env.DEV
  ? "http://localhost:3001/api/v1/ml"
  : "";

const DEFAULT_ML_IMAGE_BASE = import.meta.env.DEV
  ? "http://localhost:8000"
  : "";

const ML_API_BASE = normalizeBase(
  import.meta.env.VITE_ML_API_BASE || DEFAULT_ML_API_BASE || API_BASE
);

const ML_IMAGE_BASE = normalizeBase(
  import.meta.env.VITE_ML_IMAGE_BASE || DEFAULT_ML_IMAGE_BASE || ML_API_BASE
);

const apiUrl = (path: string) => joinBase(API_BASE, path);
const mlApiUrl = (path: string) => joinBase(ML_API_BASE, path);
const mlImageUrl = (path: string) => joinBase(ML_IMAGE_BASE, path);

export { API_BASE, ML_API_BASE, ML_IMAGE_BASE, apiUrl, mlApiUrl, mlImageUrl };
