import { Vitals, MOASSLevel, Patient } from '../types';

interface PhysiologyAvatarProps {
  vitals: Vitals;
  moass: MOASSLevel;
  combinedEff: number;
  patient: Patient;
  size?: number;
}

// Derive cardiovascular physiology from vitals
function computeCardioState(vitals: Vitals, _patient: Patient, combinedEff: number) {
  const hr = vitals.hr;
  const map = vitals.map;
  const _sbp = vitals.sbp;
  const spo2 = vitals.spo2;
  const rr = vitals.rr;

  // Stroke volume estimate (simplified Liljestrand-Zander)
  const pulsePressure = vitals.sbp - vitals.dbp;
  const sv = Math.max(20, Math.min(120, pulsePressure * 1.2)); // mL
  const co = (hr * sv) / 1000; // L/min

  // Ejection fraction estimate from CO and HR
  const edv = sv / Math.max(0.2, (0.65 - combinedEff * 0.15)); // end-diastolic volume
  const ef = Math.max(0.15, Math.min(0.75, sv / edv));

  // Preload estimate (CVP proxy from JVP)
  const preload = map < 60 ? 0.3 : map < 70 ? 0.5 : map > 100 ? 0.9 : 0.7;

  // Afterload (SVR proxy)
  const svr = (map * 80) / Math.max(0.5, co); // dynes
  const afterload = Math.min(1, Math.max(0, (svr - 600) / 1800));

  // Heart state classification
  let heartState: 'normal' | 'hyperdynamic' | 'failure' | 'dilated' = 'normal';
  if (co > 7 && hr > 100) heartState = 'hyperdynamic';
  else if (ef < 0.35 || (map < 60 && hr > 100)) heartState = 'failure';
  else if (ef < 0.45 && co < 3.5) heartState = 'dilated';

  // Chamber sizes (scale factors)
  const rvDilation = heartState === 'dilated' || heartState === 'failure' ? 1.3 : 1.0;
  const lvDilation = heartState === 'dilated' ? 1.4 : heartState === 'failure' ? 1.35 : 1.0;
  const wallThickness = heartState === 'failure' ? 0.7 : afterload > 0.7 ? 1.4 : 1.0; // hypertrophy

  // Pulmonary capillary wedge pressure estimate
  // Normal 6-12 mmHg, elevated in LV failure
  let pcwp = 8;
  if (heartState === 'failure') pcwp = 22 + (1 - ef) * 20;
  else if (heartState === 'dilated') pcwp = 16;
  else if (map > 110) pcwp = 14;
  else if (combinedEff > 0.5) pcwp = 6;

  // Pulmonary edema state
  let pulmonaryEdema: 'none' | 'mild' | 'moderate' | 'flash' = 'none';
  if (pcwp > 25) pulmonaryEdema = 'flash';
  else if (pcwp > 20) pulmonaryEdema = 'moderate';
  else if (pcwp > 16) pulmonaryEdema = 'mild';

  // Cerebral blood flow (autoregulation)
  // CBF normally autoregulated MAP 60-150
  let cbf = 1.0; // normalized
  if (map < 50) cbf = 0.3;
  else if (map < 60) cbf = 0.5 + (map - 50) * 0.05;
  else if (map > 150) cbf = 1.2;
  else cbf = 1.0;
  // Sedation reduces CBF
  cbf *= (1 - combinedEff * 0.3);
  // Hypoxia increases CBF
  if (spo2 < 90) cbf *= 1.3;

  return {
    hr, co, sv, ef, preload, afterload, heartState,
    rvDilation, lvDilation, wallThickness,
    pcwp, pulmonaryEdema, cbf, map, spo2, rr, pulsePressure, svr
  };
}

