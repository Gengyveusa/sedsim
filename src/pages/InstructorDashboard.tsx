// src/pages/InstructorDashboard.tsx
// Instructor Dashboard – class roster, analytics, CSV export, scenario assignment

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useInstructorStore, { StudentSession, setLearnerNamePersist, getLearnerName } from '../store/useInstructorStore';
import { INTERACTIVE_SCENARIOS } from '../engine/interactiveScenarios';

// ─── Auth ─────────────────────────────────────────────────────────────────────

const DEFAULT_PIN = 'sedsim2024';
const PIN_STORAGE_KEY = 'sedsim_instructor_pin';

function getStoredPin(): string {
  return localStorage.getItem(PIN_STORAGE_KEY) ?? DEFAULT_PIN;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:     'bg-green-900 text-green-300',
  moderate: 'bg-yellow-900 text-yellow-300',
  hard:     'bg-orange-900 text-orange-300',
  expert:   'bg-red-900 text-red-300',
  bls:      'bg-purple-900 text-purple-300',
};

// ─── Auth Gate ────────────────────────────────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === getStoredPin()) {
      onAuth();
    } else {
      setError('Incorrect instructor code.');
      setPin('');
    }
  }

  return (
    <div className="min-h-screen bg-sim-bg flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-3xl mb-2">🎓</div>
          <h1 className="text-2xl font-bold text-white">Instructor Portal</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your instructor code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); }}
            placeholder="Instructor code"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Enter Dashboard
          </button>
        </form>

        <p className="text-xs text-gray-600 text-center">Default code: sedsim2024</p>
      </div>
    </div>
  );
}

// ─── Analytics computations ───────────────────────────────────────────────────

interface ScenarioStats {
  id: string;
  title: string;
  difficulty: string;
  attempts: number;
  avgDuration: number;
  avgDrugs: number;
  avgAlerts: number;
  avgMinSpo2: number;
  avgMaxMoass: number;
  uniqueStudents: number;
}

