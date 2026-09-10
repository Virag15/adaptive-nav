import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the playground in demo/, which imports the package from ../src.
export default defineConfig({
  root: 'demo',
  plugins: [react()],
  server: { port: 4321 },
  // The playground is what gets deployed; it builds to the repo root's dist,
  // where a host such as Vercel expects a Vite build to land.
  build: { outDir: '../dist', emptyOutDir: true },
});
