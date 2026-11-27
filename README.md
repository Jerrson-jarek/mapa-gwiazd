# Mapa gwiazd 3D z własnymi flagami

Interaktywna, trójwymiarowa mapa 11 473 gwiazd wokół Słońca (+ 8 planet i Pluton w Układzie Słonecznym), działająca w przeglądarce. Mapę można obracać i przybliżać myszą, wyszukiwać gwiazdy i planety po nazwie, a do dowolnej gwiazdy lub planety przypisać własną flagę z podpisem i opisem. Flagi zapisują się w przeglądarce — bez kont i logowania.

Inspiracją był projekt Google „100,000 Stars”; wygląd, kod i grafiki są w całości własne.

## Uruchomienie

```
node serve.mjs 5182
```

i otwórz <http://localhost:5182>. Projekt nie ma etapu budowania ani zależności npm — to statyczne pliki, które można wgrać na dowolny hosting (np. GitHub Pages). Three.js 0.170 ładuje się z CDN (jsDelivr) przez `importmap`.

Testy logiki: `npm test` (czyli `node --test tests/*.test.mjs`).

## Technologia

- **JavaScript (moduły ES) + Three.js**, bez frameworka i bez bundlera — mało kodu, łatwe dalsze modyfikacje.
- Wszystkie gwiazdy to jeden obiekt `THREE.Points` z własnym shaderem (rozmiar z jasności, barwa ze wskaźnika B–V), dlatego mapa działa płynnie.
- Interfejs można na życzenie przenieść do **Reacta** — logika (wyszukiwanie, flagi, dane) jest w osobnych modułach niezależnych od DOM.
- Flagi: `localStorage` przeglądarki + eksport/import do pliku JSON.

## Dane

