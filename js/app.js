// Mapa gwiazd 3D — scena Three.js, interfejs, flagi użytkownika, Układ Słoneczny.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { decodeCatalog, bvToRgb, formatDistance, PC_TO_LY } from './catalog.mjs';
import { displayName, otherNames, constellationLabel } from './names.mjs';
import { buildSearchIndex, searchStars, searchPlanets } from './search.mjs';
import { LOOK, exposureFor, farFade, farMix, pointSize, projectPoint, pickNearest } from './picking.mjs';
import { FlagStore, flagSvg, sanitizeFlag, DEFAULT_FLAG, PRESETS, SHAPES, PATTERNS, SYMBOLS, LIMITS } from './flags.mjs';
import { PLANETS, AU_IN_PC, isPlanetId, positionPc, lightMinutes, orbitPointsAU } from './planets.mjs';
import {
  REGIMES, SOLAR_VIEW_AU, SOLAR_EXIT_PC, toScene, solarVisibility, overviewDirection, planetViewDirection, planetViewDistanceAU,
  markerSize, LABEL_PRIORITY, formatAu, formatLightTime, formatPeriod, formatKm, formatDatePl,
} from './solar.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const UI_KEY = 'mapa-gwiazd:ui:v1';
const HOME_DISTANCE = 42;      // pc — widok początkowy wokół Słońca
const NEAR_DISTANCE = 4;       // pc — „zbliż do gwiazdy”
const RINGS_LY = [10, 25, 50, 100, 250, 500, 1000, 2500];
const LABEL_COUNT = 38;
const FLAG_LIFT = 30;          // px — o tyle wyżej stoi flaga drugiego obiektu w tym samym miejscu
const NONE = -1;               // „nic” (zaznaczenie, obiekt pod kursorem)
const BADGE = -5;              // zbiorcza flaga „Układ Słoneczny · N” przy Słońcu
const P0 = -10;                // odnośniki planet: -10 (Merkury) … -18 (Pluton); gwiazdy mają indeksy >= 0
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ---------------------------------------------------------------- ustawienia interfejsu
function loadUi() {
  try { return { labels: true, rings: true, hintSeen: false, flagsOpen: true, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') }; }
  catch { return { labels: true, rings: true, hintSeen: false, flagsOpen: true }; }
}
const ui = loadUi();
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ustawienia widoku nie są krytyczne */ } }

// Komunikaty muszą być widoczne także nad otwartym oknem dialogowym (warstwa „top layer”),
// dlatego kontener przenosimy do ostatnio otwartego okna, a po jego zamknięciu z powrotem.
function toastHost() {
  const open = document.querySelectorAll('dialog[open]');
  return open.length ? open[open.length - 1] : document.body;
}
function dockToasts() {
  const box = $('toasts');
  const host = toastHost();
  if (box.parentElement !== host) host.append(box);
}
for (const dlg of document.querySelectorAll('dialog')) dlg.addEventListener('close', dockToasts);

function toast(message, type = 'ok', ms = 4200) {
  dockToasts();
  const node = el('div', `toast toast--${type}`, message);
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');
  $('toasts').append(node);
  setTimeout(() => node.remove(), type === 'error' ? Math.max(ms, 8000) : ms);
}

/** Czytelny komunikat dla błędów zapisu flag. */
function storeErrorText(err) {
  if (err?.code === 'backup') {
    return 'Nie można zapisać: w pamięci przeglądarki leżą starsze, uszkodzone dane flag i nie udało się zrobić ich kopii (brak miejsca). Zwolnij miejsce w pamięci przeglądarki dla tej strony i spróbuj ponownie.';
  }
  return err?.message || 'Nie udało się zapisać zmian w pamięci przeglądarki.';
}

function fail(message) {
  clearTimeout(window.__mapTimer);
  $('loading').classList.add('is-error');
  $('loadingText').textContent = message;
}

// ---------------------------------------------------------------- start
let catalog, searchIndex, store;
try {
  const res = await fetch('data/stars.json?v=1');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  catalog = decodeCatalog(await res.json());
} catch (err) {
  fail('Nie udało się wczytać katalogu gwiazd (data/stars.json). Uruchom stronę przez serwer, np. „node serve.mjs 5182”.');
  throw err;
}

const { stars, positions, byId } = catalog;
const SOL = byId.get(0) ?? 0;
searchIndex = buildSearchIndex(stars);

