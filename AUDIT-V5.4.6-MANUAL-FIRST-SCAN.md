# Audyt v5.4.6 — pierwszy skan ręczny

## Zachowanie po otwarciu

- Aplikacja nie uruchamia skanu podczas inicjalizacji.
- Flaga `manualScanUnlocked` ma wartość `false` po każdym przeładowaniu strony.
- Wywołanie automatyczne `scan({auto:true})` kończy się bez pobierania danych, dopóki użytkownik nie uruchomi poprawnie skonfigurowanego skanu przyciskiem `Skanuj`.
- Ręczne uruchomienie ustawia `manualScanUnlocked = true` i od początku ustawia licznik harmonogramu.
- Domyślny interwał to 10 minut; użytkownik może wybrać inny interwał albo `Wyłączony`.
- Usunięto opcję uruchamiania skanu przy otwarciu aplikacji.

## Trasa miasto → miasto

- `Miasto startowe` ogranicza źródło zakupu; Black Market nie może być źródłem.
- `Miasto docelowe` ogranicza miejsce sprzedaży; Black Market może być celem sprzedaży do buy orderu.
- `Dowolne z zaznaczonych` zachowuje porównanie wszystkich zaznaczonych marketów.
- Wybrane konkretne miasta są automatycznie włączane w zestawie marketów pobieranych z AODP.

## Sortowanie tabeli

- Domyślnie wyniki są ułożone od najbardziej aktualnej kompletnej pary notowań.
- Kliknięcie nagłówka sortuje po odpowiadającej mu kolumnie.
- Ponowne kliknięcie tego samego nagłówka odwraca kierunek.
- Aktywna kolumna i kierunek są widoczne jako strzałka oraz zapisane w ustawieniach lokalnych.
