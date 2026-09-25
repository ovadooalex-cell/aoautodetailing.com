import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Vite's dev server rejects requests whose Host header it doesn't
    // recognize (a DNS-rebinding guard) — which blocks it by default when
    // reached through a tunnel like `cloudflared tunnel --url` (used to get
    // a real link for phone testing/sharing) or ngrok, both of which put a
    // random subdomain in the Host header. Allowing just these two
    // well-known tunnel domains keeps that protection for everything else.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
  },
})
