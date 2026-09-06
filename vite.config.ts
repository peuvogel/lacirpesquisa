/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // Bound concurrent jsdom instances to avoid memory pressure and UI-test timeouts.
    maxWorkers: 1,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
