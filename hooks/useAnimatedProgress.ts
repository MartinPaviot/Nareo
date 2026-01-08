import { useState, useEffect, useRef } from 'react';

/**
 * Hook for animated progress that smoothly transitions between server values
 *
 * Features:
 * - Smoothly animates from current value to target value
 * - Never goes backwards (monotonic increase)
 * - Automatically increments slowly (0.5%/sec) between server updates
 * - Instantly jumps to 100% when complete
 *
 * @param serverProgress - The actual progress from server (0-100)
 * @param isGenerating - Whether generation is in progress
 * @param incrementRate - How much to increment per second when animating (default: 0.5)
 */
export function useAnimatedProgress(
  serverProgress: number,
  isGenerating: boolean,
  incrementRate: number = 0.5
): number {
  const [displayProgress, setDisplayProgress] = useState(0);
  const lastServerProgress = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const lastUpdateTime = useRef<number>(Date.now());

  useEffect(() => {
    // Reset when not generating
    if (!isGenerating) {
      setDisplayProgress(0);
      lastServerProgress.current = 0;
      return;
    }

    // If server progress increased, update our target
    if (serverProgress > lastServerProgress.current) {
      lastServerProgress.current = serverProgress;
      lastUpdateTime.current = Date.now();
    }

    // If complete, jump to 100%
    if (serverProgress >= 100) {
      setDisplayProgress(100);
      return;
    }

    // Animation loop
    const animate = () => {
      const now = Date.now();
      const elapsed = (now - lastUpdateTime.current) / 1000; // seconds

      setDisplayProgress(prev => {
        // Target is the server progress
        const target = lastServerProgress.current;

        // If we're behind the target, catch up quickly
        if (prev < target - 1) {
          // Animate towards target at 2% per frame (smooth catch-up)
          const newValue = prev + Math.min(2, (target - prev) * 0.1);
          return Math.min(newValue, target);
        }

        // If we're near the target, increment slowly to give feeling of progress
        // But never exceed 95% through auto-increment (wait for server to push us higher)
        const maxAutoProgress = Math.min(target + 5, 95);
        const autoIncrement = elapsed * incrementRate;

        if (prev < maxAutoProgress && prev < 95) {
          return Math.min(prev + autoIncrement * 0.016, maxAutoProgress); // 0.016 = approx 60fps
        }

        return prev;
      });

      animationFrame.current = requestAnimationFrame(animate);
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [isGenerating, serverProgress, incrementRate]);

  // Round to 1 decimal place for display
  return Math.round(displayProgress * 10) / 10;
}

/**
 * Simpler version: just smoothly animate to target with slow auto-increment
 */
export function useSmoothedProgress(
  targetProgress: number,
  isActive: boolean
): number {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTargetRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      lastTargetRef.current = 0;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Update target if it increased
    if (targetProgress > lastTargetRef.current) {
      lastTargetRef.current = targetProgress;
    }

    // Complete - jump to 100
    if (targetProgress >= 100) {
      setProgress(100);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start interval if not already running
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          const target = lastTargetRef.current;

          // Quickly catch up if behind
          if (prev < target - 2) {
            return prev + 1;
          }

          // Slowly increment (0.5% per second = 0.025% per 50ms interval)
          // But don't exceed target + 3 or 94% (leave room for server updates)
          const maxAuto = Math.min(target + 3, 94);
          if (prev < maxAuto) {
            return prev + 0.025;
          }

          return prev;
        });
      }, 50); // Update every 50ms for smooth animation
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, targetProgress]);

  // Return with 1 decimal for smoother display
  return Math.round(progress * 10) / 10;
}
