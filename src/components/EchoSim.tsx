/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

interface HemoParams {
  preload: number; afterload: number; contractility: number; heartRate: number; compliance: number;
}
interface PVPoint { v: number; p: number; }
interface FSPoint { edv: number; sv: number; }
interface Hemo {
  EDV: number; ESV: number; SV: number; EF: number; CO: number; heartRate: number;
  EDP: number; ESP: number; systolicBP: number; diastolicBP: number;
  LVIDd_cm: number; LVIDs_cm: number; FS: number; IVSd: number; LVPWd: number;
  RWT: number; LVmass: number; E_wave: number; A_wave: number; EA_ratio: number;
  DT: number; e_prime: number; Ee_ratio: number; TAPSE: number;
  diastolicGrade: string; pvLoop: PVPoint[]; fsCurve: FSPoint[];
  fsPoint: FSPoint; Ees: number; V0: number;
}

function computeHemodynamicsQuick(params: HemoParams) {
  const { preload: EDV, afterload, contractility } = params;
  const Ees = 2.5 * contractility, V0 = 10, Ea = afterload / 60;
  const ESV = Math.max(V0 + 5, Math.min((Ea * EDV + Ees * V0) / (Ees + Ea), EDV - 10));
  return { SV: EDV - ESV };
}

function computeHemodynamics(params: HemoParams): Hemo {
  const { preload: EDV, afterload, contractility, heartRate } = params;
  const Ees = 2.5 * contractility;
  const V0 = 10;
  const EDP = 4 + Math.exp((EDV - 100) * 0.025) * 3;
  const Ea = afterload / 60;
  const ESV = Math.max(V0 + 5, Math.min((Ea * EDV + Ees * V0) / (Ees + Ea), EDV - 10));
  const SV = EDV - ESV;
  const EF = (SV / EDV) * 100;
  const CO = (SV * heartRate) / 1000;
  const ESP = Ees * (ESV - V0);
  const systolicBP = Math.min(ESP, afterload * 1.3);
  const diastolicBP = afterload * 0.6;
  const LVIDd_cm = Math.pow(EDV * 0.75, 1 / 3);
  const LVIDs_cm = Math.pow(ESV * 0.75, 1 / 3);
  const FS = ((LVIDd_cm - LVIDs_cm) / LVIDd_cm) * 100;
  const IVSd = 0.8 + (afterload - 80) * 0.008;
  const LVPWd = 0.8 + (afterload - 80) * 0.007;
  const RWT = (2 * LVPWd) / LVIDd_cm;
  const LVmass = 0.8 * 1.04 * (Math.pow(LVIDd_cm + IVSd + LVPWd, 3) - Math.pow(LVIDd_cm, 3)) + 0.6;
  const E_wave = 0.5 + (EDP - 4) * 0.08;
  const A_wave = 0.3 + (heartRate - 60) * 0.003 + Math.max(0, (EDP - 12) * 0.02);
  const EA_ratio = E_wave / Math.max(A_wave, 0.1);
  const DT = Math.max(120, 250 - (EDP - 8) * 10);
  const e_prime = Math.max(0.03, 0.12 - (afterload - 80) * 0.001 - Math.max(0, (EDP - 10) * 0.005));
  const Ee_ratio = E_wave / e_prime;
  const TAPSE = Math.max(1.0, 2.2 - (afterload - 100) * 0.005);
  let diastolicGrade = 'Normal';
  if (Ee_ratio > 14) diastolicGrade = 'Grade III';
  else if (Ee_ratio > 10 && EA_ratio > 2) diastolicGrade = 'Grade II';
  else if (EA_ratio < 0.8 || e_prime < 0.07) diastolicGrade = 'Grade I';
  const pvLoop: PVPoint[] = [];
  const N = 60;
  for (let i = 0; i <= N / 4; i++) { const t = i / (N / 4); const v = ESV + (EDV - ESV) * t; pvLoop.push({ v, p: Math.max(2, 2 + Math.exp((v - 100) * 0.02) * 2 * t) }); }
  for (let i = 1; i <= N / 4; i++) { const t = i / (N / 4); pvLoop.push({ v: EDV, p: EDP + (ESP * 0.9 - EDP) * t }); }
  for (let i = 1; i <= N / 4; i++) { const t = i / (N / 4); const v = EDV - (EDV - ESV) * t; pvLoop.push({ v, p: Math.max(ESP * 0.9 + (ESP - ESP * 0.9) * Math.sin(t * Math.PI), Ees * (v - V0)) }); }
  for (let i = 1; i <= N / 4; i++) { const t = i / (N / 4); pvLoop.push({ v: ESV, p: Math.max(2, Ees * (ESV - V0) * (1 - t) + 2 * t) }); }
  const fsCurve: FSPoint[] = [];
  for (let edv = 40; edv <= 200; edv += 3) {
    const h = computeHemodynamicsQuick({ ...params, preload: edv });
    fsCurve.push({ edv, sv: h.SV });
  }
  return {
    EDV, ESV, SV, EF, CO, heartRate, EDP, ESP, systolicBP, diastolicBP,
    LVIDd_cm, LVIDs_cm, FS, IVSd, LVPWd, RWT, LVmass,
    E_wave, A_wave, EA_ratio, DT, e_prime, Ee_ratio, TAPSE,
    diastolicGrade, pvLoop, fsCurve, fsPoint: { edv: EDV, sv: SV }, Ees, V0,
  };
}

