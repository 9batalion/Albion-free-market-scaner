# Model wolumenu v5.4.3 — Target Volume

Wolumen pochodzi z 7/30-dniowej historii sell-side AODP i jest liczony osobno dla rynku źródłowego i rynku docelowego. Dni bez danych w pełnym oknie są liczone jako 0.

## Konserwatywny wolumen dzienny

Dla każdego miasta:

`safe daily = min(7d average daily volume, 7d median daily volume)`

Jeżeli handel występował rzadziej niż przez połowę ostatnich 7 dni, mediana może wynieść 0. Wtedy skaner nie sugeruje transportu hurtowego tylko na podstawie pojedynczego aktywnego dnia.

## Źródło

`source cap = floor(source safe daily)`

Jest to historyczna skala rynku źródłowego, a nie aktualna liczba sztuk dostępnych po najniższej cenie. Dla jednego kursu skaner nie zakłada więcej niż około jednego konserwatywnego dnia aktywności źródła.

## Miasto docelowe

`destination cap = floor(destination safe daily × selected market share × planned sell days)`

Profile udziału rynku:

- Bezpieczny: 10%
- Normalny: 20%
- Agresywny: 35%
- Maksymalny: 50%
- Własny: 1–100%

## Sugerowana partia „Zabierz”

`take = min(source cap, destination cap, budget cap, max units)`

`budget cap` jest wyliczany z pełnego kosztu partii, wraz z kosztem zakupu, transportem i order-level setup fee.

## Czas sprzedaży

`estimated sell-through days = take / (destination safe daily × selected market share)`

## Ważne ograniczenie

Publiczne dane AODP nie są pełnym aktualnym order bookiem. `source cap` i `destination cap` są konserwatywnymi estymacjami skali rynku, nie gwarancją dostępności lub sprzedaży konkretnej liczby sztuk po wskazanej cenie.

Dla Black Market bieżąca głębokość buy orderu nie jest wyprowadzana z sell-side historii, więc sugerowana partia pozostaje niedostępna.
