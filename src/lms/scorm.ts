/**
 * SCORM 1.2 / SCORM 2004 (3rd & 4th edition) runtime wrapper for SedSim.
 *
 * Usage
 * -----
 * 1. Call `scorm.initialize()` once when the page loads.
 * 2. Report learner events via the helper functions below.
 * 3. Call `scorm.terminate()` before the page unloads.
 *
 * The wrapper auto-detects whether it is running inside a SCORM 1.2 or 2004 LMS
 * by probing `window.API` (1.2) then `window.API_1484_11` (2004).
 * If neither is found it operates in a no-op "standalone" mode so the application
 * can run outside an LMS without errors.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScormVersion = '1.2' | '2004' | 'none';

interface ScormAPI {
  Initialize?: (s: string) => string;          // 2004
  LMSInitialize?: (s: string) => string;        // 1.2
  Terminate?: (s: string) => string;            // 2004
  LMSFinish?: (s: string) => string;            // 1.2
  GetValue?: (element: string) => string;       // 2004
  LMSGetValue?: (element: string) => string;    // 1.2
  SetValue?: (element: string, value: string) => string; // 2004
  LMSSetValue?: (element: string, value: string) => string; // 1.2
  Commit?: (s: string) => string;               // 2004
  LMSCommit?: (s: string) => string;            // 1.2
  GetLastError?: () => string;
  LMSGetLastError?: () => string;
}

// ─── SCORM wrapper class ──────────────────────────────────────────────────────

class ScormWrapper {
  private api: ScormAPI | null = null;
  private version: ScormVersion = 'none';
  private initialized = false;
  private startTime: Date | null = null;

  // ── API discovery ──────────────────────────────────────────────────────────

  /** Walk up window.parent chain to find the SCORM API object. */
  private findAPI(win: Window): ScormAPI | null {
    let attempts = 0;
    while (win.parent !== win && attempts < 10) {
      attempts++;
      try {
        if ((win.parent as unknown as Record<string, unknown>)['API_1484_11']) {
          return (win.parent as unknown as Record<string, ScormAPI>)['API_1484_11'];
        }
        if ((win.parent as unknown as Record<string, unknown>)['API']) {
          return (win.parent as unknown as Record<string, ScormAPI>)['API'];
        }
      } catch {
        break; // cross-origin guard
      }
      win = win.parent;
    }
    if ((win as unknown as Record<string, unknown>)['API_1484_11']) {
      return (win as unknown as Record<string, ScormAPI>)['API_1484_11'];
    }
    if ((win as unknown as Record<string, unknown>)['API']) {
      return (win as unknown as Record<string, ScormAPI>)['API'];
    }
    return null;
  }

  /** Detect SCORM version from the discovered API object. */
  private detectVersion(api: ScormAPI): ScormVersion {
    if (typeof api.Initialize === 'function') return '2004';
    if (typeof api.LMSInitialize === 'function') return '1.2';
    return 'none';
  }

  // ── Low-level helpers ──────────────────────────────────────────────────────

  private call(fn: string, ...args: string[]): string {
    if (!this.api) return 'false';
    const func = (this.api as unknown as Record<string, (...a: string[]) => string>)[fn];
    if (typeof func !== 'function') return 'false';
    return func(...args);
  }

  private initFn()     { return this.version === '2004' ? 'Initialize'     : 'LMSInitialize';  }
  private terminateFn(){ return this.version === '2004' ? 'Terminate'       : 'LMSFinish';      }
  private getFn()      { return this.version === '2004' ? 'GetValue'        : 'LMSGetValue';    }
  private setFn()      { return this.version === '2004' ? 'SetValue'        : 'LMSSetValue';    }
  private commitFn()   { return this.version === '2004' ? 'Commit'          : 'LMSCommit';      }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Initialise the SCORM session. Call once on page load. */
  initialize(): boolean {
    if (typeof window === 'undefined') return false;
    this.api = this.findAPI(window);
    if (!this.api) { this.version = 'none'; return false; }
    this.version = this.detectVersion(this.api);
    if (this.version === 'none') return false;

    const result = this.call(this.initFn(), '');
    this.initialized = result === 'true';
    if (this.initialized) {
      this.startTime = new Date();
      // Tell the LMS we are in progress
      this.setStatus('incomplete');
    }
    return this.initialized;
  }

  /** Terminate the SCORM session. Call before page unload. */
  terminate(): boolean {
    if (!this.initialized) return false;
    this.commit();
    const result = this.call(this.terminateFn(), '');
    this.initialized = false;
    return result === 'true';
  }

  /** Read a SCORM data model element. */
  getValue(element: string): string {
    if (!this.initialized) return '';
    return this.call(this.getFn(), element);
  }

  /** Write a SCORM data model element. */
  setValue(element: string, value: string): boolean {
    if (!this.initialized) return false;
    const result = this.call(this.setFn(), element, value);
    return result === 'true';
  }

  /** Persist data to the LMS. */
  commit(): boolean {
    if (!this.initialized) return false;
    return this.call(this.commitFn(), '') === 'true';
  }

  // ── High-level helpers ─────────────────────────────────────────────────────

  /** Report learner status to the LMS. */
  setStatus(status: 'passed' | 'failed' | 'completed' | 'incomplete' | 'not attempted' | 'browsed'): void {
    if (!this.initialized) return;
    if (this.version === '1.2') {
      this.setValue('cmi.core.lesson_status', status);
    } else {
      // SCORM 2004 splits completion and success
      const completionStatus = (status === 'completed' || status === 'passed' || status === 'failed')
        ? 'completed' : 'incomplete';
      const successStatus = status === 'passed' ? 'passed'
        : status === 'failed' ? 'failed' : 'unknown';
      this.setValue('cmi.completion_status', completionStatus);
      this.setValue('cmi.success_status', successStatus);
    }
    this.commit();
  }

  /** Report a numeric score (0-100 range). */
  setScore(raw: number, min = 0, max = 100): void {
    if (!this.initialized) return;
    if (this.version === '1.2') {
      this.setValue('cmi.core.score.raw',   String(raw));
      this.setValue('cmi.core.score.min',   String(min));
      this.setValue('cmi.core.score.max',   String(max));
    } else {
      const scaled = max > 0 ? raw / max : 0;
      this.setValue('cmi.score.raw',    String(raw));
      this.setValue('cmi.score.min',    String(min));
      this.setValue('cmi.score.max',    String(max));
      this.setValue('cmi.score.scaled', String(Math.round(scaled * 100) / 100));
    }
    this.commit();
  }

  /**
   * Report the session time to the LMS.
   * If `elapsedSeconds` is omitted, the elapsed wall-clock time since
   * `initialize()` is used.
   */
  setSessionTime(elapsedSeconds?: number): void {
    if (!this.initialized) return;
    const secs = elapsedSeconds ?? (this.startTime
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0);

    if (this.version === '1.2') {
      // SCORM 1.2 uses "HHHH:MM:SS.SS" format
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      const fmt = `${String(h).padStart(4, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.00`;
      this.setValue('cmi.core.session_time', fmt);
    } else {
      // SCORM 2004 uses ISO 8601 duration
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      let dur = 'PT';
      if (h > 0) dur += `${h}H`;
      if (m > 0) dur += `${m}M`;
      if (s > 0 || (h === 0 && m === 0)) dur += `${s}S`;
      this.setValue('cmi.session_time', dur);
    }
    this.commit();
  }

  /** Store arbitrary suspend data (max 4096 chars in SCORM 1.2). */
  setSuspendData(data: string): void {
    if (!this.initialized) return;
    this.setValue('cmi.suspend_data', data);
    this.commit();
  }

  getSuspendData(): string {
    if (!this.initialized) return '';
    return this.getValue('cmi.suspend_data');
  }

  /** Get learner name from the LMS (useful for xAPI actor building). */
  getLearnerName(): string {
    if (!this.initialized) return '';
    return this.version === '1.2'
      ? this.getValue('cmi.core.student_name')
      : this.getValue('cmi.learner_name');
  }

  /** Get learner ID from the LMS. */
  getLearnerId(): string {
    if (!this.initialized) return '';
    return this.version === '1.2'
      ? this.getValue('cmi.core.student_id')
      : this.getValue('cmi.learner_id');
  }

  /** Which SCORM version was detected (`'1.2'`, `'2004'`, or `'none'`). */
  getVersion(): ScormVersion {
    return this.version;
  }

  /** Whether the wrapper has successfully initialised a SCORM session. */
  isActive(): boolean {
    return this.initialized;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const scorm = new ScormWrapper();
