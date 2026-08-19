import { Form, Input, InputNumber, Modal, Select, DatePicker } from 'antd';
import type { FormInstance } from 'antd';

import {
  faqCategoryOptions,
  faqCurationModeOptions,
  faqCurationStatusOptions,
  faqExposureSurfaceOptions,
  faqStatusOptions
} from '../model/faq-schema';
import type { OperationFaq } from '../model/types';
import type {
  CurationEditorState,
  CurationFormValues,
  FaqEditorState,
  FaqFormValues
} from '../model/operation-faq-page-schema';

const { RangePicker } = DatePicker;

// FAQ·노출 규칙 편집 모달 — Phase 4 분해로 이동(동작 동일).
// 폼 인스턴스·검증·저장·알림은 페이지가 소유하고 props 로 받는다.

export function FaqEditorModal({
  editorState,
  form,
  onOk,
  onCancel
}: {
  editorState: FaqEditorState;
  form: FormInstance<FaqFormValues>;
  onOk: () => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  return (
<Modal
  open={Boolean(editorState)}
  title={editorState?.type === 'edit' ? 'FAQ 수정' : 'FAQ 등록'}
  okText="저장"
  cancelText="취소"
  onCancel={onCancel}
  onOk={() => void onOk()}
  destroyOnHidden
>
  <Form form={form} layout="vertical">
    <Form.Item
      label="질문"
      name="question"
      rules={[{ required: true, message: '질문을 입력하세요.' }]}
    >
      <Input placeholder="사용자에게 노출할 질문을 입력하세요." />
    </Form.Item>
    <Form.Item
      label="카테고리"
      name="category"
      rules={[{ required: true, message: '카테고리를 선택하세요.' }]}
    >
      <Select options={faqCategoryOptions} />
    </Form.Item>
    <Form.Item
      label="검색 키워드"
      name="searchKeywordsText"
      extra="쉼표 또는 줄바꿈 기준으로 분리되어 저장됩니다."
    >
      <Input.TextArea rows={3} placeholder="예: 결제 오류, 카드 결제, 환불" />
    </Form.Item>
    <Form.Item
      label="답변"
      name="answer"
      rules={[{ required: true, message: '답변을 입력하세요.' }]}
    >
      <Input.TextArea rows={7} placeholder="FAQ 답변을 입력하세요." />
    </Form.Item>
    <Form.Item
      label="공개 상태"
      name="status"
      rules={[{ required: true, message: '공개 상태를 선택하세요.' }]}
      style={{ marginBottom: 0 }}
    >
      <Select options={faqStatusOptions} />
    </Form.Item>
  </Form>
</Modal>
  );
}

export function CurationEditorModal({
  editorState,
  faqs,
  form,
  onOk,
  onCancel
}: {
  editorState: CurationEditorState;
  faqs: OperationFaq[];
  form: FormInstance<CurationFormValues>;
  onOk: () => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  return (
<Modal
  open={Boolean(editorState)}
  title={editorState?.type === 'edit' ? 'FAQ 노출 수정' : 'FAQ 노출 추가'}
  okText="저장"
  cancelText="취소"
  onCancel={onCancel}
  onOk={() => void onOk()}
  destroyOnHidden
>
  <Form form={form} layout="vertical">
    <Form.Item
      label="연결 FAQ"
      name="faqId"
      rules={[{ required: true, message: '연결할 FAQ를 선택하세요.' }]}
    >
      <Select
        showSearch
        optionFilterProp="label"
        placeholder="FAQ를 선택하세요."
        options={faqs.map((faq) => ({
          label: `${faq.id} · ${faq.question}`,
          value: faq.id
        }))}
      />
    </Form.Item>
    <Form.Item
      label="노출 위치"
      name="surface"
      rules={[{ required: true, message: '노출 위치를 선택하세요.' }]}
    >
      <Select options={faqExposureSurfaceOptions} />
    </Form.Item>
    <Form.Item
      label="노출 순서"
      name="displayRank"
      rules={[{ required: true, message: '노출 순서를 입력하세요.' }]}
    >
      <InputNumber min={1} max={5} style={{ width: '100%' }} />
    </Form.Item>
    <Form.Item
      label="설정 방식"
      name="curationMode"
      rules={[{ required: true, message: '설정 방식을 선택하세요.' }]}
    >
      <Select options={faqCurationModeOptions} />
    </Form.Item>
    <Form.Item
      label="노출 상태"
      name="exposureStatus"
      rules={[{ required: true, message: '노출 상태를 선택하세요.' }]}
    >
      <Select options={faqCurationStatusOptions} />
    </Form.Item>
    <Form.Item label="노출 기간" name="pinnedDateRange" style={{ marginBottom: 0 }}>
      <RangePicker style={{ width: '100%' }} />
    </Form.Item>
  </Form>
</Modal>
  );
}
