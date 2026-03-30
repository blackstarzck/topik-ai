import { Switch } from 'antd';
import type { MouseEvent } from 'react';
import { useCallback } from 'react';

type BinaryStatusSwitchProps = {
  checked: boolean;
  checkedLabel: string;
  uncheckedLabel: string;
  onToggle?: () => void;
  disabled?: boolean;
  stopPropagation?: boolean;
};

export function BinaryStatusSwitch({
  checked,
  checkedLabel,
  uncheckedLabel,
  onToggle,
  disabled,
  stopPropagation
}: BinaryStatusSwitchProps): JSX.Element {
  const resolvedDisabled = disabled ?? !onToggle;
  const shouldStopPropagation = stopPropagation ?? true;

  const handleChange = useCallback(() => {
    onToggle?.();
  }, [onToggle]);

  const handleClick = useCallback((event: MouseEvent<HTMLSpanElement>) => {
    if (shouldStopPropagation) {
      event.stopPropagation();
    }
  }, [shouldStopPropagation]);

  return (
    <span onClick={handleClick}>
      <Switch
        checked={checked}
        checkedChildren={checkedLabel}
        unCheckedChildren={uncheckedLabel}
        disabled={resolvedDisabled}
        onChange={handleChange}
      />
    </span>
  );
}
