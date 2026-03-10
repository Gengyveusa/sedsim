import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/sedsim/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    allowedHosts: true,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Vendor: charting library
          'vendor-recharts': ['recharts'],
          // AI + heavyweight optional features (lazy-loaded in production)
          'features-ai': [
            './src/ai/claudeClient.ts',
            './src/ai/mentor.ts',
            './src/ai/multiAgent.ts',
            './src/ai/simMaster.ts',
            './src/ai/digitalTwin.ts',
            './src/ai/eegModel.ts',
            './src/ai/scenarioGenerator.ts',
            './src/ai/tutorialEngine.ts',
          ],
        },
      },
    },
  },
});
