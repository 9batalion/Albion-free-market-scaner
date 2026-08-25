# Audyt v5.4.5 — ręczne uruchamianie skanu

## Zmiana

- `Automatyczny skan` domyślnie ustawiony na `Wyłączony`.
- `Start po otwarciu` domyślnie ustawiony na `Nie`.
- Ustawienia zapisane przez starszą wersję są jednorazowo migrowane do wyłączonej automatyzacji.
- Po inicjalizacji aplikacja informuje, aby najpierw skonfigurować skaner i dopiero potem nacisnąć `Skanuj`.
- Automatyzację nadal można świadomie włączyć po zakończeniu konfiguracji.
- Domyślne sortowanie wyników ustawiono na `Najbardziej aktualne`.
- Świeżość trasy wyznacza starszy z dwóch odczytów: ceny zakupu i ceny sprzedaży.
- Przy remisie świeżości wyżej znajduje się większy szacowany zysk transportu, a następnie większy zysk jednostkowy.

## Oczekiwane zachowanie

Samo otwarcie lub odświeżenie strony nie uruchamia pobierania pełnego zakresu cen i wolumenu. Połączenie kontrolne z API pozostaje aktywne wyłącznie po to, aby pokazać status dostępności API.
