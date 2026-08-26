# Albion Europe Market Scanner v5.5.1 — szybkie odświeżanie rafinacji

## Zmiana v5.5.1

Po pierwszym pełnym skanie modułu rafinacji dostępny jest przycisk `Odśwież ceny`. Użytkownik wybiera 10, 30, 50 albo wszystkie obecne wyniki. Moduł pobiera wyłącznie przedmioty używane przez wybrane pozycje, zastępuje ich stare rekordy nową odpowiedzią AODP i ponownie liczy cały ranking z zapisanych danych.

- pierwszy skan nadal musi być pełny i ręczny,
- domyślnie odświeżanych jest 30 najbardziej zyskownych pozycji,
- wyniki poza zakresem odświeżenia zachowują wcześniejsze ceny i godziny,
- udana odpowiedź bez ceny usuwa poprzednią cenę danego przedmiotu i miasta,
- zmiana surowców, tierów, enchantów lub miast wymaga nowego pełnego skanu,
- zmiana focusu, podatku, partii, opłaty stacji albo transportu przelicza wyniki lokalnie bez pobierania cen.

## Funkcje odziedziczone z v5.5.0

## Nowy moduł v5.5.0

Strona `refining.html` jest osobnym kalkulatorem opłacalności rafinacji dla drewna, włókna, skór, rudy i kamienia. Obejmuje T2–T8 oraz enchanty `.0–.4`, automatycznie przypisuje właściwe miasto z premią, wyszukuje osobno najtańsze miasto zakupu surowca i materiału poprzedniego tieru, a następnie wybiera najlepszy rynek sprzedaży gotowego materiału.

Moduł uwzględnia:

- podstawową premię miasta i premię właściwego miasta rafinacji,
- opcjonalny focus i dzienny bonus +10% / +20%,
- sprzedaż natychmiastową albo przez sell order,
- podatek Premium / bez Premium, setup fee i undercut,
- ręcznie wpisywaną opłatę stacji i transport na gotową sztukę,
- pełne materiały do pierwszej partii oraz oczekiwane zużycie po zwrotach,
- kapitał pierwszej partii, zysk jednostkowy, ROI i profit całej partii,
- czas każdego użytego notowania AODP.

Pierwszy skan kalkulatora zawsze uruchamia się ręcznie.

## Funkcje odziedziczone z v5.4.8

## Najważniejsza zmiana v5.4.8

Dobra luksusowe mają teraz osobny model. Skaner nie szuka dla nich zmiennej ceny sprzedaży w AODP. Z porównywanych marketów wybiera **najtańszą ofertę zakupu**, pokazuje jej dokładny czas odczytu i automatycznie przypisuje stałe miejsce oraz wartość sprzedaży danego dobra.

- Martlock: Knowledge — 1 000 / 5 000 / 25 000,
- Lymhurst: Silverware — 1 000 / 5 000 / 25 000,
- Fort Sterling: Decorative — 1 000 / 5 000 / 25 000,
- Thetford: Ceremonial — 1 000 / 5 000 / 25 000,
- Bridgewatch: Tribal — 1 000 / 5 000 / 25 000,
- Caerleon: Ritual — 1 000 / 5 000 / 25 000,
- dowolne Królewskie Miasto: Avalon — 10 000 / 50 000 / 250 000.

Miasto docelowe wybrane w konfiguracji nie nadpisuje reguły dobra. `Miasto startowe` nadal może ograniczyć miejsce zakupu; przy ustawieniu `Dowolne` program wybiera najtańsze zaznaczone miasto. Dla dóbr wystarczy zaznaczyć jeden market zakupu. Wynik odejmuje podatek od sprzedaży i wpisany koszt transportu, ale nie nalicza setup fee.

Cena sprzedaży jest opisana jako `stała cena w grze • bez odczytu AODP`. Sortowanie świeżości oraz obu kolumn cenowych używa dla dobra czasu oferty zakupu, ponieważ tylko ona pochodzi z AODP i może się zestarzeć. Stały skup nie ogranicza wielkości partii; estymacja `Zabierz` jest ograniczana skalą rynku zakupu, budżetem oraz limitem sztuk.

Szczegóły zmiany: `AUDIT-V5.4.8-LUXURY-FIXED-VALUE.md`.

## Funkcje odziedziczone z v5.4.7

Naprawiono kategorię `Dobra luksusowe`. Przedmioty te mają identyfikatory `TREASURE_...`, a nie standardowe identyfikatory `T4_–T8_`, dlatego poprzedni filtr odrzucał je przed wysłaniem zapytań do AODP. v5.4.7 rozpoznaje 21 dóbr luksusowych z rodzin Knowledge, Silverware, Decorative, Ceremonial, Tribal, Ritual i Avalon. Są dostępne przy ustawieniu `Tier = Wszystkie`.

Kliknięcie nagłówka `Cena kupna` sortuje teraz według czasu odczytu ceny zakupu, a kliknięcie `Cena sprzedaży` — według czasu odczytu ceny sprzedaży. Pierwsze kliknięcie pokazuje najnowsze odczyty, drugie odwraca kolejność. Wysokość ceny nie jest kryterium tych dwóch kolumn.

