/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sim-bg': '#0f172a',
        'sim-panel': '#1e293b',
        'sim-accent': '#3b82f6',
        'sim-danger': '#ef4444',
        'sim-warning': '#f59e0b',
        'sim-success': '#22c55e',
      },
    },
  },
  plugins: [],
};