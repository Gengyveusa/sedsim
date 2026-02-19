import { useState } from 'react';
import { Vitals, MOASSLevel, Patient } from '../types';

interface PhysiologyAvatarProps {
  vitals: Vitals;
  moass: MOASSLevel;
  combinedEff: number;
  patient: Patient;
  size?: number;
}

// Tooltip descriptions for anatomy and values
const TOOLTIPS: Record<string, string> = {
  brain: 'Brain: Cerebral blood flow (CBF) depends on MAP (autoregulated 60-150 mmHg). Sedation reduces metabolic demand and CBF.',
  cbf: 'CBF: Cerebral Blood Flow. Normal ~50 mL/100g/min. Autoregulated between MAP 60-150. Falls with deep sedation and hypotension.',
  rlung: 'Right Lung: 3 lobes. Gas exchange occurs in alveoli. Pulmonary edema (fluid) impairs O2 transfer when PCWP >16 mmHg.',
  llung: 'Left Lung: 2 lobes. Ventilation drives CO2 elimination. Respiratory depression from sedatives reduces RR and minute ventilation.',
  heart: 'Heart: 4-chamber pump. Right side receives venous return and pumps to lungs; left side receives oxygenated blood and pumps systemically.',
  ra: 'Right Atrium (RA): Receives systemic venous return. Normal pressure 2-6 mmHg. Elevated in RV failure, volume overload, or tamponade.',
  rv: 'Right Ventricle (RV): Pumps blood to pulmonary artery. Normal pressure 25/4 mmHg. Fails with pulmonary hypertension or volume overload.',
  la: 'Left Atrium (LA): Receives pulmonary venous return. Pressure approximates PCWP. Normal 6-12 mmHg. Elevated in LV failure causing pulmonary edema.',
  lv: 'Left Ventricle (LV): Main systemic pump. Normal pressure 120/8 mmHg. Systolic pressure equals SBP. Diastolic pressure reflects preload.',
  pa: 'Pulmonary Artery (PA): Carries deoxygenated blood to lungs. Normal 25/10 mmHg. Elevated in LV failure, lung disease, or PE.',
  preload: 'Preload: End-diastolic volume/pressure stretching the ventricle (Frank-Starling). Estimated from CVP/MAP. Low = hypovolemia, High = fluid overload.',
  afterload: 'Afterload: Resistance the ventricle must overcome to eject blood. Approximated by SVR. High afterload = increased cardiac work.',
  heartState: 'Heart State: Classification based on CO, EF, HR, MAP. Normal (EF>45%, adequate CO), Hyperdynamic (high CO, tachycardia), Failure (low EF), Dilated (low EF + low CO).',
  co: 'Cardiac Output (CO): Volume pumped per minute (HR x SV). Normal 4-8 L/min. Derived using simplified Liljestrand-Zander from pulse pressure.',
  ef: 'Ejection Fraction (EF): % of blood ejected per beat (SV/EDV). Normal 55-70%. <35% indicates systolic heart failure. Sedation can depress EF.',
  sv: 'Stroke Volume (SV): Volume ejected per beat. Normal 60-100 mL. Estimated from pulse pressure (SBP-DBP) x 1.2. Depends on preload, afterload, contractility.',
  svr: 'SVR: Systemic Vascular Resistance. Normal 800-1200 dynes. Calculated as (MAP x 80) / CO. High = vasoconstriction, Low = vasodilation/sepsis.',
  pcwp: 'PCWP: Pulmonary Capillary Wedge Pressure. Approximates LA pressure. Normal 6-12 mmHg. >16 = congestion, >20 = pulmonary edema, >25 = flash edema.',
  contractility: 'dP/dt: Rate of LV pressure rise, proxy for contractility. Normal 1200-1800 mmHg/s. Reduced by sedatives, heart failure. Increased by sympathetic drive.',
  alveolus: 'Alveolus: Thin-walled air sac where gas exchange occurs. ~300 million in lungs. O2 diffuses in, CO2 diffuses out across the alveolar-capillary membrane.',
  pao2: 'PAO2: Alveolar O2 tension. Calculated: FiO2 x (Patm-PH2O) - PaCO2/RQ. On room air ~100 mmHg. Decreases with hypoventilation or low FiO2.',
  paco2: 'PACO2/PaCO2: CO2 partial pressure. Normal 35-45 mmHg. Inversely related to alveolar ventilation. Rises with respiratory depression from sedatives.',
  membrane: 'Alveolar-Capillary Membrane: 0.5 micron barrier between air and blood. O2 and CO2 diffuse across by partial pressure gradients. Thickened in fibrosis/edema.',
  capillary: 'Pulmonary Capillary: Blood vessel in alveolar wall. Hydrostatic pressure (~PCWP+3) pushes fluid out; oncotic pressure (25 mmHg) pulls fluid in. Starling balance determines edema.',
  aaGradient: 'A-a Gradient: Difference between alveolar and arterial O2. Normal <15 mmHg. Elevated in V/Q mismatch, shunt, or diffusion impairment. Key diagnostic marker.',
  exchangeEff: 'Gas Exchange Efficiency: Derived from A-a gradient. 100% = perfect O2 transfer. Decreases with pulmonary edema, atelectasis, or V/Q mismatch.',
  netFiltration: 'Net Filtration (Starling): Hydrostatic pressure minus oncotic pressure across capillary wall. Positive = fluid leaks into alveoli (edema risk).',
  pulmonaryEdema: 'Pulmonary Edema: Fluid in alveoli impairing gas exchange. Flash edema (PCWP>25) is a medical emergency. Caused by acute LV failure or fluid overload.',
  hydrostatic: 'Hydrostatic Pressure: Blood pressure pushing fluid out of capillary into tissue/alveoli. In pulmonary capillaries, approximated by PCWP + 3 mmHg.',
  oncotic: 'Oncotic Pressure: Protein (albumin) osmotic pressure pulling fluid back into capillary. Normal ~25 mmHg. Low albumin = more edema risk.',
  arterialPo2: 'PaO2: Arterial oxygen tension. Normal 80-100 mmHg. Estimated from SpO2 via dissociation curve. <60 mmHg = respiratory failure.',
};

