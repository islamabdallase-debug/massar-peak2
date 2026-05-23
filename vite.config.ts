// ============================================================
//  مسار — Vite Configuration v5.2
//  Production-hardened for Vercel/Netlify/Cloudflare/local
// ============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/@remix-run')) return 'router';
          if (id.includes('node_modules/zustand')) return 'store';
          if (id.includes('node_modules/@supabase')) return 'supabase';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  server: {
    port: 5173,
    open: false,
    host: true,
  },

  preview: {
    port: 4173,
    host: true,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['./src/tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      './src/tests/idb_check*',
      './src/tests/db_open_debug*',
      './src/tests/idb_debug*',
    ],
  },
});
