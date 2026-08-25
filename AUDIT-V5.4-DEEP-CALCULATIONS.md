# Albion Europe Market Scanner v5.4 — głęboki audyt obliczeń

Data audytu: 2026-08-25

## Werdykt

Rdzeń obliczeń pojedynczej sztuki jest w większości poprawny: zakup z `sell_price_min`, natychmiastowa sprzedaż do `buy_price_max`, podatek 4%/8%, setup fee 2.5% dla wystawienia sell orderu i koszt transportu są stosowane we właściwych miejscach. Obecna wersja nie powinna jednak traktować `Zysku transportu` i `Plan szt.` jako dokładnych wartości wykonania hurtowego. Model mnoży cenę najlepszej pojedynczej oferty przez ilość planu, mimo że AODP nie udostępnia głębokości bieżącego order booka.

## Testy zastane

Uruchomiono:
- bulk-trade-tests.js — PASS
- financial-tests.js — PASS
- full-scan-tests.js — PASS
- manual-gate-v5.2.5-tests.js — PASS
- pagination-tests.js — PASS
- price-guard-tests.js — PASS
- volume-model-tests.js — PASS
- `node --check app.js` — PASS

PASS oznacza zgodność kodu z obecnymi założeniami, nie pełne potwierdzenie zgodności tych założeń z realnym wykonaniem transakcji w grze.

## Wyniki audytu

### 1. Pojedyncza sztuka — poprawne

Tryb instant:
`profit = buy_price_max(destination) - sales_tax - sell_price_min(source) - transport`

Tryb relist:
`target = floor(destination_sell_min × (1 - undercut%))`
`profit = target - sales_tax - setup_fee - source_sell_min - transport`

Źródło zakupu jest natychmiastowym kupnem z istniejącego sell orderu, więc nie nalicza setup fee po stronie zakupu.

### 2. Krytyczne: dokładny zysk hurtowy jest zawyżonym/niepewnym modelem wykonania

AODP prices daje najlepsze ceny, ale nie ilość sztuk dostępnych na danym poziomie ceny. Obecny kod zakłada, że cała planowana liczba sztuk zostanie kupiona po `sell_price_min` i sprzedana po jednej cenie docelowej. To nie jest gwarantowane.

Przykład: jeśli jedna runa jest po 33, a następne 5000 sztuk po 40+, plan nie może bez danych o głębokości zakładać 5000 × 33.

Wniosek: `estimated_trip_profit` powinien być oznaczony jako scenariusz top-quote albo liczony z konserwatywnych cen referencyjnych 7d.

### 3. Wysokie: zaokrąglanie opłat per sztuka i mnożenie przez qty

Kod liczy `ceil(price × rate)` dla jednej sztuki, a następnie mnoży profit jednej sztuki przez planowaną ilość. Setup fee zlecenia jest naliczane od wartości zlecenia, więc przy tanich towarach powstaje konserwatywny błąd zaokrąglenia.

Przykład runy: buy 33, raw sell 59, undercut 0.1%, target 58, Premium.
- obecny model / szt.: tax 3, setup 2, profit 20
- 10 000 szt.: obecny wynik 200 000
- licząc setup i tax od wartości całego przykładowego zlecenia: 212 300
- różnica: 12 300 silver

To nie tworzy fałszywego zysku; przeciwnie, zwykle zaniża wynik dla tanich produktów. Jednak `totalProfit = qty × unitProfit` nie jest dokładnym odwzorowaniem opłat całego zlecenia.

### 4. Wysokie: `daysAtVolume` ignoruje udział wolumenu

Plan ilości używa `daily × days × share%`, ale czas wyjścia jest liczony jako `qty / daily`.

Przy 1000 szt./d, udziale 20% i planie 200 szt.:
- kod pokazuje 0.2 dnia,
- przy założeniu przejmowania 20% dziennego obrotu plan odpowiada około 1 dniu.

Poprawna estymacja przy tym samym modelu:
`daysAtShare = qty / (daily × share%)`.

### 5. Wysokie: wymuszanie minimum 1 szt. przy bardzo małym wolumenie

`volumeCap = max(1, floor(...))` powoduje, że nawet 0.1 szt./dzień przy 20% udziału i 1 dniu daje rekomendację 1 sztuki, choć matematyczny cap wynosi 0.02.

Dla modelu hurtowego powinno być `max(0, floor(...))`. Jedną sztukę można pokazać jako test ręczny, ale nie jako wynik limitu wolumenu.

### 6. Wysokie: historia 7d wybiera VWAP przed medianą i może być manipulowana

`historyReferencePrice()` wybiera 7d VWAP jako pierwszy punkt odniesienia. Przy rzadkich przedmiotach pojedynczy dzień z wysoką ceną i dużym `item_count` może przesunąć VWAP bardzo mocno.

Test syntetyczny: 6 dni po 40 i jeden dzień po 1000 z dużą wagą:
- mediana 7d = 40,
- VWAP 7d = 640,
- obecny reference = 640.

Dla filtra anty-anomalii bezpieczniejsza jest mediana/winsoryzowany VWAP, a zwykły VWAP powinien być wartością pomocniczą.

### 7. Wysokie: Market Reality może dostać A przy brakującej historii celu

