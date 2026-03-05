import axios from 'axios';

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELED'
  | 'AUTH_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export class AppApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  retryable: boolean;
  requestId?: string;

  constructor(
    message: string,
    options: {
      code: ApiErrorCode;
      status?: number;
      retryable?: boolean;
      requestId?: string;
    }
  ) {
    super(message);
    this.name = 'AppApiError';
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId;
  }
}

function mapStatusToCode(status?: number): ApiErrorCode {
  if (status === 400) {
    return 'VALIDATION_ERROR';
  }
  if (status === 401) {
    return 'AUTH_ERROR';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  if (status && status >= 500) {
    return 'SERVER_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

function isRetryableStatus(status?: number): boolean {
  if (!status) {
    return true;
  }
  return status >= 500 || status === 408 || status === 429;
}

export function toAppApiError(error: unknown): AppApiError {
  if (error instanceof AppApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const requestId = error.response?.headers?.['x-request-id'] as string | undefined;

    if (error.code === 'ERR_CANCELED') {
      return new AppApiError('요청이 취소되었습니다.', {
        code: 'CANCELED',
        status,
        retryable: false,
        requestId
      });
    }

    if (error.code === 'ECONNABORTED') {
      return new AppApiError('요청 시간이 초과되었습니다.', {
        code: 'TIMEOUT',
        status,
        retryable: true,
        requestId
      });
    }

    if (!error.response) {
      return new AppApiError('네트워크 연결 상태를 확인해주세요.', {
        code: 'NETWORK_ERROR',
        retryable: true
      });
    }

    return new AppApiError(error.message || '요청 처리 중 오류가 발생했습니다.', {
      code: mapStatusToCode(status),
      status,
      retryable: isRetryableStatus(status),
      requestId
    });
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppApiError('요청이 취소되었습니다.', {
      code: 'CANCELED',
      retryable: false
    });
  }

  if (error instanceof Error) {
    return new AppApiError(error.message, {
      code: 'UNKNOWN_ERROR',
      retryable: false
    });
  }

  return new AppApiError('알 수 없는 오류가 발생했습니다.', {
    code: 'UNKNOWN_ERROR',
    retryable: false
  });
}