// Gwiazdy o identycznych współrzędnych (składniki układów wielokrotnych).
const companions = new Map();
{
  const groups = new Map();
  for (const s of stars) {
    const key = `${s.x},${s.y},${s.z}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s.i);
  }
  for (const g of groups.values()) if (g.length > 1) for (const i of g) companions.set(i, g.filter((j) => j !== i));
}

// Planety: prawdziwe położenia na dzień otwarcia strony, w tej samej skali co gwiazdy (parseki).
const NOW = new Date();
const isP = (ref) => ref <= P0;
const planetBodies = PLANETS.map((planet, k) => {
  const pos = toScene(positionPc(planet, NOW));
  return {
    planet, ref: P0 - k, pos, rAU: Math.hypot(pos[0], pos[1], pos[2]) / AU_IN_PC, size: markerSize(planet),
    node: null, label: null, labelW: planet.namePl.length * 7.2 + 10, sx: 0, sy: 0, on: false, light: '',
  };
});
const bodyOf = (ref) => planetBodies[P0 - ref];
const planetRefById = new Map(planetBodies.map((b) => [b.planet.id, b.ref]));
const planetRefByKey = new Map(planetBodies.map((b) => [b.planet.key, b.ref]));
const validRef = (ref) => Number.isInteger(ref) && ((ref >= 0 && ref < stars.length) || (isP(ref) && !!bodyOf(ref)));
const refOfId = (id) => byId.get(id) ?? planetRefById.get(id) ?? NONE;
const bodyId = (ref) => (isP(ref) ? bodyOf(ref).planet.id : stars[ref].id);
const bodyName = (ref) => (isP(ref) ? bodyOf(ref).planet.namePl : displayName(stars[ref]));
const knownIds = { has: (id) => byId.has(id) || isPlanetId(id) };

const WORDS = {
  star: { nom: 'gwiazda', gen: 'gwiazdy', loc: 'gwieździe', dat: 'tej gwiazdy', none: 'Ta gwiazda nie ma jeszcze flagi.' },
  planet: { nom: 'planeta', gen: 'planety', loc: 'planecie', dat: 'tej planety', none: 'Ta planeta nie ma jeszcze flagi.' },
  dwarf: { nom: 'planeta karłowata', gen: 'planety karłowatej', loc: 'planecie karłowatej', dat: 'tej planety', none: 'Ta planeta karłowata nie ma jeszcze flagi.' },
};
const wordsFor = (ref) => (!isP(ref) ? WORDS.star : bodyOf(ref).planet.kind === 'dwarf' ? WORDS.dwarf : WORDS.planet);

let storage = null;
try { storage = window.localStorage; } catch { /* np. zablokowane dane stron */ }
store = new FlagStore(storage || { getItem: () => null, setItem: () => { throw new Error('brak localStorage'); } }).load();

const state = { selected: NONE, hovered: NONE, focus: SOL, focusExact: true, lastSelectAt: 0 };
let regime = 'stars';   // 'stars' — mapa gwiazd (parseki), 'solar' — Układ Słoneczny (jednostki astronomiczne)
let solarVis = 0;       // 0…1: widoczność planet i orbit (zależy od odległości kamery od Słońca)

// ---------------------------------------------------------------- scena
const stage = $('stage');
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance' });
} catch (err) {
  fail('Ta przeglądarka lub karta graficzna nie obsługuje WebGL, który jest potrzebny do wyświetlenia mapy 3D.');
  throw err;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setClearColor(0x04060c, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.005, 60000);
camera.position.set(0.62, 0.36, 0.7).normalize().multiplyScalar(HOME_DISTANCE);

const controls = new OrbitControls(camera, stage);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 1.6;
controls.enablePan = false;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.35;
setTimeout(() => stopAutoRotate(), 60000); // bez aktywności nie obracamy (i nie rysujemy) w nieskończoność

function applyRegime() {
  controls.minDistance = REGIMES[regime].min;
  controls.maxDistance = REGIMES[regime].max;
  document.body.dataset.regime = regime;
  $('solarBtn').setAttribute('aria-pressed', String(regime === 'solar'));
}

// Gwiazdy: jeden obiekt THREE.Points z własnym shaderem (rozmiar z jasności, barwa z B–V).
const colors = new Float32Array(stars.length * 3);
const absmags = new Float32Array(stars.length);
stars.forEach((s, i) => {
  const [r, g, b] = bvToRgb(s.ci);
  colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  absmags[i] = s.absmag;
});
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
starGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
starGeometry.setAttribute('aAbsMag', new THREE.BufferAttribute(absmags, 1));
starGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1200);

const HALO = 2.6;
const starMaterial = new THREE.ShaderMaterial({
  uniforms: { uExposure: { value: 0 }, uPixelRatio: { value: pixelRatio }, uFade: { value: 1 }, uFar: { value: 0 }, uSunAlpha: { value: 1 } },
  vertexShader: /* glsl */`
    attribute vec3 aColor;
    attribute float aAbsMag;
    uniform float uExposure;
    uniform float uPixelRatio;
    uniform float uFade;     // przygaszenie słabych gwiazd przy dużym oddaleniu (żeby chmura się nie prześwietlała)
    uniform float uFar;      // 0 = widok bliski, 1 = widok daleki
    uniform float uSunAlpha; // w widoku Układu Słonecznego Słońce rysuje osobny znacznik
    varying vec3 vColor;
    varying float vAlpha;
    varying float vGlow;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float d = max(length(mv.xyz), 0.0001);
      // jasność widziana z miejsca kamery (te same wzory co w js/picking.mjs)
      float m = aAbsMag + 5.0 * log(d / 10.0) * 0.4342945 - uExposure;
      float s = ${LOOK.baseSize.toFixed(3)} * pow(${LOOK.growth.toFixed(3)}, ${LOOK.refMag.toFixed(3)} - m);
      float size = clamp(s, ${LOOK.minSize.toFixed(3)}, ${LOOK.maxSize.toFixed(3)});
      float bright = smoothstep(2.0, 7.0, s);
      vAlpha = clamp(0.3 + 0.7 * s / ${LOOK.minSize.toFixed(3)}, 0.3, 1.0) * mix(uFade, 1.0, bright);
      if (dot(position, position) < 1e-12) vAlpha *= uSunAlpha;
      vGlow = mix(1.0, smoothstep(2.5, 8.0, size), uFar);
      vColor = aColor;
      gl_PointSize = size * ${HALO.toFixed(2)} * uPixelRatio;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vGlow;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      if (r > 1.0) discard;
      float k = r * ${HALO.toFixed(2)};
      float core = exp(-k * k * 1.9);
      float halo = pow(1.0 - r, 3.0) * 0.3 * vGlow;
      float a = (core + halo) * vAlpha;
      gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.6), a);
    }`,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthTest: false,
  depthWrite: false,
});
const points = new THREE.Points(starGeometry, starMaterial);
points.frustumCulled = false;
scene.add(points);

// Pierścienie odległości od Słońca (w płaszczyźnie równika niebieskiego).
const rings = new THREE.Group();
const ringMaterial = new THREE.LineBasicMaterial({ color: 0x6f8fd0, transparent: true, opacity: 0.2, depthTest: false });
const ringLabels = RINGS_LY.map((ly) => {
  const r = ly / PC_TO_LY;
  const pts = [];
  for (let k = 0; k < 160; k++) { const a = (k / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  rings.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMaterial));
  const node = el('div', 'ring-label', `${ly} ly`);
  $('ringLabels').append(node);
  return { node, r };
});
scene.add(rings);

// Orbity planet: zamknięte linie z 720 odcinków; punkt 0 każdej orbity to dzisiejsze położenie planety.
const orbits = new THREE.Group();
const orbitMaterials = [];
for (const b of planetBodies) {
  const au = orbitPointsAU(b.planet, NOW, 720);
  const dwarf = b.planet.kind === 'dwarf';
  // orbita przerywana (Pluton) to zwykła linia z powtórzonym pierwszym punktem: LineLoop nie liczy długości
  // odcinka zamykającego, więc kreski zagęszczałyby się na nim tuż za planetą
  const arr = new Float32Array(au.length + (dwarf ? 3 : 0));
  for (let k = 0; k < au.length; k += 3) {
    arr[k] = au[k] * AU_IN_PC; arr[k + 1] = au[k + 2] * AU_IN_PC; arr[k + 2] = -au[k + 1] * AU_IN_PC; // jak toScene()
  }
  if (dwarf) arr.copyWithin(au.length, 0, 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const color = new THREE.Color(b.planet.color).lerp(new THREE.Color(0x9fb4e4), 0.4);
  const base = dwarf ? 0.42 : 0.6;
  const options = { color, transparent: true, opacity: base, depthTest: false, depthWrite: false };
  // Pluton (planeta karłowata): orbita przerywana i słabsza; długości kresek w au (scale przelicza pc -> au)
  const material = dwarf
    ? new THREE.LineDashedMaterial({ ...options, dashSize: 0.9, gapSize: 0.7, scale: 1 / AU_IN_PC })
    : new THREE.LineBasicMaterial(options);
  const line = dwarf ? new THREE.Line(geometry, material) : new THREE.LineLoop(geometry, material);
  if (dwarf) line.computeLineDistances();
  line.frustumCulled = false;
  orbits.add(line);
  orbitMaterials.push({ material, base });
}
orbits.visible = false;
scene.add(orbits);

// ---------------------------------------------------------------- warstwa HTML nad sceną
const viewProj = new THREE.Matrix4();
const proj = [0, 0, 0];
const sunScreen = [0, 0, 0];
let width = 1, height = 1;
let dirty = true;
const invalidate = () => { dirty = true; };
const snap = (v) => Math.round(v * pixelRatio) / pixelRatio; // do pełnych pikseli urządzenia — ostry tekst

const projectStar = (i) => projectPoint(viewProj.elements, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], width, height, proj);
function projectRef(ref) {
  if (!isP(ref)) return projectStar(ref);
  const p = bodyOf(ref).pos;
  return projectPoint(viewProj.elements, p[0], p[1], p[2], width, height, proj);
}
const hide = (node) => { if (node.style.display !== 'none') node.style.display = 'none'; };

function place(node, x, y, z, margin = 120) {
  if (!projectPoint(viewProj.elements, x, y, z, width, height, proj)
    || proj[0] < -margin || proj[0] > width + margin || proj[1] < -margin || proj[1] > height + margin) {
    hide(node);
    return false;
  }
  if (node.style.display === 'none') node.style.display = '';
  node.style.transform = `translate3d(${snap(proj[0])}px,${snap(proj[1])}px,0)`;
  return true;
}
const placeStar = (node, i, margin) => place(node, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], margin);
function placeRef(node, ref, margin) {
  if (!isP(ref)) return placeStar(node, ref, margin);
  const p = bodyOf(ref).pos;
  return place(node, p[0], p[1], p[2], margin);
}

function cameraDistanceTo(i) {
  return Math.hypot(camera.position.x - positions[i * 3], camera.position.y - positions[i * 3 + 1], camera.position.z - positions[i * 3 + 2]);
}
const starSize = (i) => pointSize(stars[i].absmag, cameraDistanceTo(i), starMaterial.uniforms.uExposure.value);

// Nazwy najjaśniejszych gwiazd.
const labels = new Map(); // indeks gwiazdy -> { node, w }
{
  const named = stars.filter((s) => s.proper).slice(0, LABEL_COUNT);
  const polaris = stars.find((s) => s.proper === 'Polaris');
  if (polaris && !named.includes(polaris)) named.push(polaris);
  const taken = [];
  for (const s of named) {
    if (taken.some((t) => Math.hypot(t.x - s.x, t.y - s.y, t.z - s.z) < 0.05)) continue; // składniki tej samej gwiazdy
    taken.push(s);
    const node = el('div', 'star-label', displayName(s));
    node.style.display = 'none';
    $('starLabels').append(node);
    labels.set(s.i, { node, w: displayName(s).length * 7 + 14 });
  }
}

// Słońce i planety: znaczniki HTML o stałej wielkości na ekranie (prawdziwe tarcze byłyby mniejsze niż piksel).
const planetLayer = $('planetLayer');
const sunNode = el('div', 'sun');
const sunLabel = el('span', 'planet__label', 'Słońce');
sunNode.append(el('span', 'sun__disc'), sunLabel);
sunNode.style.display = 'none';
planetLayer.append(sunNode);
for (const b of planetBodies) {
  const node = el('div', `planet planet--${b.planet.kind}${b.planet.hasRings ? ' planet--rings' : ''}`);
  node.style.setProperty('--c', b.planet.color);
  node.style.setProperty('--s', `${b.size}px`);
  node.style.display = 'none';
  b.label = el('span', 'planet__label', b.planet.namePl);
  node.append(el('span', 'planet__disc'), b.label);
  planetLayer.append(node);
  b.node = node;
}
const labelOrder = LABEL_PRIORITY.map((key) => bodyOf(planetRefByKey.get(key)));

// Układ napisów: zachłannie wg ważności (flagi > planety > zaznaczona gwiazda > jasność);
// napis kolidujący z już postawionym jest pomijany.
let labelsShown = new Set();
let planetLabelsShown = new Set();
let sunLabelShown = false;
let labelLayoutAt = -1e9;
const relayoutLabels = () => { labelLayoutAt = -1e9; invalidate(); };
function overlaps(a, boxes) {
  for (const b of boxes) if (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]) return true;
  return false;
}
const onScreen = (m) => proj[0] >= -m && proj[0] <= width + m && proj[1] >= -m && proj[1] <= height + m;
function layoutLabels() {
  const boxes = [];
  const solar = solarVis > 0.5;
  for (const [ref, node] of flagNodes) {
    if ((isP(ref) && !solar) || !projectRef(ref)) continue;
    const top = proj[1] - 46 - node._lift;
    boxes.push([proj[0] - 4, top, proj[0] + 46 + node._labelW, top + 30]);
  }
  if (badgeNode && !solar && projectStar(SOL)) {
    const top = proj[1] - 46 - badgeNode._lift;
    boxes.push([proj[0] - 4, top, proj[0] + 46 + badgeNode._labelW, top + 30]);
  }
  const planetsShown = new Set();
  sunLabelShown = false;
  if (solar) {
    if (projectStar(SOL) && onScreen(40)) {
      sunLabelShown = !flagNodes.has(SOL);
      boxes.push([proj[0] - 9, proj[1] - 9, proj[0] + (sunLabelShown ? 66 : 9), proj[1] + 9]);
    }
    const order = isP(state.selected) ? [bodyOf(state.selected), ...labelOrder.filter((b) => b.ref !== state.selected)] : labelOrder;
    for (const b of order) {
      if (flagNodes.has(b.ref) || !projectRef(b.ref) || !onScreen(40)) continue; // flaga ma własny podpis
      const left = proj[0] + b.size / 2 + 3;
      const box = [left, proj[1] - 9, left + b.labelW, proj[1] + 9];
      if (overlaps(box, boxes)) continue;
      boxes.push(box);
      planetsShown.add(b.ref);
    }
  }
  planetLabelsShown = planetsShown;
  const order = [...labels.keys()];
  if (labels.has(state.selected)) { order.splice(order.indexOf(state.selected), 1); order.unshift(state.selected); }
  const shown = new Set();
  for (const i of order) {
    if (flagNodes.has(i) || (solar && i === SOL)) continue; // flaga i znacznik Słońca mają własne podpisy
    if (!projectStar(i) || !onScreen(40)) continue;
    const box = [proj[0] - 2, proj[1] - 12, proj[0] + labels.get(i).w, proj[1] + 10];
    if (overlaps(box, boxes)) continue;
    boxes.push(box);
    shown.add(i);
  }
  labelsShown = shown;
}

// Flagi.
const flagNodes = new Map(); // odnośnik obiektu (gwiazda lub planeta) -> element
let badgeNode = null;        // „Układ Słoneczny · N” — zastępuje flagi planet, gdy widać mapę gwiazd
function flagNode(ref, flag, text) {
  const node = el('div', 'flag');
  node.dataset.ref = String(ref);
  node.innerHTML = `<span class="flag__pole"></span><span class="flag__cloth">${flagSvg(flag, { width: 36 })}</span>`;
  const label = el('span', 'flag__label', text);
  node.append(label);
  node._lift = 0;
  node._z = '';
  $('flagLayer').append(node);
  node._labelW = label.offsetWidth || text.length * 7 + 18;
  node.style.display = 'none'; // pokaże ją dopiero place() — bez mignięcia w rogu ekranu
  return node;
}
function setLift(node, rank) {
  const lift = rank * FLAG_LIFT;
  if (lift === node._lift) return;
  node._lift = lift;
  if (lift) node.style.setProperty('--lift', `${lift}px`); else node.style.removeProperty('--lift');
}
/**
 * Flagi w Układzie Słonecznym: w widoku całości Słońce i planety wewnętrzne stoją na ekranie kilka pikseli
 * od siebie, więc flaga, która zasłoniłaby już ustawioną, dostaje wyższy maszt. Liczone co klatkę dla
 * najwyżej dziesięciu flag; ramka taka sama jak w layoutLabels().
 */
const liftBoxes = [];
function liftAmong(node, x, y) {
  const x0 = x - 4, x1 = x + 46 + node._labelW;
  let rank = 0, top = y - 46;
  for (; rank < 8; rank++, top -= FLAG_LIFT) {
    let free = true;
    for (const b of liftBoxes) if (x0 < b[2] && x1 > b[0] && top < b[3] && top + 30 > b[1]) { free = false; break; }
    if (free) break;
  }
  liftBoxes.push([x0, top, x1, top + 30]);
  setLift(node, rank);
}
function rebuildFlags() {
  $('flagLayer').replaceChildren();
  flagNodes.clear();
  badgeNode = null;
  const onPlanets = [];
  for (const [id, flag] of store.entries()) {
    const ref = refOfId(id);
    if (ref === NONE) continue;
    const node = flagNode(ref, flag, flag.label || bodyName(ref));
    if (isP(ref)) onPlanets.push([ref, flag]);
    else {
      // druga flaga w tym samym punkcie (np. Alfa Centauri A i B) stoi na wyższym maszcie
      setLift(node, (companions.get(ref) || []).filter((j) => j < ref && store.has(stars[j].id)).length);
    }
    if (ref === state.selected) node.classList.add('is-selected');
    flagNodes.set(ref, node);
  }
  if (onPlanets.length) {
    onPlanets.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    badgeNode = flagNode(BADGE, onPlanets[0][1], `Układ Słoneczny · ${onPlanets.length}`);
    badgeNode.classList.add('flag--badge');
    badgeNode._names = onPlanets.map(([ref]) => bodyName(ref)).join(', ');
    badgeNode._count = onPlanets.length;
    setLift(badgeNode, flagNodes.has(SOL) ? 1 : 0);
  }
  tipFor = -2;
  renderFlagList();
  relayoutLabels();
}

function setMarker(node, ref, minSize, pad) {
  if (ref === NONE || ref === BADGE || (isP(ref) && solarVis <= 0.5) || !projectRef(ref)) { node.hidden = true; return; }
  const size = Math.max(minSize, (isP(ref) ? bodyOf(ref).size : starSize(ref)) + pad);
  node.hidden = false;
  node.style.width = node.style.height = `${size.toFixed(1)}px`;
  node.style.transform = `translate3d(${snap(proj[0] - size / 2)}px,${snap(proj[1] - size / 2)}px,0)`;
}

let layerOpacity = '';
let statusText = '';
function updateOverlay(now) {
  camera.updateMatrixWorld();
  viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const solar = solarVis > 0.5;
  if (now - labelLayoutAt >= 100) { labelLayoutAt = now; layoutLabels(); }
  if (ui.labels) {
    for (const [i, { node }] of labels) { if (labelsShown.has(i)) placeStar(node, i, 40); else hide(node); }
  }
  const ringsOn = ui.rings && rings.visible;
  if ($('ringLabels').hidden === ringsOn) $('ringLabels').hidden = !ringsOn;
  if (ringsOn) {
    const sunVisible = projectPoint(viewProj.elements, 0, 0, 0, width, height, sunScreen);
    for (const { node, r } of ringLabels) {
      const ok = place(node, r, 0, 0, 0);
      // podpis tylko wtedy, gdy pierścień ma na ekranie sensowną wielkość
      if (ok && sunVisible && Math.hypot(proj[0] - sunScreen[0], proj[1] - sunScreen[1]) < 34) hide(node);
    }
  }

  // Słońce i planety
  const opacity = solarVis < 0.01 ? '0' : solarVis.toFixed(2);
  if (opacity !== layerOpacity) {
    layerOpacity = opacity;
    planetLayer.style.opacity = opacity;
    planetLayer.hidden = opacity === '0';
  }
  if (opacity !== '0') {
    const sunFront = projectPoint(viewProj.elements, 0, 0, 0, width, height, sunScreen);
    place(sunNode, 0, 0, 0, 80);
    if (sunLabel.hidden === sunLabelShown) sunLabel.hidden = !sunLabelShown;
    for (const b of planetBodies) {
      b.on = place(b.node, b.pos[0], b.pos[1], b.pos[2], 60);
      if (!b.on) continue;
      b.sx = proj[0]; b.sy = proj[1];
      // oświetlona strona tarczy zwrócona ku Słońcu
      let light = '50% 50%';
      if (sunFront) {
        const dx = sunScreen[0] - b.sx, dy = sunScreen[1] - b.sy, len = Math.hypot(dx, dy);
        if (len > 1) light = `${Math.round(50 + 34 * dx / len)}% ${Math.round(50 + 34 * dy / len)}%`;
      }
      if (light !== b.light) { b.light = light; b.node.style.setProperty('--light', light); }
      const showLabel = planetLabelsShown.has(b.ref);
      if (b.label.hidden === showLabel) b.label.hidden = !showLabel;
    }
  } else {
    for (const b of planetBodies) b.on = false;
  }

  const dist = controls.getDistance();
  liftBoxes.length = 0;
  for (const [ref, node] of flagNodes) {
    if (isP(ref) && !solar) { hide(node); continue; }
    if (ref === SOL && !solar) setLift(node, 0);
    if (!placeRef(node, ref, 260)) continue;
    if (solar && (isP(ref) || ref === SOL)) liftAmong(node, proj[0], proj[1]);
    // bliższa flaga zasłania dalszą; głębia liczona względem odległości kamery, bo w Układzie Słonecznym to ułamki parseka
    const z = String(1000000 - Math.round(Math.min(900, proj[2] / dist) * 1000));
    if (z !== node._z) { node._z = z; node.style.zIndex = z; }
  }
  if (badgeNode) { if (solar) hide(badgeNode); else place(badgeNode, 0, 0, 0, 260); }

  setMarker($('selectMarker'), state.selected, 26, 16);
  setMarker($('hoverMarker'), state.hovered === state.selected ? NONE : state.hovered, 18, 8);

  const d = formatDistance(dist);
  const far = dist < 0.01 ? `${formatAu(dist / AU_IN_PC)} au` : `${d.ly} ly (${d.pc} pc)`;
  let text = state.focusExact && validRef(state.focus)
    ? `Środek widoku: ${bodyName(state.focus)} · kamera w odległości ${far}`
    : `Kamera ${far} od środka widoku`;
  if (solar) text += ` · położenia planet na dzień ${formatDatePl(NOW)}`;
  if (text !== statusText) { statusText = text; $('status').textContent = text; }
}

// ---------------------------------------------------------------- ruch kamery
let tween = null;
const ORIGIN = new THREE.Vector3();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const starVec = (i) => new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/**
 * Płynny przelot: środek orbity kamery -> target, odległość interpolowana logarytmicznie, kierunek po łuku.
 * `to` — zakres przybliżenia obowiązujący po przelocie. Przelot między zakresami (mapa gwiazd <-> Układ Słoneczny)
 * nie daje się przerwać, bo w połowie drogi kamera jest poza oboma zakresami.
 */
function fly({ target, distance, dir = null, duration = 1300, to = regime, focus = NONE }) {
  stopAutoRotate();
  const fromT = controls.target.clone();
  const off0 = camera.position.clone().sub(fromT);
  const d0 = Math.max(off0.length(), 1e-12);
  const dir0 = off0.lengthSq() > 0 ? off0.clone().divideScalar(d0) : new THREE.Vector3(0, 0, 1);
  let dir1 = dir;
  let natural = d0;
  if (!dir1) {
    const off1 = camera.position.clone().sub(target);
    natural = off1.length();
    dir1 = natural > d0 * 1e-9 ? off1.divideScalar(natural) : dir0.clone();
  }
  const d1 = THREE.MathUtils.clamp(distance ?? natural, REGIMES[to].min, REGIMES[to].max);
  if (!dir) {
    // Kamera stojąca tuż przy starym środku widoku (np. w Układzie Słonecznym, czyli praktycznie na Słońcu)
    // leciałaby „po linii wzroku” i stary środek — Słońce z plakietką flag albo poprzednio oglądana gwiazda —
    // wypadłby na ekranie dokładnie na nowym celu. Wtedy zostaje dotychczasowy kierunek patrzenia,
    // a gdyby i on leżał na tej linii, zostaje odchylony o 25°.
    const sep = fromT.distanceTo(target);
    const covers = (d) => {
      const cam = target.clone().addScaledVector(d, d1);
      const toOld = fromT.clone().sub(cam);
      return toOld.length() > 0 && toOld.normalize().dot(d) < -0.9945; // stary środek przed kamerą, bliżej niż 6° od celu
    };
    if (sep > d1 * 0.05 && covers(dir1)) {
      dir1 = dir0.clone();
      if (covers(dir1)) dir1.applyAxisAngle(camera.up.clone().applyQuaternion(camera.quaternion).normalize(), THREE.MathUtils.degToRad(25)).normalize();
    }
  }
  tween = {
    t0: performance.now(), duration: reducedMotion ? 1 : duration, fromT, toT: target.clone(), dir0,
    turn: new THREE.Quaternion().setFromUnitVectors(dir0, dir1), d0, d1, to, locked: to !== regime || !!tween?.locked,
  };
  controls.enabled = false;
  state.focus = focus;
  state.focusExact = focus !== NONE;
  hideHover();
  invalidate();
}

const tmpDir = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
function stepTween(now) {
  const t = Math.min(1, Math.max(0, (now - tween.t0) / tween.duration));
  const k = ease(t);
  controls.target.lerpVectors(tween.fromT, tween.toT, k);
  tmpDir.copy(tween.dir0).applyQuaternion(tmpQuat.identity().slerp(tween.turn, k)).normalize();
  const dist = Math.exp(Math.log(tween.d0) + (Math.log(tween.d1) - Math.log(tween.d0)) * k);
  camera.position.copy(controls.target).addScaledVector(tmpDir, dist);
  camera.lookAt(controls.target);
  if (t >= 1) {
    regime = tween.to;
    tween = null;
    applyRegime();
    controls.enabled = true;
    relayoutLabels();
  }
  invalidate();
}

/** Kliknięcie lub kółko myszy w trakcie przelotu przerywa go — sterowanie od razu wraca do użytkownika. */
function cancelTween() {
  if (!tween || tween.locked) return;
  tween = null;
  controls.enabled = true;
  state.focusExact = false;
  invalidate();
}

function stopAutoRotate() {
  if (controls.autoRotate) { controls.autoRotate = false; }
}

function setDistance(d) {
  if (tween) return;
  const off = camera.position.clone().sub(controls.target);
  const len = off.length() || 1;
  camera.position.copy(controls.target).addScaledVector(off, THREE.MathUtils.clamp(d, controls.minDistance, controls.maxDistance) / len);
  invalidate();
}

/** Wlot do Układu Słonecznego: całość (po orbitę Plutona) widziana z 55° nad płaszczyzną ekliptyki. */
function enterSolar() {
  fly({ target: ORIGIN, distance: SOLAR_VIEW_AU * AU_IN_PC, dir: vec(overviewDirection()), duration: regime === 'solar' ? 1400 : 2400, to: 'solar', focus: SOL });
}
/** Powrót na mapę gwiazd: kamera cofa się na 1 pc od Słońca. */
function exitSolar() {
  fly({ target: ORIGIN, distance: SOLAR_EXIT_PC, duration: 2000, to: 'stars', focus: SOL });
}
function flyHome() {
  fly({ target: ORIGIN, distance: HOME_DISTANCE, duration: regime === 'solar' ? 2400 : 1600, to: 'stars', focus: SOL });
}
function flyNear(ref) {
  if (isP(ref)) {
    const b = bodyOf(ref);
    fly({
      target: vec(b.pos), distance: planetViewDistanceAU(b.rAU) * AU_IN_PC, dir: vec(planetViewDirection(b.pos)),
      duration: regime === 'solar' ? 1500 : 2400, to: 'solar', focus: ref,
    });
  } else if (ref === SOL) enterSolar();
  else fly({ target: starVec(ref), distance: NEAR_DISTANCE, duration: regime === 'solar' ? 2400 : 1700, to: 'stars', focus: ref });
}

/**
 * Przejście między skalami przy dalszym przybliżaniu/oddalaniu na granicy zakresu:
 * przybliżanie przy Słońcu -> Układ Słoneczny, oddalanie z Układu Słonecznego -> mapa gwiazd.
 */
function edgeTransition(zoomIn) {
  if (tween) return false;
  const d = controls.getDistance();
  if (regime === 'stars' && zoomIn && d <= REGIMES.stars.min * 1.02 && controls.target.lengthSq() < 1e-8) { enterSolar(); return true; }
  if (regime === 'solar' && !zoomIn && d >= REGIMES.solar.max * 0.98) { exitSolar(); return true; }
  return false;
}

// ---------------------------------------------------------------- zaznaczanie
function pickAt(x, y) {
  const star = pickNearest({ positions, matrix: viewProj.elements, width, height, x, y, radius: 9, sizeAt: (i) => starSize(i) });
  if (solarVis > 0.5) {
    let best = NONE, bestD = Infinity;
    for (const b of planetBodies) {
      if (!b.on) continue;
      const d = Math.hypot(x - b.sx, y - b.sy);
      if (d <= Math.max(10, b.size / 2 + 5) && d < bestD) { best = b.ref; bestD = d; }
    }
    if (best !== NONE) {
      // przy samym Słońcu planety wewnętrzne leżą o kilka pikseli od niego — wygrywa to, co bliżej kursora
      if (star === SOL && projectStar(SOL) && Math.hypot(x - proj[0], y - proj[1]) < bestD) return SOL;
      return best;
    }
  }
  return star;
}

/** mode: 'none' (samo zaznaczenie — kamera stoi), 'near' (przelot blisko obiektu) */
function select(ref, mode = 'none') {
  if (!validRef(ref)) return;
  flagNodes.get(state.selected)?.classList.remove('is-selected');
  if (isP(state.selected)) bodyOf(state.selected).node.classList.remove('is-selected');
  state.selected = ref;
  state.lastSelectAt = performance.now();
  flagNodes.get(ref)?.classList.add('is-selected');
  if (isP(ref)) bodyOf(ref).node.classList.add('is-selected');
  renderInfo();
  markFlagList();
  if (mode === 'near') flyNear(ref);
  relayoutLabels();
}

function deselect() {
  if (state.selected === NONE) return;
  flagNodes.get(state.selected)?.classList.remove('is-selected');
  if (isP(state.selected)) bodyOf(state.selected).node.classList.remove('is-selected');
  state.selected = NONE;
  $('info').hidden = true;
  markFlagList();
  relayoutLabels();
}

// ---------------------------------------------------------------- panel gwiazdy / planety
const SPECTRAL = { O: 'niebieska', B: 'błękitnobiała', A: 'biała', F: 'żółtobiała', G: 'żółta', K: 'pomarańczowa', M: 'czerwona', W: 'Wolfa-Rayeta', C: 'węglowa', S: 'typu S', D: 'biały karzeł', L: 'brązowy karzeł', T: 'brązowy karzeł' };
const fmtMag = (m) => `${m < 0 ? '−' : ''}${Math.abs(m).toFixed(2).replace('.', ',')} mag`;
const cssColor = (s) => { const [r, g, b] = bvToRgb(s.ci); return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`; };
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function fact(dl, name, value, swatchColor) {
  dl.append(el('dt', '', name));
  const dd = el('dd');
  if (swatchColor) { const sw = el('span', 'swatch'); sw.style.color = swatchColor; dd.append(sw); }
  dd.append(value);
  dl.append(dd);
  return dd;
}

