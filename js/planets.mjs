// Planety Układu Słonecznego: pozycje i orbity w TYM SAMYM układzie co katalog gwiazd (HYG):
// heliocentryczny, równikowy J2000; x -> RA 0h, Dec 0°; y -> RA 6h, Dec 0°; z -> północny biegun nieba.
// Słońce leży w (0,0,0). Moduł jest czysty (bez DOM i Three.js) — działa pod `node --test`.
//
// Model: JPL "Keplerian Elements for Approximate Positions of the Major Planets" (E. M. Standish),
// tabela 1 ważna dla lat 1800–2050, średnia ekliptyka i punkt równonocy J2000.
// Dokładność: planety skaliste rzędu kilkudziesięciu sekund łuku, olbrzymy do kilku minut łuku —
// z dużym zapasem na mapę 3D. Poza 1800–2050 błąd rośnie, ale orbity pozostają sensowne.

export const AU_IN_PC = 4.84813681e-6;
export const AU_IN_KM = 149597870.7;
export const LIGHT_SPEED_KM_S = 299792.458;
/** Nachylenie ekliptyki J2000 [°] — obrót ekliptyka -> równik. */
export const OBLIQUITY_DEG = 23.43928;
export const J2000_JD = 2451545.0;

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const COS_EPS = Math.cos(OBLIQUITY_DEG * DEG);
const SIN_EPS = Math.sin(OBLIQUITY_DEG * DEG);

/**
 * Elementy w epoce J2000 i ich zmiany na stulecie juliańskie.
 * Kolejność: a [AU], e, I [°], L [°], ϖ (długość peryhelium) [°], Ω (długość węzła wstępującego) [°].
 */
