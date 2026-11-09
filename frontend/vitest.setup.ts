/**
 * vitest.setup.ts
 * Runs before every test file (see vitest.config.ts).
 */
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Adds DOM matchers such as `toBeInTheDocument()` and `toHaveAttribute()` to `expect`.
import '@testing-library/jest-dom/vitest';

// Unmount whatever a test rendered, so one test's components never leak into the next.
afterEach(() => {
  cleanup();
});
