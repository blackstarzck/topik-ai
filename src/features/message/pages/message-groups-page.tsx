import { Alert, Button, Form, Space, Typography, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  deleteMessageGroupSafe,
  fetchGroupsSafe,
  previewMessageGroupCountSafe,
  recalculateMessageGroupSafe,
  saveMessageGroupSafe
} from '../api/messages-service';
import {
  buildDefaultFormValues,
  buildNaturalLanguagePreview,
  buildPayload,
  buildQueryBuilderConfigFromValues,
  buildSqlPreview,
  cloneQueryBuilderGroup,
  filterMessageGroups,
  syncCountryRule,
  toFormValues,
  validateQueryBuilder
} from '../model/message-groups-page-schema';
import type {
  GroupEditorState,
  GroupFormValues,
  GroupSearchParamKey,
  QueryPreviewMode
} from '../model/message-groups-page-schema';
import type { MessageGroup, MessageGroupQueryGroup } from '../model/types';
import { buildMessageAuditNoticeDescription } from '../ui/message-audit-notice';
import { createMessageGroupColumns } from '../ui/message-groups-columns';
import { MessageGroupEditorDrawer } from '../ui/message-groups-editor-drawer';
import { MessageGroupsTableSection } from '../ui/message-groups-table-section';
import type { AsyncState } from '../../../shared/model/async-state';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { parseSearchDate } from '../../../shared/ui/search-bar/search-bar-utils';

const { Text } = Typography;

