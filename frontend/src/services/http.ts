import axios from 'axios';
const http = axios.create({
  // baseURL에 "/api"가 있을 경우, 요청 경로가 "/api/..."면 중복이 생길 수 있음.
  // 서비스 호출에서 apiUrl()을 사용하도록 하고, 여기서는 빈 baseURL 사용.
  baseURL: '',
  timeout: 15000,
});

export default http;
