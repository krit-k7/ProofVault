import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

const root = path.dirname(fileURLToPath(import.meta.url));

function zkBuildId(): string {
  try {
    const bzkir = readFileSync(path.join(root, 'public/zkir/proveSolvency.bzkir'));
    return createHash('sha256').update(bzkir).digest('hex').slice(0, 12);
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  cacheDir: './.vite',
  plugins: [
    react(),
    wasm(),
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    }),
    {
      // The Midnight compact-runtime imports `@midnight-ntwrk/onchain-runtime-v3`
      // (a WASM package) as a bare specifier. It is only present in pnpm's nested
      // store, so tell Vite to keep the specifier and let vite-plugin-wasm resolve it.
      name: 'wasm-module-resolver',
      resolveId(source, importer) {
        if (
          source === '@midnight-ntwrk/onchain-runtime-v3' &&
          importer &&
          importer.includes('@midnight-ntwrk/compact-runtime')
        ) {
          return { id: source, external: false, moduleSideEffects: true };
        }
        return null;
      },
    },
  ],
  resolve: {
    alias: {
      '@por/contract-gen': path.resolve(root, 'src/generated/index.js'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.wasm'],
    mainFields: ['browser', 'module', 'main'],
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      supported: { 'top-level-await': true },
      platform: 'browser',
      format: 'esm',
      loader: { '.wasm': 'binary' },
    },
    include: ['@midnight-ntwrk/compact-runtime', 'buffer'],
    exclude: [
      '@midnight-ntwrk/onchain-runtime-v3',
      '@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm',
      '@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm.js',
    ],
  },
  server: {
    port: 5175,
    strictPort: true,
    open: true,
  },
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true,
      extensions: ['.js', '.cjs'],
      ignoreDynamicRequires: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          wasm: ['@midnight-ntwrk/onchain-runtime-v3'],
        },
      },
    },
  },
  define: {
    'import.meta.env.VITE_ZK_BUILD_ID': JSON.stringify(zkBuildId()),
  },
});
