/**
 * vitest.config.ts
 * Settings for the unit tests (`npm test`). Vitest runs the *.test.ts(x) files next to the code they test.
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Compiles JSX in component tests.
  plugins: [react()],
  resolve: {
    alias: {
      // Same `@/` shortcut as tsconfig.json, so tests import modules exactly the way the app does.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The real `server-only` package throws when imported outside a React Server Component bundle.
      // Tests run in plain Node or jsdom, so they get an empty stand-in instead.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    // jsdom gives tests a fake browser (document, window, localStorage). Server-side test files opt out with
    // a `// @vitest-environment node` comment at their top.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