// Derive cardiovascular physiology from vitals
function computeCardioState(vitals: Vitals, _patient: Patient, combinedEff: number) {
  const hr = vitals.hr;
  const map = vitals.map;
  const spo2 = vitals.spo2;
  const rr = vitals.rr;
  const sbp = vitals.sbp;
  const dbp = vitals.dbp;

  const pulsePressure = sbp - dbp;
  const sv = Math.max(20, Math.min(120, pulsePressure * 1.2));
  const co = (hr * sv) / 1000;
  const edv = sv / Math.max(0.2, (0.65 - combinedEff * 0.15));
  const ef = Math.max(0.15, Math.min(0.75, sv / edv));
  const preload = map < 60 ? 0.3 : map < 70 ? 0.5 : map > 100 ? 0.9 : 0.7;
  const svr = (map * 80) / Math.max(0.5, co);
  const afterload = Math.min(1, Math.max(0, (svr - 600) / 1800));

  let contractility = 1500;
  contractility *= ef / 0.60;
  if (combinedEff > 0.3) contractility *= (1 - combinedEff * 0.4);
  contractility = Math.max(400, Math.min(2500, contractility));

  let heartState: 'normal' | 'hyperdynamic' | 'failure' | 'dilated' = 'normal';
  if (co > 7 && hr > 100) heartState = 'hyperdynamic';
  else if (ef < 0.35 || (map < 60 && hr > 100)) heartState = 'failure';
  else if (ef < 0.45 && co < 3.5) heartState = 'dilated';

  const rvDilation = heartState === 'dilated' || heartState === 'failure' ? 1.3 : 1.0;
  const lvDilation = heartState === 'dilated' ? 1.4 : heartState === 'failure' ? 1.35 : 1.0;
  const wallThickness = heartState === 'failure' ? 0.7 : afterload > 0.7 ? 1.4 : 1.0;

  let raP = 4;
  if (heartState === 'failure') raP = 14 + (1 - ef) * 10;
  else if (preload > 0.8) raP = 10;
  else if (preload < 0.4) raP = 1;

  let rvSys = 25;
  let rvDia = raP;
  if (heartState === 'failure') { rvSys = 45 + (1 - ef) * 20; rvDia = raP; }
  else if (heartState === 'hyperdynamic') { rvSys = 35; }

  let laP = 8;
  if (heartState === 'failure') laP = 22 + (1 - ef) * 20;
  else if (heartState === 'dilated') laP = 16;
  else if (map > 110) laP = 14;
  else if (combinedEff > 0.5) laP = 6;

  let lvSys = sbp;
  let lvDia = laP;
  const pcwp = laP;
  let paSys = rvSys;
  let paDia = Math.max(laP, rvDia + 2);
  const paMean = (paSys + 2 * paDia) / 3;

  let pulmonaryEdema: 'none' | 'mild' | 'moderate' | 'flash' = 'none';
  if (pcwp > 25) pulmonaryEdema = 'flash';
  else if (pcwp > 20) pulmonaryEdema = 'moderate';
  else if (pcwp > 16) pulmonaryEdema = 'mild';

  const fio2 = 0.21;
  const paco2 = rr > 0 ? Math.max(20, Math.min(80, 40 * (14 / Math.max(4, rr)))) : 80;
  const pao2Alveolar = fio2 * (760 - 47) - paco2 / 0.8;
  const pao2 = spo2 > 95 ? 80 + (spo2 - 95) * 10 : spo2 > 90 ? 60 + (spo2 - 90) * 4 : Math.max(30, spo2 - 30);
  const aaGradient = Math.max(0, pao2Alveolar - pao2);
  const gasExchangeEff = Math.max(0, Math.min(1, 1 - aaGradient / 100));
  const capPo2 = (pao2 + pao2Alveolar) / 2;
  const capHydrostatic = pcwp + 3;
  const capOncotic = 25;
  const netFiltration = capHydrostatic - capOncotic;

  let cbf = 1.0;
  if (map < 50) cbf = 0.3;
  else if (map < 60) cbf = 0.5 + (map - 50) * 0.05;
  else if (map > 150) cbf = 1.2;
  else cbf = 1.0;
  cbf *= (1 - combinedEff * 0.3);
  if (spo2 < 90) cbf *= 1.3;

  return { hr, co, sv, ef, preload, afterload, heartState, contractility, rvDilation, lvDilation, wallThickness,
    raP, rvSys, rvDia, laP, lvSys, lvDia, paSys, paDia, paMean, pcwp, pulmonaryEdema, svr, sbp, dbp, map,
    pao2, paco2, pao2Alveolar, aaGradient, gasExchangeEff, capPo2, capHydrostatic, capOncotic, netFiltration,
    cbf, spo2, rr, pulsePressure };
}

