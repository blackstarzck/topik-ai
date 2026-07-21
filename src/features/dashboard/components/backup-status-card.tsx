import { Alert, Button, Card, Col, Descriptions, Row, Space, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchBackupSummarySafe } from '../../system/api/backups-service';
import { backupViewContext } from '../../system/api/backup-data-source';
import {
  backupComponentStatusLabels,
  formatBackupDateTime,
  isRestoreDrillWarning,
  resolveBackupHealth,
  resolveDiskStatus,
  type BackupSummary
} from '../../system/model/backup-types';
import { usePermissionStore } from '../../system/model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

const { Text } = Typography;

export function BackupStatusCard(): JSX.Element {
  const navigate = useNavigate();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canReadDetails = useMemo(
    () => admins.find((admin) => admin.adminId === currentAdminId)?.permissions.includes('system.backups.read') ?? false,
    [admins, currentAdminId]
  );
  const [state, setState] = useState<AsyncState<BackupSummary | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchBackupSummarySafe(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setState({
          status: result.data.latestRunId ? 'success' : 'empty',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setState((current) => ({
        ...current,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });
    return () => controller.abort();
  }, [reloadKey]);

  const handleRetry = useCallback(() => setReloadKey((current) => current + 1), []);
  const summary = state.data;
  const health = resolveBackupHealth(summary);
  const diskStatus = resolveDiskStatus(summary?.diskUsedPercent ?? null);
  const restoreWarning = isRestoreDrillWarning(summary);

  return (
    <Card
      title="백업 상태"
      loading={state.status === 'pending' && !summary}
      extra={canReadDetails ? (
        <Button type="link" onClick={() => navigate('/system/backups')}>
          백업 관리 보기
        </Button>
      ) : null}
    >
      {backupViewContext === 'mirror' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="운영 백업 상태의 개발환경 복사본입니다."
          description={`마지막 동기화: ${formatBackupDateTime(summary?.lastReportReceivedAt ?? null)}`}
        />
      ) : null}

      {state.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="백업 상태를 불러오지 못했습니다."
          description={summary ? '마지막으로 확인된 값을 유지하고 있습니다.' : state.errorMessage}
          action={<Button size="small" onClick={handleRetry}>재시도</Button>}
        />
      ) : null}

      {state.status === 'empty' ? (
        <Alert
          type="info"
          showIcon
          message="아직 수신된 백업 기록이 없습니다."
          description="온프레미스 백업이 처음 완료되면 이 카드에 결과가 표시됩니다."
        />
      ) : (
        <Row gutter={[20, 16]}>
          <Col xs={24} lg={6}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">종합 상태</Text>
              <StatusBadge status={health} />
            </Space>
          </Col>
          <Col xs={24} lg={18}>
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2, xl: 3 }}
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
                  key: 'disk',
                  label: '온프레미스 디스크',
                  children: (
                    <Space size={6}>
                      <Text>{summary?.diskUsedPercent === null || summary?.diskUsedPercent === undefined ? '기록 없음' : `${summary.diskUsedPercent.toLocaleString('ko-KR')}%`}</Text>
                      <StatusBadge status={diskStatus} />
                    </Space>
                  )
                },
                {
                  key: 'next',
                  label: '다음 실행',
                  children: formatBackupDateTime(summary?.nextScheduledAt ?? null)
                },
                {
                  key: 'restore',
                  label: '마지막 복원 점검',
                  children: (
                    <Space size={6}>
                      <Text>{formatBackupDateTime(summary?.lastRestoreCompletedAt ?? null)}</Text>
                      {restoreWarning ? <StatusBadge status="주의" /> : <StatusBadge status="정상" />}
                    </Space>
                  )
                }
              ]}
            />
          </Col>
        </Row>
      )}
    </Card>
  );
}
