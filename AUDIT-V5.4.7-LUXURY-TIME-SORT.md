# Audyt v5.4.7 — dobra luksusowe i sortowanie czasu

## Przyczyna braku dóbr luksusowych

Identyfikatory dóbr luksusowych w bazie Albion Online mają format `TREASURE_<RODZAJ>_RARITY<1-3>`. Poprzednia wersja:

- przyjmowała do bazy wyłącznie identyfikatory zaczynające się od `T2_–T8_`,
- dodatkowo odrzucała wszystkie identyfikatory zawierające `TREASURE_`,
- próbowała przypisać kategorię po nieistniejącym w tych ID fragmencie `_LUXURY`,
- odrzucała przedmioty bez standardowego tieru w filtrze zakresu skanu.

## Poprawka

- Dodano dokładny wzorzec dla rodzin `KNOWLEDGE`, `SILVERWARE`, `DECORATIVE`, `CEREMONIAL`, `TRIBAL`, `RITUAL` i `AVALON` oraz poziomów rzadkości 1–3.
- Te 21 identyfikatorów jest dopuszczanych do lokalnej bazy i przypisywanych do `Dobra luksusowe`.
- Towary bez standardowego tieru są skanowane, gdy `Tier = Wszystkie`.
- Kategoria jest również uwzględniana w skrócie `Drobne towary`.
- Stary, siedmiodniowy cache katalogu jest unieważniany, aby aktualizacja nie czekała na jego naturalne wygaśnięcie.
- Pakiet zawiera awaryjną listę 21 identyfikatorów, więc kategoria pozostaje dostępna także wtedy, gdy odświeżenie katalogu nazw chwilowo się nie powiedzie.

## Sortowanie czasu cen

- Nagłówek `Cena kupna` używa znacznika `sourceDate`.
- Nagłówek `Cena sprzedaży` używa znacznika `destDate`.
- Domyślny kierunek obu kolumn to najnowszy odczyt na górze.
- Drugie kliknięcie tej samej kolumny pokazuje najstarszy odczyt na górze.
- Domyślne sortowanie całej tabeli nadal używa świeżości kompletnej pary kupno–sprzedaż.
