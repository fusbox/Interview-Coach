import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['**/*.{test,spec}.{ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**', '.next/**', '.untracked/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'lcov'],
            exclude: ['e2e/**', 'node_modules/**', '.next/**', '.untracked/**', 'playwright.config.ts'],
            thresholds: {
                lines: 40,
                functions: 40,
                statements: 40,
                branches: 25,
            },
        },
    },
});
