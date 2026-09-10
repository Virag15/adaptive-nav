import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the playground in demo/, which imports the package from ../src.
export default defineConfig({
  root: 'demo',
  plugins: [react()],
  server: { port: 4321 },
});
