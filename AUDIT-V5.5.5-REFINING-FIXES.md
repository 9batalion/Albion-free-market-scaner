# Wdrożenie poprawek po głębokim audycie rafinacji — v5.5.5

## Status

Wdrożono wszystkie poprawki blokujące i wysokiego priorytetu wskazane w audycie v5.5.4. Pełna macierz 215 obsługiwanych receptur została porównana z bieżącym `items.xml`: 130 receptur standardowych oraz 85 wariantów z sercami frakcji. Nie wykryto rozbieżności ilości składników, wyniku, `item value` ani bazowego focusu.

## Zrealizowane zmiany

- naprawiono skalowanie bloków poprzedniego tieru dla kamienia `.1–.3`,
- dodano alternatywne receptury z sercami frakcji,
- dodano wartości produktu i bazowe koszty focusu dla T2–T8 i enchantów,
- dodano poziomy specjalizacji T4–T8 osobno dla pięciu rodzin surowców,
- partia z focusem jest ograniczana dostępnym budżetem,
- wynik pokazuje focus na użycie stacji, focus całej partii i dodatkowy zysk na punkt focusu,
- opłata stacji jest liczona z ceny za 100 odżywienia i `item value`, osobno dla każdego rodzaju surowca,
- setup fee jest doliczane do kapitału początkowego własnej oferty sprzedaży,
- dzienny bonus można ustawić osobno dla każdej rodziny surowców,
- pokazano najstarszą cenę użytą w każdej kalkulacji i rozpiętość godzin odczytów,
- starsze dane nie są automatycznie usuwane; przekroczenie ustawionego progu powoduje ostrzeżenie,
- kolumny cen zakupu, pozostałych składników i sprzedaży sortują według czasu odczytu,
- wynik całej partii bez ręcznego potwierdzenia dostępności jest oznaczony jako szacunek,
- użytkownik może wpisać potwierdzoną w grze bezpieczną wielkość partii,
- pierwszy skan pozostał ręczny, a szybkie odświeżanie działa dopiero po nim.

## Kontrola przypadku T4.3

Dla 13 użyć stacji kalkulator pokazuje obecnie:

- 26 × T4.3 kamień,
- 104 × blok T3,
- 104 × gotowy zwykły blok T4.

Poprzednia wersja błędnie pokazywała tylko 13 bloków T3.

## Testy

Przechodzi 20 plików testowych. Nowy zestaw `refining-deep-fixes-v5.5.5-tests.js` sprawdza:

- wszystkie 15 zaczarowanych wariantów kamienia,
- liczbę 130 receptur standardowych i 85 receptur z sercami,
- wartości produktu i bazowy focus,
- wpływ specjalizacji na zużycie focusu,
- ograniczenie partii budżetem focusu,
- automatyczne opłaty stacji,
- setup fee w kapitale początkowym,
- najstarszy czas ceny i rozpiętość notowań,
- oznaczenie niepotwierdzonej partii jako szacunku,
- sortowanie kolumn cenowych po czasie.

## Świadome ograniczenie danych AODP

Publiczny endpoint cenowy AODP nie zwraca pełnej głębokości aktualnego order booka. Z tego powodu aplikacja nie udaje, że zna liczbę sztuk dostępną po najlepszej cenie. Wynik większej partii pozostaje szacunkiem do czasu wpisania przez użytkownika ilości sprawdzonej w grze.

Samodzielne, rekurencyjne rafinowanie materiału poprzedniego tieru nie jest włączane automatycznie. Kalkulator wycenia go jako zakup rynkowy, aby nie mieszać kilku osobnych budżetów focusu i opłat stacji w jednym planie bez decyzji użytkownika.
