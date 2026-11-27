import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { parseCsv, csvToObjects } from '../tools/csv.mjs';
import { isSelected, toStar, selectStars, encodeCatalog } from '../tools/build-lib.mjs';
import { decodeCatalog, bvToRgb, formatDistance } from '../js/catalog.mjs';

const HEADER = 'id,hip,hd,gl,proper,dist,mag,absmag,spect,ci,x,y,z,bayer,flam,con';
const row = (o) => ({ id: '1', hip: '', hd: '', gl: '', proper: '', dist: '50', mag: '9', absmag: '5', spect: '', ci: '', x: '30', y: '40', z: '0', bayer: '', flam: '', con: '', ...o });

test('parser CSV obsługuje cudzysłowy, przecinki w polach i CRLF', () => {
  const rows = parseCsv('a,b,c\r\n1,"x, y","he said ""hi"""\n2,,\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, y', 'he said "hi"'], ['2', '', '']]);
  assert.deepEqual(csvToObjects('id,proper\n0,Sol\n'), [{ id: '0', proper: 'Sol' }]);
});

test('reguła wyboru: Słońce, jasne, nazwane i bliskie gwiazdy; nieznana odległość odpada', () => {
  assert.equal(isSelected(row({ id: '0', dist: '0', mag: '-26.7' })), true, 'Słońce');
  assert.equal(isSelected(row({ mag: '6.5' })), true, 'mag = 6.5');
  assert.equal(isSelected(row({ mag: '6.51' })), false, 'za słaba, daleka, bez nazwy');
  assert.equal(isSelected(row({ mag: '11', proper: 'Proxima Centauri', dist: '1.3' })), true, 'nazwa własna');
  assert.equal(isSelected(row({ mag: '14', dist: '25' })), true, 'do 25 pc');
  assert.equal(isSelected(row({ mag: '14', dist: '25.01' })), false);
  assert.equal(isSelected(row({ mag: '2', dist: '100000' })), false, 'nieznana odległość');
  assert.equal(isSelected(row({ mag: '', dist: '300' })), false, 'brak jasności to nie mag 0');
});

test('toStar zaokrągla i zachowuje stałe id', () => {
  const s = toStar(row({ id: '32263', hip: '32349', hd: '48915', proper: 'Sirius', x: '-0.494323', y: '2.476731', z: '-0.758485', mag: '-1.44', absmag: '1.454', ci: '0.009', bayer: 'Alp', flam: '9', con: 'CMa' }));
  assert.deepEqual(s, { id: 32263, x: -0.494, y: 2.477, z: -0.758, mag: -1.44, absmag: 1.45, ci: 0.01, hip: 32349, hd: 48915, gl: '', proper: 'Sirius', bayer: 'Alp', flam: 9, con: 'CMa', spect: '' });
  assert.equal(toStar(row({ ci: '' })).ci, null);
  assert.deepEqual([toStar(row({ id: '0', x: '0.000005' })).x], [0]);
});

test('selectStars sortuje od najjaśniejszej, usuwa duplikaty id; zapis kolumnowy da się odczytać', () => {
  const stars = selectStars([
    row({ id: '5', mag: '3' }), row({ id: '7', mag: '-1', proper: 'Bright' }), row({ id: '5', mag: '1' }),
    row({ id: '9', mag: '12' }), row({ id: '0', dist: '0', mag: '-26.7', proper: 'Sol', x: '0', y: '0', z: '0' }),
  ]);
  assert.deepEqual(stars.map((s) => s.id), [0, 7, 5]);
  const cat = decodeCatalog(JSON.parse(JSON.stringify(encodeCatalog(stars))));
  assert.equal(cat.stars.length, 3);
  assert.equal(cat.stars[1].proper, 'Bright');
  assert.equal(cat.byId.get(5), 2);
  assert.equal(cat.stars[2].dist, 50);
  // układ sceny: (x, z, -y)
  assert.deepEqual([...cat.positions.slice(6, 9)], [30, 0, -40]);
});

test('zbudowany plik data/stars.json: rozmiar, Słońce, znane gwiazdy, licencja', () => {
  const url = new URL('../data/stars.json', import.meta.url);
  assert.ok(statSync(url).size < 1.5 * 1024 * 1024, 'plik danych < 1,5 MB');
  const data = JSON.parse(readFileSync(url, 'utf8'));
  const cat = decodeCatalog(data);
  assert.equal(data.meta.license, 'CC BY-SA 4.0');
  assert.equal(data.meta.count, cat.stars.length);
  assert.ok(cat.stars.length > 10000 && cat.stars.length < 14000, `liczba gwiazd: ${cat.stars.length}`);
  assert.equal(new Set(cat.stars.map((s) => s.id)).size, cat.stars.length, 'id są unikalne');
  const sol = cat.stars[cat.byId.get(0)];
  assert.equal(sol.proper, 'Sol');
  assert.equal(sol.dist, 0);
  const sirius = cat.stars.find((s) => s.proper === 'Sirius');
  assert.equal(sirius.hip, 32349);
  assert.ok(Math.abs(sirius.dist - 2.637) < 0.01);
  assert.ok(cat.stars.every((s, i) => i === 0 || cat.stars[i - 1].mag <= s.mag), 'posortowane wg jasności');
  assert.ok(cat.stars.every((s) => s.dist < 100000 && Number.isFinite(s.absmag)));
});

test('barwa z B–V: gorące gwiazdy niebieskawe, chłodne czerwonawe, brak danych = neutralna', () => {
  const hot = bvToRgb(-0.2), cool = bvToRgb(1.8), none = bvToRgb(null);
  assert.ok(hot[2] > hot[0], 'niebieska');
  assert.ok(cool[0] > cool[2], 'czerwona');
  for (const c of [...hot, ...cool, ...none]) assert.ok(c >= 0 && c <= 1);
});

test('formatDistance podaje lata świetlne i parseki z polskim przecinkiem', () => {
  assert.deepEqual(formatDistance(2.637), { ly: '8,60', pc: '2,64' });
  assert.deepEqual(formatDistance(152.67), { ly: '498', pc: '153' });
  assert.deepEqual(formatDistance(0), { ly: '0', pc: '0' });
});
