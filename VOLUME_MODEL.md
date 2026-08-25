# Volume Model v5.2.4 — prosty model

## Źródło

Historia AODP, `time-scale=24`, zakres około 32 dni. Model wykorzystuje 30 pełnych dni i nie zawyża średniej dniem bieżącym.

## Okna

Dla każdego rynku i jakości powstają wartości:

- 1 dzień,
- 3 dni,
- 7 dni,
- 14 dni,
- 30 dni.

Brak dnia w historii = `0` sztuk.

## Wartości pokazywane użytkownikowi

Dla zwykłej trasy:

`buyVolumeDay = source.avg7`

`sellVolumeDay = destination.avg7`

`tradeVolumeDay = min(source.avg7, destination.avg7)`

`tradeVolume7 = min(source.total7, destination.total7)`

`tradeVolume30 = min(source.total30, destination.total30)`

## Ranking

Domyślnie:

`profitVolumeDaily = netProfitPerUnit × tradeVolumeDay`

Nie jest to prognoza gwarantowanego zarobku. To proste zestawienie ceny z historycznym obrotem.

## Ograniczenie danych

Historia AODP jest historią sell-side. W szczególności nie jest pełną głębokością aktualnego buy orderu. Dla Black Market nie tworzymy sztucznego docelowego wolumenu.
