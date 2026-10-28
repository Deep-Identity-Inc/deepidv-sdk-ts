import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'agentPay/index': 'src/agentPay/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  noExternal: ['@deepidv/core'],
});
