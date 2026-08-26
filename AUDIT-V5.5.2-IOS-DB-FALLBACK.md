# Audyt v5.5.2 — Safari/iOS i awaryjna baza w pamięci

## Rozpoznany problem

Start aplikacji był jednym łańcuchem operacji. Odrzucenie `indexedDB.open()` przerywało ten łańcuch przed pobraniem katalogu przedmiotów i przed testem AODP. Interfejs pokazywał jednocześnie `Przedmioty: błąd`, `local.db: błąd` oraz `API: niepołączone`, mimo że pierwotnym problemem była wyłącznie lokalna baza przeglądarki.

## Poprawka

- Otwarcie IndexedDB ma limit 8 sekund i obsługuje zdarzenie `blocked`.
- Połączenie reaguje na `versionchange`, zamyka starą wersję i pozwala nowej karcie wykonać aktualizację.
- Błąd IndexedDB uruchamia zgodne magazyny w pamięci zamiast przerywać start.
- Ładowanie przedmiotów, sprawdzenie API i ręczne skanowanie są kontynuowane.
- Status informuje o `trybie pamięci`; w tym trybie cache znika po zamknięciu karty.

## Weryfikacja

Dodano test działania magazynów bez dostępnego obiektu `indexedDB`. Zachowano testy obliczeń, cen, wolumenu, dóbr luksusowych, ręcznego pierwszego skanu i rafinacji.
