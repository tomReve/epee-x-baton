import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/scenes/**',
        'src/main.ts',
        'src/**/*.types.ts',
        'src/**/*.data.ts',
        'node_modules/**',
      ]
    }
  },
});