function el(a, e, I, L, peri, node, da, de, dI, dL, dPeri, dNode) {
  return { a, e, I, L, peri, node, da, de, dI, dL, dPeri, dNode };
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

/**
 * id: ujemne (gwiazdy mają id HYG >= 0), stałe — są kluczem flag.
 * diameterKm: średnica równikowa; periodDays: okres gwiazdowy; aAU: średnia odległość od Słońca.
 * moons: tylko tam, gdzie liczba jest ustalona (olbrzymom wciąż przybywa odkryć — undefined).
 * Ziemia = barycentrum Ziemia–Księżyc (różnica do 4700 km, niewidoczna w tej skali).
 */
export const PLANETS = deepFreeze([
  {
    id: -1, key: 'mercury', namePl: 'Merkury', nameEn: 'Mercury', aliases: ['Mercurius'],
    kind: 'planet', kindPl: 'planeta skalista', color: '#a59a8f',
    diameterKm: 4879, periodDays: 87.969, aAU: 0.38709927, hasRings: false, moons: 0,
    elements: el(0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081),
  },
  {
    id: -2, key: 'venus', namePl: 'Wenus', nameEn: 'Venus', aliases: ['Gwiazda Poranna', 'Gwiazda Wieczorna', 'Jutrzenka'],
    kind: 'planet', kindPl: 'planeta skalista', color: '#e8cf9a',
    diameterKm: 12104, periodDays: 224.701, aAU: 0.72333566, hasRings: false, moons: 0,
    elements: el(0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
      0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418),
  },
  {
    id: -3, key: 'earth', namePl: 'Ziemia', nameEn: 'Earth', aliases: ['Terra', 'Tellus', 'Błękitna Planeta'],
    kind: 'planet', kindPl: 'planeta skalista', color: '#4f93e0',
    diameterKm: 12756, periodDays: 365.256, aAU: 1.00000261, hasRings: false, moons: 1,
    elements: el(1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0),
  },
  {
    id: -4, key: 'mars', namePl: 'Mars', nameEn: 'Mars', aliases: ['Czerwona Planeta', 'Red Planet'],
    kind: 'planet', kindPl: 'planeta skalista', color: '#d2603c',
    diameterKm: 6792, periodDays: 686.980, aAU: 1.52371034, hasRings: false, moons: 2,
    elements: el(1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343),
  },
  {
    id: -5, key: 'jupiter', namePl: 'Jowisz', nameEn: 'Jupiter', aliases: ['Iuppiter', 'Iupiter'],
    kind: 'planet', kindPl: 'gazowy olbrzym', color: '#d9b38c',
    diameterKm: 142984, periodDays: 4332.589, aAU: 5.20288700, hasRings: false,
    elements: el(5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106),
  },
  {
    id: -6, key: 'saturn', namePl: 'Saturn', nameEn: 'Saturn', aliases: ['Saturnus', 'Władca Pierścieni'],
    kind: 'planet', kindPl: 'gazowy olbrzym', color: '#e3cf9b',
    diameterKm: 120536, periodDays: 10759.22, aAU: 9.53667594, hasRings: true,
    elements: el(9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
      -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794),
  },
  {
    id: -7, key: 'uranus', namePl: 'Uran', nameEn: 'Uranus', aliases: [],
    kind: 'planet', kindPl: 'lodowy olbrzym', color: '#9fdde4',
    diameterKm: 51118, periodDays: 30685.4, aAU: 19.18916464, hasRings: false,
    elements: el(19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589),
  },
  {
    id: -8, key: 'neptune', namePl: 'Neptun', nameEn: 'Neptune', aliases: ['Neptunus'],
    kind: 'planet', kindPl: 'lodowy olbrzym', color: '#4b70e2',
    diameterKm: 49528, periodDays: 60189, aAU: 30.06992276, hasRings: false,
    elements: el(30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664),
  },
  {
    id: -9, key: 'pluto', namePl: 'Pluton', nameEn: 'Pluto', aliases: [],
    kind: 'dwarf', kindPl: 'planeta karłowata', color: '#c8ab92',
    diameterKm: 2376, periodDays: 90560, aAU: 39.48211675, hasRings: false, moons: 5,
    elements: el(39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
      -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482),
  },
]);

const BY_ID = new Map(PLANETS.map((p) => [p.id, p]));
const BY_KEY = new Map(PLANETS.map((p) => [p.key, p]));

/** true dla dziewięciu ujemnych id planet; przyjmuje liczbę albo napis z liczbą (np. klucz flagi). */
export function isPlanetId(id) {
  if (typeof id === 'string') {
    if (id.trim() === '') return false;
    id = Number(id);
  }
  return typeof id === 'number' && BY_ID.has(id);
}

/** Planeta po id (liczba albo napis z liczbą) lub null. */
export function planetById(id) {
  return isPlanetId(id) ? BY_ID.get(Number(id)) : null;
}

/** Planeta po kluczu ('mars'), bez rozróżniania wielkości liter, lub null. */
export function planetByKey(key) {
  return typeof key === 'string' ? BY_KEY.get(key.trim().toLowerCase()) || null : null;
}

/** Obiekt planety z obiektu, id albo klucza; rzuca błąd dla nieznanej wartości. */
export function resolvePlanet(planet) {
  if (planet && typeof planet === 'object' && planet.elements) return planet;
  const found = planetById(planet) || planetByKey(planet);
  if (!found) throw new RangeError(`Nieznana planeta: ${String(planet)}`);
  return found;
}

/** Wszystkie nazwy do indeksu wyszukiwarki: polska, angielska, łacińskie i potoczne (bez powtórzeń). */
export function planetSearchNames(planet) {
  const p = resolvePlanet(planet);
  const seen = new Set();
  const out = [];
  for (const name of [p.namePl, p.nameEn, ...(p.aliases || [])]) {
    const k = name.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(name); }
  }
  return out;
}

/**
 * Dzień juliański z daty (Date albo milisekundy epoki Unix).
 * Elementy JPL są w czasie TDB; różnica TDB−UTC (~69 s) przesuwa Merkurego o ~0,001° — pomijamy.
 */
export function julianDay(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  if (!Number.isFinite(ms)) throw new RangeError('Nieprawidłowa data');
  return ms / 86400000 + 2440587.5;
}

/** Stulecia juliańskie od J2000. */
export function centuriesSinceJ2000(date) {
  return (julianDay(date) - J2000_JD) / 36525;
}

/** Elementy orbity na daną datę: { a [AU], e, I, L, peri, node [°] }. */
export function elementsAt(planet, date) {
  const b = resolvePlanet(planet).elements;
  const T = centuriesSinceJ2000(date);
  return {
    a: b.a + b.da * T,
    e: b.e + b.de * T,
    I: b.I + b.dI * T,
    L: b.L + b.dL * T,
    peri: b.peri + b.dPeri * T,
    node: b.node + b.dNode * T,
  };
}