function renderInfo() {
  const ref = state.selected;
  if (!validRef(ref)) { $('info').hidden = true; return; }
  $('info').hidden = false;
  const dl = $('infoFacts');
  dl.replaceChildren();
  $('infoName').textContent = bodyName(ref);
  if (isP(ref)) {
    const b = bodyOf(ref), p = b.planet;
    const dwarf = p.kind === 'dwarf';
    $('infoEyebrow').textContent = dwarf ? 'Planeta karłowata' : 'Wybrana planeta';
    $('info').setAttribute('aria-label', dwarf ? 'Wybrana planeta karłowata' : 'Wybrana planeta');
    $('infoSub').textContent = `${p.nameEn} · Układ Słoneczny`;
    fact(dl, 'Typ', p.kindPl, p.color);
    fact(dl, 'Odległość od Słońca', `${formatAu(b.rAU)} au · światło biegnie ${formatLightTime(lightMinutes(b.rAU))}`).title = `Stan na dzień ${formatDatePl(NOW)}`;
    fact(dl, 'Średnia odległość', `${formatAu(p.aAU)} au`);
    fact(dl, 'Okres obiegu', formatPeriod(p.periodDays));
    fact(dl, 'Średnica', formatKm(p.diameterKm));
    if (p.moons != null) fact(dl, 'Księżyce', p.moons === 0 ? 'brak' : String(p.moons));
    $('flyBtnText').textContent = 'Zbliż do tej planety';
  } else {
    const s = stars[ref];
    $('infoEyebrow').textContent = 'Wybrana gwiazda';
    $('info').setAttribute('aria-label', 'Wybrana gwiazda');
    $('infoSub').textContent = otherNames(s).join(' · ');
    const con = constellationLabel(s.con);
    if (con) fact(dl, 'Gwiazdozbiór', con);
    if (s.i === SOL) {
      fact(dl, 'Odległość', 'nasza gwiazda – środek mapy');
      fact(dl, 'Planety', '8 planet i planeta karłowata Pluton');
    } else { const d = formatDistance(s.dist); fact(dl, 'Odległość od Słońca', `${d.ly} ly (${d.pc} pc)`); }
    fact(dl, 'Jasność widoma', fmtMag(s.mag));
    fact(dl, 'Jasność absolutna', fmtMag(s.absmag));
    const spect = (s.spect || '').replace(/[.…:\s]+$/, ''); // w katalogu bywa „A0m...” — wielokropek to część danych, nie skrót
    const cls = SPECTRAL[spect.charAt(0).toUpperCase()];
    if (spect) fact(dl, 'Typ widmowy', cls ? `${spect} · ${cls}` : spect, cssColor(s)).title = `Typ widmowy w katalogu: ${s.spect}`;
    for (const j of companions.get(s.i) || []) {
      const link = el('button', 'link-btn', displayName(stars[j]));
      link.type = 'button';
      link.title = 'Zaznacz gwiazdę towarzyszącą (leży w tym samym miejscu mapy)';
      link.addEventListener('click', () => select(j, 'none'));
      fact(dl, 'Gwiazda towarzysząca', link);
    }
    $('flyBtnText').textContent = s.i === SOL ? 'Pokaż planety' : 'Zbliż do tej gwiazdy';
  }
  renderFlagBox();
}

