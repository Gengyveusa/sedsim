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
  const spo2 = vitals.spo2;
  const rr = vitals.rr;
  const sbp = vitals.sbp;
  const dbp = vitals.dbp;

  // Stroke volume estimate (simplified Liljestrand-Zander)
  const pulsePressure = sbp - dbp;
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

  // Contractility (dP/dt proxy) - rate of LV pressure rise
  // Normal ~1200-1800 mmHg/s, reduced in failure
  let contractility = 1500; // normal baseline
  contractility *= ef / 0.60; // scale with EF
  if (combinedEff > 0.3) contractility *= (1 - combinedEff * 0.4); // sedation depresses
  contractility = Math.max(400, Math.min(2500, contractility));

  // Heart state classification
  let heartState: 'normal' | 'hyperdynamic' | 'failure' | 'dilated' = 'normal';
  if (co > 7 && hr > 100) heartState = 'hyperdynamic';
  else if (ef < 0.35 || (map < 60 && hr > 100)) heartState = 'failure';
  else if (ef < 0.45 && co < 3.5) heartState = 'dilated';

  // Chamber sizes (scale factors)
  const rvDilation = heartState === 'dilated' || heartState === 'failure' ? 1.3 : 1.0;
  const lvDilation = heartState === 'dilated' ? 1.4 : heartState === 'failure' ? 1.35 : 1.0;
  const wallThickness = heartState === 'failure' ? 0.7 : afterload > 0.7 ? 1.4 : 1.0;

  // === CHAMBER PRESSURES (mmHg) ===
  // Right Atrium (RA): normal 2-6 mmHg
  let raP = 4;
  if (heartState === 'failure') raP = 14 + (1 - ef) * 10;
  else if (preload > 0.8) raP = 10;
  else if (preload < 0.4) raP = 1;

  // Right Ventricle (RV): normal 25/4 mmHg (systolic/diastolic)
  let rvSys = 25;
  let rvDia = raP;
  if (heartState === 'failure') { rvSys = 45 + (1 - ef) * 20; rvDia = raP; }
  else if (heartState === 'hyperdynamic') { rvSys = 35; }

  // Left Atrium (LA): normal 6-12 mmHg (approx = PCWP)
  let laP = 8;
  if (heartState === 'failure') laP = 22 + (1 - ef) * 20;
  else if (heartState === 'dilated') laP = 16;
  else if (map > 110) laP = 14;
  else if (combinedEff > 0.5) laP = 6;

  // Left Ventricle (LV): normal 120/8 mmHg
  let lvSys = sbp; // LV systolic ~ SBP
  let lvDia = laP; // LV end-diastolic ~ LA pressure

  // PCWP ~ LA pressure
  const pcwp = laP;

  // Pulmonary artery pressure
  let paSys = rvSys;
  let paDia = Math.max(laP, rvDia + 2);
  const paMean = (paSys + 2 * paDia) / 3;

  // Pulmonary edema state
  let pulmonaryEdema: 'none' | 'mild' | 'moderate' | 'flash' = 'none';
  if (pcwp > 25) pulmonaryEdema = 'flash';
  else if (pcwp > 20) pulmonaryEdema = 'moderate';
  else if (pcwp > 16) pulmonaryEdema = 'mild';

  // === ALVEOLAR GAS EXCHANGE ===
  const fio2 = 0.21; // room air default (could be connected to interventions later)
  // Alveolar O2: PAO2 = FiO2 * (Patm - PH2O) - PaCO2/RQ
  const paco2 = rr > 0 ? Math.max(20, Math.min(80, 40 * (14 / Math.max(4, rr)))) : 80;
  const pao2Alveolar = fio2 * (760 - 47) - paco2 / 0.8;
  // Arterial O2 estimate from SpO2 (simplified dissociation curve)
  const pao2 = spo2 > 95 ? 80 + (spo2 - 95) * 10 : spo2 > 90 ? 60 + (spo2 - 90) * 4 : Math.max(30, spo2 - 30);
  // A-a gradient
  const aaGradient = Math.max(0, pao2Alveolar - pao2);
  // Gas exchange efficiency (0-1)
  const gasExchangeEff = Math.max(0, Math.min(1, 1 - aaGradient / 100));
  // Capillary PO2 (in pulm capillary)
  const capPo2 = (pao2 + pao2Alveolar) / 2;
  // Capillary pressure (hydrostatic) - related to PCWP
  const capHydrostatic = pcwp + 3; // slightly above PCWP
  const capOncotic = 25; // plasma oncotic pressure ~25 mmHg
  // Net filtration pressure (Starling)
  const netFiltration = capHydrostatic - capOncotic;

  // Cerebral blood flow (autoregulation)
  let cbf = 1.0;
  if (map < 50) cbf = 0.3;
  else if (map < 60) cbf = 0.5 + (map - 50) * 0.05;
  else if (map > 150) cbf = 1.2;
  else cbf = 1.0;
  cbf *= (1 - combinedEff * 0.3);
  if (spo2 < 90) cbf *= 1.3;

  return {
    hr, co, sv, ef, preload, afterload, heartState, contractility,
    rvDilation, lvDilation, wallThickness,
    raP, rvSys, rvDia, laP, lvSys, lvDia, paSys, paDia, paMean,
    pcwp, pulmonaryEdema, svr, sbp, dbp, map,
    pao2, paco2, pao2Alveolar, aaGradient, gasExchangeEff,
    capPo2, capHydrostatic, capOncotic, netFiltration,
    cbf, spo2, rr, pulsePressure
  };
}

