# Audyt v5.3 — Hurt / Mamut

- Rdzeń finansowy z v5.2.5 pozostawiony bez zmian.
- Błąd cache wolumenu przy awarii API pozostaje naprawiony: nie zapisujemy błędu jako potwierdzonego zera.
- Dodano osobną kategorię `bulkMaterials` dla `T4–T8_RUNE/SOUL/RELIC/ESSENCE`.
- Dodano filtr `maxBuyPrice`; nadal są to wyłącznie kryteria ceny i wolumenu.
- Plan ilości nie używa Confidence ani scoringów: bazuje wyłącznie na wolumenie, budżecie i limitach użytkownika.
- Plan nie zakłada dostępności całej partii po `sell_price_min`; jest estymacją do weryfikacji w grze.
- Wszystkie zyskowne trasy są zachowywane; paginacja chroni UI przed dużą liczbą wyników.
