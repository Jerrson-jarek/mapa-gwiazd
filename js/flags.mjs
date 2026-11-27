// Flagi użytkownika: model, walidacja, rysunek SVG, zapis w localStorage, eksport/import JSON.
// Moduł bez zależności od DOM — testowany w Node (tests/flags.test.mjs).

export const STORAGE_KEY = 'mapa-gwiazd:flagi:v1';
/** Klucz kopii nieczytelnych danych (kolejne kopie: „…:backup:2”, „…:backup:3”). */
export const BACKUP_KEY = 'mapa-gwiazd:flagi:backup';
const MAX_BACKUPS = 20;
export const LIMITS = { label: 40, note: 2000, image: 160000 };

export const SHAPES = {
  banner: { name: 'Prostokąt', d: 'M0 0H40V26H0Z', cx: 20, s: 0.62 },
  pennant: { name: 'Proporzec', d: 'M0 0L40 13L0 26Z', cx: 11.5, s: 0.46 },
  swallow: { name: 'Jaskółczy ogon', d: 'M0 0H40L31 13L40 26H0Z', cx: 15.5, s: 0.6 },
};

export const PATTERNS = {
  solid: 'Jednolita',
  horizontal: 'Dwa pasy poziome',
  vertical: 'Dwa pasy pionowe',
  cross: 'Krzyż',
};

/** Symbole w polu 24×24: f = wypełnione ścieżki, s = ścieżki rysowane linią. */
export const SYMBOLS = {
  none: { name: 'Bez symbolu' },
  star: { name: 'Gwiazda', f: 'M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6 5.9 20.9l1.3-6.7-5-4.7 6.8-.8z' },
  heart: { name: 'Serce', f: 'M12 20.5C5.5 15.6 3 12.4 3 9.1 3 6.5 5 4.5 7.5 4.5c1.8 0 3.4 1 4.5 2.6 1.1-1.6 2.7-2.6 4.5-2.6C19 4.5 21 6.5 21 9.1c0 3.3-2.5 6.5-9 11.4z' },
  circle: { name: 'Koło', f: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z' },
  diamond: { name: 'Romb', f: 'M12 3l8 9-8 9-8-9z' },
  check: { name: 'Odwiedzone', s: 'M5 12.5l4.5 4.5L19 7' },
  bolt: { name: 'Błyskawica', f: 'M13.5 2L5 13.5h5.5L9.5 22 19 10h-5.5z' },
  moon: { name: 'Księżyc', f: 'M15.5 3.5a9 9 0 1 0 5 15.6A8 8 0 0 1 15.5 3.5z' },
  planet: { name: 'Planeta', f: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', s: 'M3.5 15.5c-1.6-2 3-5.4 8-7.2s9.4-1.8 9 .2' },
  home: { name: 'Dom', f: 'M12 3.5l9 8h-2.5v8.5h-4.5v-5.5h-4v5.5H5.5v-8.5H3z' },
  plus: { name: 'Plus', f: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z' },
};

/** Gotowe flagi do wyboru jednym kliknięciem. */
export const PRESETS = [
  { name: 'Czerwony proporzec', shape: 'pennant', pattern: 'solid', color: '#e5484d', color2: '#ffffff', symbol: 'none' },
  { name: 'Granatowa z gwiazdą', shape: 'banner', pattern: 'solid', color: '#24439c', color2: '#ffffff', symbol: 'star' },
  { name: 'Zielona – odwiedzone', shape: 'swallow', pattern: 'solid', color: '#2a9d6a', color2: '#ffffff', symbol: 'check' },
  { name: 'Bursztynowa błyskawica', shape: 'pennant', pattern: 'solid', color: '#f0a020', color2: '#ffffff', symbol: 'bolt' },
  { name: 'Fioletowa z księżycem', shape: 'banner', pattern: 'solid', color: '#7d4fd0', color2: '#ffffff', symbol: 'moon' },
  { name: 'Błękitna z planetą', shape: 'swallow', pattern: 'solid', color: '#1f8fd1', color2: '#ffffff', symbol: 'planet' },
  { name: 'Różowa z sercem', shape: 'banner', pattern: 'solid', color: '#e2508f', color2: '#ffffff', symbol: 'heart' },
  { name: 'Morska – dom', shape: 'banner', pattern: 'solid', color: '#0f9a94', color2: '#ffffff', symbol: 'home' },
  { name: 'Biało-czerwona', shape: 'banner', pattern: 'horizontal', color: '#f4f4f5', color2: '#dc2f3c', symbol: 'none' },
  { name: 'Niebiesko-złota', shape: 'swallow', pattern: 'vertical', color: '#2456c9', color2: '#f5c542', symbol: 'none' },
  { name: 'Z krzyżem', shape: 'banner', pattern: 'cross', color: '#c23a2e', color2: '#ffffff', symbol: 'none' },
  { name: 'Grafitowy proporzec', shape: 'pennant', pattern: 'solid', color: '#3a4152', color2: '#ffffff', symbol: 'circle' },
];

export const DEFAULT_FLAG = Object.freeze({
  shape: 'pennant', pattern: 'solid', color: '#e5484d', color2: '#ffffff',
  symbol: 'none', image: '', label: '', note: '', updatedAt: 0,
});

const HEX = /^#[0-9a-f]{6}$/i;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export function isValidImage(v) {
  return typeof v === 'string' && v.length <= LIMITS.image && IMAGE.test(v);
}

const hex = (v, def) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : def);
const text = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max) : '');

