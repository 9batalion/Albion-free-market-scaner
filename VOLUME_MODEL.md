# Model wolumenu v5.4.1

Wolumen pochodzi z 7/30-dniowej historii sell-side AODP. Dni bez danych w pełnym oknie są liczone jako 0.

Dla transportu zwykłe miasto → zwykłe miasto:

`trade volume/day = min(source 7d avg, destination 7d avg)`

Plan hurtowy:

`share = selected volume share % / 100`

`volume cap = floor(trade volume/day × planned days × share)`

`budget cap = największe qty, dla którego buy cost + transport + order-level setup fee <= budget`

`planned units = min(volume cap, budget cap, max units)`

`estimated sell-through days = planned units / (trade volume/day × share)`

Opłaty całej partii:

`revenue = qty × sell price`

`tax total = ceil(revenue × tax%)`

`setup total = ceil(revenue × setup%)` dla relistingu

`trip profit = revenue - tax total - setup total - buy cost - transport total`

Jeśli `volume cap < 1`, plan wynosi 0 sztuk — nie jest wymuszane minimum 1.

Black Market nie ma porównywalnego sell-history wolumenu aktualnego buy orderu, dlatego plan hurtowy nie udaje znajomości jego bieżącej głębokości.

Model nie interpretuje historycznego wolumenu jako aktualnej głębokości order booka.
