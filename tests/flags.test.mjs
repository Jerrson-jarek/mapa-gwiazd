import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlagStore, sanitizeFlag, flagSvg, parseFlags, serializeFlags, isValidImage, DEFAULT_FLAG, PRESETS, SHAPES, PATTERNS, SYMBOLS, LIMITS, STORAGE_KEY, BACKUP_KEY } from '../js/flags.mjs';

/** Atrapa localStorage; quota = maksymalna łączna długość wartości. */
function memoryStorage(quota = Infinity) {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      data.set(k, String(v));
    },
  };
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('sanitizeFlag: poprawne pola przechodzą, błędne wracają do domyślnych', () => {
  const ok = sanitizeFlag({ shape: 'banner', pattern: 'cross', color: '#AABBCC', color2: '#112233', symbol: 'star', image: PNG, label: '  Mój dom  ', note: 'linia 1\r\nlinia 2', updatedAt: 1700000000000.7 });
  assert.deepEqual(ok, { shape: 'banner', pattern: 'cross', color: '#aabbcc', color2: '#112233', symbol: 'star', image: PNG, label: 'Mój dom', note: 'linia 1\nlinia 2', updatedAt: 1700000000000 });
  const bad = sanitizeFlag({ shape: 'toString', pattern: 5, color: 'red', color2: '#12', symbol: '__proto__', image: 'javascript:alert(1)', label: 42, note: null, updatedAt: 'x' });
  assert.deepEqual(bad, { ...DEFAULT_FLAG });
  assert.equal(sanitizeFlag(null), null);
  assert.equal(sanitizeFlag('flaga'), null);
  assert.equal(sanitizeFlag([]), null);
});

test('sanitizeFlag: limity długości i znaki sterujące', () => {
  const f = sanitizeFlag({ label: 'x'.repeat(100) + '\nabc', note: 'y'.repeat(5000) + '\u0000' });
  assert.equal(f.label.length, LIMITS.label);
  assert.equal(f.note.length, LIMITS.note);
  assert.equal(sanitizeFlag({ label: 'a\u0007b\nc' }).label, 'ab c');
});

