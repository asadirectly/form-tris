import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// in dev the express server runs on PORT from .env (3000 by default) and vite forwards these paths to it
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = `http://localhost:${env.PORT || 3000}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': target,
        '/login': target,
        '/ws': { target, ws: true }, // multiplayer socket
      },
    },
  };
});
