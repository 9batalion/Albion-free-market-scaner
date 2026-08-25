# Albion Europe Market Scanner v5.2.4 — Cena i Wolumen

Wersja uproszczona pod GitHub Pages/PWA.

## Zasada działania

Skaner pokazuje **wszystkie znalezione zyskowne trasy** pomiędzy wybranymi marketami. Główna tabela zawiera tylko informacje potrzebne do handlu:

- przedmiot i jakość,
- market zakupu,
- aktualna cena zakupu (`sell_price_min`),
- market sprzedaży,
- cena sprzedaży / docelowa cena wystawienia,
- zysk netto na sztuce po podatku, setup fee i zadanym koszcie transportu,
- historyczny wolumen rynku zakupu i sprzedaży,
- konserwatywny wolumen handlowy,
- wolumen 7 i 30 dni,
- `zysk × wolumen / dzień`.

## Jedyne filtry wyników

1. **Min. zysk netto / szt.**
2. **Min. wolumen / dzień**

Confidence, Opportunity Score, Liquidity Score, Momentum, ROI i podobne modele nie są używane do odrzucania wyników i nie są prezentowane w głównej tabeli.

## Wolumen

Po pobraniu bieżących cen aplikacja automatycznie pobiera historię AODP dla wszystkich itemów/marketów występujących w zyskownych trasach. Zapytania historyczne są grupowane, aby nie wykonywać osobnego requestu dla każdej trasy.

Dla zwykłej trasy miasto → miasto:

`buyVolumeDay = średni wolumen 7d rynku zakupu`

`sellVolumeDay = średni wolumen 7d rynku sprzedaży`

`tradeVolumeDay = min(buyVolumeDay, sellVolumeDay)`

Analogicznie dla wolumenu 7 i 30 dni wykorzystywana jest mniejsza z wartości obu marketów.

Dni bez rekordu sprzedaży w oknie historycznym liczone są jako `0`.

### Black Market

Publiczna historia AODP obejmuje historyczne sell orders, a nie pełną bieżącą głębokość buy orderów. Dlatego dla Black Market aplikacja pokazuje cenę buy orderu i wolumen rynku źródłowego, natomiast docelowy wolumen handlowy pozostawia jako brak zamiast tworzyć sztuczną wartość.

## Poprawki audytu v5.2.3

### 1. cityMedian per jakość

Mediana cen miast jest liczona wewnątrz grupy jakości (`qRows`). Normal, Good, Outstanding, Excellent i Masterpiece nie są już mieszane.

### 2. Model Profit/day

Starszy pomocniczy kod modelowy został poprawiony zgodnie z audytem:

`profitPerDayModel = profitPerDayNominal × Confidence / 100`

W v5.2.4 ta metryka nie jest używana w głównej tabeli ani do filtrowania, ale implementacja pozostaje matematycznie poprawna.

## Inne zmiany

- domyślna jakość: **Wszystkie**,
- brak limitu „top 5 tras” na item — zachowywana jest każda dodatnia trasa,
- portfolio i scoringi usunięte z głównego interfejsu,
- wolumen liczony automatycznie dla wszystkich zyskownych tras,
- sortowanie: zysk × wolumen, zysk/szt., wolumen, cena zakupu, cena sprzedaży,
- PL/EN i IndexedDB pozostają,
- Service Worker nie cache'uje requestów do zewnętrznego AODP API.

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz GitHub Pages dla gałęzi `main` / root. Aplikacja nie wymaga backendu.
