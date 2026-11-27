// Wygląd punktów (rozmiar z jasności) i wybieranie gwiazdy w przestrzeni ekranu.
// Te same wzory są użyte w shaderze (js/app.js) — zmieniaj je razem.

export const LOOK = { baseSize: 1.9, growth: 1.3, minSize: 1.3, maxSize: 30, refMag: 6.0 };

/** "Ekspozycja": im dalej kamera od celu, tym bardziej rozjaśniamy, żeby mapa nie gasła przy oddalaniu. */
export function exposureFor(orbitDistancePc) {
  const r = Math.max(orbitDistancePc, 10);
  // do 60 pc pełne rozjaśnianie; dalej dużo wolniejsze, żeby cała chmura gwiazd nie zlewała się w białą plamę
  if (r <= 60) return 4.25 * Math.log10(r / 10);
  return 4.25 * Math.log10(6) + 1.2 * Math.log10(r / 60);
}

/** Przygaszenie słabych gwiazd przy bardzo dużym oddaleniu (tysiące gwiazd na małej powierzchni ekranu). */
export function farFade(orbitDistancePc) {
  return orbitDistancePc <= 400 ? 1 : Math.max(0.04, Math.pow(400 / orbitDistancePc, 1.6));
}

/** 0 = widok bliski (pełna poświata każdej gwiazdy), 1 = widok daleki (poświata tylko wokół jasnych). */
export function farMix(orbitDistancePc) {
  const t = Math.min(1, Math.max(0, (orbitDistancePc - 60) / 240));
  return t * t * (3 - 2 * t);
}

/** Jasność obserwowana z odległości d [pc] (po uwzględnieniu ekspozycji). */
export function apparentMag(absmag, d, exposure = 0) {
  return absmag + 5 * Math.log10(Math.max(d, 1e-4) / 10) - exposure;
}

/** Średnica punktu w pikselach CSS. */
export function pointSize(absmag, d, exposure = 0) {
  const m = apparentMag(absmag, d, exposure);
  const s = LOOK.baseSize * Math.pow(LOOK.growth, LOOK.refMag - m);
  return Math.min(LOOK.maxSize, Math.max(LOOK.minSize, s));
}

/**
 * Rzut punktu macierzą view-projection (16 liczb, kolumnami — jak THREE.Matrix4.elements).
 * Zwraca false, gdy punkt jest za kamerą; w out: [x px, y px, w (głębokość)].
 */
export function projectPoint(m, x, y, z, width, height, out) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!(w > 1e-12)) return false; // próg dużo poniżej skali Układu Słonecznego (0,3 au = 1,5e-6 pc)
  const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[0] = (cx * 0.5 + 0.5) * width;
  out[1] = (1 - (cy * 0.5 + 0.5)) * height;
  out[2] = w;
  return true;
}

/**
 * Najbliższa gwiazda pod kursorem (w pikselach ekranu) — działa tak samo przy każdym przybliżeniu.
 * @param {object} o
 * @param {Float32Array} o.positions  xyz kolejnych gwiazd
 * @param {ArrayLike<number>} o.matrix  view-projection
 * @param {number} o.x @param {number} o.y  pozycja kursora w px
 * @param {number} [o.radius=9]  minimalny promień chwytania w px
 * @param {(i:number, depth:number)=>number} [o.sizeAt]  średnica punktu w px (większe gwiazdy łatwiej trafić)
 * @returns {number} indeks gwiazdy albo -1
 */
export function pickNearest({ positions, matrix, width, height, x, y, radius = 9, sizeAt }) {
  const p = [0, 0, 0];
  let best = -1, bestScore = Infinity;
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    if (!projectPoint(matrix, positions[k], positions[k + 1], positions[k + 2], width, height, p)) continue;
    const dx = p[0] - x, dy = p[1] - y;
    if (dx > 40 || dx < -40 || dy > 40 || dy < -40) continue;
    const d = Math.hypot(dx, dy);
    const size = sizeAt ? sizeAt(i, p[2]) : 0;
    if (d > Math.max(radius, size * 0.5 + 3)) continue;
    const score = d - size * 0.3;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}
