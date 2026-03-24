import { Alert, Button, Descriptions, Form, Input, Space } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';

import {
  fetchNoticeSafe,
  saveNoticeSafe
} from '../api/notices-service';
import type { OperationNotice } from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  DEFAULT_TINYMCE_PLUGINS,
  DEFAULT_TINYMCE_TOOLBAR,
  TinyMceHtmlEditor
} from '../../../shared/ui/html-editor/tiny-mce-html-editor';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';

type NoticeContentFormValues = {
  title: string;
  bodyHtml: string;
};

export default function OperationNoticeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { noticeId } = useParams<{ noticeId?: string }>();
  const [contentForm] = Form.useForm<NoticeContentFormValues>();
  const [noticeState, setNoticeState] = useState<AsyncState<OperationNotice | null>>({
    status: noticeId ? 'pending' : 'success',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [saveState, setSaveState] = useState<AsyncState<OperationNotice | null>>({
    status: 'idle',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  const isEdit = Boolean(noticeId);
  const notice = noticeState.data;
  const listPath = '/operation/notices';
  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('preview');
    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [location.search]);

  useEffect(() => {
    if (!isEdit || !noticeId) {
      setNoticeState({
        status: 'success',
        data: null,
        errorMessage: null,
        errorCode: null
      });
      return;
    }

    const controller = new AbortController();

    setNoticeState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchNoticeSafe(noticeId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setNoticeState({
          status: 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setNoticeState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [isEdit, noticeId, reloadKey]);

  useEffect(() => {
    contentForm.setFieldsValue({
      title: notice?.title ?? '',
      bodyHtml: notice?.bodyHtml ?? ''
    });
  }, [contentForm, notice]);

  const handleBackToList = useCallback(() => {
    navigate(`${listPath}${listSearch}`);
  }, [listPath, listSearch, navigate]);

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleSaveNotice = useCallback(async () => {
    if (isEdit && !notice) {
      return;
    }

    const values = (await contentForm.validateFields()) as NoticeContentFormValues;

    setSaveState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    const result = await saveNoticeSafe({
      id: notice?.id,
      title: values.title.trim(),
      bodyHtml: values.bodyHtml
    });

    if (!result.ok) {
      setSaveState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
      return;
    }

    setSaveState({
      status: 'success',
      data: result.data,
      errorMessage: null,
      errorCode: null
    });

    navigate(`${listPath}${listSearch}`, {
      replace: true,
      state: {
        operationNoticeSaved: {
          noticeId: result.data.id,
          mode: isEdit ? 'edit' : 'create'
        }
      }
    });
  }, [contentForm, isEdit, listPath, listSearch, navigate, notice]);

  const hasCachedNotice = Boolean(notice);
  const isLoadingInitialNotice = isEdit && noticeState.status === 'pending' && !hasCachedNotice;
  const isSaveDisabled =
    saveState.status === 'pending' || (isEdit && !hasCachedNotice);

  return (
    <div className="content-editor-page">
      <PageTitle title={isEdit ? '공지 수정 상세' : '공지 등록 상세'} />

      {isEdit && noticeState.status === 'error' && !hasCachedNotice ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="공지 등록 상세 대상을 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <span>{noticeState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</span>
              {noticeState.errorCode ? (
                <span>오류 코드: {noticeState.errorCode}</span>
              ) : null}
            </Space>
          }
          action={
            <Space>
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
              <Button type="primary" size="small" onClick={handleBackToList}>
                목록으로
              </Button>
            </Space>
          }
        />
      ) : null}

      <AdminListCard
        className="content-editor-detail-card"
        toolbar={
          <div className="content-editor-toolbar">
            <Space className="content-editor-toolbar-actions" wrap>
            <Button size="large" onClick={handleBackToList}>
              목록으로
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSaveNotice}
              loading={saveState.status === 'pending'}
              disabled={isSaveDisabled}
            >
              저장
            </Button>
            </Space>
          </div>
        }
      >
          {isLoadingInitialNotice ? (
            <Alert
              type="info"
              showIcon
              message="공지 상세를 불러오는 중입니다."
              description="저장된 제목과 본문을 확인한 뒤 수정할 수 있습니다."
            />
          ) : null}

          {isEdit && noticeState.status === 'pending' && hasCachedNotice ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="최신 공지 정보를 다시 확인하는 중입니다."
              description="마지막 성공 상태를 유지한 채 본문을 계속 확인할 수 있습니다."
            />
          ) : null}

          {saveState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="공지 저장에 실패했습니다."
              description={
                <Space direction="vertical">
                  <span>{saveState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</span>
                  {saveState.errorCode ? (
                    <span>오류 코드: {saveState.errorCode}</span>
                  ) : null}
                </Space>
              }
            />
          ) : null}

          {!isEdit || hasCachedNotice ? (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="저장 정책"
                description="신규 공지는 저장 시 숨김 상태로 보관됩니다. 사용자 화면에 노출하려면 목록에서 게시 조치를 실행하세요."
              />
              <Form form={contentForm} className="notice-detail-form">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  className="admin-form-descriptions notice-detail-meta"
                  items={markRequiredDescriptionItems(
                    [
                      {
                        key: 'title',
                        label: '공지 제목',
                        children: (
                          <Form.Item
                            name="title"
                            rules={[{ required: true, message: '공지 제목을 입력하세요.' }]}
                          >
                            <Input placeholder="공지 제목을 입력하세요." />
                          </Form.Item>
                        )
                      }
                    ],
                    ['title']
                  )}
                />
                <Form.Item
                  name="bodyHtml"
                  rules={[{ required: true, message: '공지 본문을 입력하세요.' }]}
                  style={{ marginBottom: 0 }}
                  className="notice-detail-editor-field"
                >
                  <TinyMceHtmlEditor
                    editorId={`operation-notice-editor-${notice?.id ?? 'new'}`}
                    height="100%"
                    plugins={DEFAULT_TINYMCE_PLUGINS}
                    toolbar={DEFAULT_TINYMCE_TOOLBAR}
                  />
                </Form.Item>
              </Form>
            </>
          ) : null}
      </AdminListCard>
    </div>
  );
}
