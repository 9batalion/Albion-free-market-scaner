# Albion Europe Market Scanner v5.3.2 — Hurt / Mamut

Statyczna aplikacja PWA przygotowana pod GitHub Pages. Rdzeń pozostaje prosty: **cena + wolumen**.

## Co robi v5.3.2

- porównuje ceny między marketami Europe,
- liczy zysk netto po tax/setup fee i opcjonalnym koszcie transportu,
- pobiera historyczny wolumen AODP,
- pokazuje wszystkie zyskowne trasy,
- ma filtr maksymalnej ceny zakupu, minimalnego zysku i minimalnego wolumenu,
- dodaje plan handlu hurtowego: liczba sztuk, kapitał i szacowany zysk całego transportu,
- ma preset `Runy / dusze / relikty` oraz kategorię obejmującą RUNE/SOUL/RELIC/ESSENCE,
- ma preset `Drobne towary` obejmujący materiały artefaktów, surowce, konsumpcyjne, farming i fishing,
- działa PL/EN i zapisuje ustawienia w IndexedDB.

## Plan hurtowy

Dla każdej trasy:

`plan sztuk = min(limit wolumenu, limit budżetu, maks. sztuk)`

`limit wolumenu = średni wolumen handlowy 7d × dni sprzedaży × wybrany % wolumenu`

`szac. zysk transportu = plan sztuk × zysk netto / szt.`

Domyślnie aplikacja wykorzystuje 20% szacowanego dziennego wolumenu. Jest to konserwatywna estymacja, a nie głębokość aktualnego order booka.

## Preset runy

Przycisk `Preset: runy / dusze / relikty` ustawia:
- kategorię RUNE/SOUL/RELIC/ESSENCE,
- enchant 0,
- jakość Normal,
- tryb `Transport + wystawienie sell orderu`,
- sortowanie po `Zysk transportu`,
- minimalny wolumen 1 szt./dzień.

## Ważne ograniczenie AODP

Publiczny endpoint cen pokazuje najlepsze poziomy cen, ale nie pełną liczbę sztuk dostępną po tej konkretnej cenie. Historyczny `item_count` służy do oszacowania aktywności rynku. Dlatego przed zakupem dużej partii warto zweryfikować aktualną głębokość zleceń w grze.

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz Pages dla `main / root`.


## Full Scan v5.3.2

- `Limit przedmiotów = 0` oznacza wszystkie przedmioty pasujące do kategorii/Tier/Enchant.
- Nie ma już domyślnego limitu 500 ani maksymalnego limitu 2500.
- API cen jest dzielone na partie pod limit URL 4096 znaków.
- Żądania są celowo ograniczone tempem (~1 żądanie / 1.1 s), aby respektować publiczne limity AODP (180/min oraz 300/5 min).
- Puste odpowiedzi cenowe są automatycznie dzielone na mniejsze partie (fallback), co pomaga przy kategoriach takich jak runy/dusze/relikty.
- Preset hurtowy używa pełnego zakresu (`scanLimit=0`) i domyślnie nie wymaga minimalnego wolumenu.
