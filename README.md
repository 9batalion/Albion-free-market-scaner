# Albion Europe Market Scanner v5.2 — Volume & Liquidity Intelligence

Statyczna aplikacja PWA pod GitHub Pages. Łączy się bezpośrednio z europejskim API Albion Online Data Project i zapisuje dane lokalnie w IndexedDB.

## Najważniejsza zmiana w v5.2

Wolumen i płynność są teraz pełnoprawną częścią modelu okazji oraz Portfolio Optimizer.

Aplikacja pobiera do ok. 32 dni dziennej historii AODP (`time-scale=24`) i wylicza wolumen dla pełnych okien:

- 1 dzień,
- 3 dni,
- 7 dni,
- 14 dni,
- 30 dni.

Brak rekordu danego dnia jest traktowany jako 0, dzięki czemu średnia dzienna nie jest zawyżana tylko przez aktywne dni.

## Nowe metryki

Dla przeanalizowanej okazji wyliczane są:

- `Volume/day` — efektywny dzienny wolumen używany przez model,
- `Liquidity Score 0–100`,
- regularność handlu,
- trend wolumenu,
- stabilność wolumenu,
- `Safe Qty`,
- `Normal Qty`,
- `Aggressive Qty`,
- szacowany czas wyjścia z pozycji,
- nominalny `Profit/day`,
- `Model Profit/day` ważony Confidence Score.

## Jak liczony jest wolumen

Historia AODP dotyczy sell history. Dlatego:

- dla relistingu wykorzystywana jest płynność źródła i celu, a ograniczeniem jest słabszy z dwóch rynków;
- dla sprzedaży natychmiastowej wolumen celu jest wyłącznie proxy ogólnej płynności rynku — nie oznacza głębokości aktualnego buy orderu;
- dla Black Market używany jest ostrożny współczynnik oparty na rynku źródłowym.

Publiczne AODP nie udostępnia pełnej aktualnej głębokości order booka, dlatego rekomendowana liczba sztuk jest estymacją.

## Liquidity Score

Score uwzględnia:

- średni wolumen 7 dni,
- udział aktywnych dni,
- stabilność wolumenu,
- trend 3 dni względem 14 dni.

Wysoki pojedynczy dzień nie wystarcza do uzyskania wysokiej oceny.

## Opportunity Score

Po analizie historii Liquidity Score ma dużą wagę w Opportunity Score:

- Conservative: 30% płynność,
- Balanced: 25% płynność,
- Aggressive: 24% płynność.

Pozostałe składniki to Confidence, zysk/ROI i ocena wartości ceny.

## Portfolio Optimizer v5.2

Portfolio wykorzystuje teraz rekomendacje Safe / Normal / Aggressive zależnie od profilu ryzyka oraz ustawionego horyzontu płynności.

Pozycja bez sensownego limitu wolumenowego nie jest dodawana do portfela.

Priorytet pozycji uwzględnia również `Model Profit/day`, aby premiować szybszy obrót kapitału zamiast samego wysokiego ROI.

## Filtry wolumenu

W UI można ustawić:

- minimalny wolumen / dzień,
- minimalny wolumen 7 dni,
- minimalny Liquidity Score,
- maksymalny czas wyjścia,
- wymóg wykonania analizy wolumenu.

Można też sortować wyniki według wolumenu, płynności, czasu wyjścia i Model Profit/day.

## IndexedDB

Baza `albion_europe_market_local_db` ma wersję 7. Dotychczasowe magazyny danych pozostają, a cache historii zawiera teraz 32-dniowy zakres używany do obliczeń 30-dniowych.

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz:

`Settings → Pages → Deploy from a branch → main / (root)`

Pliki wymagane do działania:

- `index.html`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- `offline.html`
- `icon.svg`
- `.nojekyll`

## Ważne ograniczenie

Wolumen historyczny opisuje wykonany handel historyczny. Nie gwarantuje, że aktualny order istnieje ani że po aktualnie widocznej cenie dostępna jest rekomendowana liczba sztuk. Większe transakcje warto zweryfikować w grze.