export default function PhysiologyAvatar({ vitals, moass: _moass, combinedEff, patient, size = 560 }: PhysiologyAvatarProps) {
  const cs = computeCardioState(vitals, patient, combinedEff);
  const cx = size / 2;
  const cy = size / 2;
  const beatDur = cs.hr > 0 ? 60 / cs.hr : 0;

  // Colors based on state
  const heartColor = cs.heartState === 'failure' ? '#dc2626'
    : cs.heartState === 'hyperdynamic' ? '#f59e0b'
    : cs.heartState === 'dilated' ? '#f97316' : '#ef4444';

  const lungColor = cs.pulmonaryEdema === 'flash' ? '#3b82f6'
    : cs.pulmonaryEdema === 'moderate' ? '#60a5fa'
    : cs.pulmonaryEdema === 'mild' ? '#93c5fd' : 'rgba(147,197,253,0.3)';

  const brainColor = cs.cbf > 0.8 ? '#a78bfa'
    : cs.cbf > 0.5 ? '#f59e0b' : '#ef4444';

  const edemaOpacity = cs.pulmonaryEdema === 'flash' ? 0.8
    : cs.pulmonaryEdema === 'moderate' ? 0.5
    : cs.pulmonaryEdema === 'mild' ? 0.3 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="av-glow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="av-pulse">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="deoxyBlood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7f1d1d" />
          <stop offset="100%" stopColor="#450a0a" />
        </linearGradient>
        <linearGradient id="oxyBlood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <radialGradient id="brainGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={brainColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={brainColor} stopOpacity="0.1" />
        </radialGradient>
        <radialGradient id="edemaGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#1e40af" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ===== BODY OUTLINE ===== */}
      <ellipse cx={cx} cy={cy - 135} rx="42" ry="48" fill="rgba(100,116,139,0.15)" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
      <rect x={cx - 8} y={cy - 89} width="16" height="22" rx="5" fill="rgba(100,116,139,0.12)" />
      <path d={`M${cx - 65} ${cy - 68} Q${cx - 70} ${cy + 10} ${cx - 55} ${cy + 90} L${cx + 55} ${cy + 90} Q${cx + 70} ${cy + 10} ${cx + 65} ${cy - 68} Z`}
        fill="rgba(100,116,139,0.08)" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />

      {/* ===== BRAIN - Cerebral Blood Flow ===== */}
      <g>
        <ellipse cx={cx} cy={cy - 140} rx="34" ry="38" fill="url(#brainGrad)" />
        {/* Brain folds */}
        <path d={`M${cx - 20} ${cy - 160} Q${cx - 10} ${cy - 170} ${cx} ${cy - 162} Q${cx + 10} ${cy - 170} ${cx + 20} ${cy - 160}`}
          fill="none" stroke={brainColor} strokeWidth="1.5" opacity="0.5" />
        <path d={`M${cx - 25} ${cy - 148} Q${cx - 12} ${cy - 155} ${cx} ${cy - 148} Q${cx + 12} ${cy - 155} ${cx + 25} ${cy - 148}`}
          fill="none" stroke={brainColor} strokeWidth="1.5" opacity="0.5" />
        <path d={`M${cx - 22} ${cy - 135} Q${cx - 8} ${cy - 142} ${cx} ${cy - 135} Q${cx + 8} ${cy - 142} ${cx + 22} ${cy - 135}`}
          fill="none" stroke={brainColor} strokeWidth="1.5" opacity="0.4" />
        {/* CBF indicator pulsing circle */}
        <circle cx={cx} cy={cy - 140} r={18 * cs.cbf}
          fill="none" stroke={brainColor} strokeWidth="2" opacity="0.6"
          style={beatDur > 0 ? { animation: `pulse ${beatDur}s ease-in-out infinite` } : {}} />
        {/* CBF label */}
        <text x={cx + 42} y={cy - 150} fill={brainColor} fontSize="9" fontWeight="bold">CBF</text>
        <text x={cx + 42} y={cy - 138} fill={brainColor} fontSize="11" fontWeight="bold">{(cs.cbf * 100).toFixed(0)}%</text>
        {/* Carotid arteries */}
        <line x1={cx - 6} y1={cy - 90} x2={cx - 10} y2={cy - 105}
          stroke="#ef4444" strokeWidth="2.5" opacity={0.4 + cs.cbf * 0.4} />
        <line x1={cx + 6} y1={cy - 90} x2={cx + 10} y2={cy - 105}
          stroke="#ef4444" strokeWidth="2.5" opacity={0.4 + cs.cbf * 0.4} />
      </g>

      {/* ===== LUNGS with breathing animation ===== */}
      <g style={cs.rr > 0 ? { animation: `breathe ${60 / cs.rr}s ease-in-out infinite`, transformOrigin: `${cx}px ${cy - 20}px` } : {}}>
        {/* Right Lung */}
        <path d={`M${cx - 18} ${cy - 60} Q${cx - 55} ${cy - 50} ${cx - 60} ${cy - 10} Q${cx - 62} ${cy + 25} ${cx - 45} ${cy + 40} Q${cx - 30} ${cy + 48} ${cx - 18} ${cy + 30} Z`}
          fill={lungColor} stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" opacity="0.4" />
        {/* Left Lung */}
        <path d={`M${cx + 18} ${cy - 60} Q${cx + 55} ${cy - 50} ${cx + 60} ${cy - 10} Q${cx + 62} ${cy + 25} ${cx + 45} ${cy + 40} Q${cx + 30} ${cy + 48} ${cx + 18} ${cy + 30} Z`}
          fill={lungColor} stroke="rgba(147,197,253,0.5)" strokeWidth="1.5" opacity="0.4" />
        {/* Bronchial tree */}
        <line x1={cx} y1={cy - 68} x2={cx} y2={cy - 45} stroke="rgba(148,163,184,0.4)" strokeWidth="3" />
        <line x1={cx} y1={cy - 50} x2={cx - 25} y2={cy - 30} stroke="rgba(148,163,184,0.3)" strokeWidth="2" />
        <line x1={cx} y1={cy - 50} x2={cx + 25} y2={cy - 30} stroke="rgba(148,163,184,0.3)" strokeWidth="2" />
        <line x1={cx - 25} y1={cy - 30} x2={cx - 38} y2={cy - 10} stroke="rgba(148,163,184,0.2)" strokeWidth="1.5" />
        <line x1={cx - 25} y1={cy - 30} x2={cx - 30} y2={cy - 5} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
        <line x1={cx + 25} y1={cy - 30} x2={cx + 38} y2={cy - 10} stroke="rgba(148,163,184,0.2)" strokeWidth="1.5" />
        <line x1={cx + 25} y1={cy - 30} x2={cx + 30} y2={cy - 5} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />

        {/* Pulmonary edema fluid overlay */}
        {edemaOpacity > 0 && (
          <>
            <ellipse cx={cx - 38} cy={cy + 15} rx="22" ry="20" fill="url(#edemaGrad)" opacity={edemaOpacity}
              style={cs.pulmonaryEdema === 'flash' ? { animation: 'blink 0.8s infinite' } : {}} />
            <ellipse cx={cx + 38} cy={cy + 15} rx="22" ry="20" fill="url(#edemaGrad)" opacity={edemaOpacity}
              style={cs.pulmonaryEdema === 'flash' ? { animation: 'blink 0.8s infinite' } : {}} />
            {/* B-lines (ultrasound artifact representation) */}
            {cs.pulmonaryEdema !== 'none' && (
              <>
                <line x1={cx - 48} y1={cy} x2={cx - 48} y2={cy + 35} stroke="#60a5fa" strokeWidth="1" opacity={edemaOpacity * 0.7} strokeDasharray="2,3" />
                <line x1={cx - 35} y1={cy - 5} x2={cx - 35} y2={cy + 38} stroke="#60a5fa" strokeWidth="1" opacity={edemaOpacity * 0.7} strokeDasharray="2,3" />
                <line x1={cx + 48} y1={cy} x2={cx + 48} y2={cy + 35} stroke="#60a5fa" strokeWidth="1" opacity={edemaOpacity * 0.7} strokeDasharray="2,3" />
                <line x1={cx + 35} y1={cy - 5} x2={cx + 35} y2={cy + 38} stroke="#60a5fa" strokeWidth="1" opacity={edemaOpacity * 0.7} strokeDasharray="2,3" />
              </>
            )}
          </>
        )}
      </g>

      {/* Lung labels */}
      <text x={cx - 72} y={cy - 15} fill="rgba(147,197,253,0.6)" fontSize="8" fontWeight="bold">R LUNG</text>
      <text x={cx + 52} y={cy - 15} fill="rgba(147,197,253,0.6)" fontSize="8" fontWeight="bold">L LUNG</text>

      {/* ===== 4-CHAMBER HEART ===== */}
      <g style={beatDur > 0 ? { animation: `heartbeat ${beatDur}s infinite`, transformOrigin: `${cx}px ${cy + 2}px` } : {}}>
        {/* Pericardium outline */}
        <ellipse cx={cx} cy={cy + 2} rx={32 * cs.lvDilation} ry={35 * cs.lvDilation}
          fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="3,3" />

        {/* === RIGHT ATRIUM (top-right of heart, viewer's left) === */}
        <ellipse cx={cx - 14} cy={cy - 12}
          rx={10 * cs.rvDilation} ry={10 * cs.rvDilation}
          fill="url(#deoxyBlood)" stroke={heartColor}
          strokeWidth={1.5 * cs.wallThickness} opacity="0.8" />
        <text x={cx - 14} y={cy - 10} fill="rgba(255,255,255,0.5)" fontSize="6" textAnchor="middle" dominantBaseline="middle">RA</text>

        {/* === RIGHT VENTRICLE (bottom-right, viewer's left) === */}
        <path d={`M${cx - 24 * cs.rvDilation} ${cy - 2} Q${cx - 28 * cs.rvDilation} ${cy + 20} ${cx - 8} ${cy + 28 * cs.rvDilation} L${cx - 4} ${cy} Z`}
          fill="url(#deoxyBlood)" stroke={heartColor}
          strokeWidth={1.8 * cs.wallThickness} opacity="0.8" />
        <text x={cx - 16} y={cy + 12} fill="rgba(255,255,255,0.5)" fontSize="6" textAnchor="middle" dominantBaseline="middle">RV</text>

        {/* === LEFT ATRIUM (top-left of heart, viewer's right) === */}
        <ellipse cx={cx + 14} cy={cy - 12}
          rx={9 * cs.lvDilation} ry={10 * cs.lvDilation}
          fill="url(#oxyBlood)" stroke={heartColor}
          strokeWidth={1.5 * cs.wallThickness} opacity="0.9" />
        <text x={cx + 14} y={cy - 10} fill="rgba(255,255,255,0.6)" fontSize="6" textAnchor="middle" dominantBaseline="middle">LA</text>

        {/* === LEFT VENTRICLE (bottom-left, viewer's right) === */}
        <path d={`M${cx + 24 * cs.lvDilation} ${cy - 2} Q${cx + 28 * cs.lvDilation} ${cy + 22} ${cx + 8} ${cy + 30 * cs.lvDilation} L${cx + 4} ${cy} Z`}
          fill="url(#oxyBlood)" stroke={heartColor}
          strokeWidth={2.2 * cs.wallThickness} opacity="0.9" />
        <text x={cx + 16} y={cy + 13} fill="rgba(255,255,255,0.6)" fontSize="6" textAnchor="middle" dominantBaseline="middle">LV</text>

        {/* Interventricular septum */}
        <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 25}
          stroke={heartColor} strokeWidth={2 * cs.wallThickness} opacity="0.6" />

        {/* Interatrial septum */}
        <line x1={cx} y1={cy - 20} x2={cx} y2={cy - 4}
          stroke={heartColor} strokeWidth={1.2 * cs.wallThickness} opacity="0.4" />

        {/* Tricuspid valve (RA->RV) */}
        <path d={`M${cx - 6} ${cy - 3} L${cx - 10} ${cy + 2} L${cx - 4} ${cy - 3}`}
          fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.6" />

        {/* Mitral valve (LA->LV) */}
        <path d={`M${cx + 6} ${cy - 3} L${cx + 10} ${cy + 2} L${cx + 4} ${cy - 3}`}
          fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.6" />

        {/* Aortic valve / Aorta */}
        <path d={`M${cx + 5} ${cy - 22} Q${cx + 20} ${cy - 40} ${cx + 35} ${cy - 55}`}
          fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.6" />

        {/* Pulmonary artery */}
        <path d={`M${cx - 5} ${cy - 22} Q${cx - 20} ${cy - 38} ${cx - 35} ${cy - 50}`}
          fill="none" stroke="#7f1d1d" strokeWidth="2.5" opacity="0.5" />

        {/* SVC / IVC flow lines */}
        <line x1={cx - 14} y1={cy - 55} x2={cx - 14} y2={cy - 22}
          stroke="#7f1d1d" strokeWidth="2" opacity="0.4" />
        <line x1={cx - 14} y1={cy + 28} x2={cx - 14} y2={cy + 50}
          stroke="#7f1d1d" strokeWidth="2" opacity="0.4" />
      </g>

      {/* ===== PRELOAD / AFTERLOAD BARS ===== */}
      <g>
        {/* Preload bar (left side) */}
        <text x={cx - 85} y={cy + 60} fill="#94a3b8" fontSize="8" fontWeight="bold">PRELOAD</text>
        <rect x={cx - 95} y={cy + 64} width="40" height="5" rx="2" fill="rgba(51,65,85,0.5)" />
        <rect x={cx - 95} y={cy + 64} width={40 * cs.preload} height="5" rx="2"
          fill={cs.preload > 0.8 ? '#ef4444' : cs.preload < 0.4 ? '#f59e0b' : '#22c55e'} />

        {/* Afterload bar (right side) */}
        <text x={cx + 55} y={cy + 60} fill="#94a3b8" fontSize="8" fontWeight="bold">AFTERLOAD</text>
        <rect x={cx + 55} y={cy + 64} width="40" height="5" rx="2" fill="rgba(51,65,85,0.5)" />
        <rect x={cx + 55} y={cy + 64} width={40 * cs.afterload} height="5" rx="2"
          fill={cs.afterload > 0.7 ? '#ef4444' : cs.afterload < 0.3 ? '#3b82f6' : '#22c55e'} />
      </g>

      {/* ===== DATA READOUTS PANEL ===== */}
      <g>
        {/* Heart state badge */}
        <rect x={cx - 45} y={cy + 78} width="90" height="18" rx="4"
          fill={cs.heartState === 'failure' ? 'rgba(220,38,38,0.25)'
            : cs.heartState === 'hyperdynamic' ? 'rgba(245,158,11,0.25)'
            : cs.heartState === 'dilated' ? 'rgba(249,115,22,0.2)'
            : 'rgba(34,197,94,0.15)'}
          stroke={heartColor} strokeWidth="1" />
        <text x={cx} y={cy + 90} fill={heartColor} fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
          {cs.heartState === 'failure' ? 'HF - Reduced EF'
            : cs.heartState === 'hyperdynamic' ? 'HYPERDYNAMIC'
            : cs.heartState === 'dilated' ? 'DILATED CM'
            : 'NORMAL'}
        </text>

        {/* CO / EF row */}
        <text x={cx - 65} y={cy + 110} fill="#94a3b8" fontSize="8" fontWeight="bold">CO</text>
        <text x={cx - 65} y={cy + 122} fill="#22c55e" fontSize="12" fontWeight="bold">{cs.co.toFixed(1)}</text>
        <text x={cx - 50} y={cy + 122} fill="#64748b" fontSize="8">L/min</text>

        <text x={cx - 10} y={cy + 110} fill="#94a3b8" fontSize="8" fontWeight="bold">EF</text>
        <text x={cx - 10} y={cy + 122} fill={cs.ef < 0.4 ? '#ef4444' : '#22c55e'} fontSize="12" fontWeight="bold">{(cs.ef * 100).toFixed(0)}%</text>

        <text x={cx + 35} y={cy + 110} fill="#94a3b8" fontSize="8" fontWeight="bold">SV</text>
        <text x={cx + 35} y={cy + 122} fill="#22c55e" fontSize="12" fontWeight="bold">{cs.sv.toFixed(0)}</text>
        <text x={cx + 52} y={cy + 122} fill="#64748b" fontSize="8">mL</text>

        {/* PCWP / SVR row */}
        <text x={cx - 65} y={cy + 138} fill="#94a3b8" fontSize="8" fontWeight="bold">PCWP</text>
        <text x={cx - 65} y={cy + 150} fill={cs.pcwp > 20 ? '#ef4444' : cs.pcwp > 16 ? '#f59e0b' : '#22c55e'} fontSize="12" fontWeight="bold">
          {cs.pcwp.toFixed(0)}
        </text>
        <text x={cx - 48} y={cy + 150} fill="#64748b" fontSize="8">mmHg</text>

        <text x={cx + 20} y={cy + 138} fill="#94a3b8" fontSize="8" fontWeight="bold">SVR</text>
        <text x={cx + 20} y={cy + 150} fill={cs.svr > 1800 ? '#ef4444' : cs.svr < 800 ? '#3b82f6' : '#22c55e'} fontSize="12" fontWeight="bold">
          {cs.svr.toFixed(0)}
        </text>

        {/* Pulmonary edema warning */}
        {cs.pulmonaryEdema !== 'none' && (
          <text x={cx} y={cy + 168} fill={cs.pulmonaryEdema === 'flash' ? '#ef4444' : '#f59e0b'}
            fontSize="10" fontWeight="bold" textAnchor="middle"
            style={cs.pulmonaryEdema === 'flash' ? { animation: 'blink 0.5s infinite' } : {}}>
            {cs.pulmonaryEdema === 'flash' ? '\u26A0 FLASH PULM EDEMA'
              : cs.pulmonaryEdema === 'moderate' ? '\u26A0 PULM EDEMA'
              : 'Mild Congestion'}
          </text>
        )}
      </g>
    </svg>
  );
}
