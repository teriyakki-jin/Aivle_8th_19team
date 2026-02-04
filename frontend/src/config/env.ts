// src/config/urls.ts (예시 파일명)

function normalizeBase(value?: string) {
  if (!value) return "";
  return value.trim().replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/**
 * 배포(PROD)에서는 mixed content를 막기 위해
 * 절대 URL(http/https)이 들어오면 강제로 상대경로로 바꾼다.
 */
function enforceRelativeInProd(base: string, fallbackRelative: string) {
  const b = normalizeBase(base);
  if (!b) return fallbackRelative;

  // PROD에서는 절대 URL을 허용하지 않음 (CloudFront 경유 강제)
  if (import.meta.env.PROD && isAbsoluteHttpUrl(b)) {
    return fallbackRelative;
  }

  // 상대경로라면 그대로 사용
  return b;
}

/**
 * base + path를 안전하게 합친다.
 * - path가 절대 URL이면 그대로 반환
 * - base가 비어있으면 path 반환
 * - 중복 슬래시 제거/정리
 * - ✅ "/api" 중복 방지: base="/api" + path="/api/..." => "/api/..."로 정리
 */
function joinBase(base: string, path: string) {
  const b = normalizeBase(base);
  const p = (path || "").trim();

  if (!p) return b || "";
  if (isAbsoluteHttpUrl(p)) return p;

  // ✅ C번 안전장치: path가 "/api/..."로 오면 앞 "/api"를 제거해 중복 방지
  // 예) base="/api", path="/api/v1/..." => cleanedPath="/v1/..."
  const cleanedPath = p.startsWith("/api/") ? p.replace(/^\/api/, "") : p;

  // base가 없으면 path 그대로 (상대경로 유지)
  if (!b) return cleanedPath;

  const normalizedPath = cleanedPath.startsWith("/") ? cleanedPath : `/${cleanedPath}`;
  return `${b}${normalizedPath}`;
}

// --------------------
// ENV 읽기
// --------------------

const RAW_API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "";

// 개발 기본값
const DEV_DEFAULT_ML_API_BASE = "http://localhost:3001/api/v1/ml";
const DEV_DEFAULT_ML_IMAGE_BASE = "http://localhost:8000";

// PROD 기본 상대경로(CloudFront behavior 기준)
const PROD_DEFAULT_API_BASE = "/api";
const PROD_DEFAULT_ML_API_BASE = "/api/v1/ml";
// 이미지도 CloudFront로 같이 태우고 싶으면 /api 또는 /ml 같은 prefix로 구성 가능
const PROD_DEFAULT_ML_IMAGE_BASE = ""; // 상대경로 그대로 사용(예: /images/xxx)

// --------------------
// 최종 BASE 결정
// --------------------

// API_BASE: PROD면 절대 URL을 강제 차단하고 /api로
const API_BASE = enforceRelativeInProd(
  RAW_API_BASE,
  import.meta.env.DEV ? "" : PROD_DEFAULT_API_BASE
);

// ML API Base: 우선 env → 없으면 dev 기본 → 없으면 API_BASE
const RAW_ML_API_BASE = import.meta.env.VITE_ML_API_BASE || "";

const ML_API_BASE = enforceRelativeInProd(
  RAW_ML_API_BASE ||
    (import.meta.env.DEV ? DEV_DEFAULT_ML_API_BASE : PROD_DEFAULT_ML_API_BASE),
  import.meta.env.DEV ? DEV_DEFAULT_ML_API_BASE : PROD_DEFAULT_ML_API_BASE
);

// ML Image Base: 우선 env → 없으면 dev 기본 → 없으면 ML_API_BASE → (PROD에서는 상대경로 기본)
const RAW_ML_IMAGE_BASE = import.meta.env.VITE_ML_IMAGE_BASE || "";

const ML_IMAGE_BASE = enforceRelativeInProd(
  RAW_ML_IMAGE_BASE ||
    (import.meta.env.DEV ? DEV_DEFAULT_ML_IMAGE_BASE : "") ||
    ML_API_BASE,
  import.meta.env.DEV ? DEV_DEFAULT_ML_IMAGE_BASE : PROD_DEFAULT_ML_IMAGE_BASE
);

// --------------------
// URL helper
// --------------------
const apiUrl = (path: string) => joinBase(API_BASE, path);
const mlApiUrl = (path: string) => joinBase(ML_API_BASE, path);
const mlImageUrl = (path: string) => joinBase(ML_IMAGE_BASE, path);

export { API_BASE, ML_API_BASE, ML_IMAGE_BASE, apiUrl, mlApiUrl, mlImageUrl };
