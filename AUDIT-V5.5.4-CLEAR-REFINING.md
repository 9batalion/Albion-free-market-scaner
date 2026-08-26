# Audyt v5.5.4 — zrozumiały moduł rafinacji

## Problem

Widok szczegółów pokazywał skróty `T4.3`, surowe identyfikatory AODP, np. `T4_ROCK_LEVEL3@3`, oraz pojęcia `tier`, `enchant`, `profit`, `focus` i `zwrot`, bez objaśnienia ich znaczenia.

## Zmiana

- Poziom: pełny zapis `poziom 4 (T4)`.
- Zaczarowanie: pełny zapis `zaczarowanie 3 (.3)` albo `bez zaczarowania (.0)`.
- Zakupy: polskie nazwy surowca, materiału poprzedniego poziomu i gotowego produktu.
- Produkcja: liczba rafinacji opisana jako liczba użyć stacji rafinacji.
- Odzysk: wyjaśnienie, że część materiałów statystycznie wraca po produkcji.
- Dane techniczne: identyfikatory AODP są dostępne dopiero po rozwinięciu osobnej sekcji.
- Finanse: pełne opisy kosztu, przychodu po podatkach i zysku.

Obliczenia silnika rafinacji nie zostały zmienione; zmieniono warstwę prezentacji i objaśnienia.
