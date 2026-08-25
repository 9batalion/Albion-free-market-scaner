# Audyt porównawczy v5.4 — Market Reality

## Sprawdzone podejścia rynkowe

1. **Albion Online Data Project**
   - oficjalne źródło danych używane przez skaner,
   - bieżące ceny zawierają `sell_price_min`, `buy_price_max` i timestampy,
   - historia API dotyczy sell orders i udostępnia `avg_price` + `item_count`,
   - API ma limity 180 zapytań/min i 300/5 min.

2. **Albion Free Market**
   - Trade Calculator uwzględnia wiek ceny i pozwala odrzucać potencjalnie złe dane,
   - Trade Routes używa średnich cen 7d i jako możliwy dzienny obrót bierze mniejszą aktywność rynku zakupu/sprzedaży,
   - podkreśla konieczność sprawdzania danych w grze przed dużym transportem.

3. **Albion Codex**
   - mocno eksponuje timestamp ceny,
   - rozróżnia `sell min` jako koszt natychmiastowego zakupu i `buy max` jako cenę natychmiastowej sprzedaży,
   - brak danych traktuje osobno od estymacji; estymacje są wyraźnie oznaczane.

4. **AlbionCore / AlbionOracle / Albion Economy / Albion Forge**
   - wspólny wzorzec: live prices + historia + freshness + arbitraż/flip finder,
   - część narzędzi dodaje ocenę wiarygodności/freshness zamiast polegać wyłącznie na nominalnym zysku.

5. **Publiczne narzędzia open-source**
   - spotykany wzorzec: wykrywanie outlierów względem historycznej ceny i osobne oznaczanie wysokiej marży przy małym wolumenie.

## Własne decyzje v5.4

Nie kopiujemy cudzej logiki ani scoringu. Zastosowano własny, jawny model:

- peer guard: median + MAD i szeroki limit wielokrotności ceny,
- history guard: referencja 7d VWAP/mediana z fallbackiem 14d/30d,
- dynamiczny limit historycznego odchylenia zależny od 7d wolumenu,
- Market Reality Score A–D = świeżość 35% + płynność 25% + regularność 20% + zgodność ceny z historią 20%,
- `#1 sprzedaż` = najwyższa bieżąca cena, która przeszła kontrolę anomalii,
- `najtańszy` = najniższa bieżąca cena zakupu w zachowanych trasach,
- historyczny zysk 7d dla relistingu jest informacją o powtarzalności, nie warunkiem usunięcia aktualnej okazji.

## Test kontrolny

Dane cenowe:
`33, 37, 39, 40, 59, 5 994 000`

Wynik peer guard:
- mediana: 39,5
- MAD: 4,5
- górny limit: 316
- zachowane: 33, 37, 39, 40, 59
- odrzucone: 5 994 000

Oczekiwane najlepsze realne miejsce sprzedaży: **59**.
