import axios from 'axios';

import { toAppApiError } from './api-error';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 10000
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toAppApiError(error))
);
