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
          message="공지 등록 상세 ??곸쓣 遺덈윭?ㅼ? 紐삵뻽?듬땲??"
          description={
            <Space direction="vertical">
              <span>{noticeState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</span>
              {noticeState.errorCode ? (
                <span>?ㅻ쪟 肄붾뱶: {noticeState.errorCode}</span>
              ) : null}
            </Space>
          }
          action={
            <Space>
              <Button size="small" onClick={handleReload}>
                ?ㅼ떆 ?쒕룄
              </Button>
              <Button type="primary" size="small" onClick={handleBackToList}>
                紐⑸줉?쇰줈
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
              紐⑸줉?쇰줈
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSaveNotice}
              loading={saveState.status === 'pending'}
              disabled={isSaveDisabled}
            >
              대상            </Button>
            </Space>
          </div>
        }
      >
          {isLoadingInitialNotice ? (
            <Alert
              type="info"
              showIcon
              message="공지 상세瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎."
              description="??λ맂 제목怨?蹂몃Ц???뺤씤?????섏젙?????덉뒿?덈떎."
            />
          ) : null}

          {isEdit && noticeState.status === 'pending' && hasCachedNotice ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="理쒖떊 공지 ?뺣낫瑜??ㅼ떆 ?뺤씤?섎뒗 以묒엯?덈떎."
              description="留덉?留?성공 상태瑜??좎???梨?蹂몃Ц??怨꾩냽 ?뺤씤?????덉뒿?덈떎."
            />
          ) : null}

          {saveState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="공지 ??μ뿉 실패?덉뒿?덈떎."
              description={
                <Space direction="vertical">
                  <span>{saveState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</span>
                  {saveState.errorCode ? (
                    <span>?ㅻ쪟 肄붾뱶: {saveState.errorCode}</span>
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
                message="대상?뺤콉"
                description="?좉퇋 공지??대상??숨김 상태濡?蹂닿??⑸땲?? 사용자?붾㈃???몄텧?섎젮硫?紐⑸줉?먯꽌 게시 議곗튂瑜??ㅽ뻾?섏꽭??"
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
                            rules={[{ required: true, message: '공지 제목???낅젰?섏꽭??' }]}
                          >
                            <Input placeholder="공지 제목???낅젰?섏꽭??" />
                          </Form.Item>
                        )
                      }
                    ],
                    ['title']
                  )}
                />
                <Form.Item
                  name="bodyHtml"
                  rules={[{ required: true, message: '공지 蹂몃Ц???낅젰?섏꽭??' }]}
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


