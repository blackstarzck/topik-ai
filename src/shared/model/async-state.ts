export type AsyncStatus = 'idle' | 'pending' | 'success' | 'empty' | 'error';

export type AsyncState<T> = {
  status: AsyncStatus;
  data: T;
  errorMessage: string | null;
  errorCode: string | null;
};
