# Audyt obliczeń — Albion Europe Market Scanner v5 → v5.1 Audited

## Zakres
Sprawdzono pobieranie i interpretację pól AODP, podatki/opłaty, zysk, ROI, freshness, Confidence Score, Opportunity Score, historię, płynność oraz Portfolio Optimizer.

## Najważniejsze poprawki

1. **Czas AODP / UTC — wysoki priorytet**
   - Poprzednio `Date.parse()` interpretował timestamp bez strefy jako czas lokalny przeglądarki.
   - Ten sam rekord mógł mieć inny wiek u użytkownika w Polsce i w USA.
   - v5.1 traktuje timestampy AODP bez jawnej strefy jako UTC i odrzuca nielogiczne daty z przyszłości.

2. **ROI — wysoki priorytet**
   - Poprzednio: `ROI = profit / buyPrice`.
   - v5.1: `ROI = profit / capitalPerUnit`, gdzie kapitał zawiera zakup + transport + setup fee (dla relistingu).
   - Zapobiega zawyżaniu ROI, szczególnie przy kosztownym transporcie lub relistingu.

3. **Cena relistingu jako całkowity silver — średni priorytet**
   - Poprzednio procentowy undercut mógł tworzyć ułamkową cenę.
   - v5.1 sprowadza docelową cenę do pełnych silverów przed naliczeniem opłat.

4. **Anomaly penalty — krytyczny błąd modelowy**
   - `anomalyPenalty` istniał w profilach ryzyka, ale nie był używany.
   - v5.1 stosuje bezpośrednią karę Confidence dla silnych anomalii historycznych.

5. **Crossed quotes — wysoki priorytet**
   - Poprzednia kara działała tylko przez mało ważony składnik `dataQuality`.
   - v5.1 odejmuje karę bezpośrednio od Confidence.

6. **Płynność 14 dni — wysoki priorytet**
   - Poprzednio `dailyVol = mean(item_count)` dla zwróconych punktów.
   - To może zawyżać płynność, gdy historia nie zawiera pustych dni.
   - v5.1 używa `sum(item_count) / 14` i zachowuje dodatkowo średnią z aktywnych punktów do diagnostyki.

7. **Persistence — średni priorytet**
   - Poprzedni model rósł głównie wraz z całkowitą liczbą historycznych aktualizacji i nie uwzględniał dobrze liczby skanów ani starzenia lokalnego profilu.
   - v5.1 uwzględnia udział aktualizacji w skanach, stabilność i recency lokalnego profilu.

8. **Confidence-weighted profit — średni priorytet**
   - Poprzednio nawet Confidence 0 dawał 15–20% nominalnego zysku modelowego.
   - v5.1 mnoży zysk bezpośrednio przez `Confidence / 100`. Nadal jest to heurystyka, a nie skalibrowane prawdopodobieństwo.

## Formuły v5.1

### Instant sell → buy order
- `tax = ceil(sellPrice × taxRate)`
- `profit = sellPrice - tax - buyPrice - transport`
- `capital = buyPrice + transport`
- `ROI = profit / capital × 100`

### Relisting
- `targetSell = integer destination price after undercut`
- `tax = ceil(targetSell × taxRate)`
- `setup = ceil(targetSell × setupRate)`
- `profit = targetSell - tax - setup - buyPrice - transport`
- `capital = buyPrice + transport + setup`
- `ROI = profit / capital × 100`

## Ograniczenia, których nie da się usunąć na samym GitHub Pages + publicznym AODP
- Publiczne agregaty cen nie pokazują pełnej głębokości konkretnego buy/sell orderu.
- History API jest historią sell-side, więc nie jest bezpośrednią historią buy orderów.
- Dane są crowdsourcowane i mogą być stare mimo poprawnego endpointu.
- Szacowana liczba sztuk pozostaje heurystyką płynności, nie gwarancją dostępnego wolumenu.
- Black Market ma dodatkową cechę jakości: wyższa jakość może realizować niższy jakościowo buy order; obecny podstawowy skaner porównuje jakości 1:1, więc może pomijać część okazji (błąd konserwatywny, nie zawyżający zysku).

## Wynik
Wersja v5 miała poprawny rdzeń podatkowy i właściwe pola AODP, ale nie była wystarczająco rygorystyczna w ocenie wieku danych, anomalii, ROI i płynności portfela. v5.1 naprawia te obszary.
