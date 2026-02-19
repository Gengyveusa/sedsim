// src/components/EEGPanel.tsx
// 4-Channel EEG Display with DSA Spectrogram and BIS Index
import React, { useRef, useEffect } from 'react';
import { EEGState } from '../engine/eegModel';

interface EEGPanelProps {
  eegState: EEGState | null;
  isRunning: boolean;
}

const CHANNEL_COLORS: Record<string, string> = {
  Fp1: '#00ffaa',
  Fp2: '#00ccff',
  F7: '#ffaa00',
  F8: '#ff66cc',
};

const SEDATION_STATE_COLORS: Record<string, string> = {
  awake: '#22c55e',
  light: '#84cc16',
  moderate: '#eab308',
  deep: '#f97316',
  burst_suppression: '#ef4444',
  isoelectric: '#dc2626',
};

const EEGPanel: React.FC<EEGPanelProps> = ({ eegState, isRunning }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dsaCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw EEG waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !eegState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const channelNames = Object.keys(eegState.channels);
    const channelHeight = h / channelNames.length;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < channelNames.length; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * channelHeight);
      ctx.lineTo(w, i * channelHeight);
      ctx.stroke();
    }

    // Draw each channel
    channelNames.forEach((name, idx) => {
      const channel = eegState.channels[name];
      if (!channel || channel.raw.length < 2) return;

      const yCenter = idx * channelHeight + channelHeight / 2;
      const color = CHANNEL_COLORS[name] || '#ffffff';

      // Channel label
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.fillText(name, 4, idx * channelHeight + 14);

      // Draw waveform
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();

      const data = channel.raw;
      const step = w / data.length;
      const scale = channelHeight / 200; // Amplitude scaling

      for (let i = 0; i < data.length; i++) {
        const x = i * step;
        const y = yCenter - data[i] * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }, [eegState]);

  // Draw DSA spectrogram
  useEffect(() => {
    const canvas = dsaCanvasRef.current;
    if (!canvas || !eegState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const fp1 = eegState.channels['Fp1'];
    if (!fp1) return;

    // Shift existing content left
    const imageData = ctx.getImageData(2, 0, w - 2, h);
    ctx.putImageData(imageData, 0, 0);

    // Draw new column
    const dsa = fp1.dsa;
    const binHeight = h / dsa.length;

    for (let i = 0; i < dsa.length; i++) {
      const intensity = Math.min(255, Math.round(dsa[i] * 4));
      // Cool-to-warm colormap
      const r = intensity;
      const g = Math.max(0, 255 - intensity * 2);
      const b = Math.max(0, 200 - intensity);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(w - 2, h - (i + 1) * binHeight, 2, binHeight);
    }
  }, [eegState]);

  if (!eegState) {
    return (
      <div className="bg-gray-900/80 rounded-lg border border-gray-700 p-4">
        <h3 className="text-gray-400 text-sm font-mono">EEG Monitor - No Data</h3>
        <p className="text-gray-500 text-xs mt-2">Start simulation to see EEG waveforms</p>
      </div>
    );
  }

  const stateColor = SEDATION_STATE_COLORS[eegState.sedationState] || '#ffffff';
  const fp1 = eegState.channels['Fp1'];

  return (
    <div className="bg-[#0a0a14] rounded-lg border border-gray-700 overflow-hidden">
      {/* Header with BIS Index */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs font-mono">EEG MONITOR</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: stateColor + '22', color: stateColor }}
          >
            {eegState.sedationState.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono" style={{ color: stateColor }}>
              {eegState.bisIndex}
            </div>
            <div className="text-gray-500 text-[10px]">BIS</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono text-cyan-400">
              {fp1?.sef || '--'}
            </div>
            <div className="text-gray-500 text-[10px]">SEF Hz</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono text-yellow-400">
              {fp1?.suppressionRatio || 0}%
            </div>
            <div className="text-gray-500 text-[10px]">SR</div>
          </div>
        </div>
      </div>

      {/* EEG Waveforms */}
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full"
        style={{ height: '160px' }}
      />

      {/* DSA Spectrogram */}
      <div className="border-t border-gray-800">
        <div className="px-3 py-1">
          <span className="text-gray-500 text-[10px] font-mono">DSA SPECTROGRAM (0-30 Hz)</span>
        </div>
        <canvas
          ref={dsaCanvasRef}
          width={600}
          height={60}
          className="w-full"
          style={{ height: '50px' }}
        />
      </div>
    </div>
  );
};

export default EEGPanel;
