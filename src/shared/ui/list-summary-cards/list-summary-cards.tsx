import { useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

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
};

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
  className
}: ListSummaryCardsProps): JSX.Element {
  return (
    <div className={['list-summary-cards', className].filter(Boolean).join(' ')}>
      {items.map((item) => {
        const cardClassName = [
          'list-summary-card',
          item.onClick ? 'list-summary-card--interactive' : null
        ]
          .filter(Boolean)
          .join(' ');

        const content = (
          <>
            <span className="list-summary-card__label">{item.label}</span>
            <span className="list-summary-card__value">{item.value}</span>
            {item.hint ? (
              <span className="list-summary-card__hint">{item.hint}</span>
            ) : null}
          </>
        );

        if (!item.onClick) {
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
