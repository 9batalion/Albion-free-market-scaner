# Albion Europe Market Scanner v5.4.1 — Calculation Fix / Market Reality

Statyczna aplikacja PWA pod GitHub Pages do wyszukiwania arbitrażu na rynku Albion Online Europe. Rdzeń: **bieżąca cena + historyczny wolumen**, z warstwą kontroli anomalii i planem hurtowym.

## Najważniejsze zmiany v5.4.1

- zachowuje normalne różnice między miastami, np. 33 → 59,
- usuwa absurdalnie wysokie cele typu 5 994 000 przy normalnym rynku 33–59,
- bardzo niskiej ceny zakupu nie usuwa — oznacza ją `sprawdź cenę`,
- Black Market jest wyłączony z porównania peer-price zwykłych miast,
- historyczna referencja korzysta najpierw z mediany, potem z odpornego VWAP,
- Market Reality pokazuje `Data Completeness` i ogranicza ocenę przy brakujących danych,
- cache cen jest używany tylko dla faktycznie nieudanych batchy API,
- rekord 0 z udanego API może nadpisać starszą cenę,
- plan hurtowy nie wymusza minimum 1 sztuki,
- czas sprzedaży uwzględnia wybrany procent dziennego rynku,
- podatek i setup fee całej partii są liczone od wartości całego zlecenia,
- limit budżetu uwzględnia dokładny setup fee planu,
- pełny skan nadal działa bez limitu 500 (`0 = wszystkie`).

## Jak czytać wynik

`Zysk top / szt.` to wynik dla bieżącej najlepszej ceny. Nie oznacza, że cała partia jest dostępna po tej cenie.

`Zysk transportu` to estymacja planowanej partii. Ilość jest ograniczana przez budżet, wybrany udział historycznego wolumenu, liczbę dni oraz maksymalną liczbę sztuk.

`Potencjał rynku / d` to wskaźnik porównawczy `zysk top × historyczny wolumen`, a nie gwarantowany dzienny zarobek.

## Ograniczenie danych

Publiczne dane AODP nie dają pełnej głębokości aktualnego order booka. Przed dużym zakupem należy sprawdzić w grze faktyczną ilość sztuk po kolejnych poziomach cen.

## Testy

Uruchom w katalogu aplikacji:

```bash
node --check app.js
for f in tests/*.js; do node "$f"; done
```

## GitHub Pages

Wrzuć zawartość katalogu do repozytorium i włącz Pages dla `main / root`.
