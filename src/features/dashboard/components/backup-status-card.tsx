import { Alert, Button, Card, Descriptions, Space, Table, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchBackupRunsSafe, fetchBackupSummarySafe } from '@/features/system/api/backups-service';
import { backupViewContext } from '@/features/system/api/backup-data-source';
import {
  backupComponentStatusLabels,
  backupRunStatusLabels,
  formatBackupDateTime,
  resolveBackupHealth,
  type BackupRun,
  type BackupSummary
} from '@/features/system/model/backup-types';
import { usePermissionStore } from '@/features/system/model/permission-store';
import type { AsyncState } from '@/shared/model/async-state';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';

const { Text } = Typography;

const RECENT_RUN_COUNT = 4;

// 카드 폭이 좁아 연도를 뺀 짧은 시각으로 표기한다(KST).
const shortDateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

function formatShortDateTime(value: string | null): string {
  if (!value) return '기록 없음';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '기록 없음' : shortDateTimeFormatter.format(parsed);
}

function failedComponentLabels(run: BackupRun): string[] {
  const parts: string[] = [];
  if (run.databaseStatus === 'failed') parts.push('DB');
  if (run.storageStatus === 'failed') parts.push('저장소');
  return parts;
}

export function BackupStatusCard(): JSX.Element {
  const navigate = useNavigate();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canReadDetails = useMemo(
    () => admins.find((admin) => admin.adminId === currentAdminId)?.permissions.includes('system.backups.read') ?? false,
    [admins, currentAdminId]
  );
  const [summaryState, setSummaryState] = useState<AsyncState<BackupSummary | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  // 이력 조회 RPC는 system.backups.read 권한이 필요해서 권한이 없는 관리자는
  // 요약(Descriptions) 보기로 폴백한다.
  const [runsState, setRunsState] = useState<AsyncState<BackupRun[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryState((current) => ({ ...current, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchBackupSummarySafe(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setSummaryState({
          status: result.data.latestRunId ? 'success' : 'empty',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setSummaryState((current) => ({
        ...current,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!canReadDetails) {
      setRunsState({ status: 'empty', data: [], errorMessage: null, errorCode: null });
      return;
    }
    const controller = new AbortController();
    setRunsState((current) => ({ ...current, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchBackupRunsSafe({ page: 1, pageSize: RECENT_RUN_COUNT }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setRunsState({
          status: result.data.rows.length > 0 ? 'success' : 'empty',
          data: result.data.rows,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setRunsState((current) => ({
        ...current,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });
    return () => controller.abort();
  }, [canReadDetails, reloadKey]);

  const handleRetry = useCallback(() => setReloadKey((current) => current + 1), []);
  const summary = summaryState.data;
  const runs = runsState.data ?? [];
  const health = resolveBackupHealth(summary);
  const loading =
    (summaryState.status === 'pending' && !summary) ||
    (canReadDetails && runsState.status === 'pending' && runs.length === 0);
  const hasError = summaryState.status === 'error' || runsState.status === 'error';

  return (
    <Card
      title="백업 상태"
      loading={loading}
      extra={canReadDetails ? (
        <Button type="link" onClick={() => navigate('/system/backups')}>
          백업 관리 보기
        </Button>
      ) : null}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space size={8}>
          <Text type="secondary">종합 상태</Text>
          <StatusBadge status={health} />
        </Space>

        {hasError ? (
          <Alert
            type="error"
            showIcon
            message="백업 상태를 불러오지 못했습니다."
            description={summary || runs.length > 0 ? '마지막으로 확인된 값을 유지하고 있습니다.' : summaryState.errorMessage ?? runsState.errorMessage}
            action={<Button size="small" onClick={handleRetry}>재시도</Button>}
          />
        ) : null}

        {canReadDetails ? (
          <Table<BackupRun>
            size="small"
            rowKey="runId"
            pagination={false}
            dataSource={runs}
            locale={{ emptyText: '아직 수신된 백업 기록이 없습니다.' }}
            columns={[
              {
                title: '실행 시각',
                dataIndex: 'startedAt',
                render: (value: string) => (
                  <Text style={{ whiteSpace: 'nowrap' }}>{formatShortDateTime(value)}</Text>
                )
              },
              {
                title: '결과',
                dataIndex: 'status',
                render: (value: BackupRun['status'], run) => {
                  const failedParts = failedComponentLabels(run);
                  return (
                    <Space size={6} wrap>
                      <StatusBadge status={backupRunStatusLabels[value]} />
                      {failedParts.length > 0 ? (
                        <Text type="secondary" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                          {failedParts.join('·')} 실패
                        </Text>
                      ) : null}
                    </Space>
                  );
                }
              }
            ]}
          />
        ) : (
          <Descriptions
            size="small"
            column={1}
            items={[
              {
                key: 'last-success',
                label: '마지막 전체 성공',
                children: formatBackupDateTime(summary?.lastSuccessAt ?? null)
              },
              {
                key: 'database',
                label: '데이터베이스',
                children: <StatusBadge status={summary?.databaseStatus ? backupComponentStatusLabels[summary.databaseStatus] : '기록 없음'} />
              },
              {
                key: 'storage',
                label: '파일 저장소',
                children: <StatusBadge status={summary?.storageStatus ? backupComponentStatusLabels[summary.storageStatus] : '기록 없음'} />
              },
              {
                key: 'next',
                label: '다음 실행',
                children: formatBackupDateTime(summary?.nextScheduledAt ?? null)
              }
            ]}
          />
        )}

        {backupViewContext === 'mirror' ? (
          <Text type="secondary" style={{ fontSize: 14 }}>
            개발환경 복사본 · 마지막 동기화 {formatBackupDateTime(summary?.lastReportReceivedAt ?? null)}
          </Text>
        ) : null}
      </Space>
    </Card>
  );
}
