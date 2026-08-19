import { Typography } from "antd";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

const { Text, Title } = Typography;

// 쿠폰 유형 선택 카드 — Phase 4 분해로 페이지 모듈에서 이동(동작 동일).
// ripple 애니메이션과 지연 선택 타이머를 카드 내부에서 관리한다.

export type CouponTypeCardProps = {
  title: string;
  description: string;
  onSelect: () => void;
};

export type CouponTypeCardRipple = {
  id: number;
  left: number;
  top: number;
  size: number;
};

export function CouponTypeSelectionCard({
  title,
  description,
  onSelect,
}: CouponTypeCardProps): JSX.Element {
  const rippleTimeoutsRef = useRef<number[]>([]);
  const [ripples, setRipples] = useState<CouponTypeCardRipple[]>([]);

  useEffect(() => {
    return () => {
      rippleTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      rippleTimeoutsRef.current = [];
    };
  }, []);

  const spawnRipple = useCallback(
    (element: HTMLButtonElement, x: number, y: number) => {
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const ripple: CouponTypeCardRipple = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        left: x - size / 2,
        top: y - size / 2,
        size,
      };
      setRipples((prev) => [...prev, ripple]);
      const timeoutId = window.setTimeout(() => {
        setRipples((prev) => prev.filter((item) => item.id !== ripple.id));
        rippleTimeoutsRef.current = rippleTimeoutsRef.current.filter(
          (currentTimeoutId) => currentTimeoutId !== timeoutId,
        );
      }, 420);
      rippleTimeoutsRef.current.push(timeoutId);
    },
    [],
  );

  const scheduleSelect = useCallback(() => {
    const timeoutId = window.setTimeout(() => {
      onSelect();
      rippleTimeoutsRef.current = rippleTimeoutsRef.current.filter(
        (currentTimeoutId) => currentTimeoutId !== timeoutId,
      );
    }, 120);
    rippleTimeoutsRef.current.push(timeoutId);
  }, [onSelect]);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      spawnRipple(
        event.currentTarget,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      scheduleSelect();
    },
    [scheduleSelect, spawnRipple],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      spawnRipple(event.currentTarget, rect.width / 2, rect.height / 2);
      scheduleSelect();
    },
    [scheduleSelect, spawnRipple],
  );

  return (
    <button
      type="button"
      className="commerce-coupon-type-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="commerce-coupon-type-card__ripple-layer" aria-hidden>
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="commerce-coupon-type-card__ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.left,
              top: ripple.top,
            }}
          />
        ))}
      </span>
      <span className="commerce-coupon-type-card__content">
        <Title level={5} style={{ margin: 0 }}>
          {title}
        </Title>
        <Text type="secondary">{description}</Text>
      </span>
    </button>
  );
}
