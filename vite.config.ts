import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Gemini API key now lives only in backend/.env (never in the browser bundle).
// During development, /api requests (including the live-voice WebSocket) are proxied
// to the Python backend.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