/** Sprowadza dowolny obiekt do poprawnej flagi (nieznane/niepoprawne pola -> wartości domyślne). Zwraca null, gdy to nie obiekt. */
export function sanitizeFlag(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const pick = (v, table, def) => (typeof v === 'string' && Object.hasOwn(table, v) ? v : def);
  return {
    shape: pick(raw.shape, SHAPES, DEFAULT_FLAG.shape),
    pattern: pick(raw.pattern, PATTERNS, DEFAULT_FLAG.pattern),
    color: hex(raw.color, DEFAULT_FLAG.color),
    color2: hex(raw.color2, DEFAULT_FLAG.color2),
    symbol: pick(raw.symbol, SYMBOLS, DEFAULT_FLAG.symbol),
    image: isValidImage(raw.image) ? raw.image : '',
    label: text(raw.label, LIMITS.label).replace(/\n/g, ' ').trim(),
    note: text(raw.note, LIMITS.note).trim(),
    updatedAt: Number.isFinite(raw.updatedAt) && raw.updatedAt > 0 ? Math.floor(raw.updatedAt) : 0,
  };
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

let svgSeq = 0;

/** Rysunek płótna flagi jako SVG (40×26). Dane wejściowe są zawsze walidowane, więc wynik można bezpiecznie wstawić do DOM. */
export function flagSvg(rawFlag, { width = 40, title = '' } = {}) {
  const f = sanitizeFlag(rawFlag) || { ...DEFAULT_FLAG };
  const shape = SHAPES[f.shape];
  const id = `fc${++svgSeq}`;
  let cloth;
  if (f.image) {
    cloth = `<rect width="40" height="26" fill="${f.color}"/><image href="${f.image}" width="40" height="26" preserveAspectRatio="xMidYMid slice"/>`;
  } else if (f.pattern === 'horizontal') {
    cloth = `<rect width="40" height="13" fill="${f.color}"/><rect y="13" width="40" height="13" fill="${f.color2}"/>`;
  } else if (f.pattern === 'vertical') {
    cloth = `<rect width="20" height="26" fill="${f.color}"/><rect x="20" width="20" height="26" fill="${f.color2}"/>`;
  } else if (f.pattern === 'cross') {
    cloth = `<rect width="40" height="26" fill="${f.color}"/><rect x="10" width="6" height="26" fill="${f.color2}"/><rect y="10" width="40" height="6" fill="${f.color2}"/>`;
  } else {
    cloth = `<rect width="40" height="26" fill="${f.color}"/>`;
  }
  let symbol = '';
  const sym = SYMBOLS[f.symbol];
  if (!f.image && (sym.f || sym.s)) {
    const ink = luminance(f.color) > 0.55 ? '#1b2030' : '#ffffff';
    const edge = ink === '#ffffff' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.5)';
    const s = shape.s;
    const tr = `translate(${(shape.cx - 12 * s).toFixed(2)} ${(13 - 12 * s).toFixed(2)}) scale(${s})`;
    symbol = `<g transform="${tr}">`
      + (sym.f ? `<path d="${sym.f}" fill="${ink}" stroke="${edge}" stroke-width="0.8" stroke-linejoin="round"/>` : '')
      + (sym.s ? `<path d="${sym.s}" fill="none" stroke="${ink}" stroke-width="${sym.f ? 1.8 : 3.4}" stroke-linecap="round" stroke-linejoin="round"/>` : '')
      + '</g>';
  }
  const h = Math.round((width * 26) / 40 * 100) / 100;
  const safeTitle = title ? `<title>${String(title).replace(/[<>&]/g, '')}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 26" width="${width}" height="${h}" aria-hidden="${title ? 'false' : 'true'}">${safeTitle}`
    + `<defs><clipPath id="${id}"><path d="${shape.d}"/></clipPath></defs>`
    + `<g clip-path="url(#${id})">${cloth}${symbol}</g>`
    + `<path d="${shape.d}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1" stroke-linejoin="round"/>`
    + '</svg>';
}

