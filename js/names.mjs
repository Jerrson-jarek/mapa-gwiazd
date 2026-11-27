// Nazewnictwo: gwiazdozbiory (łac./pol.), litery greckie, polskie nazwy znanych gwiazd.

/** skrót IAU -> [mianownik łac., dopełniacz łac., nazwa polska] */
export const CONSTELLATIONS = {
  And: ['Andromeda', 'Andromedae', 'Andromeda'], Ant: ['Antlia', 'Antliae', 'Pompa'],
  Aps: ['Apus', 'Apodis', 'Ptak Rajski'], Aqr: ['Aquarius', 'Aquarii', 'Wodnik'],
  Aql: ['Aquila', 'Aquilae', 'Orzeł'], Ara: ['Ara', 'Arae', 'Ołtarz'],
  Ari: ['Aries', 'Arietis', 'Baran'], Aur: ['Auriga', 'Aurigae', 'Woźnica'],
  Boo: ['Bootes', 'Bootis', 'Wolarz'], Cae: ['Caelum', 'Caeli', 'Rylec'],
  Cam: ['Camelopardalis', 'Camelopardalis', 'Żyrafa'], Cnc: ['Cancer', 'Cancri', 'Rak'],
  CVn: ['Canes Venatici', 'Canum Venaticorum', 'Psy Gończe'], CMa: ['Canis Major', 'Canis Majoris', 'Wielki Pies'],
  CMi: ['Canis Minor', 'Canis Minoris', 'Mały Pies'], Cap: ['Capricornus', 'Capricorni', 'Koziorożec'],
  Car: ['Carina', 'Carinae', 'Kil'], Cas: ['Cassiopeia', 'Cassiopeiae', 'Kasjopeja'],
  Cen: ['Centaurus', 'Centauri', 'Centaur'], Cep: ['Cepheus', 'Cephei', 'Cefeusz'],
  Cet: ['Cetus', 'Ceti', 'Wieloryb'], Cha: ['Chamaeleon', 'Chamaeleontis', 'Kameleon'],
  Cir: ['Circinus', 'Circini', 'Cyrkiel'], Col: ['Columba', 'Columbae', 'Gołąb'],
  Com: ['Coma Berenices', 'Comae Berenices', 'Warkocz Bereniki'], CrA: ['Corona Australis', 'Coronae Australis', 'Korona Południowa'],
  CrB: ['Corona Borealis', 'Coronae Borealis', 'Korona Północna'], Crv: ['Corvus', 'Corvi', 'Kruk'],
  Crt: ['Crater', 'Crateris', 'Puchar'], Cru: ['Crux', 'Crucis', 'Krzyż Południa'],
  Cyg: ['Cygnus', 'Cygni', 'Łabędź'], Del: ['Delphinus', 'Delphini', 'Delfin'],
  Dor: ['Dorado', 'Doradus', 'Złota Ryba'], Dra: ['Draco', 'Draconis', 'Smok'],
  Equ: ['Equuleus', 'Equulei', 'Źrebię'], Eri: ['Eridanus', 'Eridani', 'Erydan'],
  For: ['Fornax', 'Fornacis', 'Piec'], Gem: ['Gemini', 'Geminorum', 'Bliźnięta'],
  Gru: ['Grus', 'Gruis', 'Żuraw'], Her: ['Hercules', 'Herculis', 'Herkules'],
  Hor: ['Horologium', 'Horologii', 'Zegar'], Hya: ['Hydra', 'Hydrae', 'Hydra'],
  Hyi: ['Hydrus', 'Hydri', 'Wąż Wodny'], Ind: ['Indus', 'Indi', 'Indianin'],
  Lac: ['Lacerta', 'Lacertae', 'Jaszczurka'], Leo: ['Leo', 'Leonis', 'Lew'],
  LMi: ['Leo Minor', 'Leonis Minoris', 'Mały Lew'], Lep: ['Lepus', 'Leporis', 'Zając'],
  Lib: ['Libra', 'Librae', 'Waga'], Lup: ['Lupus', 'Lupi', 'Wilk'],
  Lyn: ['Lynx', 'Lyncis', 'Ryś'], Lyr: ['Lyra', 'Lyrae', 'Lutnia'],
  Men: ['Mensa', 'Mensae', 'Góra Stołowa'], Mic: ['Microscopium', 'Microscopii', 'Mikroskop'],
  Mon: ['Monoceros', 'Monocerotis', 'Jednorożec'], Mus: ['Musca', 'Muscae', 'Mucha'],
  Nor: ['Norma', 'Normae', 'Węgielnica'], Oct: ['Octans', 'Octantis', 'Oktant'],
  Oph: ['Ophiuchus', 'Ophiuchi', 'Wężownik'], Ori: ['Orion', 'Orionis', 'Orion'],
  Pav: ['Pavo', 'Pavonis', 'Paw'], Peg: ['Pegasus', 'Pegasi', 'Pegaz'],
  Per: ['Perseus', 'Persei', 'Perseusz'], Phe: ['Phoenix', 'Phoenicis', 'Feniks'],
  Pic: ['Pictor', 'Pictoris', 'Malarz'], Psc: ['Pisces', 'Piscium', 'Ryby'],
  PsA: ['Piscis Austrinus', 'Piscis Austrini', 'Ryba Południowa'], Pup: ['Puppis', 'Puppis', 'Rufa'],
  Pyx: ['Pyxis', 'Pyxidis', 'Kompas'], Ret: ['Reticulum', 'Reticuli', 'Sieć'],
  Sge: ['Sagitta', 'Sagittae', 'Strzała'], Sgr: ['Sagittarius', 'Sagittarii', 'Strzelec'],
  Sco: ['Scorpius', 'Scorpii', 'Skorpion'], Scl: ['Sculptor', 'Sculptoris', 'Rzeźbiarz'],
  Sct: ['Scutum', 'Scuti', 'Tarcza'], Ser: ['Serpens', 'Serpentis', 'Wąż'],
  Sex: ['Sextans', 'Sextantis', 'Sekstant'], Tau: ['Taurus', 'Tauri', 'Byk'],
  Tel: ['Telescopium', 'Telescopii', 'Luneta'], Tri: ['Triangulum', 'Trianguli', 'Trójkąt'],
  TrA: ['Triangulum Australe', 'Trianguli Australis', 'Trójkąt Południowy'], Tuc: ['Tucana', 'Tucanae', 'Tukan'],
  UMa: ['Ursa Major', 'Ursae Majoris', 'Wielka Niedźwiedzica'], UMi: ['Ursa Minor', 'Ursae Minoris', 'Mała Niedźwiedzica'],
  Vel: ['Vela', 'Velorum', 'Żagiel'], Vir: ['Virgo', 'Virginis', 'Panna'],
  Vol: ['Volans', 'Volantis', 'Ryba Latająca'], Vul: ['Vulpecula', 'Vulpeculae', 'Lis'],
};

