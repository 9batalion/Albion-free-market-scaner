# Audyt v5.5.3 — pełny katalog produktów

## Przyczyna różnicy 9539 → około 5234

Katalog startowy zawierał 9539 handlowalnych identyfikatorów, ale funkcje wyboru i diagnostyki odrzucały każdy zwykły przedmiot poniżej T4. `Limit = 0` usuwał limit liczbowy, lecz nie usuwał tego filtra tieru.

## Poprawka

- `Wszystkie T2–T8` obejmuje cały katalog załadowany przez aplikację, włącznie z T2, T3 i dobrami luksusowymi.
- Dodano osobne wybory T2 oraz T3.
- Licznik pasujących produktów używa tych samych reguł co właściwy skan.
- Puste rekordy AODP są usuwane z cache zamiast pozostawać w pamięci; do obliczeń trafiają tylko rekordy zawierające cenę.

## Zakres zapytań

Przy 9539 identyfikatorach, siedmiu miastach i pięciu jakościach istnieje do 333 865 kombinacji. Program dzieli identyfikatory według długości URL i odpytuje partie kolejno, z kontrolą tempa i ponowieniami. Licznik postępu pokazuje faktyczną liczbę przetworzonych produktów.
