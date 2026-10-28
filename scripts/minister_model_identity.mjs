import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const MODEL_MODULE = new URL('../site/minister-model-core.js', import.meta.url);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function manifestId(entries) {
  const manifest = JSON.stringify(entries
    .map(({ name, sha256: digest }) => [name, digest])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  return sha256(Buffer.from(manifest, 'utf8'));
}

export async function ministerModelExecutableId(bytes) {
  const moduleBytes = bytes ?? await readFile(MODEL_MODULE);
  return manifestId([{ name: 'minister-model-core.js', sha256: sha256(moduleBytes) }]);
}
