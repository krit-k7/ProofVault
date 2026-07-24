import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // External SSD / macOS often creates AppleDouble sidecars (._*.ts)
    exclude: ['**/node_modules/**', '**/._*'],
  },
});

