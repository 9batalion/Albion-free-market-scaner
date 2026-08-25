# Audyt poprawek v5.2.4

## Naprawione

1. `cityMedian` jest liczony z `qRows`, czyli osobno dla każdej jakości.
2. `profitPerDayModel` w legacy `enrichOne()` stosuje `Confidence / 100`.
3. Domyślna jakość skanu to `Wszystkie`.
4. `calcMode()` nie ogranicza już wyników do kilku tras na item — zwraca wszystkie trasy z dodatnim zyskiem netto.
5. Filtr wyników ma tylko dwa kryteria: `profit` i `volume`.
6. Główna tabela nie pokazuje Confidence, ROI, Liquidity Score, Opportunity Score ani portfolio.
7. Wolumen jest pobierany automatycznie dla wszystkich zyskownych tras przez grupowane zapytania historyczne AODP.

## Rdzeń finansowy

Instant:

`tax = ceil(sellPrice × taxRate)`

`profit = sellPrice - tax - buyPrice - transport`

Relist:

`setup = ceil(targetSellPrice × setupRate)`

`tax = ceil(targetSellPrice × taxRate)`

`profit = targetSellPrice - setup - tax - buyPrice - transport`

## Testy

- `volume-model-tests.js`
- `broad-results-tests.js`
- `price-volume-tests.js`
- `audit-v5.2.4-tests.js`