Źródło: [HYG Database v4.1](https://www.astronexus.com/projects/hyg) (astronexus), licencja [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.pl). Plik pochodny `data/stars.json` pozostaje na licencji CC BY-SA 4.0; kod projektu jest własny.

Budowanie danych z pobranego pliku katalogu:

```
node tools/build-stars.mjs <ścieżka do hygdata_v41.csv>
```

Reguła wyboru: Słońce oraz gwiazdy o znanej odległości, które mają jasność widomą ≤ 6,5 mag (widoczne gołym okiem) **lub** nazwę własną **lub** leżą do 25 pc od Słońca. Wynik: 11 473 gwiazdy, ok. 800 kB. Każda gwiazda zachowuje stałe `id` z HYG — flagi są do niego przypisane, więc przetrwają ponowne zbudowanie danych.

## Układ Słoneczny

Dodatek ponad opis zlecenia: przybliżając mapę przy Słońcu (kółkiem myszy) albo klikając „Układ Słoneczny”, przechodzi się płynnie do widoku planet — osiem planet i Pluton na swoich orbitach, w tej samej przestrzeni co gwiazdy, w prawdziwej skali odległości i w położeniach na dzień otwarcia strony. Oddalanie wraca na mapę gwiazd.

- Dwa zakresy przybliżenia: mapa gwiazd (ok. 1–7000 lat świetlnych) i Układ Słoneczny (0,3–300 au); przejście między nimi jest automatyczne.
- Planety można zaznaczać (panel z typem, odległością od Słońca, czasem biegu światła, okresem obiegu, średnicą), wyszukiwać („Jowisz”, „Mars”, „Ziemia”) i oznaczać flagami tak samo jak gwiazdy. Na mapie gwiazd flagi planet zastępuje jedna zbiorcza flaga „Układ Słoneczny · N” przy Słońcu.
- Położenia liczone są w przeglądarce z przybliżonych elementów keplerowskich JPL (E. M. Standish, „Keplerian Elements for Approximate Positions of the Major Planets”, ważne dla lat 1800–2050, domena publiczna). Dokładność rzędu minut kątowych — w zupełności wystarcza do mapy, nie zastępuje efemeryd.
- Odległości i orbity są w prawdziwej skali; tarcze planet i Słońca są powiększone do stałej wielkości na ekranie (w tej skali byłyby mniejsze niż piksel). Grafika jest rysowana w całości kodem, bez tekstur.

## Układ plików

| Plik | Rola |
|---|---|
| `index.html`, `style.css` | strona i wygląd |
| `js/app.js` | scena Three.js, kamera, zaznaczanie, panele, edytor flag, widok Układu Słonecznego |
| `js/catalog.mjs` | odczyt danych, barwa gwiazdy, formatowanie odległości |
| `js/names.mjs` | gwiazdozbiory (łac./pol.), litery greckie, polskie nazwy gwiazd |
| `js/search.mjs` | wyszukiwanie po nazwie |
| `js/picking.mjs` | wybieranie gwiazdy pod kursorem, rozmiar punktów |
| `js/planets.mjs` | dane planet, elementy orbit, położenia na dowolny dzień |
| `js/solar.mjs` | zakresy przybliżenia, kierunki widoku i formatowanie dla Układu Słonecznego |
| `js/flags.mjs` | model flagi, walidacja, rysunek SVG, zapis, eksport/import |
| `tools/build-stars.mjs`, `tools/build-lib.mjs`, `tools/csv.mjs` | budowanie `data/stars.json` z katalogu HYG |
| `data/stars.json` | dane gwiazd (CC BY-SA 4.0) |
| `tests/*.test.mjs` | testy logiki (`node --test`) |
| `serve.mjs` | prosty serwer do lokalnego podglądu |

## Zgodność z opisem zlecenia

| Wymaganie z opisu | Jak jest spełnione |
|---|---|
| Prosta, interaktywna mapa gwiazd 3D działająca w przeglądarce | Strona statyczna, WebGL (Three.js); rzeczywiste położenia 3D gwiazd z katalogu HYG |
| Uproszczona wersja „100,000 Stars”, nie kopia | Własny, lekki projekt: jedna scena, własny wygląd i kod |
| Ciemne tło; obracanie, przybliżanie i oddalanie myszą | Przeciąganie obraca widok wokół wybranej gwiazdy, kółko myszy przybliża/oddala (od ok. 1 do ok. 7000 lat świetlnych, a przy Słońcu dalej — aż do planet), ruch z wygładzaniem |
| Zaznaczenie dowolnej gwiazdy na mapie | Kliknięcie dowolnego punktu: podświetlenie pod kursorem z nazwą, znacznik zaznaczenia, panel z danymi (nazwa, gwiazdozbiór, odległość, jasność, typ widmowy); `Esc` odznacza |
| Przypisanie do gwiazdy dowolnej flagi | „Przypisz flagę”: 12 gotowych flag albo własna — kształt, wzór, dwa kolory, symbol lub **własny wgrany obraz** oraz podpis |
| Flaga widoczna także przy oddalaniu i przybliżaniu | Flaga ma stały rozmiar na ekranie i stoi przy gwieździe przy każdym przybliżeniu i z każdej strony |
| Zmiana lub usunięcie flagi | „Zmień flagę” otwiera ten sam edytor; „Usuń flagę” z potwierdzeniem |
| Zapisywanie flag po zamknięciu przeglądarki | Automatyczny zapis w `localStorage`; komunikat przy braku miejsca; dodatkowo eksport/import do pliku JSON (kopia, inny komputer) |
| Wyszukiwanie gwiazd po nazwie | Pole z podpowiedziami: nazwy własne i polskie (Sirius/Syriusz, Gwiazda Polarna), oznaczenia (alfa Centauri, α Lyr, beta Oriona, 61 Cyg), gwiazdozbiory, numery HIP/HD; bez znaczenia wielkość liter i polskie znaki; wybór przenosi kamerę do gwiazdy |
| Użytek prywatny, bez kont i logowania | Brak serwera i kont — wszystko działa lokalnie w przeglądarce |
| Działanie na komputerze w popularnych przeglądarkach | Standardowe API (WebGL, moduły ES, `importmap`, `<dialog>`): aktualne Chrome, Edge, Firefox, Safari |
| Odpowiednio dobrana baza gwiazd | 11 473 gwiazdy: wszystkie widoczne gołym okiem, wszystkie nazwane i wszystkie bliskie (do 25 pc) |
| Estetyczne, płynne działanie, intuicyjna obsługa | Jeden obiekt graficzny dla wszystkich gwiazd, płynne przeloty kamery, podpowiedź sterowania przy pierwszym uruchomieniu, okno „Pomoc” |
| Technologie: JavaScript, React, Three.js | JavaScript + Three.js; React możliwy jako warstwa interfejsu (patrz „Technologia”) |
| Samodzielne przypisywanie flag i opisu gwiazdy | Edytor flagi zawiera pole „Opis gwiazdy” (do 2000 znaków), widoczne w panelu gwiazdy |
| Kod źródłowy i prawa do dalszego wykorzystania i modyfikacji | Całość to czytelny kod źródłowy bez etapu budowania; dane na otwartej licencji CC BY-SA 4.0 (wymagane podanie źródła — jest w stopce) |

Dodatki ponad opis zlecenia:

| Dodatek | Jak działa |
|---|---|
| Układ Słoneczny (ponad opis) | 8 planet i Pluton na orbitach w prawdziwej skali i w położeniach na bieżący dzień; płynne przejście z mapy gwiazd przez przybliżenie do Słońca lub przycisk „Układ Słoneczny” |
| Flagi na planetach (ponad opis) | Te same flagi, opisy, zapis oraz eksport/import co dla gwiazd; na mapie gwiazd zbiorcza flaga „Układ Słoneczny · N” przy Słońcu |
| Wyszukiwanie planet (ponad opis) | Nazwy polskie i angielskie (Jowisz/Jupiter, Ziemia/Earth); planeta o pasującej nazwie jest na górze listy |
| Pozostałe | Lista „Moje flagi” z przelotem do obiektu, nazwy najjaśniejszych gwiazd i pierścienie odległości (przełączniki), przycisk „Widok startowy” |
