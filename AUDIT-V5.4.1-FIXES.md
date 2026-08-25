# Albion Europe Market Scanner v5.4.1 — poprawki po głębokim audycie obliczeń

## Zakres poprawki

Wersja 5.4.1 wdraża wnioski z `AUDIT-V5.4-DEEP-CALCULATIONS.md`. Celem jest rozdzielenie dokładnego wyniku dla aktualnego top quote od konserwatywnej estymacji całej partii hurtowej.

## 1. Opłaty całej partii — poprawione

`Zysk top quote / szt.` nadal pokazuje wynik dla pojedynczej sztuki przy bieżącej najlepszej cenie.

Dla planu hurtowego podatek i setup fee są teraz liczone od **całkowitej wartości planowanego zlecenia**, a nie przez proste mnożenie zaokrąglonego zysku jednostkowego:

- `revenue = qty × sell_price`
- `tax_total = ceil(revenue × tax%)`
- `setup_total = ceil(revenue × setup%)` dla relistingu
- `transport_total = qty × transport_per_unit`
- `trip_profit = revenue - tax_total - setup_total - buy_cost - transport_total`

Dzięki temu tanie towary nie są sztucznie zaniżane przez wielokrotne zaokrąglanie opłat dla każdej sztuki.

## 2. Plan ilości i czas sprzedaży — poprawione

- usunięto wymuszone minimum 1 sztuki,
- `volume cap = floor(volume/day × days × selected market share)`,
- jeśli wynik wynosi mniej niż 1 szt., plan pokazuje `0`,
- czas sprzedaży liczony jest względem wybranego udziału rynku:
  `days = qty / (volume/day × selected share)`.

Przykład: 1000 szt./dzień, udział 20%, plan 200 szt. → 1 dzień, a nie 0,2 dnia.

## 3. Budżet — dokładne ograniczenie

Limit budżetu uwzględnia:

- koszt zakupu,
- koszt transportu,
- setup fee całego zlecenia przy relistingu.

Maksymalna ilość w budżecie jest znajdowana przez wyszukiwanie binarne po rzeczywistym kapitale planu.

## 4. Historia cen — mediana przed VWAP

Referencja anty-anomaly korzysta teraz w pierwszej kolejności z mediany 7 dni. Dodatkowo obliczany jest odporny `robustVwap`, w którym skrajne dzienne ceny są winsoryzowane względem mediany i MAD.

Kolejność fallbacków:

1. mediana 7d,
2. robust VWAP 7d,
3. mediana 14d,
4. robust VWAP 14d,
5. mediana 30d,
6. robust VWAP 30d.

Pojedynczy dzień z ogromną ceną i ogromnym wolumenem nie może już sam przesunąć referencji do absurdalnego poziomu.

## 5. Asymetryczny filtr cen

### Wysoka cena celu
Skrajnie wysoka cena sprzedaży może zostać twardo odrzucona jako anomalia.

Przykład:
`33 / 37 / 39 / 40 / 59 / 5 994 000` → `59` pozostaje, `5 994 000` odpada.

### Bardzo niska cena zakupu
Skrajnie niska cena **nie jest automatycznie usuwana**. Może być prawdziwą pomyłką sprzedającego. Zostaje w wynikach z oznaczeniem `sprawdź cenę` i wymaga ręcznej kontroli w grze.

## 6. Black Market — osobna klasa

Black Market nie uczestniczy w medianie/MAD zwykłych miast dla buy orderów. Jego popyt ma inną mechanikę, więc wysoki buy order Black Market nie jest odrzucany tylko dlatego, że odstaje od Bridgewatch/Martlock/Thetford itd.

Publiczny wolumen sell-history nie jest traktowany jako głębokość bieżącego buy orderu Black Market.

## 7. Data Completeness

Market Reality Score dostał osobną miarę `Data Completeness` 0–100%.

Brak historii lub timestampów ogranicza maksymalny wynik:

- <50% → maks. D,
- <75% → maks. C,
- <90% → maks. B,
- ≥90% → możliwe A.

Black Market z definicji nie otrzymuje pełnych punktów za porównywalną historię celu, więc nie może dostać A wyłącznie na podstawie niepełnych danych.

## 8. Cache cen — poprawione

Cache cen jest używany tylko dla **tych ID przedmiotów, których batch cenowy faktycznie zakończył się błędem API**.

Udana odpowiedź z ceną 0 / brakiem zlecenia nie może już przywrócić starej dodatniej ceny z local.db.

Do local.db zapisywane są także zwrócone rekordy zerowe, aby świeży brak oferty mógł nadpisać stary stan.

## 9. Interpretacja wyników

- `Zysk top / szt.` = dokładne obliczenie dla widocznego top quote, bez wiedzy o głębokości order booka.
- `Zysk transportu` = estymacja dla planowanej partii z opłatami liczonymi na poziomie całego zlecenia.
- `Potencjał rynku / d` = wskaźnik `top profit × historyczny wolumen`; nie jest prognozą gwarantowanego dziennego zarobku.

## Wniosek

v5.4.1 usuwa wykryte błędy matematyczne planu hurtowego i ogranicza ryzyko fałszywych sygnałów ze starego cache oraz niereprezentatywnego VWAP. Nadal nie zakłada pełnej głębokości order booka, ponieważ publiczne dane AODP jej nie dostarczają.
