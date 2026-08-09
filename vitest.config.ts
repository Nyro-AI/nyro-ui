import { defineConfig } from 'vitest/config';

// Los tests viven en `test/` y NO en `src/` a propósito: `src` va dentro del
// tarball (mira la lista `files` del package.json) y `tsc -p tsconfig.json`
// compila todo lo que hay en `src` a `dist`. Colocarlos al lado del código
// publicaría los tests a las dos apps.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