export default function MessageGroupsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const selectedGroupId = searchParams.get('selected') ?? '';
  const editorParam = searchParams.get('editor') ?? '';
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [editorState, setEditorState] = useState<GroupEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageGroup | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [recalculatingGroupId, setRecalculatingGroupId] = useState<string | null>(null);
  const [lastSuccessfulGroups, setLastSuccessfulGroups] = useState<MessageGroup[]>([]);
  const [queryPreviewMode, setQueryPreviewMode] = useState<QueryPreviewMode>('natural-language');
  const [queryBuilderConfig, setQueryBuilderConfig] = useState<MessageGroupQueryGroup>(() =>
    buildQueryBuilderConfigFromValues(buildDefaultFormValues())
  );
  const [queryBuilderTouched, setQueryBuilderTouched] = useState(false);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<GroupFormValues>();

  const definitionType = Form.useWatch('definitionType', form);
  const builderMode = Form.useWatch('builderMode', form);
  const country = Form.useWatch('country', form);
  const ageRange = Form.useWatch('ageRange', form);

  const queryPreviewText = useMemo(
    () => ({
      'natural-language': buildNaturalLanguagePreview(queryBuilderConfig),
      sql: buildSqlPreview(queryBuilderConfig),
      json: JSON.stringify(queryBuilderConfig, null, 2)
    }),
    [queryBuilderConfig]
  );

  useEffect(() => {
    if (definitionType !== '조건 기반 그룹' || builderMode !== 'query-builder') {
      form.setFieldValue('queryBuilderText', '');
      return;
    }

    form.setFieldValue('queryBuilderText', queryPreviewText.sql);
  }, [builderMode, definitionType, form, queryPreviewText.sql]);

  useEffect(() => {
    if (editorState?.type !== 'create') {
      return;
    }

    if (definitionType !== '조건 기반 그룹' || builderMode !== 'query-builder' || queryBuilderTouched) {
      return;
    }

    const currentValues = form.getFieldsValue(true) as GroupFormValues;
    setQueryBuilderConfig(buildQueryBuilderConfigFromValues(currentValues));
  }, [builderMode, definitionType, editorState, form, queryBuilderTouched]);

  useEffect(() => {
    if (definitionType !== '조건 기반 그룹' || builderMode !== 'query-builder' || !country) {
      return;
    }

    setQueryBuilderConfig((current) => syncCountryRule(current, country));
  }, [builderMode, country, definitionType]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchGroupsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setGroups(result.data);
        setLastSuccessfulGroups(result.data);
        setLoadState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: null,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setLoadState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    if (loadState.status === 'success' || loadState.status === 'empty') {
      setLastSuccessfulGroups(groups);
    }
  }, [groups, loadState.status]);

  const isUsingLastSuccessfulGroups =
    (loadState.status === 'pending' || loadState.status === 'error') &&
    lastSuccessfulGroups.length > 0;
  const sourceGroups = isUsingLastSuccessfulGroups ? lastSuccessfulGroups : groups;

  const visibleGroups = useMemo(
    () => filterMessageGroups(sourceGroups, keyword, searchField, startDate, endDate),
    [endDate, keyword, searchField, sourceGroups, startDate]
  );

  const syncSearchParams = useCallback(
    (
      next: Partial<Record<GroupSearchParamKey, string | null>>,
      options?: { replace?: boolean }
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('definition');

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });

      setSearchParams(merged, { replace: options?.replace ?? true });
    },
    [searchParams, setSearchParams]
  );

  const applyCreateDrawerState = useCallback(() => {
    const defaultValues = buildDefaultFormValues();
    form.setFieldsValue(defaultValues);
    setPreviewCount(null);
    setQueryPreviewMode('natural-language');
    setQueryBuilderTouched(false);
    setQueryBuilderConfig(buildQueryBuilderConfigFromValues(defaultValues));
    setEditorState({ type: 'create' });
  }, [form]);

  const applyEditDrawerState = useCallback(
    (group: MessageGroup) => {
      form.setFieldsValue(toFormValues(group));
      setPreviewCount(group.memberCount);
      setQueryPreviewMode('sql');
      setQueryBuilderTouched(group.builderMode === 'query-builder');
      setQueryBuilderConfig(
        group.queryBuilderConfig
          ? cloneQueryBuilderGroup(group.queryBuilderConfig)
          : buildQueryBuilderConfigFromValues(toFormValues(group))
      );
      setEditorState({ type: 'edit', group });
    },
    [form]
  );

  const resetDrawerState = useCallback(() => {
    setEditorState(null);
    setPreviewCount(null);
    setQueryBuilderTouched(false);
  }, []);

  const openCreateDrawer = useCallback(() => {
    syncSearchParams({ editor: 'create', selected: null });
  }, [syncSearchParams]);

  const openEditDrawer = useCallback(
    (group: MessageGroup) => {
      syncSearchParams({ selected: group.id, editor: null });
    },
    [syncSearchParams]
  );

  const closeDrawer = useCallback(() => {
    syncSearchParams({ selected: null, editor: null });
  }, [syncSearchParams]);

  useEffect(() => {
    if (editorParam === 'create') {
      if (editorState?.type !== 'create') {
        applyCreateDrawerState();
      }
      return;
    }

    if (selectedGroupId) {
      const selectedGroup = sourceGroups.find((group) => group.id === selectedGroupId);
      if (!selectedGroup) {
        if (loadState.status === 'pending') {
          return;
        }

        resetDrawerState();
        syncSearchParams({ selected: null, editor: null });
        return;
      }

      if (editorState?.type === 'edit' && editorState.group.id === selectedGroupId) {
        return;
      }

      applyEditDrawerState(selectedGroup);
      return;
    }

    if (editorState) {
      resetDrawerState();
    }
  }, [
    applyCreateDrawerState,
    applyEditDrawerState,
    editorParam,
    editorState,
    loadState.status,
    resetDrawerState,
    selectedGroupId,
    sourceGroups,
    syncSearchParams
  ]);

  const handlePreviewCount = useCallback(async () => {
    const fieldsToValidate =
      definitionType === '정적 그룹'
        ? ['definitionType', 'channels', 'staticMembersText']
        : builderMode === 'query-builder'
          ? ['definitionType', 'builderMode', 'channels', 'country']
          : [
              'definitionType',
              'builderMode',
              'channels',
              'country',
              'memberTypes',
              'genders',
              'ageRange',
              'signupMethods',
              'signupDateRange',
              'subscriptionStates',
              'activityStates'
            ];
    const values = await form.validateFields(fieldsToValidate);

    if (definitionType === '조건 기반 그룹' && builderMode === 'query-builder') {
      const errorMessage = validateQueryBuilder(queryBuilderConfig);
      if (errorMessage) {
        notificationApi.error({
          message: '상세 조건을 확인하세요.',
          description: errorMessage
        });
        return;
      }
    }

    const result = await previewMessageGroupCountSafe(
      buildPayload(values, editorState, queryBuilderConfig)
    );

    if (!result.ok) {
      notificationApi.error({
        message: '대상 수 미리보기 실패',
        description: result.error.message
      });
      return;
    }

    if (result.data === null) {
      // supabase 모드 조건 기반 그룹 — 인원 산정 파이프라인 미연동(P2).
      notificationApi.info({
        message: '조건 기반 그룹 인원 미리보기 미지원 (P2)',
        description: '정적 그룹은 명단 수가 즉시 계산됩니다. 조건 기반 그룹 인원 산정은 발송 파이프라인 연동 후 제공됩니다.'
      });
    }

    setPreviewCount(result.data);
  }, [
    builderMode,
    definitionType,
    editorState,
    form,
    notificationApi,
    queryBuilderConfig
  ]);

  const handleSaveGroup = useCallback(async () => {
    if (definitionType === '조건 기반 그룹' && builderMode === 'query-builder') {
      const errorMessage = validateQueryBuilder(queryBuilderConfig);
      if (errorMessage) {
        notificationApi.error({
          message: '상세 조건을 확인하세요.',
          description: errorMessage
        });
        return;
      }
    }

    const values = await form.validateFields();
    const result = await saveMessageGroupSafe(
      buildPayload(values, editorState, queryBuilderConfig)
    );

    if (!result.ok) {
      notificationApi.error({
        message: '대상 그룹 저장 실패',
        description: result.error.message
      });
      return;
    }

    const saved = result.data;
    setGroups((prev) => {
      const exists = prev.some((group) => group.id === saved.id);
      return exists
        ? prev.map((group) => (group.id === saved.id ? saved : group))
        : [saved, ...prev];
    });

    notificationApi.success({
      message: `대상 그룹 ${editorState?.type === 'edit' ? '수정' : '생성'} 완료`,
      description: buildMessageAuditNoticeDescription(saved.id, [
        `예상 대상 수: ${saved.memberCount.toLocaleString()}명`
      ])
    });
    closeDrawer();
  }, [
    builderMode,
    closeDrawer,
    definitionType,
    editorState,
    form,
    notificationApi,
    queryBuilderConfig
  ]);

  const handleRecalculate = useCallback(
    async (group: MessageGroup) => {
      if (recalculatingGroupId) {
        return;
      }

      setRecalculatingGroupId(group.id);

      try {
        const result = await recalculateMessageGroupSafe(group.id);
        if (!result.ok || !result.data) {
          if (!result.ok) {
            notificationApi.error({
              message: '대상 그룹 재계산 실패',
              description: result.error.message
            });
          }
          return;
        }

        const refreshed = result.data;
        setGroups((prev) =>
          prev.map((item) => (item.id === refreshed.id ? refreshed : item))
        );
        setEditorState((current) =>
          current?.type === 'edit' && current.group.id === refreshed.id
            ? { type: 'edit', group: refreshed }
            : current
        );
        setPreviewCount((current) =>
          editorState?.type === 'edit' && editorState.group.id === refreshed.id
            ? refreshed.memberCount
            : current
        );

        notificationApi.success({
          message: '대상 그룹 예상 수 재계산 완료',
          description: buildMessageAuditNoticeDescription(refreshed.id, [
            `예상 대상 수: ${refreshed.memberCount.toLocaleString()}명`
          ])
        });
      } finally {
      setRecalculatingGroupId(null);
      }
    },
    [editorState, notificationApi, recalculatingGroupId]
  );

  const handleDeleteGroup = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }

      const result = await deleteMessageGroupSafe(deleteTarget.id, reason);
      if (!result.ok || !result.data) {
        if (!result.ok) {
          notificationApi.error({
            message: '대상 그룹 삭제 실패',
            description: result.error.message
          });
        }
        return;
      }

      const deleted = result.data;
      setGroups((prev) => prev.filter((group) => group.id !== deleted.id));
      notificationApi.success({
        message: '대상 그룹 삭제 완료',
        description: buildMessageAuditNoticeDescription(deleted.id, [
          `사유/근거: ${reason}`
        ])
      });
      setDeleteTarget(null);
    },
    [deleteTarget, notificationApi]
  );

  const columns = useMemo<TableColumnsType<MessageGroup>>(
    () =>
      createMessageGroupColumns({
        recalculatingGroupId,
        onRecalculate: handleRecalculate,
        onDelete: setDeleteTarget
      }),
    [handleRecalculate, recalculatingGroupId]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="대상 그룹" />

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="대상 그룹 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{loadState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {loadState.errorCode ?? '-'}</Text>
              <Text type="secondary">
                {lastSuccessfulGroups.length > 0
                  ? '마지막 성공 목록을 유지한 상태로 화면을 계속 제공합니다.'
                  : '이전에 성공한 조회 결과가 없어 fallback 목록은 제공되지 않습니다.'}
              </Text>
              <Button onClick={handleRetryLoad}>다시 시도</Button>
            </Space>
          }
        />
      ) : null}

      <MessageGroupsTableSection
        searchField={searchField}
        keyword={keyword}
        startDate={startDate}
        endDate={endDate}
        syncSearchParams={syncSearchParams}
        visibleGroups={visibleGroups}
        columns={columns}
        loadState={loadState}
        openCreateDrawer={openCreateDrawer}
        openEditDrawer={openEditDrawer}
      />

      <MessageGroupEditorDrawer
        editorState={editorState}
        form={form}
        definitionType={definitionType}
        builderMode={builderMode}
        ageRange={ageRange}
        queryBuilderConfig={queryBuilderConfig}
        queryPreviewMode={queryPreviewMode}
        queryPreviewText={queryPreviewText}
        previewCount={previewCount}
        recalculatingGroupId={recalculatingGroupId}
        closeDrawer={closeDrawer}
        handlePreviewCount={handlePreviewCount}
        handleSaveGroup={handleSaveGroup}
        setQueryPreviewMode={setQueryPreviewMode}
        setQueryBuilderConfig={setQueryBuilderConfig}
        setQueryBuilderTouched={setQueryBuilderTouched}
      />

      {deleteTarget ? (
        <ConfirmAction
          open
          title="대상 그룹 삭제"
          description="공용 대상 그룹을 삭제하면 메일/푸시 템플릿에서 해당 그룹을 새로 선택할 수 없습니다. 삭제 사유를 남기세요."
          targetType="Message"
          targetId={deleteTarget.id}
          confirmText="삭제 실행"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteGroup}
        />
      ) : null}
    </div>
  );
}
