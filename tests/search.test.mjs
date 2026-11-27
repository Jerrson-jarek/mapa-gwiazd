import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeCatalog } from '../js/catalog.mjs';
import { normalize, buildSearchIndex, searchStars, searchPlanets } from '../js/search.mjs';
import { PLANETS, planetSearchNames } from '../js/planets.mjs';
import { POLISH_NAMES, CONSTELLATIONS, CONSTELLATIONS_PL_GENITIVE, GREEK, designation, displayName, otherNames, constellationLabel } from '../js/names.mjs';

const { stars } = decodeCatalog(JSON.parse(readFileSync(new URL('../data/stars.json', import.meta.url), 'utf8')));
const index = buildSearchIndex(stars);
const top = (q) => { const r = searchStars(index, q, 10); return r.length ? stars[r[0].i] : null; };
const all = (q, n = 10) => searchStars(index, q, n).map((r) => stars[r.i]);

test('normalize: wielkość liter, polskie znaki, apostrofy, interpunkcja', () => {
  assert.equal(normalize('  Słońce '), 'slonce');
  assert.equal(normalize('ŁABĘDŹ'), 'labedz');
  assert.equal(normalize("Barnard's Star"), 'barnards star');
  assert.equal(normalize('α-Cen'), 'α cen');
  assert.equal(normalize(null), '');
});

test('nazwy własne (także początek nazwy)', () => {
  assert.equal(top('Sirius').proper, 'Sirius');
  assert.equal(top('betelgeuse').proper, 'Betelgeuse');
  assert.equal(top('BETEL').proper, 'Betelgeuse');
  assert.equal(top('alde').proper, 'Aldebaran');
  assert.equal(top('deneb').proper, 'Deneb', 'dokładne dopasowanie przed „Deneb Algedi” i „Denebola”');
  assert.equal(top('barnard').proper, "Barnard's Star");
});

test('polskie nazwy znanych gwiazd, bez znaków diakrytycznych', () => {
  const cases = {
    'Syriusz': 'Sirius', 'syriusz': 'Sirius', 'Gwiazda Polarna': 'Polaris', 'polarna': 'Polaris', 'Wega': 'Vega',
    'Betelgeza': 'Betelgeuse', 'Arktur': 'Arcturus', 'Kapella': 'Capella', 'Procjon': 'Procyon', 'Kastor': 'Castor',
    'Polluks': 'Pollux', 'Spika': 'Spica', 'Kłos': 'Spica', 'Kanopus': 'Canopus', 'Słońce': 'Sol', 'slonce': 'Sol',
    'Proxima': 'Proxima Centauri', 'Alfa Centauri': 'Rigil Kentaurus', 'gwiazda barnarda': "Barnard's Star",
    'Regulus': 'Regulus', 'Deneb': 'Deneb', 'Altair': 'Altair', 'Aldebaran': 'Aldebaran', 'Antares': 'Antares',
    'Rigel': 'Rigel', 'Fomalhaut': 'Fomalhaut', 'Achernar': 'Achernar',
  };
  for (const [q, proper] of Object.entries(cases)) assert.equal(top(q)?.proper, proper, `„${q}”`);
});

test('każda nazwa z tabeli polskich nazw wskazuje gwiazdę istniejącą w danych', () => {
  for (const [proper, names] of Object.entries(POLISH_NAMES)) {
    assert.ok(stars.some((s) => s.proper === proper), `brak „${proper}” w danych`);
    for (const pl of names) assert.ok(all(pl).some((s) => s.proper === proper), `„${pl}” nie znajduje „${proper}”`);
  }
});

test('oznaczenia Bayera i Flamsteeda z gwiazdozbiorem po łacinie, po polsku i skrótem', () => {
  assert.equal(top('alpha Lyrae').proper, 'Vega');
  assert.equal(top('alfa lyr').proper, 'Vega');
  assert.equal(top('α Lyr').proper, 'Vega');
  assert.equal(top('alfa Lutni').proper, 'Vega');
  assert.equal(top('beta Orionis').proper, 'Rigel');
  assert.equal(top('beta Oriona').proper, 'Rigel');
  assert.equal(top('alfa Wielkiego Psa').proper, 'Sirius');
  assert.equal(top('alfa Wielki Pies').proper, 'Sirius');
  assert.equal(top('beta Centaura').proper, 'Hadar');
  assert.equal(designation(top('61 Cyg')), '61 Cyg');
  assert.equal(designation(top('61 Cygni')), '61 Cyg');
  assert.equal(designation(top('61 Łabędzia')), '61 Cyg');
  assert.ok(all('alpha cen').some((s) => s.proper === 'Rigil Kentaurus'));
  assert.equal(designation(top('tau Ceti')), 'τ Cet');
  assert.equal(designation(top('epsilon Eridani')), 'ε Eri');
});

