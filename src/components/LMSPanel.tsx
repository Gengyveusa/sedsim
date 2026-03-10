/**
 * LMSPanel – collapsible side-drawer for LMS / xAPI / SCORM configuration.
 *
 * Layout mirrors the existing LearningPanel & TrendGraph collapsible drawers.
 */

import { useState } from 'react';
import useLMSStore from '../store/useLMSStore';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'idle' | 'testing' | 'ok' | 'error' }) {
  const map = {
    idle:    { color: 'text-gray-400',  dot: 'bg-gray-500',  label: 'Not tested' },
    testing: { color: 'text-yellow-300', dot: 'bg-yellow-400 animate-pulse', label: 'Testing…'   },
    ok:      { color: 'text-green-400', dot: 'bg-green-400',  label: 'Connected'  },
    error:   { color: 'text-red-400',   dot: 'bg-red-500',    label: 'Error'      },
  };
  const { color, dot, label } = map[status];
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function LMSPanelContent() {
  const {
    config,
    connectionStatus,
    connectionError,
    sentCount,
    pendingStatements,
    setEnabled,
    setLRSConfig,
    setActor,
    setScormEnabled,
    testConnection,
  } = useLMSStore();

  const { lrsConfig, actor } = config;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2 space-y-3 text-xs">

      {/* ── Enable toggle ── */}
      <div className="flex items-center justify-between bg-gray-800/60 rounded p-2">
        <span className="text-gray-300 font-semibold">LMS Integration</span>
        <button
          onClick={() => setEnabled(!config.enabled)}
          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
            config.enabled
              ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {config.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* ── SCORM status ── */}
      <div className="bg-gray-800/40 rounded p-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 uppercase tracking-wider text-[10px]">SCORM</span>
          <span className={`text-[10px] font-semibold ${
            config.scormVersion !== 'none' ? 'text-green-400' : 'text-gray-500'
          }`}>
            {config.scormVersion !== 'none' ? `v${config.scormVersion} active` : 'Not detected'}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.scormEnabled}
            onChange={e => setScormEnabled(e.target.checked)}
            className="accent-cyan-500"
          />
          <span className="text-gray-400">Auto-detect SCORM on load</span>
        </label>
        <p className="text-gray-500 text-[10px] leading-relaxed">
          If running inside a SCORM-compatible LMS (Canvas, Moodle, Blackboard) the wrapper
          initialises automatically and reports scores &amp; completion to the gradebook.
        </p>
      </div>

      {/* ── xAPI / LRS config ── */}
      <div className="space-y-2">
        <span className="text-gray-400 uppercase tracking-wider text-[10px]">xAPI / LRS</span>

        <div>
          <label className="block text-gray-400 mb-0.5">Endpoint URL</label>
          <input
            type="url"
            value={lrsConfig.endpoint}
            onChange={e => setLRSConfig({ endpoint: e.target.value })}
            placeholder="https://lrs.example.com/xapi"
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="block text-gray-400 mb-0.5">Auth type</label>
          <select
            value={lrsConfig.authType}
            onChange={e => {
            const v = e.target.value;
            if (v === 'none' || v === 'basic' || v === 'bearer') {
              setLRSConfig({ authType: v });
            }
          }}
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="none">None</option>
            <option value="basic">Basic (username / password)</option>
            <option value="bearer">Bearer token</option>
          </select>
        </div>

        {lrsConfig.authType === 'basic' && (
          <>
            <div>
              <label className="block text-gray-400 mb-0.5">Username</label>
              <input
                type="text"
                value={lrsConfig.username ?? ''}
                onChange={e => setLRSConfig({ username: e.target.value })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-0.5">Password</label>
              <input
                type="password"
                value={lrsConfig.password ?? ''}
                onChange={e => setLRSConfig({ password: e.target.value })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </>
        )}

        {lrsConfig.authType === 'bearer' && (
          <div>
            <label className="block text-gray-400 mb-0.5">Bearer token</label>
            <input
              type="password"
              value={lrsConfig.token ?? ''}
              onChange={e => setLRSConfig({ token: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => void testConnection()}
            disabled={!lrsConfig.endpoint || connectionStatus === 'testing'}
            className="flex-1 px-2 py-1 bg-cyan-800 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-colors"
          >
            Test connection
          </button>
          <StatusBadge status={connectionStatus} />
        </div>
        {connectionError && (
          <p className="text-red-400 text-[10px]">{connectionError}</p>
        )}
      </div>

      {/* ── Actor ── */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-gray-500 hover:text-gray-300 text-[10px] underline w-full text-left"
        >
          {showAdvanced ? '▲ Hide' : '▼ Show'} learner identity (xAPI actor)
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-gray-400 mb-0.5">Name</label>
              <input
                type="text"
                value={actor.name}
                onChange={e => setActor({ name: e.target.value })}
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-0.5">Email (mbox)</label>
              <input
                type="email"
                value={actor.mbox.replace(/^mailto:/, '')}
                onChange={e => setActor({ mbox: `mailto:${e.target.value}` })}
                placeholder="learner@institution.edu"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Session stats ── */}
      {config.enabled && (
        <div className="bg-gray-800/40 rounded p-2 space-y-1">
          <span className="text-gray-400 uppercase tracking-wider text-[10px]">Session</span>
          <div className="flex justify-between text-gray-300">
            <span>Statements sent</span>
            <span className="text-green-400 font-mono">{sentCount}</span>
          </div>
          {pendingStatements.length > 0 && (
            <div className="flex justify-between text-yellow-400">
              <span>Pending (queued)</span>
              <span className="font-mono">{pendingStatements.length}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Info ── */}
      <div className="text-gray-600 text-[10px] leading-relaxed border-t border-gray-700 pt-2">
        <p className="mb-1">
          <strong className="text-gray-500">xAPI verbs sent:</strong>{' '}
          attempted · completed · scored · administered-drug · applied-intervention
        </p>
        <p>
          Compatible with Canvas, Moodle, Blackboard and any xAPI 1.0.3 / SCORM 1.2 / SCORM 2004 LMS.
        </p>
      </div>
    </div>
  );
}

// ─── LRSConfig type re-export for inline cast ──────────────────────────────────

import type { LRSConfig } from '../lms/xapiClient';

// ─── Main export ──────────────────────────────────────────────────────────────

export default function LMSPanel() {
  const [expanded, setExpanded] = useState(false);
  const { config } = useLMSStore();

  return (
    <div
      className={`transition-all duration-300 ease-in-out border-l border-gray-700 overflow-hidden flex flex-col ${
        expanded ? 'w-72' : 'w-10'
      }`}
    >
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="h-full w-10 flex items-center justify-center bg-gray-800/60 hover:bg-gray-700/80 transition-colors group"
          title="LMS Integration settings"
        >
          <span
            className={`text-xs whitespace-nowrap tracking-wider uppercase ${
              config.enabled ? 'text-cyan-400 group-hover:text-cyan-300' : 'text-gray-400 group-hover:text-cyan-400'
            }`}
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            LMS
          </span>
        </button>
      )}

      {expanded && (
        <div className="flex flex-col h-full bg-sim-panel">
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                LMS / xAPI / SCORM
              </span>
              {config.enabled && (
                <span className="text-[9px] bg-cyan-800 text-cyan-200 px-1 rounded">ON</span>
              )}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-white text-sm px-1"
              title="Collapse LMS Panel"
            >
              &raquo;
            </button>
          </div>
          <LMSPanelContent />
        </div>
      )}
    </div>
  );
}
