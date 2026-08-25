# v5.4.2 — Connection Fix

Naprawiono brak bootstrapu aplikacji w v5.4.1 (`init`, `bind`, cache/DB handlers).

`index.html` jest teraz samowystarczalny: kod aplikacji jest osadzony w pliku, więc strona uruchomi się również wtedy, gdy na GitHub Pages podmienisz tylko `index.html`. Pełna paczka nadal zawiera `app.js`, PWA i testy.

Dodatkowo zmieniono nazwę cache Service Workera, aby stara uszkodzona wersja nie była ponownie podawana z pamięci.
