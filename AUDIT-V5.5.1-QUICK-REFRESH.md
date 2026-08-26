# Audyt v5.5.1 — szybkie odświeżanie

## Pełny skan

Buduje kompletną listę receptur dla wybranych surowców, tierów i enchantów, pobiera wszystkie wymagane identyfikatory z zaznaczonych miast, a następnie zapisuje receptury i rekordy cen w pamięci bieżącej sesji.

## Szybkie odświeżanie

1. Sortuje istniejące wyniki według zysku.
2. Wybiera pierwsze 10, 30, 50 albo wszystkie wyniki.
3. Tworzy zbiór unikalnych identyfikatorów: surowiec, materiał poprzedniego tieru i produkt końcowy.
4. Pobiera tylko te identyfikatory dla wcześniej wybranego zakresu miast.
5. Usuwa stare rekordy tych identyfikatorów i miast, także gdy nowa odpowiedź nie zawiera ceny.
6. Scala odpowiedź z nieodświeżaną częścią danych i ponownie oblicza wszystkie wyniki.

Takie zachowanie zapobiega wskrzeszaniu starej ceny po udanej odpowiedzi zerowej, a jednocześnie pozwala zachować wcześniejsze notowania pozycji spoza szybkiego odświeżenia.

## Blokada zakresu

Zmiana surowca, tieru, enchantu lub listy miast zmienia zestaw wymaganych identyfikatorów, dlatego wymaga pełnego skanu. Parametry czysto obliczeniowe korzystają z już pobranych rekordów i są przeliczane lokalnie.
