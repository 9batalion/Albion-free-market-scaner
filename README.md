# Albion Europe Market Scanner v5.4.4 — Czas odczytu ceny

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
