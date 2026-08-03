// Library build config — produces the distributable npm package artifacts.
//
// Kept SEPARATE from `vite.config.ts` (the demo/GitHub-Pages app build) so
// `npm run build` keeps emitting the demo site unchanged, while
// `npm run build:lib` emits the consumable library. React and every runtime
// dependency are externalized (declared as peer/deps in package.json) so the
// bundle ships only this component's own code + inlined SVG/CSS — no second
// copy of React, no duplicated jspdf.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib-entry.ts'),
      formats: ['es'],
      fileName: () => 'odontogram.js',
      // Guarantee a stable, single stylesheet name (dist/style.css).
      cssFileName: 'style',
    },
    // One combined stylesheet instead of per-chunk CSS.
    cssCodeSplit: false,
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Do NOT bundle React or runtime deps — the consumer app provides them.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'jspdf',
        'nanoid',
        'react-hook-form',
        'react-router-dom',
      ],
    },
  },
})
