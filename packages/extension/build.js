import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

fs.mkdirSync(outdir, { recursive: true });
fs.copyFileSync('manifest.json', path.join(outdir, 'manifest.json'));
fs.copyFileSync('src/popup/popup.html', path.join(outdir, 'popup.html'));
fs.copyFileSync('src/export/export.html', path.join(outdir, 'export.html'));
fs.copyFileSync('src/runner/runner.html', path.join(outdir, 'runner.html'));

const buildOptions = {
  entryPoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/popup.ts',
    export: 'src/export/export.ts',
    runner: 'src/runner/runner.ts',
  },
  bundle: true,
  outdir,
  format: 'esm',
  target: 'chrome120',
  sourcemap: true,
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete.');
}
