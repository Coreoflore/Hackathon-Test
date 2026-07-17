import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

function readBackendPort() {
  if (process.env.VITE_API_PORT) return process.env.VITE_API_PORT;

  try {
    const backendEnv = fs.readFileSync(path.resolve(process.cwd(), '../backend/.env'), 'utf8');
    return backendEnv.match(/^PORT\s*=\s*(\d+)/m)?.[1] || '5000';
  } catch {
    return '5000';
  }
}

const apiTarget = process.env.VITE_API_URL || `http://localhost:${readBackendPort()}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
        agent: new http.Agent({ keepAlive: false }),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('Vite proxy error:', err.message);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Backend connection failed (${err.message}). Make sure the backend is running.` }));
            }
          });
        }
      }
    }
  }
});
