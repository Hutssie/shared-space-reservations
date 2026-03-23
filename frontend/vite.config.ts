import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // alias-ul `@` catre folderul `src`
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Tipurile de fisiere pentru importuri raw. Nu adauga `.css`, `.tsx` sau `.ts` aici.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
