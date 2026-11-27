import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, positionPc, positionAU, AU_IN_PC, eclipticToEquatorial } from '../js/planets.mjs';
import {
  REGIMES, toScene, eclipticNormalScene, solarVisibility, overviewDirection, planetViewDirection, planetViewDistanceAU,
  markerSize, LABEL_PRIORITY, formatAu, formatLightTime, formatPeriod, formatKm, formatDatePl, SOLAR_VIEW_AU,
} from '../js/solar.mjs';

const DATE = new Date(Date.UTC(2026, 10, 27, 12));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);

test('zakresy przybliżenia nie nachodzą na siebie, a widok układu mieści się w zakresie', () => {
  assert.ok(REGIMES.solar.max < REGIMES.stars.min);
  assert.ok(Math.abs(REGIMES.solar.max / AU_IN_PC - 300) < 1e-9);
  assert.ok(SOLAR_VIEW_AU * AU_IN_PC > REGIMES.solar.min && SOLAR_VIEW_AU * AU_IN_PC < REGIMES.solar.max);
  assert.equal(REGIMES.stars.max, 2200);
});

test('toScene i normalna ekliptyki zgadzają się z przekształceniem z planets.mjs', () => {
  assert.deepEqual(toScene([1, 2, 3]), [1, 3, -2]);
  const n = toScene(eclipticToEquatorial([0, 0, 1]));
  eclipticNormalScene().forEach((v, i) => assert.ok(Math.abs(v - n[i]) < 1e-9));
  // wszystkie planety (poza Plutonem) leżą blisko płaszczyzny ekliptyki
  for (const p of PLANETS.filter((q) => q.key !== 'pluto')) {
    const pos = toScene(positionAU(p, DATE));
    assert.ok(Math.abs(dot(pos, eclipticNormalScene())) / len(pos) < 0.13, p.key);
  }
});

test('widoczność planet: pełna przy Słońcu, zerowa na mapie gwiazd', () => {
  assert.equal(solarVisibility(REGIMES.solar.max), 1);
  assert.equal(solarVisibility(0.3), 0);
  assert.equal(solarVisibility(1000), 0);
  const mid = solarVisibility(0.0075);
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('kierunki widoku: jednostkowe, 55° nad ekliptyką, kamera po zewnętrznej stronie planety', () => {
  const n = eclipticNormalScene();
  const o = overviewDirection();
  assert.ok(Math.abs(len(o) - 1) < 1e-9);
  assert.ok(Math.abs(Math.asin(dot(o, n)) * 180 / Math.PI - 55) < 1e-6);
  assert.ok(o[1] > 0, 'kamera nad horyzontem sceny');
  for (const p of PLANETS) {
    const pos = toScene(positionPc(p, DATE));
    const d = planetViewDirection(pos);
    assert.ok(Math.abs(len(d) - 1) < 1e-9, p.key);
    assert.ok(Math.abs(Math.asin(dot(d, n)) * 180 / Math.PI - 55) < 1e-6, p.key);
    assert.ok(dot(d, pos) > 0, `${p.key}: kamera dalej od Słońca niż planeta`);
  }
  assert.deepEqual(planetViewDirection([0, 0, 0]), overviewDirection());
});

test('odległość zbliżenia i rozmiary znaczników', () => {
  assert.equal(planetViewDistanceAU(0.1), 0.6);
  assert.equal(planetViewDistanceAU(5.2), 10.4);
  assert.equal(planetViewDistanceAU(500), 150);
  const size = Object.fromEntries(PLANETS.map((p) => [p.key, markerSize(p)]));
  assert.ok(size.jupiter > size.saturn && size.saturn > size.uranus && size.uranus > size.earth && size.earth > size.mercury && size.mercury > size.pluto);
  for (const v of Object.values(size)) assert.ok(v >= 6 && v <= 16);
  assert.deepEqual([...LABEL_PRIORITY].sort(), PLANETS.map((p) => p.key).sort());
});

test('formatowanie po polsku', () => {
  assert.equal(formatAu(0.98684), '0,99');
  assert.equal(formatAu(5.323), '5,32');
  assert.equal(formatAu(30.06), '30,1');
  assert.equal(formatAu(299.6), '300');
  assert.equal(formatLightTime(8.317), '8,3 min');
  assert.equal(formatLightTime(249.7), '4 h 10 min');
  assert.equal(formatLightTime(0.5), '30 s');
  assert.equal(formatPeriod(87.969), '88 dni (0,24 roku)');
  assert.equal(formatPeriod(60190), '60 190 dni (164,8 roku)');
  assert.equal(formatKm(142984), '142 984 km');
  assert.equal(formatDatePl(new Date(2026, 10, 7)), '07.11.2026');
});
