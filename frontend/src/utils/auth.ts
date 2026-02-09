// AWS 환경에서의 디버깅을 위한 유틸리티
export function debugAwsEnvironment() {
  console.log('=== AWS Environment Debug Info ===');
  console.log('Current URL:', window.location.href);
  console.log('API Base:', import.meta.env.VITE_API_BASE || 'undefined');
  console.log('Environment:', import.meta.env.MODE);
  console.log('Production:', import.meta.env.PROD);
  
  const token = localStorage.getItem('token');
  console.log('Token present:', !!token);
  
  if (token) {
    try {
      // JWT 토큰 디코드 (간단한 base64 디코드)
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expiry:', new Date(payload.exp * 1000));
      console.log('Token expired:', Date.now() > payload.exp * 1000);
    } catch (e) {
      console.error('Failed to decode token:', e);
    }
  }
  
  console.log('=== End Debug Info ===');
}

// 401/403 오류 발생 시 호출할 함수
export function handleAuthError() {
  console.warn('Authentication error detected, clearing session');
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  
  // 현재 페이지가 로그인 페이지가 아니면 리디렉트
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

// API 요청 전에 토큰 유효성 확인
export function validateToken(): boolean {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = Date.now() > payload.exp * 1000;
    
    if (isExpired) {
      console.warn('Token expired, clearing session');
      handleAuthError();
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Token validation failed:', e);
    handleAuthError();
    return false;
  }
}