/** Dokument eksportu (kopii zapasowej). Klucze w „flags”: id gwiazdy z HYG albo ujemne id planety. */
export function serializeFlags(flags, now = Date.now()) {
  const out = {};
  for (const [id, flag] of [...flags].sort((a, b) => a[0] - b[0])) out[id] = flag;
  return { app: 'mapa-gwiazd', version: 1, exportedAt: new Date(now).toISOString(), flags: out };
}

/**
 * Wczytuje dokument eksportu / zawartość localStorage.
 * @param {string|object} input
 * @param {{knownIds?: {has(id:number):boolean}}} [opts]  gdy podane, flagi nieznanych obiektów (gwiazd, planet) są pomijane
 * @returns {{flags: Map<number, object>, skipped: number}}
 * @throws {Error} z polskim komunikatem, gdy plik nie jest poprawną kopią flag
 */
export function parseFlags(input, { knownIds } = {}) {
  let doc = input;
  if (typeof input === 'string') {
    try { doc = JSON.parse(input); } catch { throw new Error('To nie jest poprawny plik JSON.'); }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !doc.flags || typeof doc.flags !== 'object' || Array.isArray(doc.flags)) {
    throw new Error('Plik nie zawiera flag zapisanych przez Mapę gwiazd.');
  }
  if (doc.version !== undefined && doc.version !== 1) {
    throw new Error('Nieobsługiwana wersja pliku z flagami.');
  }
  const flags = new Map();
  let skipped = 0;
  for (const [key, raw] of Object.entries(doc.flags)) {
    // każdy wpis osobno: jeden błędny (zły typ pola, nieznana gwiazda) jest pomijany i liczony, reszta się wczytuje
    try {
      const id = Number(key);
      const flag = sanitizeFlag(raw);
      // klucz: id gwiazdy (>= 0) albo ujemne id planety; „-0” odpada, bo zlałoby się z id 0
      if (!/^-?\d+$/.test(key) || !Number.isSafeInteger(id) || Object.is(id, -0) || !flag || (knownIds && !knownIds.has(id))) { skipped++; continue; }
      flags.set(id, flag);
    } catch {
      skipped++;
    }
  }
  return { flags, skipped };
}

/**
 * Magazyn flag oparty o Storage (localStorage). Klucz flagi = stałe id gwiazdy z HYG (>= 0) albo ujemne id planety
 * (js/planets.mjs: −1 Merkury … −9 Pluton). Magazyn przyjmuje każdą bezpieczną liczbę całkowitą; to, czy obiekt
 * o danym id istnieje, sprawdza wywołujący (knownIds przy imporcie).
 * Każda zmiana jest od razu zapisywana; przy błędzie zapisu (np. brak miejsca) zmiana jest cofana i zgłaszany jest wyjątek.
 *
 * Dane, których nie udało się odczytać w całości (uszkodzony JSON, inna wersja, błędne wpisy), nie są po cichu
 * nadpisywane: ich dosłowna kopia trafia pod osobny klucz (BACKUP_KEY) — od razu przy load(), a gdyby to się
 * nie udało, ponownie przed pierwszym zapisem. Dopóki kopii nie ma, zapis jest odrzucany (kod błędu 'backup').
 */
export class FlagStore {
  #unreadable = null; // surowa zawartość, której nie udało się odczytać i która nie ma jeszcze kopii
  #backupKey = null;

  constructor(storage, key = STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
    this.flags = new Map();
    this.loadError = null;
    this.loadSkipped = 0;
  }

