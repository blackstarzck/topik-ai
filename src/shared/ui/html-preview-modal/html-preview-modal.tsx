import { Alert, Button, Descriptions, Modal, Space } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { ReactNode } from 'react';

type HtmlPreviewModalProps = {
  open: boolean;
  title: string;
  descriptionItems?: DescriptionsProps['items'];
  bodyHtml?: string;
  onClose: () => void;
  width?: number;
  emptyMessage?: ReactNode;
  emptyDescription?: ReactNode;
  footerActions?: ReactNode[];
};

export function HtmlPreviewModal({
  open,
  title,
  descriptionItems,
  bodyHtml,
  onClose,
  width = 920,
  emptyMessage = '등록된 본문이 없습니다.',
  emptyDescription = '등록 상세에서 본문을 먼저 저장해주세요.',
  footerActions
}: HtmlPreviewModalProps): JSX.Element {
  const normalizedBodyHtml = bodyHtml?.trim() ?? '';
  const footerItems = [
    ...(footerActions ?? []),
    <Button key="close" onClick={onClose}>
      닫기
    </Button>
  ];

  return (
    <Modal
      open={open}
      title={title}
      footer={footerItems}
      width={width}
      onCancel={onClose}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {descriptionItems && descriptionItems.length > 0 ? (
          <Descriptions
            bordered
            size="small"
            column={3}
            className="content-preview-descriptions"
            items={descriptionItems}
          />
        ) : null}
        <div className="content-preview-canvas">
          <div className="content-preview-canvas-body">
            {normalizedBodyHtml ? (
              <div dangerouslySetInnerHTML={{ __html: normalizedBodyHtml }} />
            ) : (
              <Alert
                type="info"
                showIcon
                message={emptyMessage}
                description={emptyDescription}
              />
            )}
          </div>
        </div>
      </Space>
    </Modal>
  );
}