test('sama nazwa gwiazdozbioru zwraca jego najjaśniejsze gwiazdy', () => {
  assert.equal(top('Lutnia').proper, 'Vega');
  assert.equal(top('Orion').con, 'Ori');
  assert.ok(all('Wielka Niedźwiedzica').every((s) => s.con === 'UMa'));
});

test('numery katalogowe HIP / HD / Gliese', () => {
  assert.equal(top('HIP 32349').proper, 'Sirius');
  assert.equal(top('hip32349').proper, 'Sirius');
  assert.equal(top('HD 48915').proper, 'Sirius');
  assert.equal(top('32349').proper, 'Sirius');
  assert.equal(top('Gl 551').proper, 'Proxima Centauri');
  assert.ok(all('hip 3234').every((s) => String(s.hip).startsWith('3234')));
});

test('puste i nietrafione zapytania, limit wyników', () => {
  assert.deepEqual(searchStars(index, ''), []);
  assert.deepEqual(searchStars(index, '   '), []);
  assert.deepEqual(searchStars(index, 'qqqxyz'), []);
  assert.equal(searchStars(index, 'a', 5).length, 5);
});

test('nazwy do wyświetlenia', () => {
  const by = (p) => stars.find((s) => s.proper === p);
  assert.equal(displayName(by('Sirius')), 'Syriusz');
  assert.deepEqual(otherNames(by('Sirius')), ['Sirius', 'α CMa', 'HIP 32349', 'HD 48915', 'Gl 244A']);
  assert.equal(displayName(by('Sol')), 'Słońce');
  assert.equal(designation(by('Rigil Kentaurus')), 'α¹ Cen');
  assert.equal(displayName(by('Rigel')), 'Rigel');
  const unnamed = stars.find((s) => !s.proper && !s.bayer && !s.flam && s.hip);
  assert.equal(displayName(unnamed), `HIP ${unnamed.hip}`);
  assert.equal(constellationLabel('CMa'), 'Wielki Pies (Canis Major)');
  assert.equal(constellationLabel('Ori'), 'Orion');
  assert.equal(constellationLabel(''), '');
});

test('tabele nazw: 88 gwiazdozbiorów, 24 litery, każdy gwiazdozbiór z danych jest opisany', () => {
  assert.equal(Object.keys(CONSTELLATIONS).length, 88);
  assert.equal(Object.keys(GREEK).length, 24);
  for (const s of stars) {
    if (s.con) assert.ok(CONSTELLATIONS[s.con], `nieznany gwiazdozbiór ${s.con}`);
    if (s.bayer) assert.ok(GREEK[s.bayer.split('-')[0]], `nieznana litera ${s.bayer}`);
  }
});