  /** true, gdy zapisane dane były nieczytelne (w całości lub części) i ich kopia leży pod kluczem backupKey. */
  get recovered() { return this.#backupKey !== null; }
  /** Klucz w Storage z kopią nieczytelnych danych albo null. */
  get backupKey() { return this.#backupKey; }
  /** Nieczytelne dane, które wciąż czekają na kopię (np. zabrakło miejsca), albo null. */
  get unreadableRaw() { return this.#unreadable; }

  load() {
    this.flags = new Map();
    this.loadError = null;
    this.loadSkipped = 0;
    this.#unreadable = null;
    this.#backupKey = null;
    let raw = null;
    try { raw = this.storage.getItem(this.key); } catch (e) { this.loadError = e; return this; }
    if (raw == null || raw === '') return this;
    try {
      const { flags, skipped } = parseFlags(raw);
      this.flags = flags;
      this.loadSkipped = skipped;
      if (skipped) this.#unreadable = String(raw);
    } catch (e) {
      this.loadError = e;
      this.#unreadable = String(raw);
    }
    this.#backupUnreadable();
    return this;
  }

  /** Kopiuje nieczytelne dane pod wolny klucz kopii (nigdy nie nadpisuje istniejącej). Zwraca false, gdy się nie udało. */
  #backupUnreadable() {
    if (this.#unreadable === null) return true;
    const base = this.key === STORAGE_KEY ? BACKUP_KEY : `${this.key}:backup`;
    try {
      for (let n = 1; n <= MAX_BACKUPS; n++) {
        const k = n === 1 ? base : `${base}:${n}`;
        const existing = this.storage.getItem(k);
        if (existing == null) this.storage.setItem(k, this.#unreadable);
        else if (existing !== this.#unreadable) continue; // zajęty przez inną kopię — zostaje nietknięta
        if (this.storage.getItem(k) !== this.#unreadable) return false;
        this.#backupKey = k;
        this.#unreadable = null;
        return true;
      }
    } catch { /* brak miejsca albo zablokowana pamięć — kopii nie ma */ }
    return false;
  }

  /** Świadoma rezygnacja z nieczytelnych danych, gdy nie da się zrobić ich kopii — odblokowuje zapis. */
  discardUnreadable() { this.#unreadable = null; }

  get size() { return this.flags.size; }
  has(id) { return this.flags.has(id); }
  get(id) { return this.flags.get(id) || null; }
  entries() { return [...this.flags.entries()]; }

  #persist(previous) {
    if (!this.#backupUnreadable()) {
      this.flags = previous;
      const err = new Error('Zapisanych wcześniej flag nie udało się odczytać ani skopiować w bezpieczne miejsce — zmiana nie została zapisana, żeby ich nie nadpisać.');
      err.code = 'backup';
      throw err;
    }
    try {
      this.storage.setItem(this.key, JSON.stringify(serializeFlags(this.flags)));
    } catch (cause) {
      this.flags = previous;
      const quota = cause && (cause.name === 'QuotaExceededError' || cause.name === 'NS_ERROR_DOM_QUOTA_REACHED' || cause.code === 22 || cause.code === 1014);
      const err = new Error(quota
        ? 'Brak miejsca w pamięci przeglądarki — flaga nie została zapisana. Usuń część flag z obrazami albo wyeksportuj flagi do pliku.'
        : 'Przeglądarka nie pozwoliła zapisać flag (np. tryb prywatny lub zablokowana pamięć strony).');
      err.code = quota ? 'quota' : 'storage';
      err.cause = cause;
      throw err;
    }
  }

  set(id, rawFlag, now = Date.now()) {
    const flag = sanitizeFlag(rawFlag);
    if (!Number.isSafeInteger(id) || !flag) throw new Error('Niepoprawna flaga.');
    flag.updatedAt = now;
    const previous = new Map(this.flags);
    this.flags.set(id, flag);
    this.#persist(previous);
    return flag;
  }

  delete(id) {
    if (!this.flags.has(id)) return false;
    const previous = new Map(this.flags);
    this.flags.delete(id);
    this.#persist(previous);
    return true;
  }

  export(now = Date.now()) {
    return JSON.stringify(serializeFlags(this.flags, now), null, 2);
  }

  /** mode 'merge': dopisuje i nadpisuje flagi tych samych gwiazd; 'replace': zastępuje wszystkie. */
  import(input, { mode = 'merge', knownIds } = {}) {
    const { flags, skipped } = parseFlags(input, { knownIds });
    const previous = new Map(this.flags);
    let added = 0, updated = 0;
    if (mode === 'replace') this.flags = new Map();
    for (const [id, flag] of flags) {
      if (this.flags.has(id)) updated++; else added++;
      this.flags.set(id, flag);
    }
    this.#persist(previous);
    return { added, updated, skipped, total: this.flags.size };
  }
}