test('obraz: tylko data URL PNG/JPEG/WebP w base64 i w limicie rozmiaru', () => {
  assert.equal(isValidImage(PNG), true);
  assert.equal(isValidImage('data:image/jpeg;base64,/9j/4AAQ'), true);
  assert.equal(isValidImage('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isValidImage('data:image/png;base64,AAAA" onload="x'), false);
  assert.equal(isValidImage('https://example.com/a.png'), false);
  assert.equal(isValidImage('data:image/png;base64,' + 'A'.repeat(LIMITS.image)), false);
});

test('flagSvg: każdy kształt, wzór, symbol i gotowa flaga daje poprawny, bezpieczny SVG', () => {
  for (const shape of Object.keys(SHAPES)) for (const pattern of Object.keys(PATTERNS)) for (const symbol of Object.keys(SYMBOLS)) {
    const svg = flagSvg({ shape, pattern, symbol, color: '#123456', color2: '#abcdef' });
    assert.match(svg, /^<svg [^>]*viewBox="0 0 40 26"/);
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes(SHAPES[shape].d));
  }
  assert.equal(PRESETS.length, 12);
  for (const p of PRESETS) {
    assert.deepEqual({ ...sanitizeFlag(p) }, { ...DEFAULT_FLAG, shape: p.shape, pattern: p.pattern, color: p.color, color2: p.color2, symbol: p.symbol }, p.name);
    assert.ok(p.name);
  }
  const evil = flagSvg({ color: '"><script>alert(1)</script>', image: '"><img src=x onerror=alert(1)>', shape: '<b>' }, { title: '<script>x</script>' });
  assert.ok(!/<script|onerror|<img|<b>/.test(evil));
  assert.ok(flagSvg({ image: PNG, symbol: 'star' }).includes(`<image href="${PNG}"`));
  assert.notEqual(flagSvg({}).match(/id="(fc\d+)"/)[1], flagSvg({}).match(/id="(fc\d+)"/)[1], 'unikalne id clipPath');
});

test('FlagStore: przypisanie, zmiana, usunięcie i trwałość po „ponownym uruchomieniu”', () => {
  const storage = memoryStorage();
  const store = new FlagStore(storage).load();
  assert.equal(store.size, 0);
  store.set(32263, { ...DEFAULT_FLAG, label: 'Syriusz – mój', note: 'Najjaśniejsza', symbol: 'star' }, 1000);
  store.set(0, { ...DEFAULT_FLAG, shape: 'banner', image: PNG }, 2000);
  assert.equal(store.size, 2);
  assert.ok(storage.data.has(STORAGE_KEY));

  const reopened = new FlagStore(storage).load();
  assert.equal(reopened.size, 2);
  assert.equal(reopened.get(32263).label, 'Syriusz – mój');
  assert.equal(reopened.get(32263).note, 'Najjaśniejsza');
  assert.equal(reopened.get(32263).updatedAt, 1000);
  assert.equal(reopened.get(0).image, PNG);

  reopened.set(32263, { ...reopened.get(32263), color: '#00ff00', label: 'Zmieniona' }, 3000);
  assert.equal(new FlagStore(storage).load().get(32263).label, 'Zmieniona');
  assert.equal(new FlagStore(storage).load().get(32263).updatedAt, 3000);

  assert.equal(reopened.delete(32263), true);
  assert.equal(reopened.delete(32263), false);
  const again = new FlagStore(storage).load();
  assert.equal(again.has(32263), false);
  assert.equal(again.size, 1);
});

test('FlagStore: brak miejsca cofa zmianę i zgłasza czytelny błąd', () => {
  const storage = memoryStorage(600);
  const store = new FlagStore(storage).load();
  store.set(1, { ...DEFAULT_FLAG, label: 'mała' });
  assert.throws(() => store.set(2, { ...DEFAULT_FLAG, note: 'z'.repeat(1500) }), (e) => e.code === 'quota' && /Brak miejsca/.test(e.message));
  assert.equal(store.size, 1);
  assert.equal(store.has(2), false);
  assert.equal(new FlagStore(storage).load().size, 1);
});

test('FlagStore: uszkodzone dane w pamięci nie wywracają aplikacji', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{nie json');
  const store = new FlagStore(storage).load();
  assert.equal(store.size, 0);
  assert.ok(store.loadError);
  const broken = new FlagStore({ getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } }).load();
  assert.ok(broken.loadError);
  assert.throws(() => broken.set(1, DEFAULT_FLAG), (e) => e.code === 'storage');
  assert.throws(() => store.set(1.5, DEFAULT_FLAG));
  assert.throws(() => store.set(-1.5, DEFAULT_FLAG));
  assert.throws(() => store.set('1', DEFAULT_FLAG));
  assert.throws(() => store.set(NaN, DEFAULT_FLAG));
  assert.throws(() => store.set(2 ** 53, DEFAULT_FLAG));
});

test('eksport i import: pełna kopia przenosi flagi do innej przeglądarki', () => {
  const a = new FlagStore(memoryStorage()).load();
  a.set(7, { ...DEFAULT_FLAG, label: 'A', note: 'opis' }, 10);
  a.set(3, { ...DEFAULT_FLAG, label: 'B', image: PNG }, 20);
  const file = a.export(123456);
  const doc = JSON.parse(file);
  assert.equal(doc.app, 'mapa-gwiazd');
  assert.equal(doc.version, 1);
  assert.deepEqual(Object.keys(doc.flags), ['3', '7']);

  const b = new FlagStore(memoryStorage()).load();
  b.set(7, { ...DEFAULT_FLAG, label: 'stara' }, 1);
  b.set(99, { ...DEFAULT_FLAG, label: 'zostaje' }, 2);
  assert.deepEqual(b.import(file), { added: 1, updated: 1, skipped: 0, total: 3 });
  assert.equal(b.get(7).label, 'A');
  assert.equal(b.get(3).image, PNG);
  assert.equal(b.get(99).label, 'zostaje');
  assert.deepEqual(b.import(file, { mode: 'replace' }), { added: 2, updated: 0, skipped: 0, total: 2 });
  assert.equal(b.has(99), false);
});