export default function PhysiologyAvatar({ vitals, moass: _moass, combinedEff, patient, size = 1050 }: PhysiologyAvatarProps) {
  const cs = computeCardioState(vitals, patient, combinedEff);
  const [tooltip, setTooltip] = useState<{text: string; x: number; y: number} | null>(null);
  const cx = size / 2;
  const cy = size * 0.38;
  const beatDur = cs.hr > 0 ? 60 / cs.hr : 0;

  const heartColor = cs.heartState === 'failure' ? '#dc2626' : cs.heartState === 'hyperdynamic' ? '#f59e0b' : cs.heartState === 'dilated' ? '#f97316' : '#ef4444';
  const lungColor = cs.pulmonaryEdema === 'flash' ? '#3b82f6' : cs.pulmonaryEdema === 'moderate' ? '#60a5fa' : cs.pulmonaryEdema === 'mild' ? '#93c5fd' : 'rgba(147,197,253,0.3)';
  const brainColor = cs.cbf > 0.8 ? '#a78bfa' : cs.cbf > 0.5 ? '#f59e0b' : '#ef4444';
  const edemaOpacity = cs.pulmonaryEdema === 'flash' ? 0.8 : cs.pulmonaryEdema === 'moderate' ? 0.5 : cs.pulmonaryEdema === 'mild' ? 0.3 : 0;
  const contractColor = cs.contractility > 1400 ? '#22c55e' : cs.contractility > 900 ? '#f59e0b' : '#ef4444';

  // Hover handler
  const onHover = (key: string, e: React.MouseEvent<SVGElement>) => {
    const svg = (e.currentTarget as SVGElement).closest('svg');
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    setTooltip({ text: TOOLTIPS[key] || key, x: svgP.x, y: svgP.y });
  };
  const offHover = () => setTooltip(null);

  return (
          <svg width="100%" viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl" style={{ cursor: 'default' }}>
      <defs>
        <style>{`
          @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
          @keyframes heartbeat { 0%,100% { transform: scale(1); } 15% { transform: scale(1.06); } 30% { transform: scale(1); } 45% { transform: scale(1.03); } }
          @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        `}</style>
      </defs>

      {/* ===== BRAIN ===== */}
      <g onMouseEnter={(e) => onHover('brain', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <ellipse cx={cx} cy={cy - 120} rx={55} ry={45} fill={brainColor} opacity={cs.cbf > 0.5 ? 0.6 : 0.3}
          style={beatDur > 0 ? { animation: `pulse ${beatDur}s ease-in-out infinite` } : {}} />
        <path d={`M ${cx-30} ${cy-120} Q ${cx-45} ${cy-155} ${cx} ${cy-160} Q ${cx+45} ${cy-155} ${cx+30} ${cy-120}`}
          fill="none" stroke={brainColor} strokeWidth={2} opacity={0.5} />
      </g>
      <g onMouseEnter={(e) => onHover('cbf', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 70} y={cy - 125} fill="#94a3b8" fontSize="12" fontWeight="bold">CBF</text>
        <text x={cx + 70} y={cy - 108} fill={brainColor} fontSize="18" fontWeight="bold">{(cs.cbf * 100).toFixed(0)}%</text>
      </g>

      {/* Carotids */}
      <line x1={cx - 12} y1={cy - 75} x2={cx - 15} y2={cy - 40} stroke="#ef4444" strokeWidth={3} opacity={0.4} />
      <line x1={cx + 12} y1={cy - 75} x2={cx + 15} y2={cy - 40} stroke="#ef4444" strokeWidth={3} opacity={0.4} />

      {/* ===== LUNGS ===== */}
      <g style={cs.rr > 0 ? { animation: `breathe ${60/cs.rr}s ease-in-out infinite`, transformOrigin: `${cx}px ${cy-20}px` } : {}}>
        {/* Right lung */}
        <g onMouseEnter={(e) => onHover('rlung', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx - 90} cy={cy + 5} rx={68} ry={85} fill={lungColor} stroke="#60a5fa" strokeWidth={1.5} opacity={0.4} />
          <path d={`M ${cx-60} ${cy-40} L ${cx-60} ${cy+20} M ${cx-75} ${cy-25} L ${cx-75} ${cy+10} M ${cx-90} ${cy-10} L ${cx-90} ${cy+5}`}
            stroke="#93c5fd" strokeWidth={1} opacity={0.3} />
        </g>
        {/* Left lung */}
        <g onMouseEnter={(e) => onHover('llung', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx + 90} cy={cy + 5} rx={68} ry={85} fill={lungColor} stroke="#60a5fa" strokeWidth={1.5} opacity={0.4} />
          <path d={`M ${cx+60} ${cy-40} L ${cx+60} ${cy+20} M ${cx+75} ${cy-25} L ${cx+75} ${cy+10} M ${cx+90} ${cy-10} L ${cx+90} ${cy+5}`}
            stroke="#93c5fd" strokeWidth={1} opacity={0.3} />
        </g>
        {/* Edema overlay */}
        {edemaOpacity > 0 && (
          <>
            <ellipse cx={cx - 90} cy={cy + 5} rx={68} ry={85} fill="#3b82f6" opacity={edemaOpacity * 0.4} />
            <ellipse cx={cx + 90} cy={cy + 5} rx={68} ry={85} fill="#3b82f6" opacity={edemaOpacity * 0.4} />
            {cs.pulmonaryEdema !== 'none' && (
              <>
                <line x1={cx-110} y1={cy-30} x2={cx-110} y2={cy+40} stroke="#93c5fd" strokeWidth={1} opacity={0.6} strokeDasharray="4,4" />
                <line x1={cx-80} y1={cy-40} x2={cx-80} y2={cy+50} stroke="#93c5fd" strokeWidth={1} opacity={0.6} strokeDasharray="4,4" />
                <line x1={cx+80} y1={cy-40} x2={cx+80} y2={cy+50} stroke="#93c5fd" strokeWidth={1} opacity={0.6} strokeDasharray="4,4" />
                <line x1={cx+110} y1={cy-30} x2={cx+110} y2={cy+40} stroke="#93c5fd" strokeWidth={1} opacity={0.6} strokeDasharray="4,4" />
              </>
            )}
          </>
        )}
      </g>
      <text x={cx - 90} y={cy - 70} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">R LUNG</text>
      <text x={cx + 90} y={cy - 70} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">L LUNG</text>

      {/* ===== 4-CHAMBER HEART ===== */}
      <g style={beatDur > 0 ? { animation: `heartbeat ${beatDur}s infinite`, transformOrigin: `${cx}px ${cy+2}px` } : {}}>
        {/* Pericardium */}
        <g onMouseEnter={(e) => onHover('heart', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx} cy={cy + 5} rx={60 * Math.max(cs.rvDilation, cs.lvDilation)} ry={55 * Math.max(cs.rvDilation, cs.lvDilation)}
            fill="none" stroke={heartColor} strokeWidth={2 * cs.wallThickness} opacity={0.5} strokeDasharray="6,3" />
        </g>
        {/* RA */}
        <g onMouseEnter={(e) => onHover('ra', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx - 22 * cs.rvDilation} cy={cy - 12} rx={22 * cs.rvDilation} ry={20 * cs.rvDilation}
            fill={heartColor} opacity={0.4} stroke={heartColor} strokeWidth={1.5} />
          <text x={cx - 22 * cs.rvDilation} y={cy - 18} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">RA</text>
          <text x={cx - 22 * cs.rvDilation} y={cy - 5} fill="#fbbf24" fontSize="14" fontWeight="bold" textAnchor="middle">{cs.raP.toFixed(0)}</text>
        </g>
        {/* RV */}
        <g onMouseEnter={(e) => onHover('rv', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx - 22 * cs.rvDilation} cy={cy + 22} rx={24 * cs.rvDilation} ry={22 * cs.rvDilation}
            fill={heartColor} opacity={0.5} stroke={heartColor} strokeWidth={2 * cs.wallThickness} />
          <text x={cx - 22 * cs.rvDilation} y={cy + 16} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">RV</text>
          <text x={cx - 22 * cs.rvDilation} y={cy + 31} fill="#fbbf24" fontSize="13" fontWeight="bold" textAnchor="middle">{cs.rvSys.toFixed(0)}/{cs.rvDia.toFixed(0)}</text>
        </g>
        {/* LA */}
        <g onMouseEnter={(e) => onHover('la', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx + 22 * cs.lvDilation} cy={cy - 12} rx={22 * cs.lvDilation} ry={20 * cs.lvDilation}
            fill={heartColor} opacity={0.4} stroke={heartColor} strokeWidth={1.5} />
          <text x={cx + 22 * cs.lvDilation} y={cy - 18} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">LA</text>
          <text x={cx + 22 * cs.lvDilation} y={cy - 5} fill="#fbbf24" fontSize="14" fontWeight="bold" textAnchor="middle">{cs.laP.toFixed(0)}</text>
        </g>
        {/* LV */}
        <g onMouseEnter={(e) => onHover('lv', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <ellipse cx={cx + 22 * cs.lvDilation} cy={cy + 22} rx={26 * cs.lvDilation} ry={24 * cs.lvDilation}
            fill={heartColor} opacity={0.5} stroke={heartColor} strokeWidth={3 * cs.wallThickness} />
          <text x={cx + 22 * cs.lvDilation} y={cy + 16} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">LV</text>
          <text x={cx + 22 * cs.lvDilation} y={cy + 31} fill="#fbbf24" fontSize="13" fontWeight="bold" textAnchor="middle">{cs.lvSys.toFixed(0)}/{cs.lvDia.toFixed(0)}</text>
        </g>
        {/* Septum */}
        <line x1={cx} y1={cy - 30} x2={cx} y2={cy + 45} stroke={heartColor} strokeWidth={2} opacity={0.6} />
        {/* Valves */}
        <circle cx={cx - 8} cy={cy + 2} r={3} fill="#fbbf24" opacity={0.7} />
        <circle cx={cx + 8} cy={cy + 2} r={3} fill="#fbbf24" opacity={0.7} />
        {/* Aorta */}
        <path d={`M ${cx + 15} ${cy - 30} Q ${cx + 50} ${cy - 65} ${cx + 30} ${cy - 75}`}
          fill="none" stroke="#ef4444" strokeWidth={4} opacity={0.6} />
        {/* PA */}
        <path d={`M ${cx - 15} ${cy - 30} Q ${cx - 50} ${cy - 55} ${cx - 35} ${cy - 65}`}
          fill="none" stroke="#3b82f6" strokeWidth={3} opacity={0.5} />
      </g>
      {/* PA Pressure */}
      <g onMouseEnter={(e) => onHover('pa', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 80} y={cy - 35} fill="#94a3b8" fontSize="10" fontWeight="bold">PA</text>
        <text x={cx - 80} y={cy - 22} fill="#60a5fa" fontSize="13" fontWeight="bold">{cs.paSys.toFixed(0)}/{cs.paDia.toFixed(0)}</text>
      </g>

      {/* ===== PRELOAD / AFTERLOAD BARS ===== */}
      <g onMouseEnter={(e) => onHover('preload', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 142} y={cy + 72} fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">PRELOAD</text>
        <rect x={cx - 180} y={cy + 78} width={75} height={9} rx={4} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
        <rect x={cx - 180} y={cy + 78} width={75 * cs.preload} height={9} rx={4}
          fill={cs.preload > 0.8 ? '#ef4444' : cs.preload < 0.4 ? '#f59e0b' : '#22c55e'} />
      </g>
      <g onMouseEnter={(e) => onHover('afterload', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 142} y={cy + 72} fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">AFTERLOAD</text>
        <rect x={cx + 105} y={cy + 78} width={75} height={9} rx={4} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
        <rect x={cx + 105} y={cy + 78} width={75 * cs.afterload} height={9} rx={4}
          fill={cs.afterload > 0.7 ? '#ef4444' : cs.afterload < 0.3 ? '#3b82f6' : '#22c55e'} />
      </g>

      {/* ===== HEMODYNAMICS DATA PANEL ===== */}
      {/* Heart state badge */}
      <g onMouseEnter={(e) => onHover('heartState', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <rect x={cx - 82} y={cy + 95} width={164} height={26} rx={13}
          fill={cs.heartState === 'failure' ? '#7f1d1d' : cs.heartState === 'hyperdynamic' ? '#713f12' : cs.heartState === 'dilated' ? '#7c2d12' : '#14532d'}
          stroke={cs.heartState === 'failure' ? '#dc2626' : cs.heartState === 'hyperdynamic' ? '#f59e0b' : cs.heartState === 'dilated' ? '#f97316' : '#22c55e'}
          strokeWidth={1.5} />
        <text x={cx} y={cy + 112} fill="white" fontSize="13" textAnchor="middle" fontWeight="bold">
          {cs.heartState === 'failure' ? 'HF - Reduced EF' : cs.heartState === 'hyperdynamic' ? 'HYPERDYNAMIC' : cs.heartState === 'dilated' ? 'DILATED CM' : 'NORMAL'}
        </text>
      </g>

      {/* Row 1: CO / EF / SV */}
      <g onMouseEnter={(e) => onHover('co', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 120} y={cy + 140} fill="#94a3b8" fontSize="12">CO</text>
        <text x={cx - 120} y={cy + 157} fill="#22d3ee" fontSize="17" fontWeight="bold">{cs.co.toFixed(1)}</text>
        <text x={cx - 84} y={cy + 157} fill="#64748b" fontSize="10">L/min</text>
      </g>
      <g onMouseEnter={(e) => onHover('ef', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 22} y={cy + 140} fill="#94a3b8" fontSize="12">EF</text>
        <text x={cx - 22} y={cy + 157} fill={cs.ef < 0.4 ? '#ef4444' : '#22c55e'} fontSize="17" fontWeight="bold">{(cs.ef * 100).toFixed(0)}%</text>
      </g>
      <g onMouseEnter={(e) => onHover('sv', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 45} y={cy + 140} fill="#94a3b8" fontSize="12">SV</text>
        <text x={cx + 45} y={cy + 157} fill="#22d3ee" fontSize="17" fontWeight="bold">{cs.sv.toFixed(0)}</text>
        <text x={cx + 81} y={cy + 157} fill="#64748b" fontSize="10">mL</text>
      </g>

      {/* Row 2: SVR / PCWP / Contractility */}
      <g onMouseEnter={(e) => onHover('svr', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 120} y={cy + 175} fill="#94a3b8" fontSize="12">SVR</text>
        <text x={cx - 120} y={cy + 192} fill={cs.svr > 1800 ? '#ef4444' : cs.svr < 800 ? '#3b82f6' : '#22c55e'} fontSize="15" fontWeight="bold">{cs.svr.toFixed(0)}</text>
      </g>
      <g onMouseEnter={(e) => onHover('pcwp', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 22} y={cy + 175} fill="#94a3b8" fontSize="12">PCWP</text>
        <text x={cx - 22} y={cy + 192} fill={cs.pcwp > 20 ? '#ef4444' : cs.pcwp > 16 ? '#f59e0b' : '#22c55e'} fontSize="15" fontWeight="bold">{cs.pcwp.toFixed(0)}</text>
        <text x={cx + 22} y={cy + 192} fill="#64748b" fontSize="10">mmHg</text>
      </g>
      <g onMouseEnter={(e) => onHover('contractility', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 82} y={cy + 175} fill="#94a3b8" fontSize="10">dP/dt</text>
        <text x={cx + 82} y={cy + 192} fill={contractColor} fontSize="15" fontWeight="bold">{cs.contractility.toFixed(0)}</text>
        <text x={cx + 123} y={cy + 192} fill="#64748b" fontSize="9">mmHg/s</text>
      </g>
      {/* Contractility bar */}
      <rect x={cx + 67} y={cy + 197} width={67} height={6} rx={3} fill="#1e293b" />
      <rect x={cx + 67} y={cy + 197} width={67 * Math.min(1, cs.contractility / 2000)} height={6} rx={3} fill={contractColor} />

      {/* Pulmonary edema warning */}
      {cs.pulmonaryEdema !== 'none' && (
        <g onMouseEnter={(e) => onHover('pulmonaryEdema', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <text x={cx} y={cy + 220} fill={cs.pulmonaryEdema === 'flash' ? '#ef4444' : '#f59e0b'} fontSize="15" textAnchor="middle" fontWeight="bold" style={{ animation: cs.pulmonaryEdema === 'flash' ? 'pulse 0.5s infinite' : 'none' }}>
            {cs.pulmonaryEdema === 'flash' ? '\u26A0 FLASH PULM EDEMA' : cs.pulmonaryEdema === 'moderate' ? '\u26A0 PULM EDEMA' : 'Mild Congestion'}
          </text>
        </g>
      )}

      {/* ===== ALVEOLAR-CAPILLARY GAS EXCHANGE ===== */}
      <line x1={cx - 200} y1={cy + 235} x2={cx + 200} y2={cy + 235} stroke="#334155" strokeWidth={0.5} />
      <text x={cx} y={cy + 255} fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="0.15em">ALVEOLAR-CAPILLARY GAS EXCHANGE</text>

      {/* Alveolus */}
      <g onMouseEnter={(e) => onHover('alveolus', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <circle cx={cx - 75} cy={cy + 310} rx={60} ry={55} fill="#0f172a" stroke="#334155" strokeWidth={1.5} />
        <text x={cx - 75} y={cy + 278} fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">ALVEOLUS</text>
      </g>
      <g onMouseEnter={(e) => onHover('pao2', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 75} y={cy + 298} fill="#94a3b8" fontSize="10">{"PAO\u2082"}</text>
        <text x={cx - 75} y={cy + 316} fill="#f59e0b" fontSize="18" fontWeight="bold" textAnchor="middle">{cs.pao2Alveolar.toFixed(0)}</text>
      </g>
      <g onMouseEnter={(e) => onHover('paco2', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 75} y={cy + 332} fill="#94a3b8" fontSize="10">{"PACO₂"}</text>
        <text x={cx - 75} y={cy + 350} fill="#a855f7" fontSize="18" fontWeight="bold" textAnchor="middle">{cs.paco2.toFixed(0)}</text>
      </g>

      {/* Membrane */}
      <g onMouseEnter={(e) => onHover('membrane', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <line x1={cx - 12} y1={cy + 275} x2={cx - 12} y2={cy + 360} stroke="#475569" strokeWidth={3} strokeDasharray="6,3" />
        <text x={cx - 8} y={cy + 272} fill="#475569" fontSize="8" textAnchor="middle">MEMBRANE</text>
      </g>

      {/* Pulmonary capillary */}
      <g onMouseEnter={(e) => onHover('capillary', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <rect x={cx + 10} y={cy + 275} width={195} height={80} rx={9} fill="#0f172a" stroke="#334155" strokeWidth={1.5} />
        <text x={cx + 107} y={cy + 290} fill="#64748b" fontSize="10" fontWeight="bold" textAnchor="middle">PULM CAPILLARY</text>
        <text x={cx + 45} y={cy + 310} fill="#94a3b8" fontSize="10">{"PcO₂"}</text>
        <text x={cx + 45} y={cy + 326} fill="#f59e0b" fontSize="16" fontWeight="bold">{cs.capPo2.toFixed(0)}</text>
        <text x={cx + 115} y={cy + 310} fill="#94a3b8" fontSize="10">{"PcCO₂"}</text>
        <text x={cx + 115} y={cy + 326} fill="#a855f7" fontSize="16" fontWeight="bold">{cs.paco2.toFixed(0)}</text>
      </g>
      <g onMouseEnter={(e) => onHover('hydrostatic', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 30} y={cy + 345} fill="#ef4444" fontSize="10">Hydro: {cs.capHydrostatic.toFixed(0)} mmHg</text>
      </g>
      <g onMouseEnter={(e) => onHover('oncotic', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 120} y={cy + 345} fill="#3b82f6" fontSize="10">Oncotic: {cs.capOncotic} mmHg</text>
      </g>

      {/* O2/CO2 diffusion arrows */}
      <line x1={cx - 20} y1={cy + 300} x2={cx + 8} y2={cy + 300} stroke="#f59e0b" strokeWidth={2} markerEnd="url(#arrowBlue)" />
      <text x={cx - 7} y={cy + 295} fill="#f59e0b" fontSize="9" textAnchor="middle">{"O₂"}</text>
      <line x1={cx + 8} y1={cy + 340} x2={cx - 20} y2={cy + 340} stroke="#a855f7" strokeWidth={2} markerEnd="url(#arrowPurple)" />
      <text x={cx - 7} y={cy + 352} fill="#a855f7" fontSize="9" textAnchor="middle">{"CO₂"}</text>

      {/* Edema fluid in alveolus when PCWP high */}
      {cs.pulmonaryEdema !== 'none' && (
        <>
          <ellipse cx={cx - 75} cy={cy + 340} rx={45} ry={edemaOpacity * 15} fill="#3b82f6" opacity={edemaOpacity * 0.5} />
          <text x={cx - 75} y={cy + 370} fill="#60a5fa" fontSize="9" textAnchor="middle">TRANSUDATE</text>
        </>
      )}

      {/* Gas Exchange Efficiency panel */}
      <rect x={cx - 195} y={cy + 380} width={390} height={55} rx={6} fill="#0f172a" stroke="#334155" strokeWidth={1} />
      <g onMouseEnter={(e) => onHover('aaGradient', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 180} y={cy + 400} fill="#94a3b8" fontSize="11" fontWeight="bold">A-a Gradient</text>
        <text x={cx - 180} y={cy + 418} fill={cs.aaGradient > 25 ? '#ef4444' : cs.aaGradient > 15 ? '#f59e0b' : '#22c55e'} fontSize="18" fontWeight="bold">{cs.aaGradient.toFixed(0)} mmHg</text>
      </g>
      <g onMouseEnter={(e) => onHover('arterialPo2', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 40} y={cy + 400} fill="#94a3b8" fontSize="11" fontWeight="bold">{"PaO₂"}</text>
        <text x={cx - 40} y={cy + 418} fill={cs.pao2 < 60 ? '#ef4444' : cs.pao2 < 80 ? '#f59e0b' : '#22c55e'} fontSize="18" fontWeight="bold">{cs.pao2.toFixed(0)} mmHg</text>
      </g>
      <g onMouseEnter={(e) => onHover('paco2', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx + 100} y={cy + 400} fill="#94a3b8" fontSize="11" fontWeight="bold">{"PaCO₂"}</text>
        <text x={cx + 100} y={cy + 418} fill={cs.paco2 > 50 ? '#ef4444' : cs.paco2 < 30 ? '#3b82f6' : '#22c55e'} fontSize="18" fontWeight="bold">{cs.paco2.toFixed(0)} mmHg</text>
      </g>

      {/* Exchange efficiency bar */}
      <g onMouseEnter={(e) => onHover('exchangeEff', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
        <text x={cx - 180} y={cy + 432} fill="#94a3b8" fontSize="10">Exchange Efficiency</text>
        <rect x={cx - 60} y={cy + 424} width={200} height={8} rx={4} fill="#1e293b" />
        <rect x={cx - 60} y={cy + 424} width={200 * cs.gasExchangeEff} height={8} rx={4}
          fill={cs.gasExchangeEff > 0.8 ? '#22c55e' : cs.gasExchangeEff > 0.5 ? '#f59e0b' : '#ef4444'} />
        <text x={cx + 148} y={cy + 432} fill="white" fontSize="11" fontWeight="bold">{(cs.gasExchangeEff * 100).toFixed(0)}%</text>
      </g>

      {/* Net filtration (Starling) */}
      {cs.netFiltration > 0 && (
        <g onMouseEnter={(e) => onHover('netFiltration', e)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
          <text x={cx} y={cy + 455} fill="#f59e0b" fontSize="12" textAnchor="middle" fontWeight="bold">
            Net Filtration: +{cs.netFiltration.toFixed(0)} mmHg (edema risk)
          </text>
        </g>
      )}

      {/* Arrow markers */}
      <defs>
        <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#3b82f6" /></marker>
        <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#a855f7" /></marker>
      </defs>

      {/* ===== TOOLTIP OVERLAY ===== */}
      {tooltip && (
        <g>
          {/* Background */}
          <rect x={Math.min(tooltip.x - 10, size - 330)} y={tooltip.y - 65}
            width={320} height={55} rx={8}
            fill="#1e293b" stroke="#475569" strokeWidth={1.5}
            filter="url(#tooltipShadow)" />
          {/* Text - wrapped manually */}
          {tooltip.text.split('. ').slice(0, 3).map((line, i) => (
            <text key={i}
              x={Math.min(tooltip.x, size - 320) + 5}
              y={tooltip.y - 48 + i * 16}
              fill="#e2e8f0" fontSize="11" fontFamily="system-ui">
              {line.length > 55 ? line.substring(0, 55) + '...' : line + (i < 2 ? '.' : '')}
            </text>
          ))}
        </g>
      )}
      <defs>
        <filter id="tooltipShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
    </svg>
  );
}
