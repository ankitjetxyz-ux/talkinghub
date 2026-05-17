import { useCallback, useRef } from "react";

const DEFAULT_DELAY_MS = 480;
const MOVE_CANCEL_PX = 12;

export function useLongPress(
  onLongPress: () => void,
  options?: { delayMs?: number; disabled?: boolean },
) {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const disabled = options?.disabled ?? false;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFireRef = useRef(false);
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    clearTimer();
    didFireRef.current = false;
    timerRef.current = setTimeout(() => {
      didFireRef.current = true;
      onLongPress();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, delayMs);
  }, [clearTimer, delayMs, disabled, onLongPress]);

  const cancel = useCallback(() => {
    clearTimer();
    touchOriginRef.current = null;
  }, [clearTimer]);

  const swallowClickIfLongPress = useCallback((e: React.MouseEvent) => {
    if (!didFireRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    didFireRef.current = false;
  }, []);

  return {
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      start();
    },
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchOriginRef.current = { x: t.clientX, y: t.clientY };
      start();
    },
    onTouchEnd: cancel,
    onTouchMove: (e: React.TouchEvent) => {
      const origin = touchOriginRef.current;
      const t = e.touches[0];
      if (!origin || !t) return;
      const dx = t.clientX - origin.x;
      const dy = t.clientY - origin.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancel();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    onClick: swallowClickIfLongPress,
  };
}
