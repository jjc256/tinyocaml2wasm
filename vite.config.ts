import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',               // your app lives here
  build: {
    outDir: '../dist',       // put final files at repo root
    emptyOutDir: true
  }
});
