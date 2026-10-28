import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

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
  define: { __DEEPIDV_SERVER_VERSION__: JSON.stringify(version) },
});
