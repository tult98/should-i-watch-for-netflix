import { context, build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

function copyStatic() {
  cpSync('manifest.json', `${outdir}/manifest.json`);
  if (existsSync('public')) cpSync('public', outdir, { recursive: true });
}

const copyStaticPlugin = {
  name: 'copy-static',
  setup(b) {
    b.onEnd(() => copyStatic());
  },
};

const common = {
  bundle: true,
  target: 'chrome120',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

const configs = [
  // MV3 content scripts cannot be ES modules, so the content script is an IIFE.
  { ...common, entryPoints: ['src/content/index.ts'], outfile: `${outdir}/content.js`, format: 'iife' },
  { ...common, entryPoints: ['src/options/options.ts'], outfile: `${outdir}/options.js`, format: 'iife' },
  {
    ...common,
    entryPoints: ['src/background/index.ts'],
    outfile: `${outdir}/background.js`,
    format: 'esm',
    plugins: [copyStaticPlugin],
  },
];

if (watch) {
  const contexts = await Promise.all(configs.map((c) => context(c)));
  await Promise.all(contexts.map((c) => c.watch()));
} else {
  await Promise.all(configs.map((c) => build(c)));
}
