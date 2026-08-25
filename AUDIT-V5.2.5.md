# Audyt poprawek v5.2.5

## Manual Gate follow-up

### 1. Placeholdery wolumenu po błędzie API — NAPRAWIONE

Request historii używa `rows = null` jako stanu błędu. Brakujące rekordy są zapisywane jako potwierdzone zero wyłącznie wewnątrz `if (rows !== null)`, czyli po prawidłowej odpowiedzi API.

Błąd requestu zapisuje klucze w `failedKeys`, ale nie wykonuje `dbPutMany()` z pustymi rekordami dla tej partii.

### 2. Skalowanie szerokiej tabeli — NAPRAWIONE PO STRONIE DOM

Skaner nadal zachowuje wszystkie zyskowne trasy. `render()` wstawia do DOM tylko aktualną stronę (domyślnie 100, opcjonalnie 50/250). Eksport CSV nadal obejmuje cały przefiltrowany zestaw.

### 3. Pobieranie dużej liczby historii — USPRAWNIONE

Historia pozostaje grupowana po marketach i wielu itemach w URL. Dodano dwa workery z ograniczeniem tempa, aby skrócić szeroki skan bez agresywnego przekraczania tempa zapytań.

### 4. Martwy moduł portfolio / Confidence — USUNIĘTY

Usunięto m.in. `allocatePortfolio`, `makePortfolioCandidates`, `buildPortfolio`, `renderPortfolio`, `enrichOne`, `enrichTop`, `recalcScore`, profile ryzyka i `market_stats`. `calcMode()` liczy wyłącznie ekonomię trasy.

### 5. cityMedian — USUNIĘTY Z RDZENIA

Po usunięciu scoringu/etykiet city-gap mediana miast nie jest już potrzebna i nie jest liczona. Nie ma więc możliwości mieszania jakości w tej metryce.

### 6. Model Profit/day — USUNIĘTY Z RDZENIA

Confidence-weighted Profit/day nie jest częścią uproszczonego skanera. Pozostała wyłącznie jawna metryka `zysk netto × wolumen/d`.

## Testy

- Financial tests — PASS
- Volume model tests — PASS
- Manual Gate v5.2.5 — PASS
- Pagination tests — PASS
- `node --check app.js` — PASS
- zgodność `el('id')` z HTML — PASS
- manifest JSON — PASS
