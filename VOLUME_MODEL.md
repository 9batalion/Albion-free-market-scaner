# Volume Model v5.2

## Okna

Model pobiera dzienną historię AODP i buduje 30 pełnych dni kalendarzowych. Bieżący niepełny dzień jest przechowywany osobno i nie zawyża średnich pełnodniowych.

Dla każdego okna N:

`total_N = suma item_count z N pełnych dni`

`avg_N = total_N / N`

`active_ratio_N = dni z volume > 0 / N`

## Regularity

`regularity = 0.65 × active_ratio_30 + 0.35 × active_ratio_7`

wynik jest skalowany do 0–100.

## Trend

`trend = avg_3 / avg_14 - 1`

## Liquidity Score

W przybliżeniu:

`Liquidity = 54% volume scale + 28% regularity + 12% stability + 6% trend`

Skala wolumenu jest logarytmiczna, dzięki czemu bardzo duże rynki nie dominują liniowo nad wszystkimi pozostałymi.

## Effective daily volume

Relist:

`min(source avg7, destination avg7)`

Instant:

`min(source avg7, destination avg7) × 0.62`

Dla instant destination history jest proxy płynności, nie głębokością buy orderu.

## Ilość

Model wyprowadza ostrożną dzienną przepustowość z efektywnego wolumenu, Confidence i regularności, a następnie trzy poziomy:

- Safe ≈ 18% przepustowości,
- Normal ≈ 38%,
- Aggressive ≈ 70%.

Dodatkowe współczynniki obniżają rekomendację dla typów transakcji o większej niepewności wykonania.

## Profit/day

`profitPerDayNominal = profitPerUnit × estimatedDailyCapacity`

`profitPerDayModel = profitPerDayNominal × Confidence / 100`

To metryka heurystyczna do rankingu, a nie gwarantowany dzienny zarobek.