Szczegóły zmiany: `AUDIT-V5.4.7-LUXURY-TIME-SORT.md`.

## Funkcje odziedziczone z v5.4.6

Po każdym otwarciu aplikacji pierwszy skan musi zostać uruchomiony ręcznie. Harmonogram pozostaje dostępny i domyślnie ma interwał 10 minut, ale jest zablokowany do chwili, gdy użytkownik skonfiguruje skaner i naciśnie `Skanuj`. Pierwsze ręczne uruchomienie odblokowuje harmonogram i rozpoczyna odliczanie interwału od początku.

W konfiguracji można wybrać osobno `Miasto startowe` i `Miasto docelowe`. Konkretna para ogranicza wyniki do wskazanej trasy. Wartość `Dowolne z zaznaczonych` pozostawia porównywanie wszystkich zaznaczonych marketów. Black Market jest dostępny wyłącznie jako miasto docelowe.

Wyniki są domyślnie sortowane według świeżości kompletnej trasy: na górze znajduje się oferta, dla której starsza z ceny zakupu i ceny sprzedaży jest najnowsza. Każdy merytoryczny nagłówek tabeli jest klikalny. Pierwsze kliknięcie sortuje według danej kolumny, a drugie odwraca kolejność; aktywna kolumna i kierunek są oznaczone strzałką.

Szczegóły zmiany: `AUDIT-V5.4.6-MANUAL-FIRST-SCAN.md`.

## Funkcje odziedziczone z v5.4.5

Przy takim samym wieku notowań wyżej trafia trasa z większym szacowanym zyskiem transportu. Skan nie odrzuca oferty wyłącznie dlatego, że jej odczyt jest starszy.

## Funkcje odziedziczone z v5.4.4

Najważniejsza zmiana: pod każdą ceną zakupu i sprzedaży widoczna jest pełna data i godzina ostatniego odczytu AODP, zarówno w czasie lokalnym urządzenia, jak i UTC, wraz z wiekiem odczytu. Starsza cena nie jest usuwana wyłącznie z powodu wieku — użytkownik może sam porównać moment odczytu z bieżącą sytuacją w grze.

Znaczniki czasu są także widoczne w szczegółach trasy i zapisywane w CSV jako `buy_price_timestamp_utc` oraz `sell_price_timestamp_utc`.

Szczegóły zmiany: `AUDIT-V5.4.4-QUOTE-TIME.md`.

## Funkcje odziedziczone z v5.4.3

Najważniejsza zmiana: skaner liczy osobno historyczną skalę rynku źródłowego i miasta docelowego. Kolumny `Źródło/d`, `Sprzedaż cel/d` oraz `Zabierz` pomagają ograniczać ilość wożonego towaru do konserwatywnej estymacji tego, co ma sens kupić i sprzedać.

Szczegóły: `VOLUME_MODEL.md` i `AUDIT-V5.4.3-TARGET-VOLUME.md`.

# Albion Europe Market Scanner v5.4.1 — Calculation Fix / Market Reality

Statyczna aplikacja PWA pod GitHub Pages do wyszukiwania arbitrażu na rynku Albion Online Europe. Rdzeń: **bieżąca cena + historyczny wolumen**, z warstwą kontroli anomalii i planem hurtowym.

## Najważniejsze zmiany v5.4.1

- zachowuje normalne różnice między miastami, np. 33 → 59,
- usuwa absurdalnie wysokie cele typu 5 994 000 przy normalnym rynku 33–59,
- bardzo niskiej ceny zakupu nie usuwa — oznacza ją `sprawdź cenę`,
- Black Market jest wyłączony z porównania peer-price zwykłych miast,
- historyczna referencja korzysta najpierw z mediany, potem z odpornego VWAP,
- Market Reality pokazuje `Data Completeness` i ogranicza ocenę przy brakujących danych,
- cache cen jest używany tylko dla faktycznie nieudanych batchy API,
- rekord 0 z udanego API może nadpisać starszą cenę,
- plan hurtowy nie wymusza minimum 1 sztuki,
- czas sprzedaży uwzględnia wybrany procent dziennego rynku,
- podatek i setup fee całej partii są liczone od wartości całego zlecenia,
- limit budżetu uwzględnia dokładny setup fee planu,
- pełny skan nadal działa bez limitu 500 (`0 = wszystkie`).

## Jak czytać wynik

`Zysk top / szt.` to wynik dla bieżącej najlepszej ceny. Nie oznacza, że cała partia jest dostępna po tej cenie.

`Zysk transportu` to estymacja planowanej partii. Ilość jest ograniczana przez budżet, wybrany udział historycznego wolumenu, liczbę dni oraz maksymalną liczbę sztuk.

`Potencjał rynku / d` to wskaźnik porównawczy `zysk top × historyczny wolumen`, a nie gwarantowany dzienny zarobek.

## Ograniczenie danych

Publiczne dane AODP nie dają pełnej głębokości aktualnego order booka. Przed dużym zakupem należy sprawdzić w grze faktyczną ilość sztuk po kolejnych poziomach cen.

## Testy

Uruchom w katalogu aplikacji:

```bash
node --check app.js
for f in tests/*.js; do node "$f"; done
```

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz Pages dla `main / root`.
