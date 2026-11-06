import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const rootEnvDirectory = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig(({ mode }) => {
  const { PORT = '3000' } = loadEnv(mode, rootEnvDirectory, 'PORT');
  return {
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${PORT}` },
    },
  };
});
