import { AppApiError, toAppApiError } from './api-error';

export type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppApiError };

type RetryOptions = {
  maxRetries?: number;
};

export async function withRetry<T>(
  request: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 0;
  let attempt = 0;

  while (true) {
    try {
      return await request();
    } catch (error) {
      const mappedError = toAppApiError(error);
      const shouldRetry = mappedError.retryable && attempt < maxRetries;
      if (!shouldRetry) {
        throw mappedError;
      }
      attempt += 1;
    }
  }
}

export async function toSafeResult<T>(
  request: () => Promise<T>
): Promise<SafeResult<T>> {
  try {
    const data = await request();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toAppApiError(error) };
  }
}
