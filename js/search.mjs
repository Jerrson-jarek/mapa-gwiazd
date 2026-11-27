// Wyszukiwanie gwiazd po nazwie: nazwy własne, polskie nazwy, oznaczenia Bayera/Flamsteeda
// z nazwami gwiazdozbiorów (łac./pol., także w dopełniaczu), numery HIP/HD/Gliese.
// Bez wielkości liter i znaków diakrytycznych.
import { CONSTELLATIONS, CONSTELLATIONS_PL_GENITIVE, GREEK, POLISH_NAMES, parseBayer } from './names.mjs';
import { PLANETS, planetSearchNames } from './planets.mjs';

/**
 * "Słońce" -> "slonce"; usuwa akcenty, apostrofy, interpunkcję; zwija spacje.
 * Indeksy górne i inne znaki zgodności są rozwijane (NFKD: "α¹" -> "α1"), a litery i cyfry
 * rozdzielane ("α1 cen" -> "α 1 cen", "hip32349" -> "hip 32349", "244A" -> "244 a").
 */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/(\p{L})(?=\p{N})/gu, '$1 ')
    .replace(/(\p{N})(?=\p{L})/gu, '$1 ')
    .trim();
}

const tokens = (text) => { const n = normalize(text); return n ? n.split(' ') : []; };

/** Przedrostek katalogu Gliesego w zapytaniu i w danych („Gliese 581”, „GJ 581”, „Gl 581”) -> zawsze „gl”. */
const GLIESE = /^(?:gliese|gj|gl)(?= |$)/;

/**
 * Gwiazdozbiory przygotowane do dopasowywania:
 * forms – każda forma nazwy jako lista tokenów (łac. mianownik i dopełniacz, pol. mianownik i dopełniacz),
 * full – wszystkie tokeny pełnych nazw, base – tokeny bez polskiego dopełniacza (do luźnej odmiany).
 */
const CON_INFO = new Map(Object.entries(CONSTELLATIONS).map(([iau, names]) => {
  const forms = [...names, CONSTELLATIONS_PL_GENITIVE[iau]].filter(Boolean).map(tokens);
  return [iau, {
    iau,
    abbr: normalize(iau),
    forms,
    full: [...new Set(forms.flat())],
    base: [...new Set(names.flatMap(tokens))],
  }];
}));

/**
 * @param {object[]} stars  rekordy z decodeCatalog (posortowane od najjaśniejszej)
 */
export function buildSearchIndex(stars) {
  const hip = new Map(), hd = new Map(), gl = new Map();
  const entries = stars.map((s, i) => {
    const names = [];
    if (s.proper) {
      names.push(normalize(s.proper));
      for (const pl of POLISH_NAMES[s.proper] || []) names.push(normalize(pl));
    }
    if (s.gl) {
      // "Gl 244A" i "GJ 3375" -> "gl 244 a", "gl 3375"; sam numer ("244", "171 1") trafia do mapy gl
      const name = normalize(s.gl).replace(GLIESE, 'gl');
      names.push(name);
      const number = name.replace(/^gl /, '').replace(/ [a-z]+$/, '');
      if (/^\d/.test(number)) { if (!gl.has(number)) gl.set(number, []); gl.get(number).push(i); }
    }
    // Oznaczenie: formy litery greckiej (α, alpha, alfa, alp), indeks Bayera („1” w α¹) i numer Flamsteeda.
    const letters = new Set();
    let bayerN = '', flam = '';
    const b = parseBayer(s.bayer);
    const con = CON_INFO.get(s.con) || null;
    if (con) {
      if (b) {
        const g = GREEK[b.abbr];
        for (const t of [g[0], g[1], g[2], b.abbr]) letters.add(normalize(t));
        if (b.n) bayerN = String(b.n);
      }
      if (s.flam) flam = String(s.flam);
    }
    // gwiazdy są posortowane wg jasności: przy powtórzonym numerze zostaje pierwsza, czyli najjaśniejsza
    if (s.hip && !hip.has(s.hip)) hip.set(s.hip, i);
    if (s.hd && !hd.has(s.hd)) hd.set(s.hd, i);
    return { names: [...new Set(names)], letters: [...letters], bayerN, flam, con };
  });
  return { stars, entries, hip, hd, gl };
}