function renderFlagBox() {
  const ref = state.selected;
  const box = $('flagBox');
  box.replaceChildren();
  if (!validRef(ref)) return;
  const flag = store.get(bodyId(ref));
  if (!flag) {
    box.append(el('p', 'flag-box__none', wordsFor(ref).none));
    const add = el('button', 'btn btn--primary btn--block', 'Przypisz flagę');
    add.type = 'button'; add.id = 'addFlagBtn';
    add.addEventListener('click', () => openFlagDialog(ref));
    box.append(add);
    return;
  }
  const head = el('div', 'flag-box__head');
  head.innerHTML = flagSvg(flag, { width: 44 });
  head.append(el('b', '', flag.label || bodyName(ref)));
  box.append(head);
  if (flag.note) box.append(el('p', 'flag-box__note', flag.note));
  const row = el('div', 'row row--split');
  const edit = el('button', 'btn btn--ghost btn--sm', 'Zmień flagę');
  edit.type = 'button'; edit.id = 'editFlagBtn';
  edit.addEventListener('click', () => openFlagDialog(ref));
  const del = el('button', 'btn btn--danger btn--sm', 'Usuń flagę');
  del.type = 'button'; del.id = 'deleteFlagBtn';
  del.addEventListener('click', () => removeFlag(ref));
  row.append(edit, del);
  box.append(row);
}