test('polski dopełniacz gwiazdozbioru: „alfa Lwa”, „alfa Wielkiego Psa” i pozostałe z 88 gwiazdozbiorów', () => {
  const cases = {
    'alfa Lwa': 'Regulus', 'alfa Panny': 'Spica', 'alfa Orła': 'Altair', 'alfa Woźnicy': 'Capella',
    'alfa Wielkiego Psa': 'Sirius', 'alfa Małej Niedźwiedzicy': 'Polaris', 'beta Andromedy': 'Mirach',
    'alfa Kasjopei': 'Schedar', 'alfa Lutni': 'Vega', 'alfa Łabędzia': 'Deneb', 'alfa Skorpiona': 'Antares',
    'alfa Bliźniąt': 'Castor', 'alfa Byka': 'Aldebaran', 'beta Oriona': 'Rigel', 'beta Centaura': 'Hadar',
    'alfa Wolarza': 'Arcturus', 'alfa Małego Psa': 'Procyon', 'alfa Wielkiej Niedźwiedzicy': 'Dubhe',
    'alfa Krzyża Południa': 'Acrux', 'alfa Ryby Południowej': 'Fomalhaut', 'alfa lwa': 'Regulus', 'ALFA ORLA': 'Altair',
  };
  for (const [q, proper] of Object.entries(cases)) assert.equal(top(q)?.proper, proper, `„${q}”`);

  assert.deepEqual(Object.keys(CONSTELLATIONS_PL_GENITIVE).sort(), Object.keys(CONSTELLATIONS).sort());
  for (const [abbr, genitive] of Object.entries(CONSTELLATIONS_PL_GENITIVE)) {
    assert.match(genitive, /^\p{Lu}\p{Ll}+( \p{Lu}\p{Ll}+)?$/u, abbr);
    assert.equal(top(genitive)?.con, abbr, `sam dopełniacz „${genitive}”`);
    if (!stars.some((x) => x.con === abbr && /^Alp/.test(x.bayer))) continue;
    const found = top(`alfa ${genitive}`);
    assert.equal(found?.con, abbr, `„alfa ${genitive}”`);
    assert.match(found.bayer, /^Alp/, `„alfa ${genitive}”`);
  }
  // jednowyrazowa nazwa nie przegrywa z dłuższą, która zawiera to samo słowo
  assert.equal(top('alfa Trójkąta').con, 'Tri');
  assert.equal(top('alfa Trójkąta Południowego').con, 'TrA');
  assert.equal(top('alfa Ryb').con, 'Psc');
  assert.equal(top('alfa Erydana').proper, 'Achernar', 'potoczna odmiana nadal działa');
});

test('pełna nazwa gwiazdozbioru wygrywa ze skrótem IAU: „alfa psa” to Syriusz, nie Fomalhaut (α PsA)', () => {
  const psa = all('alfa psa').map((x) => x.proper);
  assert.equal(psa[0], 'Sirius');
  assert.ok(psa.includes('Fomalhaut'), 'α PsA zostaje na liście');
  assert.ok(psa.indexOf('Fomalhaut') > psa.indexOf('Procyon'), 'dopasowanie skrótem po dopasowaniach nazwą');
  assert.equal(top('alfa Psa').proper, 'Sirius');
  // skrót wpisany dokładnie tak jak w panelu gwiazdy jest jednoznaczny
  assert.equal(top('α PsA').proper, 'Fomalhaut');
  assert.equal(top('alfa PsA').proper, 'Fomalhaut');
  // skróty bez kolizji działają jak dotąd, także małymi literami
  assert.equal(top('alfa cma').proper, 'Sirius');
  assert.equal(top('alfa lyr').proper, 'Vega');
  assert.equal(top('beta ori').proper, 'Rigel');
  assert.equal(top('alfa cra').con, 'CrA', 'skrót przed początkiem innej nazwy (Crater)');
  for (const abbr of Object.keys(CONSTELLATIONS)) {
    if (!stars.some((x) => x.con === abbr && /^Alp/.test(x.bayer))) continue;
    assert.equal(top(`alfa ${abbr}`)?.con, abbr, `„alfa ${abbr}”`);
    assert.equal(top(`alfa ${abbr.toLowerCase()}`)?.con, abbr === 'PsA' ? 'CMa' : abbr, `„alfa ${abbr.toLowerCase()}”`);
  }
});

