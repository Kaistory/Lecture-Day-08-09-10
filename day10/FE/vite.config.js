import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server :5173 — gọi BE qua VITE_API_BASE_URL (mặc định http://127.0.0.1:8000).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
})