test('import: walidacja pliku, pomijanie nieznanych gwiazd i błędnych wpisów', () => {
  assert.throws(() => parseFlags('to nie json'), /poprawny plik JSON/);
  assert.throws(() => parseFlags('[]'), /nie zawiera flag/);
  assert.throws(() => parseFlags('{"flags":[]}'), /nie zawiera flag/);
  assert.throws(() => parseFlags('{"version":2,"flags":{}}'), /wersja/);
  const { flags, skipped } = parseFlags({ flags: { 5: { label: 'ok' }, 6: 'zła', abc: { label: 'x' }, '-1': {}, 8: { label: 'nieznana' }, '1e3': {} } }, { knownIds: new Set([5, 6]) });
  assert.deepEqual([...flags.keys()], [5]);
  assert.equal(skipped, 5);
  assert.equal(flags.get(5).shape, DEFAULT_FLAG.shape);

  const store = new FlagStore(memoryStorage()).load();
  store.set(1, DEFAULT_FLAG);
  assert.throws(() => store.import('{"oops":1}'));
  assert.equal(store.size, 1, 'nieudany import niczego nie zmienia');
  const roundTrip = parseFlags(JSON.stringify(serializeFlags(store.flags)));
  assert.deepEqual([...roundTrip.flags], [...store.flags]);
});

test('flagi planet: ujemne id (−1 … −9) zapisują się, wczytują, eksportują i importują jak flagi gwiazd', () => {
  const storage = memoryStorage();
  const store = new FlagStore(storage).load();
  store.set(-5, { ...DEFAULT_FLAG, label: 'Jowisz', note: 'gazowy olbrzym', symbol: 'planet' }, 1000);
  store.set(-1, { ...DEFAULT_FLAG, label: 'Merkury' }, 1500);
  store.set(0, { ...DEFAULT_FLAG, label: 'Słońce' }, 2000);
  store.set(32263, { ...DEFAULT_FLAG, label: 'Syriusz' }, 3000);
  assert.equal(store.has(-5), true);
  assert.equal(store.get(-5).label, 'Jowisz');

  const reopened = new FlagStore(storage).load();
  assert.equal(reopened.loadError, null);
  assert.equal(reopened.loadSkipped, 0);
  assert.equal(reopened.recovered, false);
  assert.deepEqual(reopened.entries().map(([id]) => id).sort((a, b) => a - b), [-5, -1, 0, 32263]);
  assert.deepEqual(reopened.get(-5), { ...DEFAULT_FLAG, label: 'Jowisz', note: 'gazowy olbrzym', symbol: 'planet', updatedAt: 1000 });
  assert.equal(reopened.get(0).label, 'Słońce', 'flaga planety nie miesza się z id 0');

  // eksport -> import w „innej przeglądarce”; knownIds tak, jak podaje je aplikacja (gwiazdy + planety)
  const file = reopened.export(5000);
  assert.deepEqual(Object.keys(JSON.parse(file).flags).map(Number).sort((a, b) => a - b), [-5, -1, 0, 32263]);
  const isPlanet = (id) => Number.isInteger(id) && id <= -1 && id >= -9;
  const knownIds = { has: (id) => id === 0 || id === 32263 || isPlanet(id) };
  const other = new FlagStore(memoryStorage()).load();
  assert.deepEqual(other.import(file, { knownIds }), { added: 4, updated: 0, skipped: 0, total: 4 });
  assert.deepEqual(other.get(-5), reopened.get(-5));
  assert.deepEqual([...parseFlags(other.export()).flags].sort((a, b) => a[0] - b[0]), [...reopened.flags].sort((a, b) => a[0] - b[0]));
  assert.deepEqual(other.import(file, { knownIds }), { added: 0, updated: 4, skipped: 0, total: 4 });

  // zmiana i usunięcie flagi planety
  other.set(-5, { ...other.get(-5), label: 'Jowisz!' }, 6000);
  assert.equal(new FlagStore(other.storage).load().get(-5).label, 'Jowisz!');
  assert.equal(other.delete(-5), true);
  assert.equal(other.delete(-5), false);
  assert.equal(new FlagStore(other.storage).load().has(-5), false);
  assert.equal(new FlagStore(other.storage).load().size, 3);

  // ujemne id nadal podlega sprawdzeniu knownIds; niepoprawne klucze odpadają
  const parsed = parseFlags({ flags: { '-5': { label: 'Jowisz' }, '-10': { label: 'nie ma takiej planety' }, '-0': {}, '--5': {}, '-5.5': {}, '-': {}, '- 5': {}, '-9007199254740993': {} } }, { knownIds });
  assert.deepEqual([...parsed.flags.keys()], [-5]);
  assert.equal(parsed.skipped, 7);
  assert.deepEqual([...parseFlags({ flags: { '-5': {}, '-10': {}, '-0': {} } }).flags.keys()], [-5, -10], 'bez knownIds: każda ujemna liczba całkowita poza „-0”');
});