test('Gliese: „Gliese 581”, „GJ 581” i „Gl 581” to ta sama gwiazda, niezależnie od przedrostka w danych', () => {
  for (const q of ['Gliese 581', 'gliese 581', 'GJ 581', 'gj581', 'Gl 581', 'Gliese581', 'GJ-581']) assert.equal(top(q)?.gl, 'Gl 581', `„${q}”`);
  assert.equal(top('Gliese 876')?.gl, 'Gl 876');
  assert.equal(top('Gliese 551').proper, 'Proxima Centauri');
  assert.equal(top('gl 551').proper, 'Proxima Centauri');
  // gwiazda zapisana w danych jako „GJ …” odpowiada też na „Gl …” i „Gliese …”
  const gj = stars.find((x) => x.gl === 'GJ 3375');
  for (const q of ['GJ 3375', 'Gl 3375', 'Gliese 3375']) assert.equal(top(q), gj, `„${q}”`);
  // składniki układu: litera jest opcjonalna
  assert.equal(top('Gliese 244').proper, 'Sirius');
  assert.equal(top('GJ 244A').proper, 'Sirius');
  assert.equal(top('gliese 244 b').gl, 'Gl 244B');
  assert.equal(top('Gliese 559').proper, 'Rigil Kentaurus');
  // sam numer: po HIP/HD o tym numerze, ale znajduje gwiazdę z katalogu Gliesego
  assert.ok(all('581').some((x) => x.gl === 'Gl 581'));
  assert.ok(all('876').some((x) => x.gl === 'Gl 876'));
  assert.equal(top('32349').proper, 'Sirius', 'numer HIP nadal pierwszy');
  // przekrój katalogu (co 25. gwiazda z oznaczeniem Gliesego): każda jest znajdowana pod każdym z trzech przedrostków
  const sample = stars.filter((y) => y.gl).filter((_, k) => k % 25 === 0);
  assert.ok(sample.some((y) => y.gl.startsWith('Gl ')) && sample.some((y) => y.gl.startsWith('GJ ')));
  for (const x of sample) {
    const number = x.gl.replace(/^\S+ /, '');
    for (const prefix of ['Gliese', 'GJ', 'Gl']) assert.equal(top(`${prefix} ${number}`)?.gl, x.gl, `„${prefix} ${number}”`);
  }
});

test('powtórzony numer HD wskazuje najjaśniejszą gwiazdę', () => {
  assert.equal(top('HD 212168').hip, 110712);
  assert.equal(top('hd212168').mag, 6.12);
  const firstByHd = new Map();
  for (const x of stars) if (x.hd && !firstByHd.has(x.hd)) firstByHd.set(x.hd, x);
  assert.ok(firstByHd.size < stars.filter((x) => x.hd).length, 'dane zawierają powtórzone numery HD');
  for (const hd of [65277, 212168, 336196]) {
    assert.equal(top(`HD ${hd}`), firstByHd.get(hd), `HD ${hd}`);
    assert.ok(stars.filter((x) => x.hd === hd).every((x) => x.mag >= top(`HD ${hd}`).mag));
  }
});

test('indeksy górne i cyfry przy literze: „α¹ Cen”, „alfa1 cen”, „alfa 1 cen”', () => {
  assert.equal(normalize('α¹ Cen'), 'α 1 cen');
  assert.equal(normalize('alfa1 cen'), 'alfa 1 cen');
  assert.equal(normalize('HIP32349'), 'hip 32349');
  assert.equal(normalize('Gl 244A'), 'gl 244 a');
  for (const q of ['α¹ Cen', 'α1 Cen', 'alfa1 cen', 'alfa 1 cen', 'alpha1 Centauri', 'alfa¹ Centaura']) assert.equal(top(q)?.proper, 'Rigil Kentaurus', `„${q}”`);
  for (const q of ['α² Cen', 'alfa2 cen', 'alfa 2 centauri']) assert.equal(top(q)?.proper, 'Toliman', `„${q}”`);
  // każde oznaczenie pokazywane w panelu gwiazdy da się wkleić do wyszukiwarki
  const shown = stars.filter((x) => x.bayer.includes('-'));
  assert.ok(shown.length > 50);
  for (const x of shown) assert.equal(designation(top(designation(x))), designation(x), `„${designation(x)}”`);
  assert.equal(designation(top('61Cyg')), '61 Cyg');
});

test('najważniejsze zapytania nadal wskazują właściwą gwiazdę na pierwszym miejscu', () => {
  const cases = {
    'Syriusz': 'Sirius', 'Gwiazda Polarna': 'Polaris', 'Wega': 'Vega', 'Betelgeza': 'Betelgeuse', 'Proxima': 'Proxima Centauri',
    'Alfa Centauri': 'Rigil Kentaurus', 'alfa cen': 'Rigil Kentaurus', 'Słońce': 'Sol', 'HIP 32349': 'Sirius', 'alfa Lutni': 'Vega',
    'Rigel': 'Rigel', 'Deneb': 'Deneb', 'Mizar': 'Mizar', 'gl 551': 'Proxima Centauri', 'Gl 551': 'Proxima Centauri',
  };
  for (const [q, proper] of Object.entries(cases)) assert.equal(top(q)?.proper, proper, `„${q}”`);
  assert.deepEqual(all('Alfa Centauri', 2).map((x) => x.proper), ['Rigil Kentaurus', 'Toliman']);
});

