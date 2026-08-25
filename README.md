# Albion Europe Market Scanner v5.2.5 — Cena i Wolumen

Statyczna aplikacja PWA pod GitHub Pages. Rdzeń jest celowo prosty: **cena kupna, cena sprzedaży, zysk netto i historyczny wolumen**.

## Co trafia do wyników

Dla każdej wybranej jakości i marketu skaner tworzy wszystkie trasy z dodatnim zyskiem netto po:

- podatku sprzedaży,
- setup fee przy relistingu,
- opcjonalnym koszcie transportu.

Nie ma limitu top-N tras na przedmiot. Confidence, Opportunity Score, Momentum, portfolio i modele ryzyka nie uczestniczą w selekcji ani rankingu.

## Dwa filtry

1. minimalny zysk netto / szt.,
2. minimalny wolumen handlowy / dzień.

Sortowanie: `zysk × wolumen`, zysk/szt., wolumen/dzień, cena kupna i cena sprzedaży.

## Wolumen

Aplikacja pobiera około 32 dni historii AODP i liczy 30 pełnych dni. Brak dnia sprzedaży w historii = `0`.

Dla zwykłej trasy:

- `buyVolumeDay = średni wolumen 7d marketu zakupu`,
- `sellVolumeDay = średni wolumen 7d marketu sprzedaży`,
- `tradeVolumeDay = min(buyVolumeDay, sellVolumeDay)`,
- `profitVolumeDaily = netProfitPerUnit × tradeVolumeDay`.

Historia AODP jest historią sell-side i nie oznacza głębokości aktualnego buy orderu.

### Błąd API wolumenu

v5.2.5 rozróżnia **poprawną pustą odpowiedź** od **błędu requestu**:

- poprawna odpowiedź bez rekordu może potwierdzić `0` wolumenu i zostać zapisana w IndexedDB,
- timeout/CORS/HTTP error/offline **nie zapisuje pustego placeholdera**,
- jeżeli istnieje starszy cache, może zostać pokazany z oznaczeniem `(cache)`,
- jeżeli cache nie istnieje, użytkownik widzi `błąd API` / `API error`,
- następny skan ponawia request zamiast traktować awarię jako zero przez 4h.

## Skalowanie

Wszystkie znalezione trasy są zachowywane, ale tabela renderuje je stronicami: 50 / 100 / 250 wierszy. Dzięki temu kilka tysięcy tras nie jest jednocześnie wstawiane do DOM.

Pobieranie historii wolumenu działa w maksymalnie dwóch workerach z ograniczeniem tempa requestów. Zapytania są nadal grupowane per market i wiele itemów w jednym URL.

## Black Market

Black Market może być celem natychmiastowej sprzedaży do buy orderu. Nie jest źródłem zakupu ani celem relistingu. Publiczne dane nie dają porównywalnego docelowego wolumenu Black Market, więc skaner nie wymyśla tej wartości.

## local.db

IndexedDB przechowuje:

- items,
- prices,
- history,
- watchlist,
- settings,
- opportunities,
- scan_runs.

Stare magazyny `market_stats` i `portfolios` są usuwane podczas migracji DB v11.

## Testy

Uruchom:

```bash
node tests/financial-tests.js
node tests/volume-model-tests.js
node tests/manual-gate-v5.2.5-tests.js
node tests/pagination-tests.js
```

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz Pages dla `main` / root. Backend nie jest wymagany.
