# v5.4.3 — Target Volume

## Cel

Ograniczyć niepotrzebny transport przez rozdzielenie historycznej skali rynku zakupu od historycznej skali miasta, w którym towar ma zostać sprzedany.

## Zmiany

1. Osobno wyliczane są:
   - średni wolumen źródła 7d,
   - bezpieczny wolumen źródła/d,
   - średni wolumen celu 7d,
   - bezpieczny wolumen sprzedaży celu/d,
   - bezpieczna skala całej trasy/d.
2. `safe daily = min(średnia 7d, mediana dzienna 7d)`.
3. `Zabierz` jest ograniczane przez źródło, sprzedaż w mieście docelowym, budżet i limit sztuk.
4. Czas wyprzedaży bazuje na wolumenie miasta docelowego i wybranym udziale rynku.
5. Dodano profile partii: 10%, 20%, 35%, 50% oraz własny.
6. Kolumna `Wolumen / d` została zastąpiona przez `Źródło/d`, `Sprzedaż cel/d`, `Zabierz`.
7. Eksport CSV zawiera osobne wartości źródła/celu i oba limity ilościowe.
8. Cache okazji ma nowy schemaVersion 16.

## Przykład kontrolny

Źródło bezpieczne: 17 000/d

Cel bezpieczny: 7 200/d

Profil normalny: 20%

Plan sprzedaży: 1 dzień

`destination cap = 7200 × 20% = 1440`

`source cap = 17000`

Przy wystarczającym budżecie i limicie sztuk:

`Zabierz = 1440`

## Testy

Dodano `target-volume-v5.4.3-tests.js`, który sprawdza rozdzielenie źródła/celu, limit miasta docelowego, ograniczenie przez źródło oraz zachowanie dla nieregularnego rynku.
