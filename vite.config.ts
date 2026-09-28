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
    // Vite refuses any request whose Host header is not listed here (a
    // DNS-rebinding guard), which is what produces
    // "Blocked request ... not allowed" when the preview runs behind a
    // platform proxy such as Render. A leading dot matches the domain itself
    // and every subdomain, so `.onrender.com` covers the generated
    // `*.onrender.com` service URL - including a new one if the service is
    // ever re-created. Add any custom domain to this list as well.
    allowedHosts: ['.onrender.com'],
  },
});
