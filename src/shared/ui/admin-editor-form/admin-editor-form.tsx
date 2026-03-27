import { Steps, Typography } from "antd";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

export type AdminEditorStepItem = {
  title: string;
  description: string;
};

type AdminEditorFormProps = {
  stepAriaLabel: string;
  currentStep: number;
  items: AdminEditorStepItem[];
  onStepChange: (nextStep: number) => void;
  children: ReactNode;
};

type AdminEditorFormSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminEditorForm({
  stepAriaLabel,
  currentStep,
  items,
  onStepChange,
  children,
}: AdminEditorFormProps): JSX.Element {
  return (
    <div className="admin-editor-form-shell">
      <aside className="admin-editor-form-steps" aria-label={stepAriaLabel}>
        <Steps
          current={currentStep}
          direction="vertical"
          progressDot
          items={items}
          onChange={onStepChange}
        />
      </aside>
      <div className="admin-editor-form-layout">{children}</div>
    </div>
  );
}

export function AdminEditorFormSection({
  title,
  description,
  children,
}: AdminEditorFormSectionProps): JSX.Element {
  return (
    <section className="admin-editor-form-section">
      <div className="admin-editor-form-section__header">
        <Title level={5} className="admin-editor-form-section__title">
          {title}
        </Title>
        <Text className="admin-editor-form-section__description">
          {description}
        </Text>
      </div>
      <div className="admin-editor-form-section__content">{children}</div>
    </section>
  );
}
