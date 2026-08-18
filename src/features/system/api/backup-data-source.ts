import { resolveDataSource } from '@/shared/api/data-source';

export type BackupDataSource = 'mock' | 'supabase';
export type BackupViewContext = 'primary' | 'mirror';

const env = import.meta.env as unknown as Record<string, string | undefined>;
const TOPIK_DEV_HOST = 'fglggyfvzjdsbyckinqa.supabase.co';

export function resolveBackupDataSource(): BackupDataSource {
  return resolveDataSource('VITE_BACKUP_SOURCE');
}

export const backupDataSource = resolveBackupDataSource();

export function resolveBackupViewContext(
  supabaseUrl = env.VITE_SUPABASE_URL
): BackupViewContext {
  if (!supabaseUrl) return 'primary';
  try {
    return new URL(supabaseUrl).hostname === TOPIK_DEV_HOST ? 'mirror' : 'primary';
  } catch {
    return 'primary';
  }
}

export const backupViewContext = resolveBackupViewContext();
