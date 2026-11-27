// Czysta logika budowania danych: wybór podzbioru gwiazd z katalogu HYG i zapis kolumnowy.
// Używana przez tools/build-stars.mjs oraz testy.

export const DEFAULT_RULE = { maxMag: 6.5, maxDistPc: 25, unknownDist: 100000 };

const num = (v) => (v === '' || v == null ? null : Number(v));
const round = (v, d) => { const p = 10 ** d; return Math.round(v * p) / p; };

/** Czy wiersz HYG trafia do mapy? Reguła: Słońce LUB (znana odległość ORAZ (mag ≤ 6.5 LUB nazwa własna LUB ≤ 25 pc)). */
export function isSelected(row, rule = DEFAULT_RULE) {
  if (String(row.id) === '0') return true;
  const dist = Number(row.dist);
  if (!Number.isFinite(dist) || dist >= rule.unknownDist || dist <= 0) return false;
  const mag = Number(row.mag);
  if (row.mag !== '' && Number.isFinite(mag) && mag <= rule.maxMag) return true;
  if (row.proper && row.proper.trim()) return true;
  return dist <= rule.maxDistPc;
}

/** Wiersz HYG -> zwarty rekord gwiazdy. */
export function toStar(row) {
  const x = Number(row.x), y = Number(row.y), z = Number(row.z);
  const isSol = String(row.id) === '0';
  const far = Math.hypot(x, y, z) >= 100;
  const d = far ? 2 : 3;
  return {
    id: Number(row.id),
    x: isSol ? 0 : round(x, d), y: isSol ? 0 : round(y, d), z: isSol ? 0 : round(z, d),
    mag: round(Number(row.mag), 2),
    absmag: round(Number(row.absmag), 2),
    ci: num(row.ci) == null ? null : round(Number(row.ci), 2),
    hip: num(row.hip) ?? 0,
    hd: num(row.hd) ?? 0,
    gl: (row.gl || '').trim(),
    proper: (row.proper || '').trim(),
    bayer: (row.bayer || '').trim(),
    flam: num(row.flam) ?? 0,
    con: (row.con || '').trim(),
    spect: (row.spect || '').trim(),
  };
}

/** Wybiera i sortuje gwiazdy (od najjaśniejszej; przy remisie po id — wynik deterministyczny). */
export function selectStars(rows, rule = DEFAULT_RULE) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!isSelected(row, rule)) continue;
    const s = toStar(row);
    if (!Number.isInteger(s.id) || seen.has(s.id)) continue;
    if (![s.x, s.y, s.z, s.mag, s.absmag].every(Number.isFinite)) continue;
    seen.add(s.id);
    out.push(s);
  }
  out.sort((a, b) => a.mag - b.mag || a.id - b.id);
  return out;
}

function sparse(stars, key, empty) {
  const o = {};
  stars.forEach((s, i) => { if (s[key] !== empty) o[i] = s[key]; });
  return o;
}

function indexed(stars, key) {
  const list = [...new Set(stars.map((s) => s[key]))].sort();
  const pos = new Map(list.map((v, i) => [v, i]));
  return { list, idx: stars.map((s) => pos.get(s[key])) };
}

/** Zapis kolumnowy (mały JSON): kolumny liczbowe jako tablice, rzadkie teksty jako mapy indeks->wartość. */
export function encodeCatalog(stars, meta = {}) {
  const con = indexed(stars, 'con');
  const spect = indexed(stars, 'spect');
  return {
    meta: {
      source: 'HYG Database v4.1 (astronexus)',
      sourceUrl: 'https://www.astronexus.com/projects/hyg',
      license: 'CC BY-SA 4.0',
      units: 'x,y,z: parseki, układ równikowy heliocentryczny (jak w HYG)',
      count: stars.length,
      ...meta,
    },
    id: stars.map((s) => s.id),
    x: stars.map((s) => s.x),
    y: stars.map((s) => s.y),
    z: stars.map((s) => s.z),
    mag: stars.map((s) => s.mag),
    absmag: stars.map((s) => s.absmag),
    ci: stars.map((s) => s.ci),
    hip: stars.map((s) => s.hip),
    hd: stars.map((s) => s.hd),
    conList: con.list, con: con.idx,
    spectList: spect.list, spect: spect.idx,
    proper: sparse(stars, 'proper', ''),
    bayer: sparse(stars, 'bayer', ''),
    flam: sparse(stars, 'flam', 0),
    gl: sparse(stars, 'gl', ''),
  };
}
