import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  '\uc815\uc0c1': 'green',
  '\uc815\uc9c0': 'volcano',
  '\ud0c8\ud1f4': 'default',
  '\uac8c\uc2dc': 'green',
  '\uc228\uae40': 'orange',
  '\uc644\ub8cc': 'blue',
  '\ucde8\uc18c': 'default',
  '\ud658\ubd88': 'purple',
  '\ucc98\ub9ac \ub300\uae30': 'gold',
  '\ucc98\ub9ac \uc644\ub8cc': 'blue',
  '\ud65c\uc131': 'green',
  '\ube44\ud65c\uc131': 'default',
  '\uc0ac\uc6a9 \uc911': 'green',
  '\ucd08\uc548': 'gold',
  '\uc131\uacf5': 'green',
  '\ubd80\ubd84 \uc2e4\ud328': 'orange',
  '\uc2e4\ud328': 'volcano',
  '\uc608\uc57d': 'cyan',
  '\ub300\uae30': 'gold',
  '\uc608\uc815': 'gold',
  '\uc9c4\ud589 \uc911': 'blue',
  '\uc885\ub8cc': 'default',
  '\uacf5\uac1c': 'green',
  '\ube44\uacf5\uac1c': 'default',
  '\ub178\ucd9c': 'green',
  '\ubc1c\ud589 \uc911\uc9c0': 'volcano',
  '\ud655\uc778': 'blue',
  '\uacbd\uace0': 'volcano',
  INFO: 'blue',
  WARN: 'gold',
  ERROR: 'volcano',
  active: 'green',
  inactive: 'default',
  live: 'green',
  review: 'gold',
  draft: 'default'
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  return <Tag color={colorMap[status] ?? 'default'}>{status}</Tag>;
}
