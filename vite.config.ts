import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api/* to the local Firebase Functions emulator so the frontend
    // can call the API with a simple relative URL (/api/...) during development.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        // Rewrite: prepend the project/region/function name so the emulator
        // routes the request to the `api` function and Express receives the
        // full /api/... path (matching app.use('/api/email', ...) routes).
        rewrite: (path) => '/celltalediagnostics-8f817/asia-south1/api' + path,
      },
    },
  },
})