// ---------------------------------------------------------------- lista „Moje flagi”
const flagListButtons = new Map(); // odnośnik obiektu -> przycisk
function renderFlagList() {
  const list = $('flagList');
  list.replaceChildren();
  flagListButtons.clear();
  const entries = store.entries().filter(([id]) => refOfId(id) !== NONE).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  $('flagCount').textContent = String(entries.length);
  $('flagsEmpty').hidden = entries.length > 0;
  $('exportBtn').disabled = entries.length === 0;
  for (const [id, flag] of entries) {
    const ref = refOfId(id);
    const name = bodyName(ref);
    const li = el('li');
    const btn = el('button', 'flag-item');
    btn.type = 'button';
    btn.title = `Leć do ${wordsFor(ref).dat}`;
    btn.innerHTML = flagSvg(flag, { width: 30 });
    btn.append(el('b', '', flag.label || name));
    let sub;
    if (isP(ref)) {
      sub = `${wordsFor(ref).nom} · ${formatAu(bodyOf(ref).rAU)} au od Słońca`;
      if (flag.label) sub = `${name} · ${sub}`;
    } else sub = ref === SOL ? name : `${name} · ${formatDistance(stars[ref].dist).ly} ly`;
    btn.append(el('small', '', sub));
    btn.addEventListener('click', () => select(ref, 'near'));
    li.append(btn);
    list.append(li);
    flagListButtons.set(ref, btn);
  }
  markFlagList();
}
function markFlagList() {
  for (const [ref, btn] of flagListButtons) btn.classList.toggle('is-selected', ref === state.selected);
}

// ---------------------------------------------------------------- okna dialogowe
function confirmDialog({ title, text, yes = 'Usuń' }) {
  const dlg = $('confirmDialog');
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmYes').textContent = yes;
  dlg.returnValue = 'no';
  dlg.showModal();
  $('confirmNo').focus();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true }));
}

async function removeFlag(ref) {
  if (!validRef(ref)) return false;
  const flag = store.get(bodyId(ref));
  if (!flag) return false;
  const ok = await confirmDialog({
    title: 'Usunąć flagę?',
    text: `Flaga${flag.note ? ' i opis' : ''} ${wordsFor(ref).gen} „${bodyName(ref)}” ${flag.note ? 'zostaną trwale usunięte' : 'zostanie trwale usunięta'}.`,
  });
  if (!ok) return false;
  try { store.delete(bodyId(ref)); } catch (err) { toast(storeErrorText(err), 'error'); return false; }
  rebuildFlags();
  renderFlagBox();
  toast('Flaga została usunięta.');
  return true;
}

