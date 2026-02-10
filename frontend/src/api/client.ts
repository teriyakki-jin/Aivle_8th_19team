import { apiUrl } from "../config/env";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function request<T>(method: HttpMethod, path: string, body?: any): Promise<T> {
  const token = localStorage.getItem("token");

  console.log(`[API] ${method} ${apiUrl(path)}, token: ${token ? 'present' : 'missing'}`);

  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[API] ${method} ${path} failed (${res.status}):`, text);
    
    // 인증 오류인 경우 토큰 제거 및 로그아웃 처리
    if (res.status === 401 || res.status === 403) {
      console.warn('[API] Authentication failed, clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      // 페이지 새로고침하여 로그인 페이지로 리디렉트
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
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