/** Luźna polska odmiana nazwy gwiazdozbioru: „Erydana”, „Centaurze” pasują do „Erydan”, „Centaur”. */
const inflected = (t, w, abbr) => w !== abbr && w.length >= 3 && t.length - w.length <= 3 && t.startsWith(w);

/**
 * Punktacja (wyżej = lepiej):
 * 100 dokładna nazwa · 85 początek nazwy do granicy słowa · 80 początek nazwy · 60 początki słów nazwy ·
 * 72 oznaczenie z całą nazwą gwiazdozbioru (albo skrótem IAU wpisanym dokładnie, np. „PsA”) ·
 * 70 oznaczenie z częścią nazwy wielowyrazowej · 66 oznaczenie ze skrótem IAU („alfa psa” to najpierw Wielki Pies,
 * dopiero potem α PsA) · 50 oznaczenie dopasowane po początku słowa · 20–34 sam gwiazdozbiór · 25 sama litera/numer.
 */
function scoreEntry(e, q, qTokens, rawTokens) {
  let best = 0;
  for (const name of e.names) {
    if (name === q) return 100;
    if (name.startsWith(q)) { best = Math.max(best, name[q.length] === ' ' ? 85 : 80); continue; }
    const nt = name.split(' ');
    if (qTokens.every((t) => nt.some((w) => w.startsWith(t)))) best = Math.max(best, 60);
  }
  const con = e.con;
  if (best >= 60 || !con) return best;
  // Oznaczenie: każdy token zapytania musi pasować do litery/numeru albo do gwiazdozbioru.
  let exact = 0, usedDesig = 0, loose = 0, viaAbbr = false, afterLetter = false;
  const conExact = [];
  for (const t of qTokens) {
    const wasLetter = afterLetter;
    afterLetter = false;
    if (/^\d+$/.test(t)) {
      // numer tuż po literze gwiazdy z indeksem Bayera to ten indeks („π 1” = π¹, a nie π³ o numerze Flamsteeda 1)
      if (t === e.bayerN || (t === e.flam && !(wasLetter && e.bayerN))) { exact++; usedDesig++; continue; }
      return best;
    }
    if (e.letters.includes(t)) { exact++; usedDesig++; afterLetter = true; continue; }
    if (con.full.includes(t)) { exact++; conExact.push(t); continue; }
    if (t === con.abbr) { exact++; viaAbbr = true; continue; }
    if (e.letters.some((w) => w.startsWith(t))) { usedDesig++; afterLetter = true; continue; }
    if (con.full.some((w) => w.startsWith(t)) || con.base.some((w) => inflected(t, w, con.abbr))) { loose++; continue; }
    return best;
  }
  const usedCon = conExact.length + loose + (viaAbbr ? 1 : 0);
  // cała nazwa gwiazdozbioru w jednej z form („Lwa”, „Wielkiego Psa”) albo skrót IAU z zachowaną wielkością liter
  const whole = !loose && (viaAbbr
    ? rawTokens.includes(con.iau)
    : con.forms.some((f) => f.length === conExact.length && f.every((w) => conExact.includes(w))));
  if (usedDesig && usedCon) {
    if (exact !== qTokens.length) return Math.max(best, 50);
    return Math.max(best, whole ? 72 : viaAbbr ? 66 : 70);
  }
  if (usedCon) {
    const base = e.letters.length || e.flam ? 30 : 20; // sam gwiazdozbiór: najpierw gwiazdy z oznaczeniem
    return Math.max(best, base + (whole ? 4 : viaAbbr && !conExact.length ? -2 : 0));
  }
  return Math.max(best, 25); // sama litera/numer
}

/**
 * @returns {{i: number, score: number}[]} indeksy gwiazd, najlepsze dopasowania najpierw
 */
