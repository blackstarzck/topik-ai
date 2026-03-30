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
  emptyMessage = '?깅줉??蹂몃Ц???놁뒿?덈떎.',
  emptyDescription = '?깅줉 상세?먯꽌 蹂몃Ц??癒쇱? ??ν빐二쇱꽭??',
  footerActions
}: HtmlPreviewModalProps): JSX.Element {
  const normalizedBodyHtml = bodyHtml?.trim() ?? '';
  const footerItems = [
    ...(footerActions ?? []),
    <Button key="close" onClick={onClose}>
      ?リ린
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

