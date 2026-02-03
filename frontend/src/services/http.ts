import axios from 'axios';
import { API_BASE } from '../config/env';

const http = axios.create({
  baseURL: API_BASE || '',
  timeout: 15000,
});

export default http;