function computeScenarioStats(sessions: StudentSession[]): ScenarioStats[] {
  const byScenario = new Map<string, StudentSession[]>();
  for (const s of sessions) {
    const arr = byScenario.get(s.scenarioId) ?? [];
    arr.push(s);
    byScenario.set(s.scenarioId, arr);
  }

  // Also include scenarios with 0 attempts from the known scenario list
  const allScenarioIds = new Set([
    ...INTERACTIVE_SCENARIOS.map(sc => sc.id),
    ...byScenario.keys(),
  ]);

  const stats: ScenarioStats[] = [];
  for (const id of allScenarioIds) {
    const rows = byScenario.get(id) ?? [];
    const scenarioMeta = INTERACTIVE_SCENARIOS.find(sc => sc.id === id);
    const title = rows[0]?.scenarioTitle ?? scenarioMeta?.title ?? id;
    const difficulty = rows[0]?.difficulty ?? scenarioMeta?.difficulty ?? 'unknown';

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    stats.push({
      id,
      title,
      difficulty,
      attempts: rows.length,
      avgDuration:  avg(rows.map(r => r.durationSeconds)),
      avgDrugs:     avg(rows.map(r => r.drugsAdministeredCount)),
      avgAlerts:    avg(rows.map(r => r.alertsTriggered)),
      avgMinSpo2:   avg(rows.map(r => r.minSpo2)),
      avgMaxMoass:  avg(rows.map(r => r.maxMoass)),
      uniqueStudents: new Set(rows.map(r => r.studentName)).size,
    });
  }

  return stats.sort((a, b) => b.attempts - a.attempts);
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-1">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'roster' | 'analytics' | 'assign';

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function InstructorDashboard() {
  const navigate                    = useNavigate();
  const [authed, setAuthed]         = useState(false);
  const [tab, setTab]               = useState<Tab>('overview');
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [newPin, setNewPin]         = useState('');
  const [pinMsg, setPinMsg]         = useState('');
  const [learnerNameInput, setLearnerNameInput] = useState(() => getLearnerName());
  const [learnerNameSaved, setLearnerNameSaved] = useState(false);
  const [sortField, setSortField]   = useState<keyof StudentSession>('completedAt');
  const [sortAsc, setSortAsc]       = useState(false);
  const [filterScenario, setFilterScenario] = useState('all');
  const [filterStudent, setFilterStudent]   = useState('');
  const [confirmClear, setConfirmClear]     = useState(false);

  const { sessions, deleteSession, clearSessions, exportCSV } = useInstructorStore();

  // ── Derived data ────────────────────────────────────────────────────────────
  const scenarioStats = useMemo(() => computeScenarioStats(sessions), [sessions]);

  const uniqueStudents = useMemo(
    () => Array.from(new Set(sessions.map(s => s.studentName))).sort(),
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    let rows = [...sessions];
    if (filterScenario !== 'all') rows = rows.filter(s => s.scenarioId === filterScenario);
    if (filterStudent.trim()) rows = rows.filter(s =>
      s.studentName.toLowerCase().includes(filterStudent.toLowerCase())
    );
    rows.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [sessions, filterScenario, filterStudent, sortField, sortAsc]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleExportCSV() {
    const csv  = exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sedsim_class_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSavePin() {
    if (newPin.length < 4) { setPinMsg('Code must be at least 4 characters.'); return; }
    localStorage.setItem(PIN_STORAGE_KEY, newPin);
    setPinMsg('Instructor code updated ✓');
    setNewPin('');
    setTimeout(() => { setPinMsg(''); setPinChangeOpen(false); }, 2000);
  }

  function handleSaveLearnerName() {
    setLearnerNamePersist(learnerNameInput);
    setLearnerNameSaved(true);
    setTimeout(() => setLearnerNameSaved(false), 2000);
  }

  function toggleSort(field: keyof StudentSession) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  }

  function SortIcon({ field }: { field: keyof StudentSession }) {
    if (sortField !== field) return <span className="text-gray-600 ml-1">⇅</span>;
    return <span className="text-blue-400 ml-1">{sortAsc ? '↑' : '↓'}</span>;
  }

  // ── Auth gate ────────────────────────────────────────────────────────────────

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;

  // ── Dashboard ────────────────────────────────────────────────────────────────

  const totalCompletions = sessions.length;
  const avgSpo2 = sessions.length
    ? (sessions.reduce((a, s) => a + s.minSpo2, 0) / sessions.length).toFixed(1)
    : '—';
  const avgAlerts = sessions.length
    ? (sessions.reduce((a, s) => a + s.alertsTriggered, 0) / sessions.length).toFixed(1)
    : '—';

  return (
    <div className="min-h-screen bg-sim-bg text-white">
      {/* Header */}
      <div className="bg-sim-panel border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-white">🎓 Instructor Dashboard</h1>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
            {uniqueStudents.length} student{uniqueStudents.length !== 1 ? 's' : ''} · {totalCompletions} session{totalCompletions !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={sessions.length === 0}
            className="text-sm px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={() => setPinChangeOpen(!pinChangeOpen)}
            className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Settings popover */}
      {pinChangeOpen && (
        <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {/* Change PIN */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Change Instructor Code</h3>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPin}
                  onChange={e => { setNewPin(e.target.value); setPinMsg(''); }}
                  placeholder="New code (min 4 chars)"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSavePin}
                  className="text-sm px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  Save
                </button>
              </div>
              {pinMsg && <p className="text-xs text-green-400">{pinMsg}</p>}
            </div>

            {/* Learner name (shown in sim) */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Learner Name{' '}
                <span className="text-gray-500 font-normal">(used when recording sessions)</span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={learnerNameInput}
                  onChange={e => { setLearnerNameInput(e.target.value); setLearnerNameSaved(false); }}
                  placeholder="e.g. Student A"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSaveLearnerName}
                  className="text-sm px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  Save
                </button>
              </div>
              {learnerNameSaved && (
                <p className="text-xs text-green-400">Name saved ✓ (used in next session)</p>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="border-t border-gray-700 pt-3">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                🗑 Clear all session data…
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-400">Delete all {sessions.length} sessions?</span>
                <button
                  onClick={() => { clearSessions(); setConfirmClear(false); }}
                  className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 rounded transition-colors"
                >
                  Yes, delete all
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-sim-panel border-b border-gray-700 px-6 flex gap-1">
        {(['overview', 'roster', 'analytics', 'assign'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'overview' ? '📊 Overview'
              : t === 'roster' ? '👥 Roster'
              : t === 'analytics' ? '📈 Analytics'
              : '📋 Assign'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* ── Overview ─────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Sessions" value={totalCompletions} />
              <StatCard label="Unique Students" value={uniqueStudents.length} />
              <StatCard label="Avg Min SpO₂" value={`${avgSpo2}%`} sub="lower = more critical events" />
              <StatCard label="Avg Alerts / Session" value={avgAlerts} sub="proxy for errors/interventions needed" />
            </div>

            {/* Scenario completion bar chart */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Scenario Completion Counts</h2>
              {scenarioStats.filter(s => s.attempts > 0).length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No sessions recorded yet. Have students run scenarios in the simulator.
                </p>
              ) : (
                <div className="space-y-2">
                  {scenarioStats.filter(s => s.attempts > 0).map(sc => (
                    <div key={sc.id} className="flex items-center gap-3">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold w-16 text-center flex-shrink-0 ${DIFFICULTY_COLORS[sc.difficulty] ?? 'bg-gray-700 text-gray-300'}`}>
                        {sc.difficulty.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-300 flex-1 truncate">{sc.title}</span>
                      <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(
                              (sc.attempts / Math.max(...scenarioStats.map(x => x.attempts), 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{sc.attempts}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent sessions */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Recent Sessions</h2>
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">No sessions recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...sessions]
                    .sort((a, b) => b.completedAt - a.completedAt)
                    .slice(0, 5)
                    .map(s => (
                      <div key={s.id} className="flex items-center gap-4 py-2 border-b border-gray-800 last:border-0">
                        <span className="text-xs text-gray-300 font-medium w-28 truncate">{s.studentName}</span>
                        <span className="text-xs text-gray-400 flex-1 truncate">{s.scenarioTitle}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${DIFFICULTY_COLORS[s.difficulty] ?? 'bg-gray-700 text-gray-300'}`}>
                          {s.difficulty.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 w-28 text-right">{formatDate(s.completedAt)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Roster ───────────────────────────────────────────────────── */}
        {tab === 'roster' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                value={filterStudent}
                onChange={e => setFilterStudent(e.target.value)}
                placeholder="Filter by student name…"
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-56"
              />
              <select
                value={filterScenario}
                onChange={e => setFilterScenario(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Scenarios</option>
                {INTERACTIVE_SCENARIOS.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.title}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                  <tr>
                    {(
                      [
                        ['studentName',            'Student'],
                        ['scenarioTitle',           'Scenario'],
                        ['difficulty',              'Difficulty'],
                        ['completedAt',             'Completed'],
                        ['durationSeconds',         'Duration'],
                        ['drugsAdministeredCount',  'Drugs'],
                        ['interventionsApplied',    'Interv.'],
                        ['alertsTriggered',         'Alerts'],
                        ['minSpo2',                 'Min SpO₂'],
                        ['maxMoass',                'Max MOASS'],
                      ] as [keyof StudentSession, string][]
                    ).map(([field, label]) => (
                      <th
                        key={field}
                        className="px-3 py-3 text-left cursor-pointer hover:text-white whitespace-nowrap"
                        onClick={() => toggleSort(field)}
                      >
                        {label}<SortIcon field={field} />
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                        No sessions found
                      </td>
                    </tr>
                  ) : filteredSessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-3 py-3 text-white font-medium">{s.studentName}</td>
                      <td className="px-3 py-3 text-gray-300 max-w-xs truncate">{s.scenarioTitle}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${DIFFICULTY_COLORS[s.difficulty] ?? 'bg-gray-700 text-gray-300'}`}>
                          {s.difficulty.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{formatDate(s.completedAt)}</td>
                      <td className="px-3 py-3 text-gray-400">{formatDuration(s.durationSeconds)}</td>
                      <td className="px-3 py-3 text-gray-400">{s.drugsAdministeredCount}</td>
                      <td className="px-3 py-3 text-gray-400">{s.interventionsApplied}</td>
                      <td className="px-3 py-3">
                        <span className={
                          s.alertsTriggered > 3 ? 'text-red-400'
                          : s.alertsTriggered > 1 ? 'text-yellow-400'
                          : 'text-gray-400'
                        }>
                          {s.alertsTriggered}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={
                          s.minSpo2 < 90 ? 'text-red-400 font-semibold'
                          : s.minSpo2 < 95 ? 'text-yellow-400'
                          : 'text-green-400'
                        }>
                          {s.minSpo2.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400">{s.maxMoass}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Export row */}
            {sessions.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleExportCSV}
                  className="text-sm px-4 py-2 bg-green-700 hover:bg-green-600 rounded transition-colors"
                >
                  ⬇ Export Filtered as CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Analytics ────────────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            {sessions.length === 0 ? (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center text-gray-500">
                No session data available yet. Sessions are recorded automatically when students complete scenarios.
              </div>
            ) : (
              <>
                {/* Per-scenario stats table */}
                <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-700">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wide">Aggregate Analytics by Scenario</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Averages across all recorded sessions. Min SpO₂ &lt; 90% indicates a desaturation event.
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-3 text-left">Scenario</th>
                        <th className="px-3 py-3 text-left">Difficulty</th>
                        <th className="px-3 py-3 text-right">Attempts</th>
                        <th className="px-3 py-3 text-right">Students</th>
                        <th className="px-3 py-3 text-right">Avg Duration</th>
                        <th className="px-3 py-3 text-right">Avg Drugs</th>
                        <th className="px-3 py-3 text-right">Avg Alerts</th>
                        <th className="px-3 py-3 text-right">Avg Min SpO₂</th>
                        <th className="px-3 py-3 text-right">Avg Max MOASS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {scenarioStats.filter(s => s.attempts > 0).map(sc => (
                        <tr key={sc.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-3 py-3 text-gray-300 max-w-xs truncate">{sc.title}</td>
                          <td className="px-3 py-3">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${DIFFICULTY_COLORS[sc.difficulty] ?? 'bg-gray-700 text-gray-300'}`}>
                              {sc.difficulty.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-white font-semibold">{sc.attempts}</td>
                          <td className="px-3 py-3 text-right text-gray-400">{sc.uniqueStudents}</td>
                          <td className="px-3 py-3 text-right text-gray-400">{formatDuration(Math.round(sc.avgDuration))}</td>
                          <td className="px-3 py-3 text-right text-gray-400">{sc.avgDrugs.toFixed(1)}</td>
                          <td className="px-3 py-3 text-right">
                            <span className={
                              sc.avgAlerts > 3 ? 'text-red-400'
                              : sc.avgAlerts > 1 ? 'text-yellow-400'
                              : 'text-gray-400'
                            }>
                              {sc.avgAlerts.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={
                              sc.avgMinSpo2 < 90 ? 'text-red-400 font-semibold'
                              : sc.avgMinSpo2 < 95 ? 'text-yellow-400'
                              : 'text-green-400'
                            }>
                              {sc.avgMinSpo2.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-400">{sc.avgMaxMoass.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Per-student summary */}
                <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-700">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wide">Student Progress</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-3 text-left">Student</th>
                        <th className="px-3 py-3 text-right">Sessions</th>
                        <th className="px-3 py-3 text-right">Easy</th>
                        <th className="px-3 py-3 text-right">Moderate</th>
                        <th className="px-3 py-3 text-right">Hard</th>
                        <th className="px-3 py-3 text-right">Expert</th>
                        <th className="px-3 py-3 text-right">Avg Alerts</th>
                        <th className="px-3 py-3 text-right">Best Min SpO₂</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {uniqueStudents.map(name => {
                        const rows = sessions.filter(s => s.studentName === name);
                        const byDiff = (d: string) => rows.filter(r => r.difficulty === d).length;
                        const avgAl = rows.reduce((a, r) => a + r.alertsTriggered, 0) / rows.length;
                        const bestSpo2 = Math.max(...rows.map(r => r.minSpo2));
                        return (
                          <tr key={name} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-3 py-3 text-white font-medium">{name}</td>
                            <td className="px-3 py-3 text-right text-gray-400">{rows.length}</td>
                            <td className="px-3 py-3 text-right text-green-400">{byDiff('easy')}</td>
                            <td className="px-3 py-3 text-right text-yellow-400">{byDiff('moderate')}</td>
                            <td className="px-3 py-3 text-right text-orange-400">{byDiff('hard')}</td>
                            <td className="px-3 py-3 text-right text-red-400">{byDiff('expert')}</td>
                            <td className="px-3 py-3 text-right">
                              <span className={
                                avgAl > 3 ? 'text-red-400'
                                : avgAl > 1 ? 'text-yellow-400'
                                : 'text-gray-400'
                              }>
                                {avgAl.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className={
                                bestSpo2 < 90 ? 'text-red-400'
                                : bestSpo2 < 95 ? 'text-yellow-400'
                                : 'text-green-400'
                              }>
                                {bestSpo2.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Assign ───────────────────────────────────────────────────── */}
        {tab === 'assign' && <AssignTab />}
      </div>
    </div>
  );
}

// ─── Assign Tab ───────────────────────────────────────────────────────────────

const ASSIGN_KEY = 'sedsim_scenario_assignments';

interface Assignment {
  group: string;
  scenarioIds: string[];
}

function loadAssignments(): Assignment[] {
  try { return JSON.parse(localStorage.getItem(ASSIGN_KEY) ?? '[]') as Assignment[]; }
  catch { return []; }
}

function saveAssignments(a: Assignment[]): void {
  try { localStorage.setItem(ASSIGN_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

function AssignTab() {
  const [assignments, setAssignments] = useState<Assignment[]>(() => loadAssignments());
  const [newGroup, setNewGroup]       = useState('');
  const [addMsg, setAddMsg]           = useState('');

  function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    if (assignments.some(a => a.group === name)) { setAddMsg('Group already exists.'); return; }
    const updated = [...assignments, { group: name, scenarioIds: [] }];
    setAssignments(updated);
    saveAssignments(updated);
    setNewGroup('');
    setAddMsg('');
  }

  function removeGroup(group: string) {
    const updated = assignments.filter(a => a.group !== group);
    setAssignments(updated);
    saveAssignments(updated);
  }

  function toggleScenario(group: string, scenarioId: string) {
    const updated = assignments.map(a => {
      if (a.group !== group) return a;
      const ids = a.scenarioIds.includes(scenarioId)
        ? a.scenarioIds.filter(id => id !== scenarioId)
        : [...a.scenarioIds, scenarioId];
      return { ...a, scenarioIds: ids };
    });
    setAssignments(updated);
    saveAssignments(updated);
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 text-sm text-blue-300">
        <strong>How it works:</strong> Create student groups and assign scenarios to each group.
        Share the group name with students so they know which scenarios to complete.
        Session completions are tracked per student name in the Roster tab.
      </div>

      {/* Add group */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={newGroup}
          onChange={e => { setNewGroup(e.target.value); setAddMsg(''); }}
          onKeyDown={e => e.key === 'Enter' && addGroup()}
          placeholder="New group name (e.g. Group A, Week 1)"
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-72"
        />
        <button
          onClick={addGroup}
          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          + Add Group
        </button>
        {addMsg && <span className="text-xs text-red-400">{addMsg}</span>}
      </div>

      {/* Groups */}
      {assignments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 text-center text-gray-500">
          No groups yet. Create a group above to start assigning scenarios.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(a => (
            <div key={a.group} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">{a.group}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {a.scenarioIds.length} scenario{a.scenarioIds.length !== 1 ? 's' : ''} assigned
                  </span>
                  <button
                    onClick={() => removeGroup(a.group)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove group
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {INTERACTIVE_SCENARIOS.map(sc => {
                  const assigned = a.scenarioIds.includes(sc.id);
                  return (
                    <label
                      key={sc.id}
                      className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        assigned
                          ? 'bg-blue-900/40 border border-blue-700/50'
                          : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() => toggleScenario(a.group, sc.id)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate">{sc.title}</p>
                        <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${DIFFICULTY_COLORS[sc.difficulty] ?? 'bg-gray-700 text-gray-300'}`}>
                          {sc.difficulty.toUpperCase()}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