/** skrót IAU -> polski dopełniacz nazwy gwiazdozbioru („alfa Lwa”, „beta Wielkiego Psa”) — do wyszukiwania. */
export const CONSTELLATIONS_PL_GENITIVE = {
  And: 'Andromedy', Ant: 'Pompy', Aps: 'Ptaka Rajskiego', Aqr: 'Wodnika',
  Aql: 'Orła', Ara: 'Ołtarza', Ari: 'Barana', Aur: 'Woźnicy',
  Boo: 'Wolarza', Cae: 'Rylca', Cam: 'Żyrafy', Cnc: 'Raka',
  CVn: 'Psów Gończych', CMa: 'Wielkiego Psa', CMi: 'Małego Psa', Cap: 'Koziorożca',
  Car: 'Kila', Cas: 'Kasjopei', Cen: 'Centaura', Cep: 'Cefeusza',
  Cet: 'Wieloryba', Cha: 'Kameleona', Cir: 'Cyrkla', Col: 'Gołębia',
  Com: 'Warkocza Bereniki', CrA: 'Korony Południowej', CrB: 'Korony Północnej', Crv: 'Kruka',
  Crt: 'Pucharu', Cru: 'Krzyża Południa', Cyg: 'Łabędzia', Del: 'Delfina',
  Dor: 'Złotej Ryby', Dra: 'Smoka', Equ: 'Źrebięcia', Eri: 'Erydanu',
  For: 'Pieca', Gem: 'Bliźniąt', Gru: 'Żurawia', Her: 'Herkulesa',
  Hor: 'Zegara', Hya: 'Hydry', Hyi: 'Węża Wodnego', Ind: 'Indianina',
  Lac: 'Jaszczurki', Leo: 'Lwa', LMi: 'Małego Lwa', Lep: 'Zająca',
  Lib: 'Wagi', Lup: 'Wilka', Lyn: 'Rysia', Lyr: 'Lutni',
  Men: 'Góry Stołowej', Mic: 'Mikroskopu', Mon: 'Jednorożca', Mus: 'Muchy',
  Nor: 'Węgielnicy', Oct: 'Oktantu', Oph: 'Wężownika', Ori: 'Oriona',
  Pav: 'Pawia', Peg: 'Pegaza', Per: 'Perseusza', Phe: 'Feniksa',
  Pic: 'Malarza', Psc: 'Ryb', PsA: 'Ryby Południowej', Pup: 'Rufy',
  Pyx: 'Kompasu', Ret: 'Sieci', Sge: 'Strzały', Sgr: 'Strzelca',
  Sco: 'Skorpiona', Scl: 'Rzeźbiarza', Sct: 'Tarczy', Ser: 'Węża',
  Sex: 'Sekstantu', Tau: 'Byka', Tel: 'Lunety', Tri: 'Trójkąta',
  TrA: 'Trójkąta Południowego', Tuc: 'Tukana', UMa: 'Wielkiej Niedźwiedzicy', UMi: 'Małej Niedźwiedzicy',
  Vel: 'Żagla', Vir: 'Panny', Vol: 'Ryby Latającej', Vul: 'Lisa',
};

