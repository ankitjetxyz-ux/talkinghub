import { useCallback, useRef } from "react";

type Point = { x: number; y: number };

const DEFAULT_THRESHOLD = 72;

/** Detect horizontal swipes on touch devices. */
export function useHorizontalSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = DEFAULT_THRESHOLD,
) {
  const start = useRef<Point | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const origin = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!origin || !t) return;

      const dx = t.clientX - origin.x;
      const dy = t.clientY - origin.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return { onTouchStart, onTouchEnd };
}
