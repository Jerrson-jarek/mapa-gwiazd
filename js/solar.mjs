// Układ Słoneczny na mapie: skale przybliżenia, kierunki widoku, rozmiary znaczników, formatowanie.
// Czyste funkcje bez DOM i Three.js — testowane w tests/solar.test.mjs.
import { AU_IN_PC, OBLIQUITY_DEG } from './planets.mjs';

/** Dwa zakresy przybliżenia (odległość kamery od środka widoku, w parsekach). */
export const REGIMES = Object.freeze({
  stars: Object.freeze({ min: 0.3, max: 2200 }),
  solar: Object.freeze({ min: 0.3 * AU_IN_PC, max: 300 * AU_IN_PC }),
});
export const SOLAR_VIEW_AU = 75;   // widok całego układu po wlocie (Pluton mieści się w kadrze 16:10)
export const SOLAR_EXIT_PC = 1;    // odległość od Słońca po powrocie na mapę gwiazd
export const VIEW_TILT_DEG = 55;   // wysokość kamery nad płaszczyzną ekliptyki

const RAD = Math.PI / 180;
const EPS = OBLIQUITY_DEG * RAD;

/** Układ równikowy (jak HYG) -> układ sceny (Y w górę): to samo odwzorowanie co dla gwiazd w catalog.mjs. */
export const toScene = ([x, y, z]) => [x, z, -y];

/** Normalna do płaszczyzny ekliptyki w układzie sceny. */
export const eclipticNormalScene = () => [0, Math.cos(EPS), Math.sin(EPS)];

/** 1 = planety w pełni widoczne (kamera przy Słońcu), 0 = ukryte (mapa gwiazd). Płynne przejście 0,003–0,012 pc. */
export function solarVisibility(cameraDistanceFromSunPc) {
  const t = Math.min(1, Math.max(0, (cameraDistanceFromSunPc - 0.003) / 0.009));
  return 1 - t * t * (3 - 2 * t);
}

/** Kierunek Słońce -> kamera dla widoku całego układu: `tilt` stopni nad ekliptyką, bez przechyłu horyzontu. */
export function overviewDirection(tiltDeg = VIEW_TILT_DEG) {
  const a = tiltDeg * RAD - EPS;
  return [0, Math.sin(a), Math.cos(a)];
}

/** Kierunek planeta -> kamera: po zewnętrznej stronie orbity i nad ekliptyką, żeby Słońce zostało w kadrze. */
export function planetViewDirection(posScene, tiltDeg = VIEW_TILT_DEG) {
  const n = eclipticNormalScene();
  const dot = posScene[0] * n[0] + posScene[1] * n[1] + posScene[2] * n[2];
  const u = [posScene[0] - dot * n[0], posScene[1] - dot * n[1], posScene[2] - dot * n[2]];
  const len = Math.hypot(u[0], u[1], u[2]);
  if (!(len > 0)) return overviewDirection(tiltDeg);
  const c = Math.cos(tiltDeg * RAD) / len, s = Math.sin(tiltDeg * RAD);
  return [u[0] * c + n[0] * s, u[1] * c + n[1] * s, u[2] * c + n[2] * s];
}

/** Odległość kamery od planety po „zbliż”: dwie odległości planety od Słońca (Słońce i sąsiednie orbity w kadrze). */
export function planetViewDistanceAU(sunDistanceAU) {
  return Math.min(150, Math.max(0.6, 2 * sunDistanceAU));
}

const MARKER_PX = { jupiter: 16, saturn: 14, uranus: 11, neptune: 11, earth: 9, venus: 9, mars: 7.5, mercury: 6.5, pluto: 6 };
/** Średnica znacznika planety w px (stała na ekranie — prawdziwe tarcze byłyby mniejsze niż piksel). */
export const markerSize = (planet) => MARKER_PX[planet.key] ?? 8;

/** Kolejność ważności podpisów, gdy planety nachodzą na siebie na ekranie. */
export const LABEL_PRIORITY = ['jupiter', 'saturn', 'earth', 'uranus', 'neptune', 'mars', 'venus', 'mercury', 'pluto'];

const comma = (v, digits) => v.toFixed(digits).replace('.', ',');
const thousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function formatAu(au) {
  return au < 10 ? comma(au, 2) : au < 100 ? comma(au, 1) : thousands(au);
}

/** Czas biegu światła: „8,3 min” albo „4 h 10 min”. */
export function formatLightTime(minutes) {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 60) return `${comma(minutes, 1)} min`;
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)} h ${total % 60} min`;
}

/** Okres obiegu: „88 dni (0,24 roku)”, „60 190 dni (164,8 roku)”. */
export function formatPeriod(days) {
  const years = days / 365.25;
  return `${thousands(days)} dni (${comma(years, years < 10 ? 2 : 1)} roku)`;
}

export const formatKm = (km) => `${thousands(km)} km`;

export function formatDatePl(date) {
  const p = (v) => String(v).padStart(2, '0');
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
}
