import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOK, exposureFor, farFade, farMix, apparentMag, pointSize, projectPoint, pickNearest } from '../js/picking.mjs';

// Prosta macierz view-projection: kamera w (0,0,10) patrzy w -Z, rzut perspektywiczny 90°, proporcje 1:1.
// clip = P * V * p ; zapis kolumnami jak w THREE.Matrix4.elements.
function viewProj(camZ = 10, near = 0.1, far = 1000) {
  const a = -(far + near) / (far - near), b = (-2 * far * near) / (far - near);
  // P (f = 1) pomnożone przez translację (0,0,-camZ)
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, a, -1, 0, 0, -camZ * a + b, camZ];
}
const W = 800, H = 600;

test('projectPoint: środek, kierunki osi ekranu, punkt za kamerą', () => {
  const m = viewProj();
  const out = [0, 0, 0];
  assert.equal(projectPoint(m, 0, 0, 0, W, H, out), true);
  assert.deepEqual(out.map((v) => Math.round(v)), [400, 300, 10]);
  projectPoint(m, 5, 0, 0, W, H, out);
  assert.equal(Math.round(out[0]), 600, 'x w prawo');
  projectPoint(m, 0, 5, 0, W, H, out);
  assert.equal(Math.round(out[1]), 150, 'y w górę ekranu = mniejsze px');
  assert.equal(projectPoint(m, 0, 0, 20, W, H, out), false, 'za kamerą');
});

test('pickNearest: wybiera najbliższą gwiazdę w promieniu, ignoruje dalekie i te za kamerą', () => {
  const m = viewProj();
  const positions = new Float32Array([0, 0, 0, 0.5, 0, 0, 5, 0, 0, 0, 0, 30]); // px: 400, 420, 600, (za kamerą)
  const pick = (x, y, extra = {}) => pickNearest({ positions, matrix: m, width: W, height: H, x, y, ...extra });
  assert.equal(pick(401, 300), 0);
  assert.equal(pick(417, 302), 1);
  assert.equal(pick(410, 300, { radius: 12 }), 0, 'remis -> pierwsza (jaśniejsza)');
  assert.equal(pick(500, 300), -1, 'pusto');
  assert.equal(pick(600, 309), 2);
  assert.equal(pick(600, 311), -1, 'poza promieniem 9 px');
  assert.equal(pick(400, 300, { radius: 1000 }), 0);
});

test('pickNearest: duża (jasna) gwiazda ma większy obszar chwytania i pierwszeństwo', () => {
  const m = viewProj();
  const positions = new Float32Array([0, 0, 0, 0.5, 0, 0]); // 400 px i 420 px
  const sizeAt = (i) => (i === 0 ? 40 : 2);
  assert.equal(pickNearest({ positions, matrix: m, width: W, height: H, x: 412, y: 300, sizeAt }), 0);
  assert.equal(pickNearest({ positions, matrix: m, width: W, height: H, x: 412, y: 300 }), 1);
});

test('pickNearest działa tak samo przy każdym przybliżeniu (kamera 1 pc i 3000 pc od gwiazdy)', () => {
  for (const camZ of [1, 30, 3000]) {
    const m = viewProj(camZ, camZ / 100, camZ * 100);
    const positions = new Float32Array([0, 0, 0]);
    assert.equal(pickNearest({ positions, matrix: m, width: W, height: H, x: 403, y: 297 }), 0, `camZ=${camZ}`);
  }
});

test('rozmiar punktu: jaśniejsze i bliższe gwiazdy są większe, w zadanych granicach', () => {
  assert.equal(exposureFor(5), 0);
  assert.equal(exposureFor(10), 0);
  assert.ok(exposureFor(1000) > exposureFor(100));
  assert.ok(Math.abs(apparentMag(1.45, 2.637) - -1.44) < 0.02, 'Syriusz widziany ze Słońca');
  assert.ok(pointSize(1.45, 2.637) > pointSize(4.85, 2.637));
  assert.ok(pointSize(4.85, 1) > pointSize(4.85, 10));
  assert.equal(pointSize(15, 900), LOOK.minSize);
  assert.equal(pointSize(-7, 0.01), LOOK.maxSize);
  assert.ok(pointSize(0, 500, exposureFor(500)) > pointSize(0, 500, 0), 'ekspozycja rozjaśnia przy oddaleniu');
  assert.ok(exposureFor(3000) < 6, 'ekspozycja przy dużym oddaleniu jest ograniczona');
  assert.equal(farFade(42), 1);
  assert.ok(farFade(3000) < 0.1 && farFade(3000) > 0);
  assert.equal(farMix(42), 0);
  assert.equal(farMix(1000), 1);
});
