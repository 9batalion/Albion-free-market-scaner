# Albion Europe Market Scanner v5.2.3 — Cena × Wolumen

Wersja pod GitHub Pages/PWA uproszczona zgodnie z założeniem: **główne kryteria wyszukiwania to tylko cena i wolumen**.

## Jak działa wyszukiwanie

1. **Cena** — skaner porównuje ceny między marketami i zachowuje trasy z dodatnim zyskiem netto po podatku, setup fee i koszcie transportu.
2. **Wolumen** — dla najlepszych cenowo kandydatów pobierana jest historia 30 dni i wyliczany jest estymowany wolumen dzienny.

Pozostałe wskaźniki, takie jak ROI, Confidence, świeżość, Liquidity Score, czas wyjścia i anomalie, są nadal pokazywane, ale **nie usuwają okazji z wyników**.

## Filtry wyników

Są tylko dwa podstawowe pola:

- **Min. zysk netto / szt. (cena)**
- **Min. wolumen / dzień**

Presety:

- **Wszystkie dodatnie** — pokazuje każdą trasę z dodatnim zyskiem,
- **Tylko z wolumenem** — wymaga wolumenu > 0,
- **Aktywny handel** — min. 5 szt./dzień,
- **Wyższa cena** — min. 1000 silver zysku/szt.

## Sortowanie

Domyślne sortowanie to **Cena × Wolumen**. Dodatkowo można sortować po zysku, ROI, wolumenie, Profit/day, Confidence, świeżości, Liquidity Score itd. Są to kryteria sortowania, nie twarde filtry.

## Ranking Cena × Wolumen

Po analizie wolumenu wynik jest liczony jako:

- 58% — wynik cenowy (zysk jednostkowy + ROI),
- 42% — wolumen dzienny.

Przed analizą wolumenu kandydat pozostaje widoczny i jest oceniany tylko wstępnie na podstawie ceny.

## Wolumen

Wolumen jest liczony z historii AODP z pełnych okien 1/3/7/14/30 dni. Dni bez sprzedaży są traktowane jako 0.

Dla natychmiastowej sprzedaży wolumen rynku docelowego jest tylko wskaźnikiem płynności rynku — publiczne AODP nie podaje pełnej głębokości aktualnego buy orderu.

## Portfolio

Portfolio nie wymaga już minimalnego Confidence. Dobór pozycji opiera się przede wszystkim na:

- zysku/cenie,
- wolumenie,
- budżecie,
- limicie na przedmiot,
- limicie na trasę,
- estymowanej liczbie sztuk wynikającej z wolumenu.

Confidence pozostaje informacją pomocniczą.

## Analiza wolumenu

Domyślna opcja: **top 50 wg ceny**. Dostępne są też 0 / 30 / 50 / 80 kandydatów.

## GitHub Pages

Pliki można umieścić w repozytorium i opublikować przez GitHub Pages. IndexedDB działa lokalnie w przeglądarce użytkownika.
