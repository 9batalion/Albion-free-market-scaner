# Audyt v5.3.2 — Real Price Guard

## Cel
Odrzucać skrajnie nierealne ceny z pojedynczych marketów bez usuwania normalnej przewagi cenowej między miastami.

## Reguły
- Porównanie bieżącej ceny docelowej oraz ceny zakupu z medianą cen tego samego itemu i jakości w wybranych marketach.
- Szeroki próg: max(8× mediana, mediana + 15× MAD).
- Przykład T5_RUNE: 33 / 37 / 39 / 40 / 59 / 5 994 000 => 59 pozostaje prawidłowym celem, 5 994 000 jest odrzucane.
- Drugi filtr po pobraniu historii: sprzedaż > 10× mediany historycznej lub zakup < 1/10 mediany historycznej jest odrzucany.
- Filtr działa na cenę sprzedaży w relistingu i na buy order w trybie natychmiastowym.
- Stary cache okazji v5.3.1 jest unieważniany przez schemaVersion 13.

## Oczekiwany efekt
Najwyższe realne miasto nadal jest rekomendowane. W opisanym przypadku Brecilien 33 → Martlock 59 pozostaje okazją, a Fort Sterling 5 994 000 znika z wyników.
