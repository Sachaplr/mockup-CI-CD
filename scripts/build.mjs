import { build } from 'esbuild';

await build({
  entryPoints: ['web/src/app.js'],
  outfile: 'public/assets/app.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: false,
  logLevel: 'info',
});
