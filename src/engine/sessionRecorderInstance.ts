/**
 * sessionRecorderInstance.ts
 *
 * Singleton SessionRecorder instance for use across the application.
 * Import this where you need to record or query the session recorder.
 *
 * NOTE: This file MUST NOT import React. Engine files are pure TypeScript.
 */

import { SessionRecorder } from './sessionRecorder';

export const sessionRecorderInstance = new SessionRecorder();
