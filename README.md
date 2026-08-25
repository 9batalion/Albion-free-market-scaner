# Albion Europe Market Scanner v5.4 — Market Reality / Hurt

Statyczna aplikacja PWA pod GitHub Pages. Rdzeń pozostaje prosty: **aktualna cena + historyczny wolumen**, ale v5.4 dodaje warstwę interpretacji, żeby odróżnić realną okazję od pojedynczego, starego albo absurdalnego rekordu.

## Co robi v5.4

- porównuje ceny między marketami Europe,
- liczy zysk netto po tax/setup fee i opcjonalnym koszcie transportu,
- odrzuca skrajne anomalie cen względem innych miast oraz historii 7/14/30 dni,
- zachowuje najwyższą **realną** cenę sprzedaży — np. 59 zostaje, 5 994 000 przy typowych cenach 33–59 odpada,
- pobiera historyczny wolumen AODP i używa minimum aktywności rynku zakupu/sprzedaży jako wskaźnika przepustowości trasy,
- nadaje każdej trasie ocenę **A–D** na podstawie świeżości, płynności, regularności i zgodności ceny z historią,
- pokazuje referencyjną cenę sprzedaży 7d oraz historyczny spread po opłatach,
- oznacza `najtańszy` market zakupu oraz `#1 sprzedaż` dla najlepszego realnego celu,
- dodaje sortowanie po ocenie realności,
- eksportuje ocenę, referencje 7d, wiek cen i flagi najlepszej trasy do CSV,
- zachowuje plan hurtowy / Mamut i pełny skan bez limitu 500.

## Nasza interpretacja rynku

### 1. Aktualna cena jest sygnałem, nie prawdą absolutną
AODP pokazuje najlepsze poziomy aktualnych zleceń wraz z timestampem. Pojedynczy rekord może być stary albo pochodzić z bardzo płytkiego rynku, dlatego sama najwyższa cena nie wystarcza.

### 2. Najlepsze realne miasto
Najpierw porównujemy bieżące ceny między miastami. Normalne różnice zostają. Skrajna cena odstająca wielokrotnie od mediany/MAD pozostałych miast jest usuwana.

Przykład:
`33 / 37 / 39 / 40 / 59 / 5 994 000` → wynik docelowy `59`, nie `5 994 000`.

### 3. Historia jako drugi bezpiecznik
Po pobraniu historii obliczana jest referencja ceny z 7 dni (VWAP; fallback 7d mediana → 14d → 30d). Dopuszczalny mnożnik odchylenia jest szerszy dla rynków o małym obrocie i węższy dla bardzo płynnych.

### 4. Ocena Market Reality A–D
Ocena nie jest prawdopodobieństwem ani gwarancją. Składa się z:
- 35% świeżość obu cen,
- 25% historyczny wolumen trasy,
- 20% regularność handlu,
- 20% zgodność bieżących cen z historią.

### 5. Dwa różne pojęcia zysku
- `Zysk / szt.` — wynik z bieżącej ceny po opłatach.
- `Historyczny zysk / szt.` — dla relistingu kontrola, czy podobny spread istniał przy referencjach 7d.
- `Potencjał rynku / d` — zysk × historyczny wolumen; to górny wskaźnik potencjału, nie gwarantowany zarobek.
- `Zysk transportu` — wynik planu z budżetem i wybranym udziałem wolumenu.

## Ważne ograniczenie AODP

Publiczny endpoint cen daje najlepsze poziomy cen, ale nie pełną głębokość order booka. Endpoint historii dotyczy historycznych sell orders. Dlatego liczba sztuk w planie hurtowym jest estymacją aktywności rynku, a nie informacją, że dokładnie tyle sztuk kupisz/sprzedasz po jednej cenie.

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz Pages dla `main / root`.
