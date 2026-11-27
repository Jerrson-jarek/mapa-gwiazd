// Dekodowanie data/stars.json (zapis kolumnowy) do tablicy gwiazd + pozycje dla Three.js.

export const PC_TO_LY = 3.26156;

/**
 * @returns {{stars: object[], positions: Float32Array, byId: Map<number, number>, meta: object}}
 * positions: układ sceny (Y w górę = północny biegun nieba): (x, z, -y) z HYG, w parsekach.
 */
export function decodeCatalog(data) {
  const n = data.id.length;
  const stars = new Array(n);
  const positions = new Float32Array(n * 3);
  const byId = new Map();
  for (let i = 0; i < n; i++) {
    const x = data.x[i], y = data.y[i], z = data.z[i];
    stars[i] = {
      i, id: data.id[i], x, y, z,
      dist: Math.hypot(x, y, z),
      mag: data.mag[i], absmag: data.absmag[i], ci: data.ci[i],
      hip: data.hip[i] || 0, hd: data.hd[i] || 0,
      con: data.conList[data.con[i]] || '',
      spect: data.spectList[data.spect[i]] || '',
      proper: data.proper[i] || '', bayer: data.bayer[i] || '',
      flam: data.flam[i] || 0, gl: data.gl[i] || '',
    };
    positions[i * 3] = x; positions[i * 3 + 1] = z; positions[i * 3 + 2] = -y;
    byId.set(data.id[i], i);
  }
  return { stars, positions, byId, meta: data.meta || {} };
}

/** Wskaźnik barwy B–V -> [r,g,b] 0..1 (temperatura wg Ballesterosa, barwa ciała doskonale czarnego, lekko rozbielona). */
export function bvToRgb(bv) {
  const c = bv == null || !Number.isFinite(bv) ? 0.6 : Math.min(2.0, Math.max(-0.4, bv));
  const t = 4600 * (1 / (0.92 * c + 1.7) + 1 / (0.92 * c + 0.62));
  const k = Math.min(400, Math.max(10, t / 100));
  let r, g, b;
  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    b = 255;
  }
  const clamp = (v) => Math.min(255, Math.max(0, v)) / 255;
  const mix = 0.25; // rozbielenie, żeby barwy były subtelne
  return [clamp(r), clamp(g), clamp(b)].map((v) => v + (1 - v) * mix);
}

/** Odległość w pc -> teksty { ly, pc } z polskim przecinkiem dziesiętnym. */
export function formatDistance(pc) {
  if (pc < 1e-6) return { ly: '0', pc: '0' };
  const f = (v) => (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString()).replace('.', ',');
  return { ly: f(pc * PC_TO_LY), pc: f(pc) };
}
