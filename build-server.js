import { build } from 'esbuild';

build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env': 'process.env'
  },
  logLevel: 'error',
  outfile: 'dist/server.cjs'
}).catch((err) => {
  console.error('esbuild build failed:', err);
  process.exit(1);
});
