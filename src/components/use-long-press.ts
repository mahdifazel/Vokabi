"use client";

import { useEffect, useRef } from "react";

const LONG_PRESS_MS = 450;
const MOVE_SLOP_PX = 10;

/**
 * Pointer handlers implementing a long press (touch and mouse alike): fires
 * after 450 ms of holding still, gives a short haptic buzz where supported,
 * and suppresses the click that follows the release so the row's normal
 * action doesn't also run. Movement beyond the slop (scrolling) cancels.
 * Spread the returned handlers onto the pressable element.
 */
export function useLongPress(onLongPress: (() => void) | undefined, enabled = true) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const touchRef = useRef(false);
  const suppressClickRef = useRef(false);

  function cancel() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const active = enabled && !!onLongPress;

  return {
    onPointerDown(e: React.PointerEvent) {
      if (!active || e.button !== 0) return;
      touchRef.current = e.pointerType !== "mouse";
      startRef.current = { x: e.clientX, y: e.clientY };
      cancel();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        suppressClickRef.current = true;
        navigator.vibrate?.(15);
        onLongPress?.();
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: React.PointerEvent) {
      if (timerRef.current == null) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture(e: React.MouseEvent) {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onContextMenu(e: React.MouseEvent) {
      if (touchRef.current && active) e.preventDefault();
    },
  };
}
