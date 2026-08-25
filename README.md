# Albion Europe Market Scanner v4 — Portfolio Intelligence

Statyczna aplikacja PWA przygotowana pod GitHub Pages. Nie wymaga backendu. Łączy się bezpośrednio z europejskim API Albion Online Data Project i przechowuje własną pamięć rynku w IndexedDB.

## Co nowego w v4

### Portfolio Optimizer
Po skanie aplikacja może automatycznie zbudować portfel zakupów dla podanego budżetu, np. 5 000 000 silver. Model nie wybiera wyłącznie najwyższego ROI. Bierze pod uwagę:

- Confidence Score,
- Opportunity Score,
- zysk i ROI po opłatach,
- świeżość notowań,
- historyczną płynność,
- limit liczby sztuk wynikający z płynności,
- limit kapitału na jeden przedmiot,
- limit kapitału na jedną trasę,
- maksymalną liczbę pozycji,
- profil ryzyka,
- rezerwę gotówkową.

Portfel pokazuje kolejność zakupów, liczbę sztuk, potrzebny kapitał, zysk nominalny oraz zysk modelowy ważony jakością sygnału.

> Ważne: publiczne AODP nie udostępnia pełnej, bieżącej głębokości order booka. Rekomendowana liczba sztuk jest ostrożną estymacją na podstawie historii wolumenu, a nie informacją o aktualnej liczbie sztuk dostępnych po danej cenie.

### Ograniczanie koncentracji
Domyślnie:
- 10% budżetu pozostaje jako rezerwa,
- maks. 20% inwestowalnego budżetu trafia w jeden item + quality,
- maks. 40% inwestowalnego budżetu trafia na jedną trasę,
- maks. 12 pozycji,
- maks. 25 sztuk na jedną pozycję.

Wszystkie wartości można zmienić w UI.

### Estymacja płynności
Limit sztuk wykorzystuje średni historyczny wolumen sell orders z AODP, horyzont płynności i profil ryzyka. Dla instant arbitrage limit jest dodatkowo obniżany, ponieważ historyczny wolumen sell nie pokazuje głębokości aktualnego buy orderu.

### Kapitał wymagany
Dla natychmiastowego arbitrażu kapitał / szt. obejmuje cenę zakupu i ustawiony koszt transportu. Dla relistingu uwzględnia również setup fee, które trzeba zapłacić przy wystawianiu zlecenia.

## Modele okazji z v3

- **Instant arbitrage** — zakup po `sell_price_min` i sprzedaż do `buy_price_max` w innym markecie.
- **Black Market** — Black Market jest wyłącznie celem natychmiastowej sprzedaży.
- **Relist spread** — zakup, transport i własny sell order w innym mieście.
- **City gap** — cena źródłowa wyraźnie poniżej mediany innych miast.
- **Mean reversion** — cena źródłowa poniżej 14-dniowej mediany z oceną płynności.
- **Anomaly checks** — kary za ekstremalne odstępstwa, skrzyżowane lub stare notowania.

## Confidence Score 0–100

Heurystyczna ocena jakości sygnału złożona m.in. ze świeżości, spreadu, lokalnej historii aktualizacji, płynności, zmienności i zgodności z historią AODP.

## Opportunity Score 0–100

Łączy Confidence, ROI, zysk bezwzględny i ocenę wartości ceny źródłowej. Wagi zależą od profilu: konserwatywnego, zbalansowanego albo agresywnego.

## local.db / IndexedDB

Baza `albion_europe_market_local_db` ma wersję 4 i przechowuje:

- `items` — baza przedmiotów,
- `prices` — ostatnie ceny,
- `history` — 14-dniowa historia,
- `market_stats` — lokalnie uczone profile aktualizacji rynku,
- `opportunities` — ostatnie sygnały,
- `portfolios` — ostatni zbudowany portfel,
- `watchlist`,
- `settings`,
- `scan_runs`.

Backup DB i import obejmują również portfel.

## GitHub Pages

Wrzuć pliki do repozytorium i włącz:

`Settings → Pages → Deploy from a branch → main / (root)`

Pliki:
- `index.html`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- `offline.html`
- `icon.svg`
- `.nojekyll`

Autoskan i przebudowa portfela działają, gdy strona/PWA jest otwarta. GitHub Pages nie uruchamia JavaScriptu po całkowitym zamknięciu aplikacji.