test('import: pola złego typu nie przerywają importu — błędny wpis nie blokuje poprawnych', () => {
  // zgłoszony przypadek: kolor jako tablica wywracał cały import („raw.color.toLowerCase is not a function”)
  const reported = parseFlags('{"flags":{"32263":{"color":["#ffffff"]}}}');
  assert.equal(reported.skipped, 0);
  assert.deepEqual(reported.flags.get(32263), { ...DEFAULT_FLAG });

  const wrongTypes = {
    shape: ['banner'], pattern: { 0: 'cross' }, color: ['#ffffff'], color2: { toString: () => '#000000' }, symbol: true,
    image: [PNG], label: ['etykieta'], note: { toString: () => 'opis' }, updatedAt: '1700000000000',
  };
  assert.deepEqual(sanitizeFlag(wrongTypes), { ...DEFAULT_FLAG });
  for (const color of [123456, true, null, {}, [], ['#fff'], new String('#ffffff')]) {
    assert.equal(sanitizeFlag({ color }).color, DEFAULT_FLAG.color);
    assert.equal(sanitizeFlag({ color2: color }).color2, DEFAULT_FLAG.color2);
  }
  for (const image of [42, {}, [PNG], 'data:image/gif;base64,AAAA', 'data:text/html;base64,AAAA', ` ${PNG}`, `data:image/png;base64,${'A'.repeat(LIMITS.image)}`]) {
    assert.equal(sanitizeFlag({ image }).image, '');
  }
  assert.match(flagSvg({ color: ['#ffffff'], color2: 7 }), /^<svg /);

  // wpis, którego nie da się nawet odczytać, jest pomijany i liczony; pozostałe się wczytują
  const exploding = { get color() { throw new Error('bum'); } };
  const mixed = parseFlags({ flags: { 1: { label: 'pierwsza' }, 2: exploding, 3: { color: ['#ffffff'], label: 'trzecia' }, 4: 17, 5: { label: 'piąta' } } });
  assert.deepEqual([...mixed.flags.keys()], [1, 3, 5]);
  assert.equal(mixed.skipped, 2);
  assert.equal(mixed.flags.get(3).label, 'trzecia');

  const store = new FlagStore(memoryStorage()).load();
  store.set(9, { ...DEFAULT_FLAG, label: 'była wcześniej' }, 5);
  const file = JSON.stringify({ app: 'mapa-gwiazd', version: 1, flags: { 32263: { color: ['#ffffff'], label: 'Syriusz' }, 7: { color: '#00FF00', label: 'dobra' }, 8: 'zła', 777: { label: 'nieznana gwiazda' } } });
  assert.deepEqual(store.import(file, { knownIds: new Set([7, 8, 9, 32263]) }), { added: 2, updated: 0, skipped: 2, total: 3 });
  assert.equal(store.get(32263).label, 'Syriusz');
  assert.equal(store.get(32263).color, DEFAULT_FLAG.color);
  assert.equal(store.get(7).color, '#00ff00');
  assert.equal(store.get(9).label, 'była wcześniej');
});

test('FlagStore: nieczytelne dane trafiają do kopii przed pierwszym zapisem i nie są nadpisywane', () => {
  for (const raw of ['{"flags":{"1":{"label":"ucięte', JSON.stringify({ app: 'mapa-gwiazd', version: 2, flags: { 1: { label: 'z nowszej wersji' } } }), '[]']) {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = new FlagStore(storage).load();
    assert.equal(store.size, 0);
    assert.ok(store.loadError);
    assert.equal(store.recovered, true);
    assert.equal(store.backupKey, BACKUP_KEY);
    assert.equal(storage.getItem(BACKUP_KEY), raw, 'dosłowna kopia');
    assert.equal(storage.getItem(STORAGE_KEY), raw, 'samo wczytanie niczego nie nadpisuje');

    store.set(5, { ...DEFAULT_FLAG, label: 'nowa' }, 100); // zapis działa normalnie
    assert.equal(storage.getItem(BACKUP_KEY), raw, 'kopia przetrwała zapis');
    const reopened = new FlagStore(storage).load();
    assert.equal(reopened.get(5).label, 'nowa');
    assert.equal(reopened.loadError, null);
    assert.equal(reopened.recovered, false);
    assert.equal(reopened.backupKey, null);
  }
  // właściwości są tylko do odczytu
  const ro = new FlagStore(memoryStorage()).load();
  assert.throws(() => { ro.recovered = true; }, TypeError);
  assert.throws(() => { ro.backupKey = 'x'; }, TypeError);
  assert.equal(ro.recovered, false);
  assert.equal(ro.backupKey, null);
});

