import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function readBackendPort() {
  if (process.env.VITE_API_PORT) return process.env.VITE_API_PORT;

  try {
    const backendEnv = fs.readFileSync(path.resolve(process.cwd(), '../backend/.env'), 'utf8');
    return backendEnv.match(/^PORT\s*=\s*(\d+)/m)?.[1] || '5000';
  } catch {
    return '5000';
  }
}

const apiTarget = process.env.VITE_API_URL || `http://127.0.0.1:${readBackendPort()}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});