function UltrasoundA4C({ hemo, canvasSize }: { hemo: Hemo; canvasSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speckleRef = useRef<{ data: Float32Array; size: number } | null>(null);
  const timeRef = useRef(0);
  useEffect(() => {
    const NS = 512; const speckle = new Float32Array(NS * NS);
    for (let i = 0; i < NS * NS; i++) { const g1 = (Math.random() - 0.5) * 2; const g2 = (Math.random() - 0.5) * 2; speckle[i] = Math.sqrt(g1 * g1 + g2 * g2); }
    speckleRef.current = { data: speckle, size: NS };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !speckleRef.current) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height; let animId: number;
    const draw = () => {
      timeRef.current += 1 / 60; const t = timeRef.current;
      const period = 60 / hemo.heartRate; const phase = (t % period) / period;
      let wf: number;
      if (phase < 0.05) wf = phase / 0.05 * 0.3;
      else if (phase < 0.35) { const ep = (phase - 0.05) / 0.3; wf = 0.3 + 0.7 * Math.sin(ep * Math.PI / 2); }
      else if (phase < 0.40) { const rp = (phase - 0.35) / 0.05; wf = 1.0 - rp * 0.3; }
      else if (phase < 0.65) { const fp = (phase - 0.40) / 0.25; wf = 0.7 * (1 - fp); }
      else if (phase < 0.85) wf = 0.0;
      else { const ap = (phase - 0.85) / 0.15; wf = 0.15 * Math.sin(ap * Math.PI); }
      const lvWd = hemo.LVIDd_cm * 28, lvWs = hemo.LVIDs_cm * 28;
      const lvW = lvWd - (lvWd - lvWs) * wf, lvL = lvW * 2.1;
      const wallT = hemo.IVSd * 12 + wf * 4;
      const rvW = lvW * 0.65, rvL = lvL * 0.85;
      const raW = rvW * 0.85 + wf * 6, raL = rvL * 0.4 + wf * 4;
const imgData = ctx.createImageData(W, H); const px = imgData.data;
      const spk = speckleRef.current!; const sd = spk.data, ss = spk.size;
      for (let py = 0; py < H; py++) {
        for (let ppx = 0; ppx < W; ppx++) {
          const dx = ppx - aX, dy = py - aY, dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dx, dy); const idx = (py * W + ppx) * 4;
          if (Math.abs(angle) > sA / 2 || dist > sD || dist < 8) { px[idx] = 0; px[idx+1] = 0; px[idx+2] = 0; px[idx+3] = 255; continue; }
          const nD = dist / sD; const att = Math.exp(-nD * 1.8) * (1 + nD * 1.2);
          const sX = ((ppx + Math.floor(wf * 3)) % ss + ss) % ss;
          const sY = ((py + Math.floor(wf * 2)) % ss + ss) % ss;
          const sv = sd[sY * ss + sX]; const hCY = sD * 0.32;
          const hx = ppx - aX, hy = py - aY - hCY;
          const lvCX = -lvW * 0.3, lvCY = -lvL * 0.15, lvRX = lvW / 2, lvRY = lvL / 2;
          const lvDst = Math.pow((hx - lvCX) / lvRX, 2) + Math.pow((hy - lvCY) / lvRY, 2);
          const rvCX = rvW * 0.55, rvCY = -rvL * 0.1, rvRX = rvW / 2, rvRY = rvL / 2;
          const rvDst = Math.pow((hx - rvCX) / rvRX, 2) + Math.pow((hy - rvCY) / rvRY, 2);
          const laCX = lvCX - 5, laCY = lvCY + lvRY + laL * 0.45, laRX = laW / 2, laRY = laL / 2;
          const laDst = Math.pow((hx - laCX) / laRX, 2) + Math.pow((hy - laCY) / laRY, 2);
          const raCX = rvCX + 3, raCY = rvCY + rvRY + raL * 0.45, raRX = raW / 2, raRY = raL / 2;
          const raDst = Math.pow((hx - raCX) / raRX, 2) + Math.pow((hy - raCY) / raRY, 2);
          const sepX = (lvCX + lvRX + rvCX - rvRX) / 2;
          const sepIn = Math.abs(hx - sepX) < wallT / 2 && hy > Math.min(lvCY - lvRY, rvCY - rvRY) * 0.8 && hy < Math.max(lvCY + lvRY, rvCY + rvRY) * 0.7;
          let br = 0; let cav = false;
          if (lvDst < 0.85) { br = sv * 8 * att; cav = true; }
          else if (rvDst < 0.82) { br = sv * 10 * att; cav = true; }
          else if (laDst < 0.80) { br = sv * 9 * att; cav = true; }
          else if (raDst < 0.78) { br = sv * 10 * att; cav = true; }
          else if (lvDst < 1.0) { br = (60 + sv * 80 * (1 - (lvDst - 0.85) / 0.15)) * att; }
          else if (rvDst < 1.0) { br = (50 + sv * 70 * (1 - (rvDst - 0.82) / 0.18)) * att; }
          else if (laDst < 1.0) { br = (45 + sv * 60 * (1 - (laDst - 0.80) / 0.20)) * att; }
          else if (raDst < 1.0) { br = (45 + sv * 60 * (1 - (raDst - 0.78) / 0.22)) * att; }
          else if (sepIn) { br = (55 + sv * 50) * att; }
          else if (lvDst < 1.6) { br = (40 + sv * 55) * att; }
          else if (rvDst < 1.5) { br = (35 + sv * 45) * att; }
          else { br = (15 + sv * 25) * att; if (nD < 0.08) br += 30 * (1 - nD / 0.08); }
          const lc = Math.log(1 + br * 0.8) / Math.log(1 + 120) * 255;
          if (cav) { px[idx] = Math.min(255, lc * 0.15); px[idx+1] = Math.min(255, lc * 0.12); px[idx+2] = Math.min(255, lc * 0.2); }
          else { px[idx] = Math.min(255, lc * 1.05); px[idx+1] = Math.min(255, lc * 0.9); px[idx+2] = Math.min(255, lc * 0.7); }
          px[idx+3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      ctx.strokeStyle = 'rgba(80,160,120,0.4)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(aX, aY); ctx.lineTo(aX + Math.sin(-sA / 2) * sD, aY + Math.cos(-sA / 2) * sD);
      ctx.moveTo(aX, aY); ctx.lineTo(aX + Math.sin(sA / 2) * sD, aY + Math.cos(sA / 2) * sD); ctx.stroke();
      ctx.fillStyle = 'rgba(120,200,160,0.6)'; ctx.font = 'bold 10px monospace';
      const hYO = aY + sD * 0.32;
      ctx.fillText('LV', aX - lvW * 0.3 - 8, hYO - 5); ctx.fillText('RV', aX + rvW * 0.55 - 8, hYO - 5);
      ctx.fillText('LA', aX - lvW * 0.3 - 8, hYO + lvL * 0.5 + 15); ctx.fillText('RA', aX + rvW * 0.55 - 8, hYO + rvL * 0.4 + 12);
      ctx.strokeStyle = 'rgba(80,220,120,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath();
      const ecgY2 = H - 18;
      for (let x = 0; x < W; x++) {
        const ep2 = ((x / W * 2.5) + phase) % 1; let ev = 0;
        if (ep2 > 0.1 && ep2 < 0.12) ev = -0.15;
        else if (ep2 > 0.16 && ep2 < 0.17) ev = -0.1;
        else if (ep2 > 0.17 && ep2 < 0.19) ev = 0.9;
        else if (ep2 > 0.19 && ep2 < 0.21) ev = -0.2;
        else if (ep2 > 0.25 && ep2 < 0.35) ev = 0.2 * Math.sin((ep2 - 0.25) / 0.1 * Math.PI);
        x === 0 ? ctx.moveTo(x, ecgY2 - ev * 14) : ctx.lineTo(x, ecgY2 - ev * 14);
      }
      ctx.stroke();
      animId = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(animId);
  }, [hemo]);
  return <canvas ref={canvasRef} width={canvasSize} height={canvasSize} style={{ width: '100%', height: 'auto', borderRadius: '6px' }} />;
}

export interface EchoSimProps {
  vitals: { hr: number; sbp: number; dbp: number; map: number; spo2: number; rr: number; etco2: number };
  patient: { age: number; weight: number; height: number; sex: string; asa: number; copd?: boolean; hepaticImpairment?: boolean; renalImpairment?: boolean };
  moass: number;
  combinedEff: number;
  pkStates: Record<string, { ce: number }>;
}

export default function EchoSim({ vitals, patient, moass, combinedEff, pkStates }: EchoSimProps) {
  let ees = 2.5;
  let edpScale = 1.0;
  let vedv = 130;
  let peakSys = vitals.sbp || 120;
  const hr = vitals.hr || 75;

  // Age
  if (patient.age > 65) { ees -= 0.4; edpScale += 0.3; }
  else if (patient.age > 50) { ees -= 0.2; edpScale += 0.15; }
  // ASA
  if (patient.asa >= 3) { ees -= 0.3; edpScale += 0.2; }
  else if (patient.asa >= 2) { ees -= 0.1; }
  // Comorbidities
  if (patient.copd) { vedv -= 5; }
  if (patient.hepaticImpairment) { ees -= 0.2; }
  if (patient.renalImpairment) { edpScale += 0.2; vedv += 10; }
  // Drug effects
  for (const [drug, state] of Object.entries(pkStates)) {
    const ce = state.ce;
    if (drug === 'propofol' && ce > 0) { ees -= ce * 0.15; peakSys -= ce * 5; }
    if (drug === 'midazolam' && ce > 0) { ees -= ce * 0.05; }
    if (drug === 'fentanyl' && ce > 0) { ees -= ce * 0.2; peakSys -= ce * 3; }
    if (drug === 'ketamine' && ce > 0) { ees += ce * 0.1; peakSys += ce * 4; }
  }
  // MOASS
  if (moass >= 4) { ees -= 0.3; peakSys -= 15; }
  else if (moass >= 2) { ees -= 0.15; peakSys -= 8; }
  ees -= combinedEff * 0.08;

  // Clamp
  ees = Math.max(0.8, Math.min(4.0, ees));
  vedv = Math.max(80, Math.min(180, vedv));
  peakSys = Math.max(70, Math.min(200, peakSys));

  const contractility = ees / 2.5;
  const afterload = peakSys * 0.6;
  const preload = vedv * edpScale * 0.92;

  const hemo = computeHemodynamics({
    preload: Math.max(40, Math.min(200, preload)),
    afterload: Math.max(40, Math.min(200, afterload)),
    contractility: Math.max(0.3, Math.min(2.0, contractility)),
    heartRate: hr,
    compliance: 0.06,
  });

  return (
    <div className="space-y-2">
      <UltrasoundA4C hemo={hemo} canvasSize={300} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs px-1">
        <div className="flex justify-between"><span className="text-gray-400">EF</span><span className={hemo.EF < 40 ? 'text-red-400' : hemo.EF < 55 ? 'text-yellow-400' : 'text-green-400'}>{hemo.EF.toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-gray-400">CO</span><span>{hemo.CO.toFixed(1)} L/min</span></div>
        <div className="flex justify-between"><span className="text-gray-400">SV</span><span>{hemo.SV.toFixed(0)} mL</span></div>
        <div className="flex justify-between"><span className="text-gray-400">FS</span><span>{hemo.FS.toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-gray-400">E/A</span><span className={hemo.EA_ratio < 0.8 ? 'text-yellow-400' : hemo.EA_ratio > 2 ? 'text-red-400' : 'text-green-400'}>{hemo.EA_ratio.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">TAPSE</span><span className={hemo.TAPSE < 1.6 ? 'text-red-400' : 'text-green-400'}>{hemo.TAPSE.toFixed(1)} cm</span></div>
        <div className="flex justify-between"><span className="text-gray-400">e'</span><span>{hemo.e_prime.toFixed(2)} cm/s</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Diastolic</span><span className={hemo.diastolicGrade === 'Normal' ? 'text-green-400' : hemo.diastolicGrade === 'Grade I' ? 'text-yellow-400' : 'text-red-400'}>{hemo.diastolicGrade}</span></div>
      </div>
    </div>
  );
}
