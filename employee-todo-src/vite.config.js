import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const OUT_DIR = path.resolve(import.meta.dirname, '../modules/projects/employee-todo');
const BASE = '/modules/projects/employee-todo/';
const CANONICAL_START = '/modules/projects/employee-todo/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '員工待辦事項',
        short_name: '員工待辦',
        theme_color: '#1e2a32',
        background_color: '#1e2a32',
        display: 'standalone',
        lang: 'zh-Hant',
        scope: BASE,
        start_url: CANONICAL_START,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'] },
    }),
  ],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index-[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
  },
});
