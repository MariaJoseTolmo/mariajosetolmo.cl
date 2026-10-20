// Bundles the probe app into dist/index.js and zips it as dist/app-<sha256>.zip.
// index.js MUST sit at the zip root (default entrypoint of nodejs24.x).
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

await build({
  entryPoints: ['app/src/main.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  minify: true,
  tsconfig: 'tsconfig.json',
  external: ['@nestjs/microservices', '@nestjs/websockets', 'class-validator', 'class-transformer'],
  logLevel: 'warning',
});

// -X strips extra file attributes so the same input yields the same zip.
execFileSync('zip', ['-X', '-q', 'app.zip', 'index.js'], { cwd: 'dist' });
const sha = createHash('sha256').update(readFileSync('dist/app.zip')).digest('hex');
const name = `app-${sha}.zip`;
renameSync('dist/app.zip', `dist/${name}`);

const kb = (f) => (statSync(f).size / 1024).toFixed(0);
console.log(`bundle: ${kb('dist/index.js')} KB, zip: ${kb(`dist/${name}`)} KB`);
console.log(`artifact: dist/${name}`);
