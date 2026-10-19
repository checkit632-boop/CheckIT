import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
  ],

  server: {
    host: true,
    https: true,
    port: 5173,

    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // Envía X-Forwarded-For con la IP real del navegador, para que los
        // límites de peticiones del backend no traten a todos los equipos
        // como si fueran uno solo (el proxy).
        xfwd: true,
      },
    },
  },
});