export function searchStars(index, query, limit = 10) {
  const q = normalize(query);
  if (!q) return [];
  const out = [];
  const seen = new Set();
  const push = (i, score) => { if (i != null && !seen.has(i)) { seen.add(i); out.push({ i, score }); } };

  // Numery katalogowe: "hip 32349", "HD48915", "32349"
  const cat = q.match(/^(hip|hd)?\s*(\d+)$/);
  if (cat) {
    const n = Number(cat[2]);
    if (cat[1] !== 'hd') push(index.hip.get(n), 95);
    if (cat[1] !== 'hip') push(index.hd.get(n), cat[1] ? 95 : 90);
    if (cat[1]) {
      // podpowiedzi po początku numeru (od najjaśniejszych)
      const map = cat[1] === 'hip' ? index.hip : index.hd;
      const extra = [];
      for (const [num, i] of map) if (num !== n && String(num).startsWith(cat[2])) extra.push(i);
      extra.sort((a, b) => a - b).slice(0, limit).forEach((i) => push(i, 40));
      return out.slice(0, limit);
    }
  }
  // Sam numer z katalogu Gliesego: "581", "171.1"
  for (const i of index.gl?.get(q) || []) push(i, 85);

  const qTokens = q.split(' ');
  // tokeny z zachowaną wielkością liter — do rozpoznania skrótu IAU wpisanego dokładnie („PsA”)
  const rawTokens = String(query ?? '').normalize('NFKD').split(/[^\p{L}]+/u);
  // "Gliese 581" / "GJ 581" / "Gl 581" to ta sama gwiazda niezależnie od przedrostka zapisanego w danych
  const qGl = q.replace(GLIESE, 'gl') !== q ? q.replace(GLIESE, 'gl') : null;
  const qGlTokens = qGl ? qGl.split(' ') : null;
  const { entries } = index;
  for (let i = 0; i < entries.length; i++) {
    if (seen.has(i)) continue;
    let score = scoreEntry(entries[i], q, qTokens, rawTokens);
    if (qGl && score < 100) score = Math.max(score, scoreEntry(entries[i], qGl, qGlTokens, rawTokens));
    if (score > 0) out.push({ i, score });
  }
  // gwiazdy są posortowane wg jasności, więc indeks rozstrzyga remisy na korzyść jaśniejszych
  out.sort((a, b) => b.score - a.score || a.i - b.i);
  return out.slice(0, limit);
}

/** Nazwy planet przygotowane do dopasowywania: główne (polska, angielska) i pozostałe (łacińskie, potoczne). */
const PLANET_NAMES = PLANETS.map((planet) => {
  const main = new Set([normalize(planet.namePl), normalize(planet.nameEn)]);
  return { planet, names: [...new Set(planetSearchNames(planet).map(normalize))].filter(Boolean).map((name) => ({ name, main: main.has(name) })) };
});

/**
 * Wyszukiwanie planet Układu Słonecznego po nazwie (polskiej, angielskiej, łacińskiej, potocznej),
 * bez wielkości liter i znaków diakrytycznych. Punktacja w tej samej skali co searchStars:
 * 110 dokładna nazwa (powyżej każdej gwiazdy) · 90 początek nazwy polskiej/angielskiej („jow”, „sat”, „ear”) ·
 * 70 początek innej nazwy („terr”, „gwiazda por”). Zapytania krótsze niż 2 znaki nie dają wyników.
 * @returns {{planet: object, score: number}[]} planety z PLANETS, najlepsze dopasowania najpierw
 */
export function searchPlanets(query, limit = 5) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const out = [];
  for (const { planet, names } of PLANET_NAMES) {
    let score = 0;
    for (const { name, main } of names) {
      if (name === q) { score = 110; break; }
      if (name.startsWith(q)) score = Math.max(score, main ? 90 : 70);
    }
    if (score > 0) out.push({ planet, score });
  }
  // sort jest stabilny: przy remisie zostaje kolejność od Słońca (Merkury … Pluton)
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, Math.max(0, limit));
}
