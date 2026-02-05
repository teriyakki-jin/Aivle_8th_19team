/**
 * URL 끝의 슬래시 정리
 */
function normalizeBase(value?: string) {
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

/**
 * 절대 http(s) URL인지 확인
 */
function isAbsoluteHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * PROD 환경에서 절대 URL을 강제로 상대경로로 변환 (CloudFront 경유 강제)
 */
function enforceRelativeInProd(b: string, fallbackRelative: string) {
  const normalized = normalizeBase(b);

  // PROD에서는 절대 URL을 허용하지 않음 (CloudFront 경유 강제)
  if (import.meta.env.PROD && isAbsoluteHttpUrl(normalized)) {
    return fallbackRelative;
  }

  // 상대경로라면 그대로 사용
  return normalized;
}

/**
 * base + path를 안전하게 합친다.
 * - path가 절대 URL이면 그대로 반환
 * - base가 비어있으면 path 반환
 * - 중복 슬래시 제거/정리
 * - /api 중복 방지: base="/api" + path="/api/..." => "/api/..."로 정리
 */
function joinBase(base: string, path: string) {
  const b = normalizeBase(base);
  const p = (path || "").trim();

  if (!p) return b || "";
  if (isAbsoluteHttpUrl(p)) return p;

  // base가 "/api"일 때만 path의 "/api"를 제거해 중복 방지
  const stripApiPrefix = b === "/api" || b.endsWith("/api");
  const cleanedPath = stripApiPrefix && p.startsWith("/api/")
    ? p.replace(/^\/api/, "")
    : p;

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

const RAW_ML_API_BASE =
  import.meta.env.VITE_ML_API_BASE || "";

const RAW_ML_IMAGE_BASE =
  import.meta.env.VITE_ML_IMAGE_BASE || "";

// 개발 기본값
const DEV_DEFAULT_API_BASE = "";
const DEV_DEFAULT_ML_API_BASE = "http://localhost:3001/api/v1/ml";
const DEV_DEFAULT_ML_IMAGE_BASE = "http://localhost:8000";

// PROD 기본 상대경로 (CloudFront behavior 기준)
const PROD_DEFAULT_API_BASE = "/api";
const PROD_DEFAULT_ML_API_BASE = "/api/v1/ml";
const PROD_DEFAULT_ML_IMAGE_BASE = "";

// --------------------
// 최종 BASE 결정
// --------------------

// API_BASE: PROD면 절대 URL을 강제 차단하고 /api로
const API_BASE = enforceRelativeInProd(
  RAW_API_BASE || (import.meta.env.DEV ? DEV_DEFAULT_API_BASE : PROD_DEFAULT_API_BASE),
  PROD_DEFAULT_API_BASE
);

// ML_API_BASE
const ML_API_BASE = enforceRelativeInProd(
  RAW_ML_API_BASE || (import.meta.env.DEV ? DEV_DEFAULT_ML_API_BASE : PROD_DEFAULT_ML_API_BASE),
  PROD_DEFAULT_ML_API_BASE
);

// ML_IMAGE_BASE
const ML_IMAGE_BASE = enforceRelativeInProd(
  RAW_ML_IMAGE_BASE || (import.meta.env.DEV ? DEV_DEFAULT_ML_IMAGE_BASE : PROD_DEFAULT_ML_IMAGE_BASE),
  PROD_DEFAULT_ML_IMAGE_BASE
);

// --------------------
// Export Functions
// --------------------

const apiUrl = (path: string) => joinBase(API_BASE, path);
const mlApiUrl = (path: string) => joinBase(ML_API_BASE, path);
const mlImageUrl = (path: string) => joinBase(ML_IMAGE_BASE, path);

export { API_BASE, ML_API_BASE, ML_IMAGE_BASE, apiUrl, mlApiUrl, mlImageUrl };
