/**
 * usePerformanceObserver
 *
 * Dev-mode hook that uses the PerformanceObserver API to log long tasks
 * (>50 ms) and measure frame timing. Only active when import.meta.env.DEV
 * is true so it compiles out of production bundles entirely.
 *
 * Usage: call once at the app root level.
 */
import { useEffect } from 'react';

export function usePerformanceObserver(): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    // ── Long Task observer ──────────────────────────────────────────────────
    let longTaskObserver: PerformanceObserver | null = null;
    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const durationMs = entry.duration.toFixed(1);
          console.warn(`[SedSim Perf] Long task detected: ${durationMs}ms`, entry);
        }
      });
      try {
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch {
        // Browser may not support longtask
      }
    }

    // ── Paint / Layout Shift observer ───────────────────────────────────────
    let paintObserver: PerformanceObserver | null = null;
    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('paint')) {
      paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.info(`[SedSim Perf] ${entry.name}: ${entry.startTime.toFixed(1)}ms`);
        }
      });
      try {
        paintObserver.observe({ type: 'paint', buffered: true });
      } catch {
        // ignore
      }
    }

    // ── Periodic frame-rate sampler (requestAnimationFrame) ─────────────────
    let rafHandle: number;
    let lastFrameTime = performance.now();
    let slowFrameCount = 0;
    const TARGET_FPS = 60;
    const FRAME_BUDGET_MS = 1000 / TARGET_FPS; // ~16.67 ms

    const measureFrame = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      if (delta > FRAME_BUDGET_MS * 1.5) {
        slowFrameCount++;
        if (slowFrameCount % 10 === 1) {
          console.warn(`[SedSim Perf] Slow frame: ${delta.toFixed(1)}ms (${(1000 / delta).toFixed(0)} fps)`);
        }
      }
      rafHandle = requestAnimationFrame(measureFrame);
    };
    rafHandle = requestAnimationFrame(measureFrame);

    return () => {
      longTaskObserver?.disconnect();
      paintObserver?.disconnect();
      cancelAnimationFrame(rafHandle);
    };
  }, []);
}
