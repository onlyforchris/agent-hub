import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const rawApiTarget = (process.env.VITE_API_TARGET || 'http://127.0.0.1:8066').trim();
  const apiTarget = /^https?:\/\//i.test(rawApiTarget) ? rawApiTarget : `http://${rawApiTarget}`;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 9001,
      proxy: {
        '/api': apiTarget,
      },
    },
  };
});