// Edytor flagi.
const editor = { ref: NONE, draft: { ...DEFAULT_FLAG } };

function choice(container, html, title, onClick, extraClass = '') {
  const b = el('button', `choice ${extraClass}`.trim());
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.setAttribute('aria-pressed', 'false');
  b.innerHTML = html;
  b.addEventListener('click', onClick);
  container.append(b);
  return b;
}

const symbolIcon = (key) => {
  const s = SYMBOLS[key];
  if (!s.f && !s.s) return 'brak';
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${s.f ? `<path d="${s.f}" fill="currentColor"/>` : ''}${s.s ? `<path d="${s.s}" fill="none" stroke="currentColor" stroke-width="${s.f ? 1.8 : 3}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg>`;
};

const editorButtons = { presets: [], shapes: {}, patterns: {}, symbols: {} };
function buildEditor() {
  PRESETS.forEach((p, k) => {
    editorButtons.presets[k] = choice($('presetChoices'), flagSvg(p, { width: 40 }), p.name, () => {
      Object.assign(editor.draft, { shape: p.shape, pattern: p.pattern, color: p.color, color2: p.color2, symbol: p.symbol, image: '' });
      syncEditor();
    });
  });
  for (const key of Object.keys(SHAPES)) {
    editorButtons.shapes[key] = choice($('shapeChoices'), flagSvg({ shape: key, color: '#c9d3ea' }, { width: 30 }), SHAPES[key].name, () => { editor.draft.shape = key; syncEditor(); });
  }
  for (const key of Object.keys(PATTERNS)) {
    editorButtons.patterns[key] = choice($('patternChoices'), flagSvg({ shape: 'banner', pattern: key, color: '#c9d3ea', color2: '#5d6f96' }, { width: 30 }), PATTERNS[key], () => { editor.draft.pattern = key; syncEditor(); });
  }
  for (const key of Object.keys(SYMBOLS)) {
    editorButtons.symbols[key] = choice($('symbolChoices'), symbolIcon(key), SYMBOLS[key].name, () => { editor.draft.symbol = key; syncEditor(); }, key === 'none' ? 'choice--text' : '');
  }
  for (const c of ['#e5484d', '#f0a020', '#f5c542', '#2a9d6a', '#0f9a94', '#1f8fd1', '#24439c', '#7d4fd0', '#e2508f', '#f4f4f5', '#3a4152']) {
    const b = el('button');
    b.type = 'button'; b.style.background = c; b.title = c; b.setAttribute('aria-label', `Kolor ${c}`);
    b.addEventListener('click', () => { editor.draft.color = c; syncEditor(); });
    $('swatches').append(b);
  }
  $('color1').addEventListener('input', (e) => { editor.draft.color = e.target.value; syncEditor(); });
  $('color2').addEventListener('input', (e) => { editor.draft.color2 = e.target.value; syncEditor(); });
  $('flagLabel').addEventListener('input', (e) => { editor.draft.label = e.target.value; syncEditor(); });
  $('flagNote').addEventListener('input', (e) => { editor.draft.note = e.target.value; $('noteCount').textContent = `${e.target.value.length} / ${LIMITS.note}`; });
  $('imageBtn').addEventListener('click', () => $('imageFile').click());
  $('imageClear').addEventListener('click', () => { editor.draft.image = ''; syncEditor(); });
  $('imageFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { editor.draft.image = await fileToFlagImage(file); syncEditor(); }
    catch (err) { toast(err.userMessage || 'Nie udało się odczytać tego pliku jako obrazu.', 'error'); }
  });
  $('flagCancel').addEventListener('click', () => $('flagDialog').close());
  $('flagCancelX').addEventListener('click', () => $('flagDialog').close());
  $('flagDelete').addEventListener('click', async () => { if (await removeFlag(editor.ref)) $('flagDialog').close(); });
  $('flagForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const ref = editor.ref;
    if (!validRef(ref)) return;
    try { store.set(bodyId(ref), editor.draft); }
    catch (err) { toast(storeErrorText(err), 'error'); return; }
    $('flagDialog').close();
    rebuildFlags();
    renderFlagBox();
    toast(`Flaga zapisana — zostanie na tej ${wordsFor(ref).loc} także po zamknięciu przeglądarki.`);
  });
}

function syncEditor() {
  const d = editor.draft;
  const hasImage = !!d.image;
  PRESETS.forEach((p, k) => editorButtons.presets[k].setAttribute('aria-pressed',
    String(!hasImage && p.shape === d.shape && p.pattern === d.pattern && p.color === d.color && p.symbol === d.symbol && (p.pattern === 'solid' || p.color2 === d.color2))));
  for (const [k, b] of Object.entries(editorButtons.shapes)) b.setAttribute('aria-pressed', String(k === d.shape));
  for (const [k, b] of Object.entries(editorButtons.patterns)) { b.setAttribute('aria-pressed', String(!hasImage && k === d.pattern)); b.disabled = hasImage; }
  for (const [k, b] of Object.entries(editorButtons.symbols)) { b.setAttribute('aria-pressed', String(!hasImage && k === d.symbol)); b.disabled = hasImage; }
  $('color1').value = d.color;
  $('color2').value = d.color2;
  $('color2').closest('.color').classList.toggle('is-off', hasImage || d.pattern === 'solid');
  $('color1').closest('.color').classList.toggle('is-off', hasImage);
  $('imageClear').hidden = !hasImage;
  $('imageBtn').textContent = hasImage ? 'Zmień obraz…' : 'Wgraj własny obraz…';
  const preview = $('flagPreview');
  preview.innerHTML = `<span class="flag__pole"></span><span class="flag__cloth">${flagSvg(d, { width: 36 })}</span>`;
  preview.append(el('span', 'flag__label', d.label.trim() || (validRef(editor.ref) ? bodyName(editor.ref) : '')));
}

function openFlagDialog(ref) {
  if (!validRef(ref)) return;
  const existing = store.get(bodyId(ref));
  const words = wordsFor(ref);
  editor.ref = ref;
  editor.draft = { ...DEFAULT_FLAG, ...(existing || {}) };
  $('flagDialogMode').textContent = existing ? 'Zmiana flagi' : 'Nowa flaga';
  $('flagDialogTitle').textContent = bodyName(ref);
  $('flagSave').textContent = existing ? 'Zapisz zmiany' : 'Zapisz flagę';
  $('flagDelete').hidden = !existing;
  $('flagLabel').value = editor.draft.label;
  $('flagLabel').placeholder = bodyName(ref);
  $('labelHint').textContent = `(opcjonalnie; pusty = nazwa ${isP(ref) ? 'planety' : 'gwiazdy'})`;
  $('noteTitle').textContent = `Opis ${isP(ref) ? 'planety' : 'gwiazdy'}`;
  $('flagNote').value = editor.draft.note;
  $('flagNote').placeholder = `Twoja notatka, np. dlaczego ta ${words.nom} jest dla Ciebie ważna…`;
  $('noteCount').textContent = `${editor.draft.note.length} / ${LIMITS.note}`;
  syncEditor();
  $('flagDialog').showModal();
}

function userError(message) {
  const err = new Error(message);
  err.userMessage = message;
  return err;
}