/** skrót HYG -> [symbol, nazwa angielska/łacińska, nazwa polska] */
export const GREEK = {
  Alp: ['α', 'alpha', 'alfa'], Bet: ['β', 'beta', 'beta'], Gam: ['γ', 'gamma', 'gamma'],
  Del: ['δ', 'delta', 'delta'], Eps: ['ε', 'epsilon', 'epsilon'], Zet: ['ζ', 'zeta', 'dzeta'],
  Eta: ['η', 'eta', 'eta'], The: ['θ', 'theta', 'theta'], Iot: ['ι', 'iota', 'jota'],
  Kap: ['κ', 'kappa', 'kappa'], Lam: ['λ', 'lambda', 'lambda'], Mu: ['μ', 'mu', 'mi'],
  Nu: ['ν', 'nu', 'ni'], Xi: ['ξ', 'xi', 'ksi'], Omi: ['ο', 'omicron', 'omikron'],
  Pi: ['π', 'pi', 'pi'], Rho: ['ρ', 'rho', 'ro'], Sig: ['σ', 'sigma', 'sigma'],
  Tau: ['τ', 'tau', 'tau'], Ups: ['υ', 'upsilon', 'ypsilon'], Phi: ['φ', 'phi', 'fi'],
  Chi: ['χ', 'chi', 'chi'], Psi: ['ψ', 'psi', 'psi'], Ome: ['ω', 'omega', 'omega'],
};

/** nazwa własna z HYG -> polskie nazwy (pierwsza jest wyświetlana, wszystkie są wyszukiwalne) */
export const POLISH_NAMES = {
  'Sol': ['Słońce'],
  'Sirius': ['Syriusz'],
  'Polaris': ['Gwiazda Polarna'],
  'Vega': ['Wega'],
  'Betelgeuse': ['Betelgeza'],
  'Arcturus': ['Arktur'],
  'Capella': ['Kapella'],
  'Procyon': ['Procjon'],
  'Castor': ['Kastor'],
  'Pollux': ['Polluks'],
  'Spica': ['Spika', 'Kłos'],
  'Canopus': ['Kanopus'],
  'Rigil Kentaurus': ['Alfa Centauri A', 'Alfa Centauri'],
  'Toliman': ['Alfa Centauri B'],
  'Proxima Centauri': ['Proxima Centauri', 'Proxima'],
  "Barnard's Star": ['Gwiazda Barnarda'],
  "Van Maanen's Star": ['Gwiazda van Maanena'],
  "Kapteyn's Star": ['Gwiazda Kapteyna'],
  "Luyten's Star": ['Gwiazda Luytena'],
  'Alcor': ['Alkor'],
  'Alcyone': ['Alkione'],
  'Maia': ['Maja'],
  'Electra': ['Elektra'],
  'Alphard': ['Alfard'],
};

const SUP = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** "Alp-1" -> { abbr: 'Alp', n: 1 } */
export function parseBayer(bayer) {
  if (!bayer) return null;
  const [abbr, n] = String(bayer).split('-');
  if (!GREEK[abbr]) return null;
  return { abbr, n: n ? Number(n) : 0 };
}

/** Oznaczenie Bayera/Flamsteeda, np. "α¹ Cen", "61 Cyg" (lub ''). */
export function designation(star) {
  if (!star.con) return '';
  const b = parseBayer(star.bayer);
  if (b) return `${GREEK[b.abbr][0]}${b.n ? (SUP[b.n] || b.n) : ''} ${star.con}`;
  if (star.flam) return `${star.flam} ${star.con}`;
  return '';
}

export function polishName(star) {
  return (star.proper && POLISH_NAMES[star.proper]?.[0]) || '';
}

/** Numer katalogowy do wyświetlenia, gdy brak innej nazwy. */
export function catalogName(star) {
  if (star.hip) return `HIP ${star.hip}`;
  if (star.hd) return `HD ${star.hd}`;
  if (star.gl) return star.gl;
  return `HYG ${star.id}`;
}

/** Najlepsza nazwa do pokazania użytkownikowi. */
export function displayName(star) {
  return polishName(star) || star.proper || designation(star) || catalogName(star);
}

/** Pozostałe nazwy (bez tej wyświetlanej) — do podtytułu. */
export function otherNames(star) {
  const main = displayName(star);
  const all = [star.proper, designation(star), star.hip ? `HIP ${star.hip}` : '', star.hd ? `HD ${star.hd}` : '', star.gl];
  return [...new Set(all.filter((n) => n && n !== main))];
}

export function constellationLabel(con) {
  const c = CONSTELLATIONS[con];
  return c ? (c[2] === c[0] ? c[0] : `${c[2]} (${c[0]})`) : '';
}
