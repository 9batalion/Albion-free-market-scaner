# Audyt v5.4.4 — czas odczytu ceny

## Przyczyna rozbieżności

Skaner poprawnie odczytywał `sell_price_min` z AODP, ale w głównej tabeli nie było od razu widoczne, z jakiej dokładnie daty i godziny pochodzi wartość. W przykładzie z `T5_MOUNT_HORSE` AODP zwracał dla Martlock cenę około 235 tys. z wcześniejszego odczytu, podczas gdy późniejszy widok rynku w grze pokazywał 69 999.

AODP jest źródłem społecznościowym: wartość zmienia się po przesłaniu nowego odczytu rynku przez klienta danych. Skaner nie ma bezpośredniego dostępu do bieżącego order booka gry.

## Zmiana

- Nie dodano automatycznego odrzucania ceny tylko z powodu jej wieku.
- Pod ceną zakupu i sprzedaży widoczne są: pełna data, czas lokalny, czas UTC i wiek odczytu.
- Te same informacje są widoczne w szczegółach trasy.
- CSV zawiera surowe znaczniki czasu AODP dla obu stron trasy.
- Zachowano dotychczasową logikę wyboru cen i kontroli skrajnych anomalii.

## Interpretacja

Cena w tabeli oznacza: „ostatnia cena zaobserwowana przez AODP o pokazanej godzinie”, a nie gwarancję, że identyczna oferta nadal znajduje się w grze w chwili oglądania wyniku.
