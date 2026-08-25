# Model wolumenu v5.3

Wolumen jest liczony z 7/30-dniowej historii sell-side AODP. Dni bez danych w pełnym oknie są liczone jako 0.

Dla transportu miasto → miasto:

`trade volume/day = min(source 7d avg, destination 7d avg)`

Plan hurtowy:

`volume cap = trade volume/day × planned days × volume share %`

`budget cap = budget per route / unit capital`

`planned units = min(volume cap, budget cap, max units)`

`trip profit = planned units × net profit/unit`

Model nie interpretuje wolumenu jako aktualnej głębokości order booka.
