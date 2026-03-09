import { useEffect, useState } from 'react';

/**
 * Animates from 0 to `target` over `duration` ms when `enabled` is true.
 * Uses requestAnimationFrame for smooth counting.
 */
export function useCountUp(
  target: number,
  options: { duration?: number; enabled?: boolean; decimals?: number } = {}
): number {
  const { duration = 800, enabled = true, decimals = 0 } = options;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const startValue = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      const current = startValue + (target - startValue) * eased;
      setValue(Number(current.toFixed(decimals)));
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration, enabled, decimals]);

  return value;
}
