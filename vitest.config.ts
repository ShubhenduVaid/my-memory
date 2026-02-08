import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      // Focus unit coverage on core + adapters + main services. Renderer UI is better
      // covered with dedicated component/e2e tests (separate harness).
      include: [
        'src/core/**/*.ts',
        'src/adapters/**/*.ts',
        'src/main/**/*.ts',
        'src/obsidian-plugin/**/*.ts',
        'src/renderer/onboarding.ts'
      ],
      exclude: ['dist/**', 'release/**', 'build/**', 'src/main/index.ts'],
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85
      }
    }
  }
});
