import { useCallback, useRef, useState } from "react";

interface UseLongPressOptions {
  /** Time in ms to trigger long press (default: 500) */
  threshold?: number;
  /** Called when long press is triggered */
  onLongPress: () => void;
  /** Called on regular press/click (not long press) */
  onPress?: () => void;
}

interface UseLongPressReturn {
  /** Whether a long press is currently active */
  isLongPressing: boolean;
  /** Pointer event handlers to spread on the target element */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

/**
 * Hook to detect long press interactions
 * Use for touch-friendly drag initiation patterns
 */
export function useLongPress({
  threshold = 500,
  onLongPress,
  onPress,
}: UseLongPressOptions): UseLongPressReturn {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Prevent default to avoid text selection during long press
      e.preventDefault();
      isLongPressTriggeredRef.current = false;

      timerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        setIsLongPressing(true);
        onLongPress();
      }, threshold);
    },
    [threshold, onLongPress],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      clearTimer();

      if (!isLongPressTriggeredRef.current && onPress) {
        // Was a short press/click
        onPress();
      }

      setIsLongPressing(false);
    },
    [clearTimer, onPress],
  );

  const handlePointerLeave = useCallback(() => {
    clearTimer();
    // Don't reset isLongPressing here - allow drag to continue after leaving element
  }, [clearTimer]);

  const handlePointerCancel = useCallback(() => {
    clearTimer();
    setIsLongPressing(false);
  }, [clearTimer]);

  return {
    isLongPressing,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerLeave,
      onPointerCancel: handlePointerCancel,
    },
  };
}
