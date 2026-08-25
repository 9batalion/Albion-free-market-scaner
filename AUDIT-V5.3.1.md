# Audyt v5.3.1 Full Scan

- Usunięto sztywny limit 500/2500: 0 = wszystkie pasujące Item ID.
- Dodano batching URL oraz globalny pacing API 1100 ms.
- Dodano retry dla timeout/429/5xx i fallback dzielenia pustych partii cenowych.
- Postęp pokazuje liczbę przetworzonych Item ID / cały zakres.
- Wolumen pobierany jest sekwencyjnie z tym samym limiterem, aby ograniczyć 429.
- Preset runy/dusze/relikty nie narzuca limitu 500 i nie wymaga min. wolumenu.
