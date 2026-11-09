/**
 * test/stubs/server-only.ts
 * Empty stand-in for the `server-only` package, used only by the tests (see vitest.config.ts).
 * In the real app, `import 'server-only'` makes the build fail if server code (like the file holding the
 * secret API key) is ever imported into a browser bundle. Tests run outside that bundler, so they need this stub.
 */
export {};
