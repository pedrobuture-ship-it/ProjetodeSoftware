import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
