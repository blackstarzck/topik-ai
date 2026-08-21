import { Skeleton } from 'antd';
import { useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import type { AsyncStatus } from '../../model/async-state';

type ListSummaryCardItem = {
  key: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

type ListSummaryCardsProps = {
  items: ListSummaryCardItem[];
  className?: string;
  /**
   * 값을 아직 한 번도 받지 못한 상태. 라벨은 그대로 두고 **값·힌트만** 스켈레톤으로 그린다.
   *
   * 이 플래그가 필요한 이유 — 요약 카드는 조회 중에도 계산식을 그대로 그리므로 데이터가
   * 빈 배열인 첫 프레임에 `0건`·`₩0` 을 **정상 수치처럼** 보여줬다(gap-register §3.17.3).
   * 표에는 antd 의 로딩 오버레이가 있는데 카드에는 그런 표현이 없었다.
   *
   * 🚨 갱신 중(직전 데이터가 있는 재조회)에는 `false` 를 넘겨야 한다 — 그때 스켈레톤을
   * 띄우면 이미 맞는 수치가 사라져 화면이 깜빡인다. 판정은 `isInitialSummaryLoad` 를 쓴다.
   */
  loading?: boolean;
};

/**
 * "값을 아직 한 번도 못 받았다"를 판정한다.
 *
 * 저장소에 이미 같은 관용구가 흩어져 있었다(`status === 'pending' && !hasCached` — 표
 * loading 4곳). 요약 카드도 같은 기준을 쓰되 판정을 한 곳에 두어 화면마다 달라지지 않게 한다.
 */
export function isInitialSummaryLoad(status: AsyncStatus, hasData: boolean): boolean {
  return status === 'pending' && !hasData;
}

type SummaryCardRipple = {
  id: number;
  size: number;
  x: number;
  y: number;
};

function InteractiveListSummaryCard({
  item,
  className,
  content
}: {
  item: ListSummaryCardItem;
  className: string;
  content: ReactNode;
}): JSX.Element {
  const [ripples, setRipples] = useState<SummaryCardRipple[]>([]);
  const rippleSequenceRef = useRef(0);

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    const targetRect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(targetRect.width, targetRect.height) * 1.15;
    const isKeyboardTrigger =
      event.detail === 0 || (event.clientX === 0 && event.clientY === 0);
    const x = isKeyboardTrigger
      ? targetRect.width / 2 - size / 2
      : event.clientX - targetRect.left - size / 2;
    const y = isKeyboardTrigger
      ? targetRect.height / 2 - size / 2
      : event.clientY - targetRect.top - size / 2;
    const nextRippleId = rippleSequenceRef.current;

    rippleSequenceRef.current += 1;
    setRipples((currentRipples) => [
      ...currentRipples,
      {
        id: nextRippleId,
        size,
        x,
        y
      }
    ]);
    item.onClick?.();
  };

  const handleRippleAnimationEnd = (rippleId: number): void => {
    setRipples((currentRipples) =>
      currentRipples.filter((ripple) => ripple.id !== rippleId)
    );
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-pressed={item.active}
    >
      <span className="list-summary-card__content">{content}</span>
      <span className="list-summary-card__ripple-layer" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="list-summary-card__ripple"
            style={{
              width: `${ripple.size}px`,
              height: `${ripple.size}px`,
              left: `${ripple.x}px`,
              top: `${ripple.y}px`
            }}
            onAnimationEnd={() => handleRippleAnimationEnd(ripple.id)}
          />
        ))}
      </span>
    </button>
  );
}

export function ListSummaryCards({
  items,
  className,
  loading = false
}: ListSummaryCardsProps): JSX.Element {
  return (
    <div className={['list-summary-cards', className].filter(Boolean).join(' ')}>
      {items.map((item) => {
        const cardClassName = [
          'list-summary-card',
          item.onClick && !loading ? 'list-summary-card--interactive' : null
        ]
          .filter(Boolean)
          .join(' ');

        const content = (
          <>
            <span className="list-summary-card__label">{item.label}</span>
            <span className="list-summary-card__value">
              {loading ? (
                <Skeleton.Input active size="small" style={{ minWidth: 96 }} />
              ) : (
                item.value
              )}
            </span>
            {!loading && item.hint ? (
              <span className="list-summary-card__hint">{item.hint}</span>
            ) : null}
          </>
        );

        // 로딩 중에는 값이 없으니 필터로 쓸 수 없다 — 클릭형 카드도 정적으로 그린다.
        if (!item.onClick || loading) {
          return (
            <div key={item.key} className={cardClassName}>
              <span className="list-summary-card__content">{content}</span>
            </div>
          );
        }

        return (
          <InteractiveListSummaryCard
            key={item.key}
            item={item}
            className={cardClassName}
            content={content}
          />
        );
      })}
    </div>
  );
}
