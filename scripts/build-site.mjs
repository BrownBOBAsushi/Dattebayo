import { mkdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'probe.html']) {
  copyFileSync(new URL(file, root), new URL(file, output));
}
cpSync(new URL('src/', root), new URL('src/', output), { recursive: true });
cpSync(new URL('assets/', root), new URL('assets/', output), { recursive: true });