/** Własny obraz: przycięcie do proporcji flagi i zmniejszenie do 128×83 px. */
async function fileToFlagImage(file) {
  if (!file.type.startsWith('image/')) throw userError('Wybrany plik nie jest obrazem.');
  if (file.size > 25 * 1024 * 1024) throw userError('Ten obraz jest za duży (ponad 25 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const W = 128, H = 83;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) throw userError('Ten obraz nie ma określonych wymiarów (np. plik SVG bez rozmiaru). Zapisz go jako PNG lub JPG i spróbuj ponownie.');
    const scale = Math.max(W / iw, H / ih);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (W - iw * scale) / 2, (H - ih * scale) / 2, iw * scale, ih * scale);
    let data = c.toDataURL('image/png');
    if (data.length > 60000) {
      // zdjęcia: JPEG jest wielokrotnie mniejszy (białe tło pod przezroczystością)
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      data = c.toDataURL('image/jpeg', 0.86);
    }
    if (!sanitizeFlag({ image: data }).image) throw userError('Nie udało się przetworzyć tego obrazu.');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- eksport / import
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([store.export()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const day = new Date();
  const two = (v) => String(v).padStart(2, '0');
  a.download = `mapa-gwiazd-flagi-${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}.json`; // data lokalna, nie UTC
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Zapisano ${store.size} ${plural(store.size, 'flagę', 'flagi', 'flag')} do pliku.`);
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const r = store.import(await file.text(), { mode: 'merge', knownIds });
    rebuildFlags();
    renderFlagBox();
    const parts = [`dodano ${r.added}`, `zaktualizowano ${r.updated}`];
    if (r.skipped) parts.push(`pominięto ${r.skipped} (nieznane obiekty lub błędne wpisy)`);
    toast(`Import zakończony: ${parts.join(', ')}.`);
  } catch (err) {
    toast(err?.code ? storeErrorText(err) : (err.message || 'Nie udało się zaimportować pliku.'), 'error');
  }
});

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return one;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
  return many;
}

// ---------------------------------------------------------------- wyszukiwarka
const searchInput = $('search');
const resultsList = $('results');
let results = [];
let activeResult = -1;

function closeResults() {
  resultsList.hidden = true;
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.removeAttribute('aria-activedescendant');
  activeResult = -1;
}

/** Planety i gwiazdy razem, wg trafności; pewne trafienia w planetę (nazwa lub jej początek) zawsze na górze. */
function searchAll(q) {
  const planets = searchPlanets(q, 5).map((r) => ({ ref: planetRefById.get(r.planet.id), score: r.score, planet: true }));
  const starHits = searchStars(searchIndex, q, 9).map((r) => ({ ref: r.i, score: r.score, planet: false }));
  const top = planets.filter((r) => r.score >= 90);
  const rest = [...planets.filter((r) => r.score < 90), ...starHits].sort((a, b) => b.score - a.score); // stabilne: przy remisie planeta pierwsza
  return [...top, ...rest].slice(0, 9);
}

function renderResults() {
  const q = searchInput.value.trim();
  resultsList.replaceChildren();
  if (!q) { results = []; closeResults(); return; }
  results = searchAll(q);
  if (!results.length) {
    resultsList.append(el('li', 'results__empty', 'Brak gwiazdy ani planety o takiej nazwie. Spróbuj np. „Wega”, „Jowisz”, „beta Oriona” albo „HIP 91262”.'));
  }
  results.forEach((r, k) => {
    const li = el('li', 'result');
    li.id = `res-${k}`;
    li.setAttribute('role', 'option');
    const dot = el('span', 'result__dot');
    const dist = el('span', 'result__dist');
    const flag = store.get(bodyId(r.ref));
    if (flag) dist.innerHTML = flagSvg(flag, { width: 20 });
    let sub;
    if (r.planet) {
      const b = bodyOf(r.ref);
      dot.style.color = b.planet.color;
      dot.classList.add('result__dot--planet');
      dist.append(`${formatAu(b.rAU)} au`);
      sub = `${b.planet.kind === 'dwarf' ? 'Planeta karłowata' : 'Planeta'} · Układ Słoneczny`;
    } else {
      const s = stars[r.ref];
      dot.style.color = cssColor(s);
      dist.append(s.i === SOL ? '' : `${formatDistance(s.dist).ly} ly`);
      sub = [...otherNames(s).slice(0, 2), constellationLabel(s.con)].filter(Boolean).join(' · ') || `jasność ${fmtMag(s.mag)}`;
    }
    li.append(dot, el('span', 'result__name', bodyName(r.ref)), dist, el('span', 'result__sub', sub));
    li.addEventListener('mousedown', (e) => e.preventDefault());
    li.addEventListener('click', () => chooseResult(k));
    resultsList.append(li);
  });
  activeResult = results.length ? 0 : -1;
  if (!results.length) searchInput.removeAttribute('aria-activedescendant');
  resultsList.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
  markActive();
}

function markActive() {
  [...resultsList.children].forEach((li, k) => {
    const on = k === activeResult && li.classList.contains('result');
    li.classList.toggle('is-active', on);
    li.setAttribute('aria-selected', String(on));
    if (on) { searchInput.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
  });
}

function chooseResult(k) {
  const r = results[k];
  if (!r) return;
  searchInput.value = bodyName(r.ref);
  closeResults();
  searchInput.blur();
  select(r.ref, 'near');
}

searchInput.addEventListener('input', renderResults);
searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) renderResults(); searchInput.select(); });
searchInput.addEventListener('blur', () => setTimeout(closeResults, 120));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (resultsList.hidden) { renderResults(); return; }
    e.preventDefault();
    if (results.length) { activeResult = (activeResult + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; markActive(); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (resultsList.hidden) renderResults();
    if (results.length) chooseResult(Math.max(0, activeResult));
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    if (!resultsList.hidden) closeResults(); else searchInput.blur();
  }
});

// ---------------------------------------------------------------- mysz i klawiatura na scenie
const pointer = { x: -1, y: -1, inside: false, moved: true, down: null, overFlag: NONE };
const tooltip = $('tooltip');
let tipFor = -2, tipW = 0, tipH = 0;
const flagRefAt = (target) => {
  const node = target instanceof Element ? target.closest('.flag') : null;
  return node?.dataset.ref != null ? Number(node.dataset.ref) : NONE;
};

// Faza „capture”: przerwanie przelotu musi nastąpić, zanim OrbitControls obsłuży to samo zdarzenie.
stage.addEventListener('pointerdown', () => { stopAutoRotate(); cancelTween(); }, { capture: true });
stage.addEventListener('wheel', (e) => {
  stopAutoRotate();
  cancelTween();
  if (e.deltaY !== 0) edgeTransition(e.deltaY < 0);
}, { capture: true, passive: true });
stage.addEventListener('pointerdown', (e) => {
  if (e.button === 0) pointer.down = { x: e.clientX, y: e.clientY, id: e.pointerId, flag: flagRefAt(e.target) };
  stage.classList.add('is-dragging');
  hideHover();
});
function endPointer(e, click) {
  stage.classList.remove('is-dragging');
  const down = pointer.down;
  pointer.down = null;
  pointer.moved = true;
  touches.delete(e.pointerId);
  pinchGap = 0;
  if (!click || !down || e.pointerId !== down.id || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const ref = down.flag !== NONE ? down.flag : pickAt(e.clientX, e.clientY);
  if (ref === BADGE) enterSolar();
  else if (ref !== NONE) select(ref, 'none'); // samo zaznaczenie — kamera zostaje na miejscu
}
window.addEventListener('pointerup', (e) => endPointer(e, true));
window.addEventListener('pointercancel', (e) => endPointer(e, false));
stage.addEventListener('dblclick', () => {
  if (state.selected !== NONE && performance.now() - state.lastSelectAt < 700) select(state.selected, 'near');
});
stage.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; pointer.moved = true;
  pointer.overFlag = flagRefAt(e.target);
});
stage.addEventListener('pointerleave', () => { pointer.inside = false; hideHover(); });

// Ekran dotykowy: rozsuwanie/zsuwanie dwóch palców na granicy zakresu przełącza skalę tak samo jak kółko myszy.
const touches = new Map();
let pinchGap = 0;
function trackTouch(e) {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size !== 2) { pinchGap = 0; return; }
  const [a, b] = [...touches.values()];
  const gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (pinchGap && Math.abs(gap - pinchGap) > 6) {
    if (edgeTransition(gap > pinchGap)) { touches.clear(); pinchGap = 0; return; }
    pinchGap = gap;
  } else if (!pinchGap) pinchGap = gap;
}
stage.addEventListener('pointerdown', trackTouch, { capture: true });
stage.addEventListener('pointermove', trackTouch, { capture: true });

// Safari na macOS: gest szczypania na gładziku ma przybliżać mapę, a nie powiększać stronę.
let gestureStart = 0;
document.addEventListener('gesturestart', (e) => { e.preventDefault(); stopAutoRotate(); cancelTween(); gestureStart = controls.getDistance(); });
document.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  if (!gestureStart || !(e.scale > 0) || tween) return;
  const wanted = gestureStart / e.scale;
  setDistance(wanted);
  if (wanted < controls.minDistance * 0.9 || wanted > controls.maxDistance * 1.1) { if (edgeTransition(wanted < controls.minDistance)) gestureStart = 0; }
});
document.addEventListener('gestureend', (e) => { e.preventDefault(); gestureStart = 0; });

function hideHover() {
  if (state.hovered !== NONE) { state.hovered = NONE; invalidate(); }
  tooltip.hidden = true;
  tipFor = -2;
  stage.classList.remove('is-over-star');
}

function tipContent(ref) {
  if (ref === BADGE) return [badgeNode?._count === 1 ? 'Flaga w Układzie Słonecznym' : 'Flagi w Układzie Słonecznym', `${badgeNode?._names ?? ''} — kliknij, aby zobaczyć Układ Słoneczny`];
  const flag = store.get(bodyId(ref));
  const name = bodyName(ref);
  const title = flag?.label ? `${flag.label} — ${name}` : name;
  if (isP(ref)) return [title, `${bodyOf(ref).planet.kindPl} · ${formatAu(bodyOf(ref).rAU)} au od Słońca`];
  return [title, ref === SOL ? 'nasza gwiazda' : `${formatDistance(stars[ref].dist).ly} ly od Słońca`];
}

function updateHover() {
  if (!pointer.inside || pointer.down || tween || stage.classList.contains('is-dragging')) return;
  if (pointer.overFlag !== NONE) {
    // flaga mogła zniknąć spod nieruchomego kursora (zmiana skali chowa flagi planet albo flagę zbiorczą)
    const node = pointer.overFlag === BADGE ? badgeNode : flagNodes.get(pointer.overFlag);
    if (!node || node.style.display === 'none') pointer.overFlag = NONE;
  }
  const ref = pointer.overFlag !== NONE ? pointer.overFlag : pickAt(pointer.x, pointer.y);
  if (ref !== state.hovered) { state.hovered = ref; invalidate(); }
  stage.classList.toggle('is-over-star', ref !== NONE);
  if (ref === NONE) { tooltip.hidden = true; tipFor = -2; return; }
  if (ref !== tipFor) {
    // treść i wymiary dymka tylko przy zmianie obiektu (bez wymuszania layoutu w każdej klatce)
    const [title, sub] = tipContent(ref);
    tooltip.replaceChildren(el('b', '', title), el('span', '', sub));
    tooltip.hidden = false;
    tipW = tooltip.offsetWidth; tipH = tooltip.offsetHeight;
    tipFor = ref;
  }
  const tx = Math.min(Math.max(8, pointer.x + 16), window.innerWidth - tipW - 8);
  const ty = pointer.y + 18 + tipH > window.innerHeight ? pointer.y - tipH - 12 : pointer.y + 18;
  tooltip.style.transform = `translate3d(${Math.round(tx)}px,${Math.round(ty)}px,0)`;
}

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
function isTextEntry(t) {
  if (!(t instanceof HTMLElement)) return false;
  return t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && TEXT_INPUTS.has(t.type));
}
window.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') { deselect(); }
  else if (e.key === '/' && !isTextEntry(e.target)) { e.preventDefault(); searchInput.focus(); }
});

// ---------------------------------------------------------------- pozostałe przyciski
$('infoClose').addEventListener('click', deselect);
$('flyBtn').addEventListener('click', () => { if (state.selected !== NONE) select(state.selected, 'near'); });
$('homeBtn').addEventListener('click', flyHome);
$('solarBtn').addEventListener('click', enterSolar);
$('helpBtn').addEventListener('click', () => $('helpDialog').showModal());

function applyToggles() {
  $('labelsToggle').checked = ui.labels;
  $('ringsToggle').checked = ui.rings;
  $('starLabels').hidden = !ui.labels;
  relayoutLabels();
}
$('labelsToggle').addEventListener('change', (e) => { ui.labels = e.target.checked; saveUi(); applyToggles(); });
$('ringsToggle').addEventListener('change', (e) => { ui.rings = e.target.checked; saveUi(); applyToggles(); });

function applyFlagsPanel() {
  $('flagsToggle').setAttribute('aria-expanded', String(ui.flagsOpen));
  $('flagsBody').hidden = !ui.flagsOpen;
}
$('flagsToggle').addEventListener('click', () => { ui.flagsOpen = !ui.flagsOpen; saveUi(); applyFlagsPanel(); });

$('hint').hidden = ui.hintSeen;
$('hintOk').addEventListener('click', () => { ui.hintSeen = true; saveUi(); $('hint').hidden = true; });

// Flagi zmienione w innej karcie tej samej przeglądarki (key === null: wyczyszczono całą pamięć strony).
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== store.key) return;
  store.load();
  rebuildFlags();
  renderFlagBox();
});

// ---------------------------------------------------------------- pętla rysowania
function resize() {
  width = stage.clientWidth || window.innerWidth;
  height = stage.clientHeight || window.innerHeight;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  starMaterial.uniforms.uPixelRatio.value = pixelRatio;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  relayoutLabels();
}
window.addEventListener('resize', resize);
// Zmiana skali ekranu (przeniesienie okna na inny monitor, powiększenie strony).
(function watchPixelRatio() {
  const mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  if (!mq?.addEventListener) return;
  mq.addEventListener('change', () => { resize(); watchPixelRatio(); }, { once: true });
})();
controls.addEventListener('change', invalidate);
canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => { resize(); invalidate(); });

// OrbitControls zgłasza „change” dopiero przy ruchu większym niż 0,001 pc — w skali Układu Słonecznego
// to setki au, dlatego ruch kamery wykrywamy sami.
const lastPos = new THREE.Vector3(NaN, NaN, NaN);
const lastQuat = new THREE.Quaternion();
let lastFrame = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (tween) stepTween(now); else controls.update(dt);
  // z tolerancją: w spoczynku OrbitControls potrafi przestawiać kamerę o najmniejszy możliwy ułamek co klatkę,
  // a wtedy mapa rysowałaby się bez końca; zapis „!(… <= …)” łapie też pierwszą klatkę (NaN)
  const moveTol = controls.getDistance() * 1e-9;
  if (!(lastPos.distanceToSquared(camera.position) <= moveTol * moveTol) || 1 - Math.abs(lastQuat.dot(camera.quaternion)) > 1e-15) {
    lastPos.copy(camera.position);
    lastQuat.copy(camera.quaternion);
    dirty = true;
  }
  if (dirty) {
    dirty = false;
    const dist = controls.getDistance();
    const fromSun = camera.position.length();
    solarVis = solarVisibility(fromSun);
    // płaszczyzna przycinania podąża za skalą: 0,3 au od planety to 1,5e-6 pc
    const near = Math.min(0.005, Math.max(1e-10, Math.min(dist, fromSun || dist) * 0.01));
    if (Math.abs(near - camera.near) > camera.near * 0.02) { camera.near = near; camera.updateProjectionMatrix(); }
    const u = starMaterial.uniforms;
    u.uExposure.value = exposureFor(dist);
    u.uFade.value = farFade(dist);
    u.uFar.value = farMix(dist);
    u.uSunAlpha.value = 1 - solarVis;
    orbits.visible = solarVis > 0.01;
    for (const { material, base } of orbitMaterials) material.opacity = base * solarVis;
    rings.visible = ui.rings && fromSun > 0.05; // z wnętrza Układu Słonecznego pierścienie byłyby kreską przez całe niebo
    renderer.render(scene, camera);
    updateOverlay(now);
    if (pointer.inside) pointer.moved = true;
  }
  if (pointer.moved) { pointer.moved = false; updateHover(); }
}

buildEditor();
applyRegime();
applyToggles();
applyFlagsPanel();
resize();
rebuildFlags();
controls.update(0);
requestAnimationFrame(frame);

const n = stars.length;
$('brandSub').textContent = `${n.toLocaleString('pl-PL')} ${plural(n, 'gwiazda', 'gwiazdy', 'gwiazd')} + 8 planet i Pluton`;
clearTimeout(window.__mapTimer);
$('loading').classList.remove('is-error');
$('loading').classList.add('is-done');
setTimeout(() => { $('loading').hidden = true; }, 700);
if (store.recovered) {
  // magazyn zachował kopię nieczytelnych danych pod osobnym kluczem — nowe flagi zapisują się normalnie
  toast('Zapisane flagi były uszkodzone — kopia została zachowana, nowe flagi zapisują się normalnie.', 'error');
} else if (store.loadError) {
  toast('Nie udało się odczytać zapisanych flag z pamięci przeglądarki. Nowe flagi mogą się nie zapisać.', 'error');
} else if (!storage) toast('Pamięć przeglądarki (localStorage) jest niedostępna — flagi nie będą zapisywane.', 'error');

// Uchwyt diagnostyczny (konsola przeglądarki / testy ręczne).
const screenOfRef = (ref) => (validRef(ref) && projectRef(ref) ? { x: proj[0], y: proj[1] } : null);
window.mapaGwiazd = {
  stars, planets: PLANETS, store, deselect, setDistance, enterSolar, exitSolar,
  select: (id, mode) => select(byId.get(id) ?? NONE, mode),
  selectPlanet: (key, mode) => select(planetRefByKey.get(key) ?? NONE, mode),
  regime: () => regime,
  screenOf: (id) => screenOfRef(byId.get(id) ?? NONE),
  screenOfPlanet: (key) => screenOfRef(planetRefByKey.get(key) ?? NONE),
  view: () => ({
    regime, distancePc: controls.getDistance(), distanceAu: controls.getDistance() / AU_IN_PC, solarVisibility: solarVis,
    focus: validRef(state.focus) ? bodyId(state.focus) : null, selected: validRef(state.selected) ? bodyId(state.selected) : null,
    flying: !!tween, labels: labelsShown.size, planetLabels: planetLabelsShown.size,
  }),
};
