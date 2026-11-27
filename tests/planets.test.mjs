import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AU_IN_PC, AU_IN_KM, OBLIQUITY_DEG, PLANETS,
  julianDay, elementsAt, solveKepler, wrapDeg180,
  positionAU, positionPc, positionEclipticAU, eclipticLongitudeDeg,
  eclipticToEquatorial, equatorialToEcliptic,
  orbitPointsAU, distanceAU, lightMinutes,
  planetById, planetByKey, resolvePlanet, isPlanetId, planetSearchNames,
} from '../js/planets.mjs';

const DEG = Math.PI / 180;
const utc = (s) => new Date(s);
const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || 'wartość'}: ${actual} zamiast ${expected} ± ${tol}`);
/** Różnica kątów [°] w (−180, 180]. */
const angleDiff = (a, b) => wrapDeg180(a - b);
/** Precesja ogólna w długości: ~1,397° na stulecie (równonoc daty względem J2000). */
const precessionDeg = (date) => 1.39697 * (julianDay(date) - 2451545) / 36525;

/** Odległość punktu p od odcinka ab (3D). */
function distToSegment(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2));
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
}
function distToLoop(p, pts) {
  const n = pts.length / 3;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    best = Math.min(best, distToSegment(p, pts.subarray(i * 3, i * 3 + 3), pts.subarray(j * 3, j * 3 + 3)));
  }
  return best;
}

test('stałe: AU w parsekach zgodne z 1 pc = 206264,806 AU; czas światła 1 AU ≈ 8,317 min', () => {
  near(1 / AU_IN_PC, 206264.806, 0.01, 'AU na parsek');
  assert.equal(AU_IN_KM, 149597870.7);
  near(lightMinutes(1), 8.3167, 0.0005, 'minuty świetlne 1 AU');
  near(lightMinutes(30.07), 250.1, 0.1, 'Neptun: ponad 4 godziny');
});

test('julianDay: J2000, epoka Unix, milisekundy; błędna data rzuca', () => {
  assert.equal(julianDay(utc('2000-01-01T12:00:00Z')), 2451545);
  assert.equal(julianDay(new Date(0)), 2440587.5);
  assert.equal(julianDay(Date.UTC(2026, 10, 27, 12)), julianDay(utc('2026-11-27T12:00:00Z')));
  near(julianDay(utc('2026-11-27T12:00:00Z')), 2461372.0, 1e-9, 'JD 2026-11-27 12:00 UTC');
  assert.throws(() => julianDay(new Date('nie data')), RangeError);
});

test('PLANETS: kolejność, unikalne ujemne id, komplet pól, zamrożone', () => {
  assert.deepEqual(PLANETS.map((p) => p.id), [-1, -2, -3, -4, -5, -6, -7, -8, -9]);
  assert.deepEqual(PLANETS.map((p) => p.key), ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
  assert.deepEqual(PLANETS.map((p) => p.namePl), ['Merkury', 'Wenus', 'Ziemia', 'Mars', 'Jowisz', 'Saturn', 'Uran', 'Neptun', 'Pluton']);
  assert.equal(new Set(PLANETS.map((p) => p.id)).size, 9);
  for (const p of PLANETS) {
    assert.ok(Number.isInteger(p.id) && p.id < 0, `${p.key}: id ujemne`);
    assert.match(p.color, /^#[0-9a-f]{6}$/, `${p.key}: kolor`);
    assert.ok(p.nameEn && p.kindPl && Array.isArray(p.aliases), `${p.key}: nazwy`);
    assert.ok(p.diameterKm > 2000 && p.periodDays > 80, `${p.key}: dane fizyczne`);
    assert.equal(p.aAU, p.elements.a, `${p.key}: aAU = a z elementów`);
    assert.equal(p.kind, p.key === 'pluto' ? 'dwarf' : 'planet');
    assert.equal(p.hasRings, p.key === 'saturn');
    // III prawo Keplera: T² = a³ (lata, AU) — wyłapuje pomyłkę w okresie albo półosi
    near((p.periodDays / 365.256) ** 2 / p.aAU ** 3, 1, 0.01, `${p.key}: T²/a³`);
    assert.ok(Object.isFrozen(p) && Object.isFrozen(p.elements) && Object.isFrozen(p.aliases), `${p.key}: zamrożone`);
  }
  assert.ok(Object.isFrozen(PLANETS));
  assert.deepEqual(PLANETS.map((p) => p.moons), [0, 0, 1, 2, undefined, undefined, undefined, undefined, 5]);
});

test('isPlanetId / planetById / resolvePlanet: liczby, napisy, klucze i wartości spoza zakresu', () => {
  for (const p of PLANETS) {
    assert.equal(isPlanetId(p.id), true);
    assert.equal(isPlanetId(String(p.id)), true);
    assert.equal(planetById(p.id), p);
    assert.equal(planetById(String(p.id)), p);
    assert.equal(resolvePlanet(p), p);
    assert.equal(resolvePlanet(p.id), p);
    assert.equal(resolvePlanet(p.key), p);
    assert.equal(planetByKey(p.key.toUpperCase()), p);
  }
  for (const bad of [0, 1, 3, -10, -1.5, NaN, Infinity, '0', '32263', '-10', '', ' ', 'mars', '-3x', null, undefined, {}, [], true]) {
    assert.equal(isPlanetId(bad), false, `isPlanetId(${JSON.stringify(bad)})`);
    assert.equal(planetById(bad), null);
  }
  assert.throws(() => resolvePlanet('wulkan'), RangeError);
  assert.throws(() => positionAU(0, new Date()), RangeError);
});

test('planetSearchNames: polska, angielska i łacińska nazwa, bez powtórzeń', () => {
  assert.deepEqual(planetSearchNames('uranus'), ['Uran', 'Uranus']);
  assert.deepEqual(planetSearchNames(-4).slice(0, 2), ['Mars', 'Czerwona Planeta'], 'Mars/Mars nie powtarza się');
  const earth = planetSearchNames('earth');
  for (const n of ['Ziemia', 'Earth', 'Terra']) assert.ok(earth.includes(n), n);
  assert.ok(planetSearchNames('jupiter').includes('Iuppiter'));
  assert.ok(planetSearchNames('pluto').includes('Pluto') && planetSearchNames('pluto').includes('Pluton'));
  const all = new Map();
  for (const p of PLANETS) {
    const names = planetSearchNames(p);
    assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, `${p.key}: bez duplikatów`);
    for (const n of names) {
      assert.ok(!all.has(n.toLowerCase()), `nazwa „${n}” wskazuje dwie planety`);
      all.set(n.toLowerCase(), p.id);
    }
  }
});

test('równanie Keplera zbiega dla e do 0,25 (i dla wysokich mimośrodów)', () => {
  for (const e of [0, 0.0167, 0.0934, 0.2056, 0.2488, 0.25, 0.6, 0.95]) {
    for (let k = -720; k <= 720; k++) {
      const M = (k / 720) * Math.PI;
      const E = solveKepler(M, e);
      assert.ok(Number.isFinite(E), `E skończone (e=${e}, M=${M})`);
      // M = −π jest sprowadzane do +π (zakres (−π, π]), więc resztę porównujemy modulo 2π
      const residual = wrapDeg180((E - e * Math.sin(E) - M) / DEG) * DEG;
      near(residual, 0, 1e-9, `reszta równania Keplera (e=${e}, M=${M})`);
      assert.ok(Math.abs(E) <= Math.PI + 1e-9, `E w zakresie (e=${e}, M=${M})`);
    }
  }
  near(solveKepler(0, 0.25), 0, 1e-12, 'peryhelium');
  near(Math.abs(solveKepler(Math.PI, 0.25)), Math.PI, 1e-9, 'aphelium');
  // M poza (−π, π] jest sprowadzane do zakresu
  near(solveKepler(1 + 4 * Math.PI, 0.2), solveKepler(1, 0.2), 1e-9, 'okresowość');
  assert.equal(wrapDeg180(540), 180);
  assert.equal(wrapDeg180(-180), 180);
  assert.equal(wrapDeg180(-190), 170);
});

test('Ziemia: peryhelium ok. 3–4 stycznia ≈ 0,983 AU, aphelium ok. 4 lipca ≈ 1,017 AU', () => {
  near(distanceAU('earth', utc('2025-01-04T12:00:00Z')), 0.9833, 0.002, 'peryhelium 2025');
  near(distanceAU('earth', utc('2025-07-04T12:00:00Z')), 1.0167, 0.002, 'aphelium 2025');
  near(distanceAU('earth', utc('2026-01-03T12:00:00Z')), 0.9833, 0.002, 'peryhelium 2026');
  near(distanceAU('earth', utc('2026-07-06T12:00:00Z')), 1.0167, 0.002, 'aphelium 2026');
  // distanceAU zgodne z długością wektora pozycji
  for (const p of PLANETS) {
    const d = utc('2026-11-27T12:00:00Z');
    near(Math.hypot(...positionAU(p, d)), distanceAU(p, d), 1e-9, `${p.key}: |r|`);
    near(Math.hypot(...positionEclipticAU(p, d)), distanceAU(p, d), 1e-9, `${p.key}: |r| ekliptyczne`);
  }
});

test('Ziemia: długość heliocentryczna ≈ 180° w równonocy marcowej i ≈ 0° we wrześniowej', () => {
  const march = utc('2025-03-20T09:01:00Z');
  const september = utc('2025-09-22T18:19:00Z');
  near(angleDiff(eclipticLongitudeDeg('earth', march), 180), 0, 0.5, 'równonoc marcowa (J2000)');
  near(angleDiff(eclipticLongitudeDeg('earth', september), 0), 0, 0.5, 'równonoc wrześniowa (J2000)');
  // Równonoc jest liczona od punktu Barana DATY; po doliczeniu precesji (0,35° w 2025 r.) zgodność jest ~10× lepsza.
  near(angleDiff(eclipticLongitudeDeg('earth', march) + precessionDeg(march), 180), 0, 0.03, 'równonoc marcowa (równonoc daty)');
  near(angleDiff(eclipticLongitudeDeg('earth', september) + precessionDeg(september), 0), 0, 0.03, 'równonoc wrześniowa (równonoc daty)');
  // To samo po obrocie pozycji równikowej z powrotem do ekliptyki
  const back = equatorialToEcliptic(positionAU('earth', march));
  near(angleDiff(Math.atan2(back[1], back[0]) / DEG, 180), 0, 0.5, 'obrót odwrotny');
});

test('Ziemia w układzie równikowym: z ≈ 0 w równonocach, |z| ≈ sin ε · r w przesileniach', () => {
  const sinEps = Math.sin(OBLIQUITY_DEG * DEG);
  for (const s of ['2025-03-20T09:01:00Z', '2025-09-22T18:19:00Z']) {
    const [x, y, z] = positionAU('earth', utc(s));
    // 0,35° precesji od J2000 daje |z| ≈ r·sin ε·sin 0,35° ≈ 0,0024 AU
    near(z, 0, 0.004, `z w równonocy ${s}`);
    near(y, 0, 0.008, `y w równonocy ${s}`);
    near(Math.abs(x), distanceAU('earth', utc(s)), 1e-4, `|x| = r w równonocy ${s}`);
  }
  // marzec: Słońce widać w kierunku RA 0h, więc Ziemia leży po stronie −x; wrzesień odwrotnie
  assert.ok(positionAU('earth', utc('2025-03-20T09:01:00Z'))[0] < 0);
  assert.ok(positionAU('earth', utc('2025-09-22T18:19:00Z'))[0] > 0);

  const june = utc('2025-06-21T02:42:00Z');
  const december = utc('2025-12-21T15:03:00Z');
  const zJune = positionAU('earth', june)[2];
  const zDec = positionAU('earth', december)[2];
  near(Math.abs(zJune), sinEps * distanceAU('earth', june), 2e-4, '|z| w przesileniu czerwcowym');
  near(Math.abs(zDec), sinEps * distanceAU('earth', december), 2e-4, '|z| w przesileniu grudniowym');
  // czerwiec: Słońce na Dec +23,4°, więc Ziemia widziana ze Słońca ma Dec −23,4° (z < 0, y < 0)
  assert.ok(zJune < 0 && positionAU('earth', june)[1] < 0, 'czerwiec: z < 0, y < 0');
  assert.ok(zDec > 0 && positionAU('earth', december)[1] > 0, 'grudzień: z > 0, y > 0');
  near(eclipticLongitudeDeg('earth', june), 270, 0.5, 'długość w przesileniu czerwcowym');
  near(eclipticLongitudeDeg('earth', december), 90, 0.5, 'długość w przesileniu grudniowym');
});

test('obrót ekliptyka <-> równik: odwracalny, zachowuje długość i oś x', () => {
  const v = [0.3, -1.7, 0.45];
  const eq = eclipticToEquatorial(v);
  assert.equal(eq[0], v[0]);
  near(Math.hypot(...eq), Math.hypot(...v), 1e-12, 'długość');
  equatorialToEcliptic(eq).forEach((c, i) => near(c, v[i], 1e-12, `składowa ${i}`));
  // biegun ekliptyki leży na RA 18h, Dec 66,56°
  const pole = eclipticToEquatorial([0, 0, 1]);
  near(pole[1], -Math.sin(OBLIQUITY_DEG * DEG), 1e-12, 'biegun ekliptyki: y');
  near(pole[2], Math.cos(OBLIQUITY_DEG * DEG), 1e-12, 'biegun ekliptyki: z');
});

test('opozycje: Mars 2025-01-16, Jowisz 2026-01-10, Saturn 2025-09-21 — długości zgodne z Ziemią', () => {
  for (const [key, day] of [['mars', '2025-01-16'], ['jupiter', '2026-01-10'], ['saturn', '2025-09-21']]) {
    const date = utc(`${day}T12:00:00Z`);
    const diff = angleDiff(eclipticLongitudeDeg(key, date), eclipticLongitudeDeg('earth', date));
    near(diff, 0, 1.5, `opozycja: ${key} ${day}`);
    // tydzień wcześniej Ziemia jest jeszcze za planetą, tydzień później już przed nią
    const before = new Date(date.getTime() - 7 * 86400000);
    const after = new Date(date.getTime() + 7 * 86400000);
    assert.ok(angleDiff(eclipticLongitudeDeg(key, before), eclipticLongitudeDeg('earth', before)) > 1.5, `${key}: przed opozycją`);
    assert.ok(angleDiff(eclipticLongitudeDeg(key, after), eclipticLongitudeDeg('earth', after)) < -1.5, `${key}: po opozycji`);
  }
});

test('długości heliocentryczne w epoce J2000 zgodne z tablicami (±0,2°)', () => {
  const j2000 = utc('2000-01-01T12:00:00Z');
  const expected = { mercury: 253.8, venus: 182.6, earth: 100.4, mars: 359.4, jupiter: 36.3, saturn: 45.7, uranus: 316.4, neptune: 303.9, pluto: 250.5 };
  for (const [key, lon] of Object.entries(expected)) {
    near(angleDiff(eclipticLongitudeDeg(key, j2000), lon), 0, 0.2, `${key}: długość J2000`);
  }
  near(distanceAU('pluto', j2000), 30.2, 0.1, 'Pluton w 2000 r. wciąż blisko peryhelium');
});

test('odległość każdej planety mieści się w [a(1−e), a(1+e)] przez cały okres i sięga obu krańców', () => {
  const start = utc('2026-01-01T00:00:00Z').getTime();
  for (const p of PLANETS) {
    const steps = 720;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i <= steps; i++) {
      const date = new Date(start + (i / steps) * p.periodDays * 86400000);
      const { a, e } = elementsAt(p, date);
      const r = distanceAU(p, date);
      assert.ok(r >= a * (1 - e) - 1e-9 && r <= a * (1 + e) + 1e-9, `${p.key}: r=${r} poza [q, Q] dla ${date.toISOString()}`);
      min = Math.min(min, r); max = Math.max(max, r);
    }
    // Poza 1800–2050 elementy dryfują (olbrzymy), stąd luz 1% na krańcach
    near(min / (p.aAU * (1 - p.elements.e)), 1, 0.01, `${p.key}: peryhelium osiągane`);
    near(max / (p.aAU * (1 + p.elements.e)), 1, 0.01, `${p.key}: aphelium osiągane`);
  }
});

test('ruch jest prosty (przeciwnie do wskazówek zegara, patrząc z północy) i okres się zgadza', () => {
  const t0 = utc('2026-11-27T12:00:00Z');
  for (const p of PLANETS) {
    const dt = p.periodDays / 360;
    const t1 = new Date(t0.getTime() + dt * 86400000);
    const step = angleDiff(eclipticLongitudeDeg(p, t1), eclipticLongitudeDeg(p, t0));
    assert.ok(step > 0.4 && step < 2, `${p.key}: krok długości ${step}° na 1/360 okresu`);
    // po pełnym okresie gwiazdowym planeta wraca w to samo miejsce
    const full = new Date(t0.getTime() + p.periodDays * 86400000);
    near(angleDiff(eclipticLongitudeDeg(p, full), eclipticLongitudeDeg(p, t0)), 0, 0.5, `${p.key}: długość po pełnym okresie`);
  }
});

test('positionPc = positionAU · AU_IN_PC; planety leżą w pasie ekliptyki, nie równika', () => {
  const date = utc('2026-11-27T12:00:00Z');
  for (const p of PLANETS) {
    const au = positionAU(p, date);
    const pc = positionPc(p, date);
    pc.forEach((c, i) => near(c, au[i] * AU_IN_PC, 1e-18, `${p.key}: składowa ${i}`));
    assert.ok(Math.hypot(...pc) < 2.5e-4, `${p.key}: w parsekach to ułamki tysięcznych`);
    const ecl = positionEclipticAU(p, date);
    const lat = Math.asin(ecl[2] / Math.hypot(...ecl)) / DEG;
    assert.ok(Math.abs(lat) <= p.elements.I + 0.01 || p.key === 'earth', `${p.key}: szerokość ekliptyczna ${lat}° <= I`);
  }
  near(Math.hypot(...positionEclipticAU('earth', date).slice(2)), 0, 1e-4, 'Ziemia w płaszczyźnie ekliptyki');
});

test('orbitPointsAU: zamknięta elipsa, punkt 0 = bieżąca pozycja, promienie w [q, Q]', () => {
  const date = utc('2026-11-27T12:00:00Z');
  for (const p of PLANETS) {
    const pts = orbitPointsAU(p, date);
    assert.ok(pts instanceof Float32Array);
    assert.equal(pts.length, 256 * 3);
    const { a, e } = elementsAt(p, date);
    const pos = positionAU(p, date);
    const tol = a * 1e-5; // precyzja Float32
    for (let c = 0; c < 3; c++) near(pts[c], pos[c], tol, `${p.key}: punkt 0, składowa ${c}`);
    assert.ok(distToLoop(pos, pts) <= tol, `${p.key}: pozycja na łamanej`);
    let min = Infinity, max = -Infinity, maxGap = 0;
    for (let i = 0; i < 256; i++) {
      const j = (i + 1) % 256;
      const r = Math.hypot(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      assert.ok(Number.isFinite(r), `${p.key}: punkt ${i} skończony`);
      assert.ok(r >= a * (1 - e) - tol && r <= a * (1 + e) + tol, `${p.key}: punkt ${i} r=${r}`);
      min = Math.min(min, r); max = Math.max(max, r);
      maxGap = Math.max(maxGap, Math.hypot(pts[j * 3] - pts[i * 3], pts[j * 3 + 1] - pts[i * 3 + 1], pts[j * 3 + 2] - pts[i * 3 + 2]));
    }
    // elipsa jest domknięta: żaden odcinek (także ostatni -> pierwszy) nie jest dłuższy niż a·2π/256
    assert.ok(maxGap <= a * (2 * Math.PI / 256) * 1.001, `${p.key}: najdłuższy odcinek ${maxGap}`);
    near(min / (a * (1 - e)), 1, 1e-3, `${p.key}: orbita sięga peryhelium`);
    near(max / (a * (1 + e)), 1, 1e-3, `${p.key}: orbita sięga aphelium`);
    // punkty idą zgodnie z ruchem planety: pozycja za 1/64 okresu leży przy punkcie o małym dodatnim indeksie
    const later = positionAU(p, new Date(date.getTime() + (p.periodDays / 64) * 86400000));
    let nearest = 0, best = Infinity;
    for (let i = 0; i < 256; i++) {
      const d = Math.hypot(pts[i * 3] - later[0], pts[i * 3 + 1] - later[1], pts[i * 3 + 2] - later[2]);
      if (d < best) { best = d; nearest = i; }
    }
    assert.ok(nearest >= 1 && nearest <= 8, `${p.key}: kierunek obiegu (najbliższy punkt ${nearest})`);
    assert.ok(distToLoop(later, pts) <= a * 2e-3, `${p.key}: późniejsza pozycja wciąż przy orbicie`);
  }
  assert.equal(orbitPointsAU('mars', date, 64).length, 64 * 3);
  assert.throws(() => orbitPointsAU('mars', date, 2), RangeError);
});

test('pozycje referencyjne 2026-11-27 12:00 UTC (regresja, równik J2000, AU)', () => {
  const date = utc('2026-11-27T12:00:00Z');
  const expected = {
    mercury: [-0.3696, 0.0357, 0.0574],
    venus: [0.0559, 0.6559, 0.2916],
    earth: [0.4190, 0.8197, 0.3553],
    mars: [-0.6287, 1.3511, 0.6367],
    jupiter: [-3.8109, 3.3814, 1.5421],
    saturn: [9.1737, 2.0789, 0.4638],
    uranus: [8.7250, 15.9431, 6.8591],
    neptune: [29.8271, 1.7145, -0.0408],
    pluto: [20.1173, -25.8283, -14.1214],
  };
  for (const [key, xyz] of Object.entries(expected)) {
    positionAU(key, date).forEach((c, i) => near(c, xyz[i], 1e-4, `${key}: składowa ${i}`));
  }
});