export default function PhysiologyAvatar({ vitals, moass: _moass, combinedEff, patient, size = 700 }: PhysiologyAvatarProps) {
  const cs = computeCardioState(vitals, patient, combinedEff);
  const cx = size / 2;
  const cy = size * 0.38; // shift heart region up to make room for alveoli below
  const beatDur = cs.hr > 0 ? 60 / cs.hr : 0;

  // Colors based on state
  const heartColor = cs.heartState === 'failure' ? '#dc2626' : cs.heartState === 'hyperdynamic' ? '#f59e0b' : cs.heartState === 'dilated' ? '#f97316' : '#ef4444';
  const lungColor = cs.pulmonaryEdema === 'flash' ? '#3b82f6' : cs.pulmonaryEdema === 'moderate' ? '#60a5fa' : cs.pulmonaryEdema === 'mild' ? '#93c5fd' : 'rgba(147,197,253,0.3)';
  const brainColor = cs.cbf > 0.8 ? '#a78bfa' : cs.cbf > 0.5 ? '#f59e0b' : '#ef4444';
  const edemaOpacity = cs.pulmonaryEdema === 'flash' ? 0.8 : cs.pulmonaryEdema === 'moderate' ? 0.5 : cs.pulmonaryEdema === 'mild' ? 0.3 : 0;
  const contractColor = cs.contractility > 1400 ? '#22c55e' : cs.contractility > 900 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow2"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="o2grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
        <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#a855f7"/></linearGradient>
        <linearGradient id="alvGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fecaca"/><stop offset="50%" stopColor="#fca5a5" stopOpacity="0.5"/><stop offset="100%" stopColor="#93c5fd"/></linearGradient>
      </defs>

      {/* ===== BRAIN - Cerebral Blood Flow ===== */}
      <ellipse cx={cx} cy={cy - 105} rx={32} ry={26} fill="#1e1b4b" stroke={brainColor} strokeWidth={2} opacity={0.9} />
      <path d={`M ${cx-20} ${cy-110} Q ${cx-10} ${cy-130} ${cx} ${cy-128} Q ${cx+10} ${cy-130} ${cx+20} ${cy-110}`} fill="none" stroke={brainColor} strokeWidth={1.5} opacity={0.6} />
      <path d={`M ${cx-15} ${cy-100} Q ${cx} ${cy-118} ${cx+15} ${cy-100}`} fill="none" stroke={brainColor} strokeWidth={1} opacity={0.5} />
      <circle cx={cx} cy={cy - 105} r={8} fill={brainColor} opacity={cs.cbf > 0.5 ? 0.6 : 0.3} style={beatDur > 0 ? { animation: `pulse ${beatDur}s ease-in-out infinite` } : {}} />
      <text x={cx + 40} y={cy - 108} fill={brainColor} fontSize="10" fontWeight="bold">CBF</text>
      <text x={cx + 40} y={cy - 96} fill={brainColor} fontSize="11" fontWeight="bold">{(cs.cbf * 100).toFixed(0)}%</text>
      {/* Carotids */}
      <line x1={cx - 8} y1={cy - 78} x2={cx - 12} y2={cy - 92} stroke="#ef4444" strokeWidth={2} opacity={0.6} />
      <line x1={cx + 8} y1={cy - 78} x2={cx + 12} y2={cy - 92} stroke="#ef4444" strokeWidth={2} opacity={0.6} />

      {/* ===== LUNGS with breathing ===== */}
      <g style={cs.rr > 0 ? { animation: `breathe ${60 / cs.rr}s ease-in-out infinite`, transformOrigin: `${cx}px ${cy - 20}px` } : {}}>
        <ellipse cx={cx - 65} cy={cy - 15} rx={40} ry={55} fill={lungColor} stroke="#64748b" strokeWidth={1.5} opacity={0.4} />
        <ellipse cx={cx + 65} cy={cy - 15} rx={40} ry={55} fill={lungColor} stroke="#64748b" strokeWidth={1.5} opacity={0.4} />
        {/* Bronchial tree */}
        <line x1={cx} y1={cy - 65} x2={cx} y2={cy - 40} stroke="#94a3b8" strokeWidth={2} opacity={0.5} />
        <line x1={cx} y1={cy - 50} x2={cx - 25} y2={cy - 30} stroke="#94a3b8" strokeWidth={1.5} opacity={0.4} />
        <line x1={cx} y1={cy - 50} x2={cx + 25} y2={cy - 30} stroke="#94a3b8" strokeWidth={1.5} opacity={0.4} />
        {/* Edema overlay */}
        {edemaOpacity > 0 && (
          <>
            <ellipse cx={cx - 65} cy={cy - 5} rx={35} ry={45} fill="#3b82f6" opacity={edemaOpacity * 0.4} />
            <ellipse cx={cx + 65} cy={cy - 5} rx={35} ry={45} fill="#3b82f6" opacity={edemaOpacity * 0.4} />
            {/* B-lines */}
            {cs.pulmonaryEdema !== 'none' && (
              <>
                <line x1={cx - 80} y1={cy - 45} x2={cx - 80} y2={cy + 25} stroke="#60a5fa" strokeWidth={1} opacity={0.6} strokeDasharray="2,3" />
                <line x1={cx - 65} y1={cy - 50} x2={cx - 65} y2={cy + 30} stroke="#60a5fa" strokeWidth={1} opacity={0.6} strokeDasharray="2,3" />
                <line x1={cx + 65} y1={cy - 50} x2={cx + 65} y2={cy + 30} stroke="#60a5fa" strokeWidth={1} opacity={0.6} strokeDasharray="2,3" />
                <line x1={cx + 80} y1={cy - 45} x2={cx + 80} y2={cy + 25} stroke="#60a5fa" strokeWidth={1} opacity={0.6} strokeDasharray="2,3" />
              </>
            )}
          </>
        )}
        <text x={cx - 68} y={cy - 50} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">R LUNG</text>
        <text x={cx + 68} y={cy - 50} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">L LUNG</text>
      </g>

      {/* ===== 4-CHAMBER HEART with PRESSURES ===== */}
      <g style={beatDur > 0 ? { animation: `heartbeat ${beatDur}s infinite`, transformOrigin: `${cx}px ${cy + 2}px` } : {}}>
        {/* Pericardium */}
        <ellipse cx={cx} cy={cy + 5} rx={50} ry={45} fill="none" stroke="#475569" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
        {/* RA - top-left (viewer perspective) */}
        <ellipse cx={cx - 20} cy={cy - 12} rx={18 * cs.rvDilation} ry={16} fill="#1e3a5f" stroke={heartColor} strokeWidth={cs.wallThickness * 1.5} opacity={0.85} />
        <text x={cx - 20} y={cy - 16} fill="#94a3b8" fontSize="7" textAnchor="middle" fontWeight="bold">RA</text>
        <text x={cx - 20} y={cy - 7} fill="#22d3ee" fontSize="8" textAnchor="middle" fontWeight="bold">{cs.raP.toFixed(0)}</text>
        {/* RV - bottom-left */}
        <ellipse cx={cx - 20} cy={cy + 18} rx={20 * cs.rvDilation} ry={20} fill="#1e3a5f" stroke={heartColor} strokeWidth={cs.wallThickness * 1.8} opacity={0.85} />
        <text x={cx - 20} y={cy + 14} fill="#94a3b8" fontSize="7" textAnchor="middle" fontWeight="bold">RV</text>
        <text x={cx - 20} y={cy + 24} fill="#22d3ee" fontSize="7" textAnchor="middle" fontWeight="bold">{cs.rvSys.toFixed(0)}/{cs.rvDia.toFixed(0)}</text>
        {/* LA - top-right */}
        <ellipse cx={cx + 20} cy={cy - 12} rx={18 * cs.lvDilation} ry={16} fill="#3b1e1e" stroke={heartColor} strokeWidth={cs.wallThickness * 1.5} opacity={0.85} />
        <text x={cx + 20} y={cy - 16} fill="#94a3b8" fontSize="7" textAnchor="middle" fontWeight="bold">LA</text>
        <text x={cx + 20} y={cy - 7} fill="#f87171" fontSize="8" textAnchor="middle" fontWeight="bold">{cs.laP.toFixed(0)}</text>
        {/* LV - bottom-right */}
        <ellipse cx={cx + 20} cy={cy + 18} rx={22 * cs.lvDilation} ry={22} fill="#3b1e1e" stroke={heartColor} strokeWidth={cs.wallThickness * 2.5} opacity={0.85} />
        <text x={cx + 20} y={cy + 14} fill="#94a3b8" fontSize="7" textAnchor="middle" fontWeight="bold">LV</text>
        <text x={cx + 20} y={cy + 24} fill="#f87171" fontSize="7" textAnchor="middle" fontWeight="bold">{cs.lvSys.toFixed(0)}/{cs.lvDia.toFixed(0)}</text>
        {/* Septum */}
        <line x1={cx} y1={cy - 25} x2={cx} y2={cy + 38} stroke="#64748b" strokeWidth={2} opacity={0.6} />
        <line x1={cx - 38} y1={cy + 2} x2={cx + 38} y2={cy + 2} stroke="#64748b" strokeWidth={1} opacity={0.4} />
        {/* Valves */}
        <circle cx={cx - 8} cy={cy + 2} r={3} fill="#f59e0b" opacity={0.7} />
        <circle cx={cx + 8} cy={cy + 2} r={3} fill="#f59e0b" opacity={0.7} />
        {/* Aorta */}
        <path d={`M ${cx + 20} ${cy - 30} Q ${cx + 30} ${cy - 55} ${cx} ${cy - 60} Q ${cx - 30} ${cy - 55} ${cx - 35} ${cy - 40}`} fill="none" stroke="#ef4444" strokeWidth={3} opacity={0.7} />
        {/* PA */}
        <path d={`M ${cx - 20} ${cy - 28} Q ${cx - 15} ${cy - 45} ${cx - 40} ${cy - 35}`} fill="none" stroke="#3b82f6" strokeWidth={2.5} opacity={0.6} />
        <path d={`M ${cx - 20} ${cy - 28} Q ${cx - 15} ${cy - 45} ${cx + 40} ${cy - 35}`} fill="none" stroke="#3b82f6" strokeWidth={2.5} opacity={0.6} />
      </g>

      {/* PA Pressure label */}
      <text x={cx - 55} y={cy - 55} fill="#60a5fa" fontSize="7" fontWeight="bold" textAnchor="middle">PA</text>
      <text x={cx - 55} y={cy - 46} fill="#60a5fa" fontSize="8" fontWeight="bold" textAnchor="middle">{cs.paSys.toFixed(0)}/{cs.paDia.toFixed(0)}</text>

      {/* ===== PRELOAD / AFTERLOAD BARS ===== */}
      <text x={cx - 95} y={cy + 48} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">PRELOAD</text>
      <rect x={cx - 120} y={cy + 52} width={50} height={6} rx={3} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
      <rect x={cx - 120} y={cy + 52} width={50 * cs.preload} height={6} rx={3} fill={cs.preload > 0.8 ? '#ef4444' : cs.preload < 0.4 ? '#f59e0b' : '#22c55e'} />
      <text x={cx + 95} y={cy + 48} fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">AFTERLOAD</text>
      <rect x={cx + 70} y={cy + 52} width={50} height={6} rx={3} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
      <rect x={cx + 70} y={cy + 52} width={50 * cs.afterload} height={6} rx={3} fill={cs.afterload > 0.7 ? '#ef4444' : cs.afterload < 0.3 ? '#3b82f6' : '#22c55e'} />

      {/* ===== HEMODYNAMICS DATA PANEL ===== */}
      {/* Heart state badge */}
      <rect x={cx - 55} y={cy + 65} width={110} height={16} rx={4} fill={cs.heartState === 'failure' ? '#7f1d1d' : cs.heartState === 'hyperdynamic' ? '#713f12' : cs.heartState === 'dilated' ? '#7c2d12' : '#14532d'} stroke={heartColor} strokeWidth={1} />
      <text x={cx} y={cy + 76} fill="white" fontSize="9" textAnchor="middle" fontWeight="bold">
        {cs.heartState === 'failure' ? 'HF - Reduced EF' : cs.heartState === 'hyperdynamic' ? 'HYPERDYNAMIC' : cs.heartState === 'dilated' ? 'DILATED CM' : 'NORMAL'}
      </text>

      {/* Row 1: CO / EF / SV */}
      <text x={cx - 80} y={cy + 92} fill="#94a3b8" fontSize="8">CO</text>
      <text x={cx - 80} y={cy + 103} fill="#22d3ee" fontSize="11" fontWeight="bold">{cs.co.toFixed(1)}</text>
      <text x={cx - 56} y={cy + 103} fill="#64748b" fontSize="7">L/min</text>
      <text x={cx - 15} y={cy + 92} fill="#94a3b8" fontSize="8">EF</text>
      <text x={cx - 15} y={cy + 103} fill={cs.ef < 0.4 ? '#ef4444' : '#22c55e'} fontSize="11" fontWeight="bold">{(cs.ef * 100).toFixed(0)}%</text>
      <text x={cx + 30} y={cy + 92} fill="#94a3b8" fontSize="8">SV</text>
      <text x={cx + 30} y={cy + 103} fill="#22d3ee" fontSize="11" fontWeight="bold">{cs.sv.toFixed(0)}</text>
      <text x={cx + 54} y={cy + 103} fill="#64748b" fontSize="7">mL</text>

      {/* Row 2: SVR / PCWP / Contractility */}
      <text x={cx - 80} y={cy + 116} fill="#94a3b8" fontSize="8">SVR</text>
      <text x={cx - 80} y={cy + 127} fill={cs.svr > 1800 ? '#ef4444' : cs.svr < 800 ? '#3b82f6' : '#22c55e'} fontSize="10" fontWeight="bold">{cs.svr.toFixed(0)}</text>
      <text x={cx - 15} y={cy + 116} fill="#94a3b8" fontSize="8">PCWP</text>
      <text x={cx - 15} y={cy + 127} fill={cs.pcwp > 20 ? '#ef4444' : cs.pcwp > 16 ? '#f59e0b' : '#22c55e'} fontSize="10" fontWeight="bold">{cs.pcwp.toFixed(0)}</text>
      <text x={cx + 15} y={cy + 127} fill="#64748b" fontSize="7">mmHg</text>

      {/* Contractility (dP/dt) */}
      <text x={cx + 55} y={cy + 116} fill="#94a3b8" fontSize="7">dP/dt</text>
      <text x={cx + 55} y={cy + 127} fill={contractColor} fontSize="10" fontWeight="bold">{cs.contractility.toFixed(0)}</text>
      <text x={cx + 82} y={cy + 127} fill="#64748b" fontSize="6">mmHg/s</text>
      {/* Contractility bar */}
      <rect x={cx + 45} y={cy + 130} width={45} height={4} rx={2} fill="#1e293b" />
      <rect x={cx + 45} y={cy + 130} width={45 * Math.min(1, cs.contractility / 2000)} height={4} rx={2} fill={contractColor} />

      {/* Pulmonary edema warning */}
      {cs.pulmonaryEdema !== 'none' && (
        <text x={cx} y={cy + 145} fill={cs.pulmonaryEdema === 'flash' ? '#ef4444' : '#f59e0b'} fontSize="10" textAnchor="middle" fontWeight="bold" style={{ animation: cs.pulmonaryEdema === 'flash' ? 'blink 0.5s infinite' : 'none' }}>
          {cs.pulmonaryEdema === 'flash' ? '\u26A0 FLASH PULM EDEMA' : cs.pulmonaryEdema === 'moderate' ? '\u26A0 PULM EDEMA' : 'Mild Congestion'}
        </text>
      )}

      {/* ===== ALVEOLAR GAS EXCHANGE COMPONENT ===== */}
      {/* Section divider */}
      <line x1={cx - 130} y1={cy + 158} x2={cx + 130} y2={cy + 158} stroke="#475569" strokeWidth={0.5} strokeDasharray="4,4" />
      <text x={cx} y={cy + 170} fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold" letterSpacing="0.1em">ALVEOLAR-CAPILLARY GAS EXCHANGE</text>

      {/* Alveolus - large circle representing air space */}
      <circle cx={cx - 50} cy={cy + 220} r={40} fill="#0f172a" stroke="#64748b" strokeWidth={1.5} />
      <text x={cx - 50} y={cy + 195} fill="#94a3b8" fontSize="7" textAnchor="middle">ALVEOLUS</text>

      {/* Alveolar air content */}
      <text x={cx - 50} y={cy + 210} fill="#60a5fa" fontSize="8" textAnchor="middle" fontWeight="bold">PAO\u2082</text>
      <text x={cx - 50} y={cy + 222} fill="#60a5fa" fontSize="12" textAnchor="middle" fontWeight="bold">{cs.pao2Alveolar.toFixed(0)}</text>
      <text x={cx - 50} y={cy + 233} fill="#a78bfa" fontSize="8" textAnchor="middle" fontWeight="bold">PACO\u2082</text>
      <text x={cx - 50} y={cy + 244} fill="#a78bfa" fontSize="11" textAnchor="middle" fontWeight="bold">{cs.paco2.toFixed(0)}</text>

      {/* Alveolar-capillary membrane (thin barrier) */}
      <rect x={cx - 12} y={cy + 185} width={4} height={70} rx={2} fill="#475569" opacity={0.6} />
      <text x={cx - 10} y={cy + 183} fill="#64748b" fontSize="5" textAnchor="middle">MEMBRANE</text>

      {/* Pulmonary capillary (below/right of alveolus) */}
      <rect x={cx + 5} y={cy + 190} width={80} height={55} rx={8} fill="#1e1b2e" stroke="#ef4444" strokeWidth={1.5} opacity={0.8} />
      <text x={cx + 45} y={cy + 200} fill="#94a3b8" fontSize="7" textAnchor="middle" fontWeight="bold">PULM CAPILLARY</text>

      {/* Capillary blood gas values */}
      <text x={cx + 25} y={cy + 215} fill="#ef4444" fontSize="7">PcO\u2082</text>
      <text x={cx + 25} y={cy + 226} fill="#ef4444" fontSize="10" fontWeight="bold">{cs.capPo2.toFixed(0)}</text>
      <text x={cx + 62} y={cy + 215} fill="#a78bfa" fontSize="7">PcCO\u2082</text>
      <text x={cx + 62} y={cy + 226} fill="#a78bfa" fontSize="10" fontWeight="bold">{cs.paco2.toFixed(0)}</text>

      {/* Capillary pressures */}
      <text x={cx + 20} y={cy + 238} fill="#f59e0b" fontSize="6">Hydro:</text>
      <text x={cx + 52} y={cy + 238} fill="#f59e0b" fontSize="7" fontWeight="bold">{cs.capHydrostatic.toFixed(0)} mmHg</text>
      <text x={cx + 20} y={cy + 248} fill="#22d3ee" fontSize="6">Oncotic:</text>
      <text x={cx + 52} y={cy + 248} fill="#22d3ee" fontSize="7" fontWeight="bold">{cs.capOncotic} mmHg</text>

      {/* O2 diffusion arrow (alveolus -> capillary) */}
      <line x1={cx - 8} y1={cy + 210} x2={cx + 8} y2={cy + 210} stroke="#3b82f6" strokeWidth={2} markerEnd="url(#arrowBlue)" />
      <text x={cx} y={cy + 207} fill="#3b82f6" fontSize="6" textAnchor="middle" fontWeight="bold">O\u2082</text>

      {/* CO2 diffusion arrow (capillary -> alveolus) */}
      <line x1={cx + 8} y1={cy + 230} x2={cx - 8} y2={cy + 230} stroke="#a855f7" strokeWidth={2} markerEnd="url(#arrowPurple)" />
      <text x={cx} y={cy + 228} fill="#a855f7" fontSize="6" textAnchor="middle" fontWeight="bold">CO\u2082</text>

      {/* Edema fluid in alveolus when PCWP high */}
      {cs.pulmonaryEdema !== 'none' && (
        <>
          <ellipse cx={cx - 50} cy={cy + 245} rx={30} ry={10 * edemaOpacity} fill="#3b82f6" opacity={edemaOpacity * 0.5} />
          <text x={cx - 50} y={cy + 260} fill="#60a5fa" fontSize="6" textAnchor="middle">TRANSUDATE</text>
        </>
      )}

      {/* Gas Exchange Efficiency panel */}
      <rect x={cx - 130} y={cy + 270} width={260} height={50} rx={6} fill="#0f172a" stroke="#334155" strokeWidth={1} />
      <text x={cx - 120} y={cy + 284} fill="#94a3b8" fontSize="7" fontWeight="bold">A-a Gradient</text>
      <text x={cx - 120} y={cy + 297} fill={cs.aaGradient > 25 ? '#ef4444' : cs.aaGradient > 15 ? '#f59e0b' : '#22c55e'} fontSize="12" fontWeight="bold">{cs.aaGradient.toFixed(0)} mmHg</text>

      <text x={cx - 30} y={cy + 284} fill="#94a3b8" fontSize="7" fontWeight="bold">PaO\u2082</text>
      <text x={cx - 30} y={cy + 297} fill={cs.pao2 < 60 ? '#ef4444' : cs.pao2 < 80 ? '#f59e0b' : '#22c55e'} fontSize="12" fontWeight="bold">{cs.pao2.toFixed(0)}</text>
      <text x={cx - 5} y={cy + 297} fill="#64748b" fontSize="7">mmHg</text>

      <text x={cx + 50} y={cy + 284} fill="#94a3b8" fontSize="7" fontWeight="bold">PaCO\u2082</text>
      <text x={cx + 50} y={cy + 297} fill={cs.paco2 > 50 ? '#ef4444' : cs.paco2 < 30 ? '#3b82f6' : '#22c55e'} fontSize="12" fontWeight="bold">{cs.paco2.toFixed(0)}</text>
      <text x={cx + 75} y={cy + 297} fill="#64748b" fontSize="7">mmHg</text>

      {/* Exchange efficiency bar */}
      <text x={cx - 120} y={cy + 312} fill="#94a3b8" fontSize="7">Exchange Efficiency</text>
      <rect x={cx - 40} y={cy + 306} width={160} height={6} rx={3} fill="#1e293b" />
      <rect x={cx - 40} y={cy + 306} width={160 * cs.gasExchangeEff} height={6} rx={3} fill={cs.gasExchangeEff > 0.8 ? '#22c55e' : cs.gasExchangeEff > 0.5 ? '#f59e0b' : '#ef4444'} />
      <text x={cx + 125} y={cy + 313} fill="white" fontSize="7" fontWeight="bold">{(cs.gasExchangeEff * 100).toFixed(0)}%</text>

      {/* Net filtration (Starling) */}
      {cs.netFiltration > 0 && (
        <text x={cx} y={cy + 330} fill="#f59e0b" fontSize="8" textAnchor="middle" fontWeight="bold">
          Net Filtration: +{cs.netFiltration.toFixed(0)} mmHg (edema risk)
        </text>
      )}

      {/* Arrow markers */}
      <defs>
        <marker id="arrowBlue" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="#3b82f6" /></marker>
        <marker id="arrowPurple" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="#a855f7" /></marker>
      </defs>
    </svg>
  );
}
