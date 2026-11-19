// Assemble a portable entry from the static studio and the supplied capture folder.
// Node 22 runs this file directly; no dependency installation or compilation is needed.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const sourceDirectory = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
mkdirSync(destination, { recursive: true });
for (const folder of ['app', 'screenshots']) {
  const target = join(destination, folder);
  mkdirSync(target, { recursive: true });
  const source = join(sourceDirectory, folder);
  if (existsSync(source)) cpSync(source, target, { recursive: true });
}
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log('Vice Poster Studio packaged. dossier.json written to ' + destination);