Jeśli historia destination jest nieznana, scoring potrafi użyć tylko dobrej regularności source, domyślnej płynności i jednego ratio. W skrajnym, ale możliwym przypadku brak danych docelowych może dać około 84/100 = A.

Brak historii destination powinien ograniczać ocenę maksymalnie do C/B albo dodawać jawny `dataCompleteness`.

### 8. Średnie/wysokie: peer guard może usuwać prawdziwą okazję zakupu

Dla źródła lista 1 / 37 / 39 / 40 / 59 powoduje odrzucenie ceny 1 jako low outlier. Jednak niski, świeży sell order jest ofertą, którą da się natychmiast kupić — może być prawdziwą okazją, a nie błędem.

Lepsza asymetria:
- ekstremalnie wysoki target sell: twardo weryfikować,
- ekstremalnie niski source sell: nie usuwać automatycznie; oznaczyć jako `extreme bargain` i wymagać świeżego timestampu / ręcznej weryfikacji.

### 9. Średnie: Black Market jest wrzucany do peer guard buy-orderów

W instant mode Black Market może być naturalnie wyżej niż zwykłe buy ordery miast. Obecny wspólny peer guard może odrzucić BM jako outlier. Black Market powinien mieć osobną klasę porównania i nie być liczony do mediany zwykłych miast.

### 10. Wysokie: częściowy błąd API + cache może wskrzesić stare ceny

Przy choć jednym błędzie partii kod dołącza cache dla całego wyboru. Świeże rekordy z cenami 0 są wcześniej odfiltrowywane jako „nieznaczące”, więc stary dodatni rekord cache dla klucza, który w udanej odpowiedzi API miał już 0/brak orderu, może pozostać po merge.

Poprawka: cache wolno używać wyłącznie dla dokładnie tych partii/kluczy, których request się nie udał. Dla udanej odpowiedzi trzeba zapisać tombstone/stan zero i wykluczyć starszy cache.

### 11. Średnie: `profit × volume/day` nie jest realizowalnym dziennym zyskiem

Ta liczba zakłada jednocześnie:
- utrzymanie bieżącego spreadu,
- wykonanie po top quote,
- przejęcie 100% historycznej aktywności obu rynków.

Może zostać jako `market potential`, ale nie powinna być nazywana oczekiwanym zyskiem dziennym. Dla rankingu praktycznego lepsze jest `profit × daily × selectedShare%` z konserwatywną ceną planu.

### 12. Średnie: instant buy-order nie ma znanej głębokości

Dla natychmiastowej sprzedaży `buy_price_max` jest ceną najlepszego buy orderu, ale publiczny endpoint cen nie dostarcza ilości na tym poziomie. Sell-history destination jest tylko wskaźnikiem aktywności i nie może potwierdzić, że planowana ilość zostanie sprzedana do najlepszego buy orderu.

## Co jest poprawne i warto zachować

- Europe endpoint AODP.
- Rozdzielenie `sell_price_min` jako kosztu instant-buy i `buy_price_max` jako wyjścia instant-sell.
- 4% Premium / 8% bez Premium jako sales tax.
- 2.5% setup fee dla wystawianego zlecenia.
- Brak setup fee przy natychmiastowym zakupie z sell orderu i przy natychmiastowej sprzedaży do istniejącego buy orderu.
- Wykluczenie Black Market jako źródła zakupu.
- C# ticks -> epoch milliseconds.
- 7/30d windows z pominięciem bieżącego niepełnego dnia.
- `trade activity = min(source activity, destination activity)` jako konserwatywny proxy przepustowości.
- przykład 33/37/39/40/59/5 994 000: 59 zostaje, 5 994 000 jest odrzucane.

## Rekomendowany model v5.4.1

1. `quoteProfitUnit` — dokładna matematyka jednej sztuki po aktualnym top quote.
2. `bulkPlanBuyPrice` — konserwatywnie `max(current source sell_min, robust source 7d reference)`.
3. `bulkPlanSellPrice` — konserwatywnie `min(current target, robust destination 7d reference × dopuszczalny premium)`.
4. `plannedQty = floor(min(volume × days × share, budget cap, maxQty))`, bez wymuszania 1.
5. `daysAtShare = qty / (daily × share)`.
6. Opłaty planu liczyć na wartości całego zlecenia; jeśli dokładne grupowanie filli jest nieznane, pokazywać wariant konserwatywny i nominalny.
7. Osobny `dataCompleteness`; brak historii celu nie może dostać A.
8. Peer guard + history guard łączyć zamiast twardo odrzucać świeże niskie źródło.
9. Black Market wyłączyć z peer median zwykłych miast.
10. Cache fallback tylko dla nieudanych batchy; udane zero ma pierwszeństwo nad starym cache.

## Ocena końcowa

- Matematyka pojedynczej sztuki: **8.5/10**
- Filtr anomalii: **7/10**
- Historia/reference price: **6/10**
- Wolumen jako proxy rynku: **7/10**
- Plan hurtowy / total trip profit: **5/10**
- Odporność cache/API: **6/10**

Najważniejsza zmiana: nie traktować jednej najlepszej ceny AODP jako ceny dla całej partii mamuta. To jest największe źródło potencjalnie błędnej interpretacji wyniku mimo poprawnej arytmetyki jednej sztuki.