test('searchPlanets: nazwy planet po polsku, angielsku i potocznie; dokładna nazwa ponad każdą gwiazdą', () => {
  const first = (q) => searchPlanets(q)[0]?.planet.key ?? null;
  const cases = {
    'Jowisz': 'jupiter', 'jowisz': 'jupiter', 'JOWISZ': 'jupiter', 'Jupiter': 'jupiter', 'jow': 'jupiter', 'jup': 'jupiter',
    'Saturn': 'saturn', 'sat': 'saturn', 'Ziemia': 'earth', 'zie': 'earth', 'earth': 'earth', 'Terra': 'earth',
    'mars': 'mars', 'Mars': 'mars', 'pluton': 'pluto', 'pluto': 'pluto', 'Merkury': 'mercury', 'mercury': 'mercury',
    'Wenus': 'venus', 'venus': 'venus', 'Uran': 'uranus', 'uranus': 'uranus', 'Neptun': 'neptune', 'neptune': 'neptune',
    'Błękitna Planeta': 'earth', 'blekitna planeta': 'earth', 'Czerwona Planeta': 'mars', '  SATURN  ': 'saturn', 'ne': 'neptune',
  };
  for (const [q, key] of Object.entries(cases)) assert.equal(first(q), key, `„${q}”`);

  // każda nazwa każdej planety: dokładne trafienie, wynik >= 100 i powyżej najlepszej gwiazdy dla tego samego tekstu
  assert.equal(PLANETS.length, 9);
  for (const planet of PLANETS) {
    for (const name of planetSearchNames(planet)) {
      for (const q of [name, name.toUpperCase(), normalize(name)]) {
        const [hit] = searchPlanets(q);
        assert.equal(hit.planet, planet, `„${q}”`);
        assert.ok(hit.score >= 100, `„${q}”`);
        assert.ok(hit.score > (searchStars(index, q, 1)[0]?.score ?? 0), `„${q}” ponad gwiazdami`);
      }
    }
    // początek polskiej i angielskiej nazwy od 2 znaków
    for (const name of [planet.namePl, planet.nameEn]) {
      for (let n = 2; n < name.length; n++) assert.ok(searchPlanets(name.slice(0, n), 9).some((r) => r.planet === planet), `„${name.slice(0, n)}”`);
    }
  }
  // początek nazwy głównej przed początkiem nazwy potocznej, wyniki malejąco, limit
  assert.equal(searchPlanets('jow')[0].score, 90);
  assert.equal(searchPlanets('gwiazda')[0].planet.key, 'venus');
  assert.equal(searchPlanets('gwiazda')[0].score, 70);
  assert.deepEqual(searchPlanets('me').map((r) => r.planet.key), ['mercury']);
  const m = searchPlanets('ma');
  assert.ok(m.every((r, k) => k === 0 || m[k - 1].score >= r.score));
  assert.equal(searchPlanets('p', 9).length, 0);
  assert.equal(searchPlanets('pl', 0).length, 0);
  assert.equal(searchPlanets('ur', 1).length, 1);

  // brak wyników: puste, jednoznakowe i niezwiązane zapytania
  for (const q of ['', ' ', 'j', 'm', 'ż', null, undefined, 'Syriusz', 'alfa Lwa', 'HIP 32349', 'qqqxyz', 'mar s', 'owisz', '5', '-5']) {
    assert.deepEqual(searchPlanets(q), [], `„${q}”`);
  }
});

test('searchStars nie zmienia się przez planety: nazwy planet nie dają mylących gwiazd', () => {
  for (const planet of PLANETS) {
    for (const q of [planet.namePl, planet.nameEn]) {
      const best = searchStars(index, q, 1)[0];
      assert.ok(!best || best.score < 100, `„${q}” nie jest dokładną nazwą żadnej gwiazdy`);
      assert.ok(!best || best.score < searchPlanets(q)[0].score, `„${q}”`);
    }
  }
  assert.deepEqual(all('mars').map((x) => x.proper), ['Marsic', 'Marsic B'], 'tylko początek nazwy Marsic (κ Her)');
  for (const q of ['saturn', 'jowisz', 'jupiter', 'ziemia', 'earth', 'wenus', 'venus', 'uran', 'neptun', 'pluton', 'pluto', 'merkury', 'mercury']) {
    assert.deepEqual(searchStars(index, q), [], `„${q}”`);
  }
});
