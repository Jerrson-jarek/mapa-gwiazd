// Buduje data/stars.json z katalogu HYG v4.1 (hygdata_v41.csv).
// Użycie: node tools/build-stars.mjs <ścieżka do hygdata_v41.csv> [plik wyjściowy]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvToObjects } from './csv.mjs';
import { selectStars, encodeCatalog, DEFAULT_RULE } from './build-lib.mjs';

const [csvPath, outArg] = process.argv.slice(2);
if (!csvPath) {
  console.error('Użycie: node tools/build-stars.mjs <ścieżka do hygdata_v41.csv> [plik wyjściowy]');
  process.exit(1);
}
const outPath = resolve(outArg || fileURLToPath(new URL('../data/stars.json', import.meta.url)));

const rows = csvToObjects(readFileSync(csvPath, 'utf8'));
const stars = selectStars(rows);
const catalog = encodeCatalog(stars, {
  rule: `Słońce + gwiazdy o znanej odległości spełniające: mag ≤ ${DEFAULT_RULE.maxMag} LUB nazwa własna LUB odległość ≤ ${DEFAULT_RULE.maxDistPc} pc`,
});
const json = JSON.stringify(catalog);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
console.log(`Wiersze w katalogu: ${rows.length}`);
console.log(`Gwiazdy na mapie:   ${stars.length}`);
console.log(`Zapisano:           ${outPath} (${(Buffer.byteLength(json) / 1024).toFixed(0)} kB)`);
