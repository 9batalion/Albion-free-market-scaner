# Audyt v5.4.8 — stała wartość dóbr luksusowych

## Zakres

Zmiana dotyczy wyłącznie 21 identyfikatorów `TREASURE_*_RARITY1-3`. Pozostałe kategorie nadal używają dotychczasowych modeli `instant` i `relist`.

## Model dobra luksusowego

1. Pobierz aktualny `sell_price_min` i `sell_price_min_date` dla zaznaczonych marketów zakupu.
2. Jeżeli ustawiono konkretne `Miasto startowe`, ogranicz kandydatów do tego miasta.
3. Wybierz jeden najtańszy market dla danego dobra i jakości; przy remisie wybierz nowszy odczyt.
4. Ustal miasto oraz wartość sprzedaży z tabeli reguł dobra, bez odczytu ceny docelowej AODP.
5. Oblicz: `zysk = stała wypłata - podatek - zakup - transport`. Setup fee wynosi 0.
6. Pokaż czas wyłącznie przy ofercie zakupu. Przy sprzedaży pokaż podstawę: stała cena w grze.

## Wyjątek awaloński

Golden Frame, Golden Gyroscope i Golden Sextant można sprzedać w dowolnym Królewskim Mieście odpowiednio za 10 000, 50 000 i 250 000. Nie są przypisywane do Brecilien ani do jednego wybranego miasta.

## Wolumen

Stały miejski buyback nie jest ograniczany historycznym wolumenem sprzedaży celu. Plan partii korzysta z konserwatywnej skali rynku zakupu, budżetu, kosztu transportu i limitu sztuk. AODP nie pokazuje jednak pełnej bieżącej głębokości sell orderów, dlatego liczbę sztuk po najtańszej cenie nadal należy potwierdzić w grze.
