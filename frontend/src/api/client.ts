// API Base URL - 환경에 따라 동적 설정
const getApiBase = (): string => {
  // 개발 환경에서는 프록시 사용
  if (import.meta.env.DEV) {
    return "";
  }
  
  // 프로덕션 환경에서는 환경변수 또는 현재 도메인 기반으로 설정
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase) {
    return apiBase;
  }
  
  // CloudFront URL에서 백엔드 URL 추론
  const currentHost = window.location.host;
  if (currentHost.includes('cloudfront.net')) {
    // CloudFront 도메인인 경우 백엔드 ALB 또는 API Gateway URL로 변경
    // 실제 백엔드 URL로 교체 필요
    return import.meta.env.VITE_BACKEND_URL || 'https://your-backend-alb-url.amazonaws.com';
  }
  
  return "";
};

const API_BASE = getApiBase();

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function request<T>(method: HttpMethod, path: string, body?: any): Promise<T> {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return undefined as T;

  const result = await res.json();

  // 백엔드 ApiResponse { status, message, data } 형태면 data 추출
  if (result && typeof result === 'object' && 'data' in result) {
    return result.data as T;
  }

  return result as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: any) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
