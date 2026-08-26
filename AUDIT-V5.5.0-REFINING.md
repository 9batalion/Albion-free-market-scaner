# Audyt v5.5.0 — moduł rafinacji

## Zakres

Moduł obsługuje pięć rodzin rafinacji: deski, tkaninę, skórę, sztaby i bloki kamienne. Analizowane są T2–T8 oraz istniejące enchanty `.0–.4`.

## Receptury

| Tier | Surowiec bieżącego tieru | Materiał poprzedniego tieru |
|---|---:|---:|
| T2 | 1 | 0 |
| T3 | 2 | 1 |
| T4 | 2 | 1 |
| T5 | 3 | 1 |
| T6 | 4 | 1 |
| T7 | 5 | 1 |
| T8 | 5 | 1 |

T4.x wykorzystuje materiał T3.0. Od T5.x materiał poprzedniego tieru ma ten sam enchant.

Kamień jest wyjątkiem: `.1`, `.2` i `.3` nie tworzą zaczarowanych bloków, lecz odpowiednio 2, 4 i 8 zwykłych bloków na jedną rafinację. Silnik przelicza koszt składników na jedną uzyskaną sztukę bloku. Wariant kamienia `.4` nie jest generowany.

## Miasta premii

- drewno — Fort Sterling,
- włókno — Lymhurst,
- skóry — Martlock,
- ruda — Thetford,
- kamień — Bridgewatch.

## Zwrot surowców

Silnik sumuje bonus miasta `+18%`, premię rafinacji właściwego miasta `+40%`, opcjonalny focus `+59%` oraz ręcznie wybrany bonus dzienny. Następnie stosuje wzór `RRR = bonus / (1 + bonus)`.

Bez focusu i bonusu dnia daje to `0,58 / 1,58 = 36,7089%`. Z focusem: `1,17 / 2,17 = 53,9171%`.

## Koszty i wynik

`zysk / szt. = przychód po podatku i setup fee − efektywnie zużyte składniki − opłata stacji − transport`.

Koszt efektywny stosuje oczekiwany zwrot do obu składników receptury. Jednocześnie szczegóły pokazują pełną liczbę składników potrzebną do uruchomienia pierwszej partii, ponieważ statystyczny zwrot nie jest zapasem początkowym.

## Ograniczenia

- AODP pokazuje najlepsze ceny, ale nie pełną ilość na kolejnych poziomach order booka.
- Opłata stacji jest wpisywana ręcznie jako koszt jednej gotowej sztuki, aby nie zgadywać aktualnej ceny konkretnego stanowiska.
- Zwrot jest wartością oczekiwaną; wynik małej partii może różnić się od średniej.
- Moduł nie wycenia focusu w srebrze ani nie ogranicza partii dostępną liczbą punktów focusu. To kolejny możliwy etap.
