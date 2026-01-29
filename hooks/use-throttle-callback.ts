import { useCallback, useEffect, useRef } from "react";

/**
 * A hook that creates a throttled version of a callback function.
 * Uses refs to ensure the callback always has access to the latest version,
 * avoiding stale closure issues.
 *
 * @param callback - The function to throttle
 * @param delay - The throttle delay in milliseconds
 * @returns A throttled version of the callback
 */
export function useThrottleCallback<Params extends unknown[], Return>(
  callback: (...args: Params) => Return,
  delay: number,
): (...args: Params) => void {
  const lastCall = useRef(0);
  const timeout = useRef<NodeJS.Timeout | null>(null);
  // Store callback in ref to always access latest version
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Params) => {
      const now = Date.now();
      const remainingTime = delay - (now - lastCall.current);

      if (remainingTime <= 0) {
        if (timeout.current) {
          clearTimeout(timeout.current);
          timeout.current = null;
        }
        lastCall.current = now;
        callbackRef.current(...args);
      } else if (!timeout.current) {
        timeout.current = setTimeout(() => {
          lastCall.current = Date.now();
          timeout.current = null;
          callbackRef.current(...args);
        }, remainingTime);
      }
    },
    [delay],
  );
}