/** Kąt [°] sprowadzony do (−180, 180]. */
export function wrapDeg180(deg) {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/**
 * Równanie Keplera E − e·sin E = M (radiany), metoda Newtona, tolerancja 1e-10 rad.
 * Zbieżne dla 0 <= e < 1; dla e planet (do 0,25) wystarcza kilka kroków.
 */
export function solveKepler(M, e) {
  let m = M % TAU;
  if (m > Math.PI) m -= TAU;
  else if (m <= -Math.PI) m += TAU;
  let E = e < 0.8 ? m + e * Math.sin(m) : (m < 0 ? -Math.PI : Math.PI);
  for (let i = 0; i < 60; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

/** Macierz obrotu (płaszczyzna orbity -> ekliptyka J2000) jako 6 współczynników dla x', y'. */
function orbitBasis(elements) {
  const w = (elements.peri - elements.node) * DEG;
  const O = elements.node * DEG;
  const I = elements.I * DEG;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);
  return [
    cw * cO - sw * sO * cI, -sw * cO - cw * sO * cI,
    cw * sO + sw * cO * cI, -sw * sO + cw * cO * cI,
    sw * sI, cw * sI,
  ];
}

/** Anomalia mimośrodowa [rad] na daną datę. */
function eccentricAnomaly(elements) {
  const M = wrapDeg180(elements.L - elements.peri) * DEG;
  return solveKepler(M, elements.e);
}

/** Punkt orbity o anomalii mimośrodowej E w ekliptyce J2000 [AU]. */
function eclipticPoint(elements, basis, E) {
  const xp = elements.a * (Math.cos(E) - elements.e);
  const yp = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(E);
  return [
    basis[0] * xp + basis[1] * yp,
    basis[2] * xp + basis[3] * yp,
    basis[4] * xp + basis[5] * yp,
  ];
}

/** Ekliptyka J2000 -> równik J2000 (układ katalogu gwiazd). */
export function eclipticToEquatorial([x, y, z]) {
  return [x, COS_EPS * y - SIN_EPS * z, SIN_EPS * y + COS_EPS * z];
}

/** Równik J2000 -> ekliptyka J2000 (obrót odwrotny). */
export function equatorialToEcliptic([x, y, z]) {
  return [x, COS_EPS * y + SIN_EPS * z, -SIN_EPS * y + COS_EPS * z];
}

/** Pozycja heliocentryczna w ekliptyce J2000 [AU] — krok pośredni, przydatny w testach. */
export function positionEclipticAU(planet, date) {
  const elements = elementsAt(planet, date);
  return eclipticPoint(elements, orbitBasis(elements), eccentricAnomaly(elements));
}

/** Heliocentryczna długość ekliptyczna J2000 [°], 0..360. */
export function eclipticLongitudeDeg(planet, date) {
  const [x, y] = positionEclipticAU(planet, date);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/** Pozycja heliocentryczna, równik J2000 [AU] — te same osie co x, y, z gwiazd w HYG. */
export function positionAU(planet, date) {
  return eclipticToEquatorial(positionEclipticAU(planet, date));
}

/** To samo w parsekach (jednostka katalogu gwiazd). */
export function positionPc(planet, date) {
  const [x, y, z] = positionAU(planet, date);
  return [x * AU_IN_PC, y * AU_IN_PC, z * AU_IN_PC];
}

/** Odległość od Słońca [AU]. */
export function distanceAU(planet, date) {
  const elements = elementsAt(planet, date);
  return elements.a * (1 - elements.e * Math.cos(eccentricAnomaly(elements)));
}

/** Czas biegu światła na dystansie `au` [minuty]. */
export function lightMinutes(au) {
  return (au * AU_IN_KM) / LIGHT_SPEED_KM_S / 60;
}

/**
 * Zamknięta elipsa orbity oskulacyjnej na daną datę: Float32Array(segments * 3), równik J2000, AU.
 * Dla LineLoop (ostatni punkt łączy się z pierwszym, bez powtórzenia).
 * Punkt 0 to bieżąca pozycja planety, kolejne idą zgodnie z kierunkiem ruchu — planeta leży
 * dokładnie na linii, a indeks punktu można użyć do wygaszania „ogona” orbity.
 */
export function orbitPointsAU(planet, date, segments = 256) {
  const n = Math.floor(Number(segments));
  if (!(n >= 3)) throw new RangeError('segments musi być >= 3');
  const elements = elementsAt(planet, date);
  const basis = orbitBasis(elements);
  const E0 = eccentricAnomaly(elements);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = eclipticToEquatorial(eclipticPoint(elements, basis, E0 + (i / n) * TAU));
    out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2];
  }
  return out;
}