test('FlagStore: kopia nieczytelnych danych nie nadpisuje wcześniejszej i nie mnoży się przy kolejnych uruchomieniach', () => {
  const storage = memoryStorage();
  storage.setItem(BACKUP_KEY, 'kopia z poprzedniej awarii');
  storage.setItem(STORAGE_KEY, '{zepsute A');
  const first = new FlagStore(storage).load();
  assert.equal(first.backupKey, `${BACKUP_KEY}:2`);
  assert.equal(storage.getItem(BACKUP_KEY), 'kopia z poprzedniej awarii');
  assert.equal(storage.getItem(`${BACKUP_KEY}:2`), '{zepsute A');
  // użytkownik niczego nie zapisał i otwiera stronę ponownie: ta sama kopia, bez duplikatów
  const again = new FlagStore(storage).load();
  assert.equal(again.backupKey, `${BACKUP_KEY}:2`);
  assert.equal(again.recovered, true);
  assert.equal(storage.data.size, 3);
  again.set(1, DEFAULT_FLAG);
  assert.equal(storage.data.size, 3);
  assert.equal(new FlagStore(storage).load().size, 1);

  // dane czytelne tylko częściowo: poprawne flagi są wczytane, a oryginał z błędnymi wpisami ma kopię
  const partial = memoryStorage();
  const raw = JSON.stringify({ app: 'mapa-gwiazd', version: 1, flags: { 1: { label: 'dobra' }, x: { label: 'zły klucz' }, 2: 'nie obiekt' } });
  partial.setItem(STORAGE_KEY, raw);
  const store = new FlagStore(partial).load();
  assert.equal(store.loadError, null);
  assert.equal(store.size, 1);
  assert.equal(store.loadSkipped, 2);
  assert.equal(store.recovered, true);
  store.set(3, DEFAULT_FLAG);
  assert.equal(partial.getItem(store.backupKey), raw);
  assert.deepEqual(Object.keys(JSON.parse(partial.getItem(STORAGE_KEY)).flags), ['1', '3']);

  // własny klucz magazynu ma własny klucz kopii
  const custom = memoryStorage();
  custom.setItem('inne', 'śmieci');
  assert.equal(new FlagStore(custom, 'inne').load().backupKey, 'inne:backup');
});

test('FlagStore: gdy kopii nie da się zrobić, zapis jest wstrzymany zamiast nadpisać stare dane', () => {
  const raw = '{zepsute' + 'x'.repeat(600);
  // brak miejsca przy wczytaniu, miejsce jest przy pierwszym zapisie: kopia powstaje tuż przed nim
  const flaky = memoryStorage();
  flaky.data.set(STORAGE_KEY, raw);
  const realSet = flaky.setItem;
  let blocked = true;
  flaky.setItem = (k, v) => { if (blocked) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } realSet(k, v); };
  const store = new FlagStore(flaky).load();
  assert.ok(store.loadError);
  assert.equal(store.recovered, false);
  assert.equal(store.unreadableRaw, raw);
  assert.throws(() => store.set(1, DEFAULT_FLAG), (e) => e.code === 'backup');
  assert.equal(store.size, 0, 'zmiana cofnięta');
  assert.equal(flaky.getItem(STORAGE_KEY), raw, 'stare dane nietknięte');
  blocked = false;
  store.set(1, { ...DEFAULT_FLAG, label: 'po odblokowaniu' });
  assert.equal(store.recovered, true);
  assert.equal(store.unreadableRaw, null);
  assert.equal(flaky.getItem(store.backupKey), raw);
  assert.equal(new FlagStore(flaky).load().get(1).label, 'po odblokowaniu');

  // kopia trwale niemożliwa (za mało miejsca): usuwanie i import też nie nadpisują; świadome porzucenie odblokowuje zapis
  const full = memoryStorage(400);
  full.data.set(STORAGE_KEY, raw);
  const stuck = new FlagStore(full).load();
  assert.throws(() => stuck.set(1, DEFAULT_FLAG), (e) => e.code === 'backup' && /nie została zapisana/.test(e.message));
  assert.throws(() => stuck.import('{"flags":{"2":{}}}'), (e) => e.code === 'backup');
  assert.equal(stuck.size, 0);
  assert.equal(full.getItem(STORAGE_KEY), raw);
  stuck.discardUnreadable();
  stuck.set(1, DEFAULT_FLAG);
  assert.equal(new FlagStore(full).load().size, 1);
});
