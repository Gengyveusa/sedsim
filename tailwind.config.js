/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core background colors
        'sim-bg': '#0a0a0f',
        'sim-panel': '#111118',
        
        // Waveform/vital colors
        'sim-spo2': '#00ff88',
        'sim-ecg': '#00cc66',
        'sim-capno': '#ffcc00',
        'sim-hr': '#00ff88',
        'sim-bp': '#ff4444',
        'sim-rr': '#ffcc00',
        'sim-bis': '#00aaff',
        
        // Drug UI colors
        'sim-propofol': '#a78bfa',
        'sim-midazolam': '#60a5fa',
        'sim-fentanyl': '#f97316',
        'sim-ketamine': '#a855f7',
        'sim-reversal': '#ef4444',
        
        // Status colors
        'sim-warning': '#ff6600',
        'sim-danger': '#ff0000',
        'sim-success': '#00ff88',
        
        // Text colors
        'sim-text': '#e0e0e8',
        'sim-text-secondary': '#888898',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'sans': ['IBM Plex Sans', 'sans-serif'],
      },
      animation: {
        'pulse-alarm': 'pulse-alarm 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-alarm': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
    },
  },
  plugins: [],
};
