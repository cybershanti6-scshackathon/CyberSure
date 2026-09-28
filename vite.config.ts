import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken. Silently drifting to 5174/5175 serves the
    // app from an origin the backend's CORS list may not allow, which surfaces
    // as an opaque "service is not responding" error in the browser rather
    // than as the port conflict it actually is.
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
