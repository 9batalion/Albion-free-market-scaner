# Volume Model v5.2.5

## Źródło

AODP history, `time-scale=24`, zakres ok. 32 dni. Do statystyk używane są pełne dni przed bieżącym dniem.

## Okna

`1d / 3d / 7d / 14d / 30d`.

Dzień bez sprzedaży jest liczony jako `0`, dzięki czemu średnia nie jest średnią wyłącznie z aktywnych dni.

## Wartości w tabeli

Dla marketu źródłowego i docelowego:

- średni wolumen 7 dni,
- wolumen handlowy/d = minimum z obu marketów,
- wolumen 7 dni = minimum z sum 7d,
- wolumen 30 dni = minimum z sum 30d,
- zysk × wolumen/d = zysk netto na sztuce × wolumen handlowy/d.

Dla Black Market docelowy wolumen handlowy pozostaje niedostępny.

## Semantyka błędów

Stan `0` i stan `API error` są różne.

`0` wolumenu można zapisać wyłącznie po poprawnej odpowiedzi AODP, w której dany item/jakość nie wystąpiły lub historia ma zerowy obrót. Wyjątek sieciowy nigdy nie tworzy zerowego placeholdera.

Jeżeli odświeżenie się nie uda, istniejący cache może być pokazany jako `(cache)`. Bez cache widoczny jest `błąd API`.
