(() => {
'use strict';

const API = 'https://europe.albion-online-data.com';
const ITEMS_URLS = [
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json',
  'https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/formatted/items.json'
];
const MARKETS = [
  {api:'Bridgewatch', label:'Bridgewatch', royal:true},
  {api:'Caerleon', label:'Caerleon', royal:true},
  {api:'Fort Sterling', label:'Fort Sterling', royal:true},
  {api:'Lymhurst', label:'Lymhurst', royal:true},
  {api:'Martlock', label:'Martlock', royal:true},
  {api:'Thetford', label:'Thetford', royal:true},
  {api:'Brecilien', label:'Brecilien', royal:true},
  {api:'Arthurs Rest', label:"Arthur's Rest", royal:false},
  {api:'Merlyns Rest', label:"Merlyn's Rest", royal:false},
  {api:'Morganas Rest', label:"Morgana's Rest", royal:false},
  {api:'Black Market', label:'Black Market', royal:false}
];
const qualityName = {1:'Normal',2:'Good',3:'Outstanding',4:'Excellent',5:'Masterpiece'};
const DB_NAME='albion_europe_market_local_db';
const DB_VERSION=10;
const DB_STORES=['items','prices','history','watchlist','settings','opportunities','scan_runs','market_stats','portfolios'];
const PROFILE = {
  conservative:{freshHalfLife:8, confidenceWeight:.40, profitWeight:.22, valueWeight:.08, liquidityWeight:.30, crossedPenalty:42, anomalyPenalty:42},
  balanced:{freshHalfLife:14, confidenceWeight:.35, profitWeight:.30, valueWeight:.10, liquidityWeight:.25, crossedPenalty:30, anomalyPenalty:30},
  aggressive:{freshHalfLife:24, confidenceWeight:.28, profitWeight:.38, valueWeight:.10, liquidityWeight:.24, crossedPenalty:18, anomalyPenalty:20}
};

const el = id => document.getElementById(id);
const state = {items:[],itemById:new Map(),raw:[],opportunities:[],portfolio:null,stop:false,watched:new Set(),history:new Map(),scanId:0,watchOnly:false,lastApiOk:false,marketStats:new Map(),lang:'pl',scanDiagnostics:null,resultPreset:'all'};
let db=null,settingsTimer=null,autoTimer=null;

const locale = () => state.lang==='en'?'en-US':'pl-PL';
const fmt = n => Number.isFinite(+n) ? Math.round(+n).toLocaleString(locale()) : '—';
const pct = n => Number.isFinite(+n) ? (+n).toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1})+'%' : '—';
const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const now = () => Date.now();
const clamp = (n,a=0,b=100) => Math.max(a,Math.min(b,n));
function parseAodpTime(d){
  if(!d||String(d).startsWith('0001-'))return NaN;
  const v=String(d).trim(),hasZone=/[zZ]$|[+\-]\d{2}:?\d{2}$/.test(v);
  return Date.parse(hasZone?v:v+'Z');
}
const ageHours = d => {const t=parseAodpTime(d);if(!Number.isFinite(t))return Infinity;const h=(now()-t)/36e5;return h < -0.25 ? Infinity : Math.max(0,h);};
const ageText = h => !Number.isFinite(h)?tr('brak','n/a'):h<1?Math.round(h*60)+' min':h<48?h.toLocaleString(locale(),{maximumFractionDigits:1})+' h':(h/24).toLocaleString(locale(),{maximumFractionDigits:1})+' d';
const marketLabel = api => MARKETS.find(m=>m.api===api)?.label || api;
const itemIcon = (id,q=1) => `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?quality=${q}&size=64`;
const dbKeyPrice = r => `${r.item_id}|${r.city}|${+r.quality||1}`;
const statKey = (itemId,city,quality) => `${itemId}|${city}|${quality}`;
const median = a => {if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const mean = a => a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;


const tr = (pl,en) => state.lang==='en'?en:pl;
const TEXT_PAIRS = {
  'Market Intelligence • Europe • AODP API • modele okazji • Kategorie • PL/EN • Portfolio Optimizer • Confidence Score • IndexedDB • GitHub Pages / PWA':'Market Intelligence • Europe • AODP API • opportunity models • Categories • PL/EN • Portfolio Optimizer • Confidence Score • IndexedDB • GitHub Pages / PWA','API:':'API:','niepołączone':'not connected','Przedmioty:':'Items:','Ostatni skan:':'Last scan:','Zakres skanowania':'Scan scope','Wyszukaj przedmiot / ID':'Search item / ID','Wszystkie':'All','Jakość':'Quality','Limit przedmiotów':'Item limit',
  'Przy pustym wyszukiwaniu skaner wybiera handlowalne T4–T8. Duży limit = więcej zapytań i dłuższy skan.':'With an empty search, the scanner selects tradeable T4–T8 items. A higher limit means more requests and a longer scan.',
  'Kategorie przedmiotów':'Item categories','Wszystkie kategorie':'All categories','Wyczyść':'Clear','Tylko ekwipunek':'Equipment only',
  'Kategorie są stosowane przed zapytaniem do API. Możesz zaznaczyć kilka grup jednocześnie, np. Zbroje + Broń.':'Categories are applied before API requests. You can select multiple groups, e.g. Armor + Weapons.',
  'Markety':'Markets','Główne miasta':'Royal cities','Black Market jest traktowany wyłącznie jako cel natychmiastowej sprzedaży do buy orderu; nie jest używany jako źródło zakupu ani jako zwykły market do relistingu.':'Black Market is used only as a destination for instant sales into buy orders; it is not used as a purchase source or a normal relisting market.',
  'Strategia':'Strategy','Tryb':'Mode','Smart Scan — wszystkie modele':'Smart Scan — all models','Natychmiast: sell → buy order':'Instant: sell → buy order','Transport + wystawienie sell orderu':'Transport + place sell order',
  'Profil ryzyka':'Risk profile','Konserwatywny':'Conservative','Zbalansowany':'Balanced','Agresywny':'Aggressive','Analiza historii':'History analysis','Szybka — bez historii':'Fast — no history','Zaawansowana — top 30':'Advanced — top 30','Głęboka — top 50':'Deep — top 50',
  'Tak (tax 4%)':'Yes (tax 4%)','Nie (tax 8%)':'No (tax 8%)','Koszt transportu / szt.':'Transport cost / unit',
  'W trybie natychmiastowym sprzedaż do istniejącego buy orderu nie używa setup fee, ale nadal uwzględniamy podatek od sprzedaży (4% Premium / 8% bez Premium). W trybie wystawienia uwzględniamy podatek oraz setup fee.':'In instant mode, selling into an existing buy order does not use the setup fee, but sales tax still applies (4% Premium / 8% without Premium). Relisting includes both tax and setup fee.',
  'Filtry okazji':'Opportunity filters','Min. zysk / szt.':'Min. profit / unit','Maks. wiek ceny (h)':'Max price age (h)','Min. cena zakupu':'Min. buy price','Wyklucz ten sam market':'Exclude same market','Obie ceny muszą być świeże':'Both prices must be fresh',
  'Wolumen i płynność':'Volume & liquidity','Min. wolumen / dzień':'Min. volume / day','Min. wolumen 7 dni':'Min. 7-day volume','Min. Liquidity Score':'Min. Liquidity Score','Maks. czas wyjścia (dni)':'Max exit time (days)','Tylko po analizie wolumenu':'Require volume analysis','Śr. wolumen':'Avg. volume','est. szt. / dzień':'est. units / day','Śr. płynność':'Avg. liquidity','Wolumen/d':'Volume/day','Wyjście':'Exit','Vol/d':'Vol/day','Wolumen / dzień':'Volume / day','est. płynność rynku':'estimated market liquidity','Wolumen pochodzi z historycznych sell orders AODP. Dla natychmiastowej sprzedaży wolumen rynku docelowego jest wskaźnikiem płynności rynku, a nie głębokością aktualnego buy orderu.':'Volume comes from AODP historical sell orders. For instant sales, destination volume is a market-liquidity proxy, not the depth of the current buy order.',
  'Portfel i budżet':'Portfolio & budget','Budżet (silver)':'Budget (silver)','Rezerwa %':'Reserve %','Maks. na przedmiot % budżetu':'Max per item % of budget','Maks. na trasę % budżetu':'Max per route % of budget','Maks. pozycji':'Max positions','Maks. sztuk / pozycję':'Max units / position','Min. confidence portfela':'Min. portfolio confidence','Horyzont płynności':'Liquidity horizon','6 godzin':'6 hours','12 godzin':'12 hours','1 dzień':'1 day','2 dni':'2 days','3 dni':'3 days','Automatycznie przebuduj portfel po skanie':'Rebuild portfolio automatically after scan','Zbuduj portfel':'Build portfolio','Eksport portfela':'Export portfolio',
  'Liczba sztuk jest estymacją opartą na historii wolumenu i jakości danych. Publiczne AODP nie udostępnia pełnej głębokości aktualnego order booka, dlatego większe pozycje wymagają weryfikacji w grze.':'Unit count is an estimate based on historical volume and data quality. Public AODP does not expose the full depth of the current order book, so larger positions should be verified in-game.',
  'Automatyzacja i local.db':'Automation & local.db','Automatyczny skan':'Automatic scan','Wyłączony':'Off','co 5 min':'every 5 min','co 10 min':'every 10 min','co 15 min':'every 15 min','co 30 min':'every 30 min','co 60 min':'every 60 min','Start po otwarciu':'Start on open','Tak':'Yes','Nie':'No','Użyj ostatnich danych local.db przy błędzie API':'Use latest local.db data on API error','Pokaż cache':'Show cache','Wyczyść cache':'Clear cache','IndexedDB zapisuje ostatnie ceny, historię, obserwowane przedmioty i ustawienia lokalnie w tej przeglądarce. Dane nie są wysyłane do GitHub.':'IndexedDB stores recent prices, history, watched items and settings locally in this browser. Data is not sent to GitHub.',
  'Skanuj okazje':'Scan opportunities','Gotowy.':'Ready.','Przelicz modele historii':'Recalculate history models','Przerwij':'Stop',
  'Okazje':'Opportunities','po filtrach':'after filters','Najlepszy zysk':'Best profit','srebra / szt.':'silver / unit','Najlepszy ROI':'Best ROI','po opłatach':'after fees','Przeskanowano':'Scanned','przedmiotów':'items','Średnia świeżość':'Average freshness','starsza z dwóch cen':'older of the two prices','Śr. confidence':'Avg. confidence','jakość sygnału 0–100':'signal quality 0–100',
  'Portfel rekomendowany':'Recommended portfolio','Dobór pozycji według budżetu, płynności, koncentracji, Confidence i Opportunity Score.':'Position selection based on budget, liquidity, concentration, Confidence and Opportunity Score.','Nie zbudowano portfela.':'Portfolio not built.','Budżet':'Budget','Kapitał użyty':'Capital used','Wolne środki':'Free funds','Zysk nominalny':'Nominal profit','Zysk modelowy':'Model profit','ROI modelowy':'Model ROI',
  'Przedmiot':'Item','Trasa / model':'Route / model','Szt.':'Units','Kapitał':'Capital','Confidence':'Confidence','Priorytet':'Priority','Dlaczego':'Why','Najpierw wykonaj skan, a następnie zbuduj portfel.':'Run a scan first, then build a portfolio.','Model dywersyfikuje kapitał między przedmioty i trasy. Wyniki są estymacją, nie gwarancją dostępności zleceń ani realizacji sprzedaży.':'The model diversifies capital across items and routes. Results are estimates, not guarantees of order availability or sale execution.',
  'Sortuj: Opportunity Score':'Sort: Opportunity Score','Zysk ważony pewnością':'Confidence-weighted profit','Zysk':'Profit','Świeżość':'Freshness','Cena zakupu':'Buy price','Wolumen':'Volume','Płynność':'Liquidity','Model Profit/day':'Model Profit/day','Czas wyjścia':'Exit time','Safe / Normal / Aggressive':'Safe / Normal / Aggressive','★ Obserwowane':'★ Watched','Eksport CSV':'Export CSV','Model':'Model','Trasa':'Route','Kupno':'Buy','Sprzedaż':'Sell','Zysk netto':'Net profit','Zysk ważony':'Weighted profit','Wiek':'Age','Opportunity':'Opportunity','Ocena':'Rating','Uruchom skan, aby wyszukać okazje między marketami Europy.':'Run a scan to find opportunities across European markets.',
  'Szczegóły':'Details','Zamknij':'Close','Powtarzalność':'Persistence','Płynność':'Liquidity','Zmienność':'Volatility','Zgodność z historią':'History plausibility',
  'wysoka pewność':'high confidence','dobry confidence':'good confidence','wysoki Opportunity':'high Opportunity','zakup poniżej mediany':'buy below median','dobra płynność':'good liquidity','anomalia':'anomaly','wysokie ryzyko':'high risk','stara cena':'stale price','dobry sygnał':'good signal','zweryfikuj':'verify',
  'brak istotnych ostrzeżeń modelu.':'no material model warnings.','Ryzyka:':'Risks:','Portfel v5.2.3:':'Portfolio v5.2.3:','skrzyżowane notowania — możliwa różnica czasu aktualizacji':'crossed quotes — timestamps may be out of sync','cena blisko limitu świeżości':'price near the freshness limit','duży spread na rynku docelowym':'large spread in destination market','cena zakupu ekstremalnie poniżej bieżącej mediany miast — sprawdź świeżość':'buy price extremely below the current city median — verify freshness','cena zakupu ekstremalnie poniżej 30-dniowej mediany — możliwy stary rekord':'buy price extremely below the 30-day median — possibly stale record','buy order znacznie powyżej historycznej ceny sprzedaży — wysoka szansa nieaktualnego sygnału':'buy order far above historical sell price — high chance of a stale signal','niski historyczny obrót':'low historical volume','wysoka zmienność ceny':'high price volatility','Polski':'Polish',
  'Warunki skanu':'Scan conditions','v5.2.3 zapisuje szeroki zestaw kandydatów z dodatnim zyskiem. ROI, Confidence, świeżość, wolumen i płynność nie kasują już sygnału podczas skanu — ustawiasz je niżej jako filtry wyników lub kryteria sortowania.':'v5.2.3 keeps a broad set of positive-profit candidates. ROI, Confidence, freshness, volume and liquidity no longer delete a signal during scanning — use them below as result filters or sorting criteria.',
  'Filtry wyników — nie wpływają na pobieranie API':'Result filters — do not affect API fetching','Wszystkie dodatnie':'All positive','Polecane':'Recommended','Świeże':'Fresh','Płynne':'Liquid','Wysoka marża':'High margin','Filtruj: obie ceny w limicie wieku':'Filter: both prices within age limit','Skan zachowuje wszystkie dodatnie kandydaty. Te pola tylko zawężają tabelę. Użyj „Wszystkie dodatnie”, aby natychmiast wrócić do pełnej listy.':'The scan keeps all positive-profit candidates. These fields only narrow the table. Use “All positive” to instantly return to the full list.',
  'Market Intelligence • Europe • AODP API • Cena × Wolumen • Volume 1/3/7/14/30d • Portfolio Optimizer • PL/EN • IndexedDB • GitHub Pages / PWA':'Market Intelligence • Europe • AODP API • Price × Volume • Volume 1/3/7/14/30d • Portfolio Optimizer • PL/EN • IndexedDB • GitHub Pages / PWA',
  'Analiza wolumenu':'Volume analysis','Szybka — bez wolumenu':'Fast — no volume','Standard — top 30 wg ceny':'Standard — top 30 by price','Dokładna — top 50 wg ceny':'Detailed — top 50 by price','Głęboka — top 80 wg ceny':'Deep — top 80 by price',
  'v5.2.3 wykrywa okazje na podstawie dwóch rzeczy: dodatniej różnicy ceny po opłatach oraz wolumenu. Pozostałe wskaźniki są tylko informacją i sortowaniem.':'v5.2.3 detects opportunities using two things: positive net price difference after fees and volume. Other indicators are informational and sortable only.',
  'Horyzont wolumenu portfela':'Portfolio volume horizon','Liczba sztuk jest estymacją opartą głównie na wolumenie historycznym. Publiczne AODP nie udostępnia pełnej głębokości aktualnego order booka, dlatego większe pozycje wymagają weryfikacji w grze.':'Unit count is estimated mainly from historical volume. Public AODP does not expose the full current order-book depth, so larger positions should be verified in-game.',
  'Dobór pozycji głównie według ceny, wolumenu, budżetu i koncentracji. Confidence pozostaje informacją pomocniczą.':'Position selection is based mainly on price, volume, budget and concentration. Confidence remains auxiliary information.',
  'Zysk skorygowany (info)':'Adjusted profit (info)','ROI portfela':'Portfolio ROI',
  'Filtry podstawowe: cena + wolumen':'Basic filters: price + volume','Tylko z wolumenem':'With volume only','Aktywny handel':'Active trading','Wyższa cena':'Higher price','Min. zysk netto / szt. (cena)':'Min. net profit / unit (price)',
  'Tylko te dwa pola filtrują okazje. ROI, Confidence, świeżość, Liquidity Score i czas wyjścia są nadal liczone i można po nich sortować, ale nie usuwają wyników.':'Only these two fields filter opportunities. ROI, Confidence, freshness, Liquidity Score and exit time are still calculated and sortable, but do not remove results.',
  'Sortuj: Cena × wolumen':'Sort: Price × volume','Cena×Vol':'Price×Vol','Profit/day':'Profit/day','Przelicz wolumen':'Recalculate volume'
};
Object.assign(TEXT_PAIRS,{
  'Albion Europe Market Scanner v5.2.4 — Cena i Wolumen':'Albion Europe Market Scanner v5.2.4 — Price & Volume',
  'Europe • AODP API • ceny kupna/sprzedaży • wolumen 7/30 dni • PL/EN • IndexedDB • GitHub Pages / PWA':'Europe • AODP API • buy/sell prices • 7/30-day volume • PL/EN • IndexedDB • GitHub Pages / PWA',
  'Skanuj ceny i wolumen':'Scan prices and volume','Odśwież wolumen':'Refresh volume',
  'Warunki skanu':'Scan rules','Skaner pokazuje każdą trasę z dodatnim zyskiem netto. Do filtrowania wyników służą wyłącznie minimalny zysk i minimalny wolumen.':'The scanner shows every route with positive net profit. Only minimum profit and minimum volume filter the results.',
  'Filtry: tylko cena i wolumen':'Filters: price and volume only','Min. zysk netto / szt. (cena)':'Min. net profit / unit (price)',
  'Żadne dodatkowe score, Confidence, ROI ani świeżość nie usuwają wyników. Cena i wolumen są jedynymi kryteriami.':'No additional score, Confidence, ROI or freshness removes results. Price and volume are the only criteria.',
  'Największy wolumen':'Highest volume','Najlepszy obrót zysku':'Best profit throughput','zysk × wolumen / dzień':'profit × volume / day','Rekordy z wolumenem':'Routes with volume','okazji z historią':'routes with history',
  'Tryb':'Mode','Kup w':'Buy in','Cena kupna':'Buy price','Sprzedaj w':'Sell in','Cena sprzedaży':'Sell price','Zysk netto / szt.':'Net profit / unit','Vol. zakup / d':'Buy vol / day','Vol. sprzedaż / d':'Sell vol / day','Wolumen handlowy / d':'Trade volume / day','Wolumen 7 dni':'7-day volume','Wolumen 30 dni':'30-day volume','Zysk × wolumen / d':'Profit × volume / day',
  'Sortuj: Zysk × wolumen':'Sort: Profit × volume','Zysk / szt.':'Profit / unit','Najniższa cena zakupu':'Lowest buy price','Najwyższa cena sprzedaży':'Highest sell price',
  'Do buy orderu':'To buy order','Wystaw sell order':'List sell order','Szczegóły':'Details','Zysk po opłatach':'Profit after fees','szt.':'unit',
  'Wolumen pochodzi z historycznych sell orders AODP. Dla sprzedaży do buy orderu wolumen rynku docelowego jest wskaźnikiem aktywności rynku, a nie głębokością konkretnego buy orderu.':'Volume comes from historical AODP sell orders. For sales into a buy order, destination volume is a market-activity indicator, not the depth of that specific buy order.'
});
const EN_TO_PL = Object.fromEntries(Object.entries(TEXT_PAIRS).map(([pl,en])=>[en,pl]));
function translateKnownText(s){if(s==null)return s;const str=String(s);if(state.lang==='en')return TEXT_PAIRS[str]||str;return EN_TO_PL[str]||str;}
function translateTextNodes(root=document.body){
  const map=state.lang==='en'?TEXT_PAIRS:EN_TO_PL,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){const raw=n.nodeValue,trim=raw.trim();if(trim&&map[trim])n.nodeValue=raw.replace(trim,map[trim]);}
}
function translateDynamic(s){
  if(s==null)return s;let str=String(s);const exact=translateKnownText(str);if(exact!==str)return exact;
  const parts=str.split(' • ');if(parts.length>1)return parts.map(translateDynamic).join(' • ');
  let m=str.match(/^limit płynności (\d+) szt\.$/);if(m)return state.lang==='en'?`liquidity cap ${m[1]} units`:str;
  m=str.match(/^liquidity cap (\d+) units$/);if(m)return state.lang==='pl'?`limit płynności ${m[1]} szt.`:str;
  return str;
}
function applyLanguage(lang,persist=true){
  state.lang=lang==='en'?'en':'pl';document.documentElement.lang=state.lang;if(el('languageSelect'))el('languageSelect').value=state.lang;
  document.title=state.lang==='en'?'Albion Europe Market Scanner v5.2.4 — Price & Volume':'Albion Europe Market Scanner v5.2.4 — Cena i Wolumen';
  if(el('itemQuery'))el('itemQuery').placeholder=tr('np. Bag, T6_BAG, peleryna…','e.g. Bag, T6_BAG, cape…');
  if(el('resultSearch'))el('resultSearch').placeholder=tr('Filtruj wyniki po nazwie, ID lub mieście…','Filter results by name, ID or city…');
  const catSelection=selectedCategories();renderCategories(catSelection);translateTextNodes(document.body);updateCategorySummary();render();if(db)updateDbInfo().catch(()=>{});if(persist&&db)queueSaveSettings();
}

const CATEGORY_GROUPS = [
  {id:'armor',pl:'Zbroje',en:'Armor',children:[['head','Hełmy','Helmets'],['chest','Pancerze','Chest armor'],['shoes','Buty','Shoes']]},
  {id:'accessories',pl:'Ekwipunek dodatkowy',en:'Accessories',children:[['bags','Torby','Bags'],['capes','Peleryny','Capes'],['mounts','Wierzchowce','Mounts']]},
  {id:'resources',pl:'Surowce',en:'Resources',children:[['rawResources','Surowce podstawowe','Raw resources'],['refinedResources','Surowce przetworzone','Refined resources']]},
  {id:'consumables',pl:'Konsumowalne',en:'Consumables',children:[['food','Jedzenie','Food'],['potions','Mikstury','Potions']]},
  {id:'gathering',pl:'Zbieractwo',en:'Gathering',children:[['gatheringGear','Ubrania zbierackie','Gathering gear'],['tools','Narzędzia','Tools']]},
  {id:'special',pl:'Pozostałe grupy',en:'Other groups',children:[['artifacts','Artefakty','Artifacts'],['journals','Dzienniki','Journals'],['fishing','Ryby i wędkarstwo','Fish & fishing'],['farming','Rolnictwo','Farming'],['luxury','Dobra luksusowe','Luxury goods'],['other','Inne','Other']]}
];
const CATEGORY_LEAVES = CATEGORY_GROUPS.flatMap(g=>g.children.map(c=>c[0]));
const EQUIPMENT_CATEGORIES = new Set(['head','chest','shoes','bags','capes','gatheringGear']);
function categoryLabel(id){for(const g of CATEGORY_GROUPS)for(const c of g.children)if(c[0]===id)return state.lang==='en'?c[2]:c[1];return id;}
function categoryForItem(id){
  const base=String(id).split('@')[0];
  if(/_GATHERER_/.test(base))return'gatheringGear';
  if(/_MOUNT_/.test(base))return'mounts';
  if(/_TOOL_/.test(base))return'tools';
  if(/_(?:ARTEFACT|ARTIFACT)_/.test(base))return'artifacts';
  if(/_JOURNAL_/.test(base))return'journals';
  if(/_LUXURY/.test(base))return'luxury';
  if(/(?:^|_)FISH(?:_|$)|_FISHING_/.test(base))return'fishing';
  if(/_(?:SEED|FARM|CROP|HERB|BABY|EGG)(?:_|$)/.test(base))return'farming';
  if(/^T[2-8]_(?:ORE|WOOD|FIBER|HIDE|ROCK)(?:_|$)/.test(base))return'rawResources';
  if(/^T[2-8]_(?:METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_|$)/.test(base))return'refinedResources';
  if(/_(?:MEAL|FOOD)(?:_|$)/.test(base))return'food';
  if(/_POTION(?:_|$)/.test(base))return'potions';
  if(/_HEAD_/.test(base))return'head';
  if(/_ARMOR_/.test(base))return'chest';
  if(/_SHOES_/.test(base))return'shoes';
  if(/_(?:MAIN|2H)_/.test(base))return'weapons';
  if(/_OFF_/.test(base))return'offhands';
  if(/_BAG(?:_|$)/.test(base))return'bags';
  if(/^T[2-8]_CAPE/.test(base)||/_CAPE(?:_|$)/.test(base))return'capes';
  return'other';
}
function selectedCategories(){return [...document.querySelectorAll('.categoryLeafCheck:checked')].map(x=>x.value);}
function setSelectedCategories(ids){const set=new Set(ids||[]);document.querySelectorAll('.categoryLeafCheck').forEach(x=>x.checked=set.has(x.value));updateCategoryParents();updateCategorySummary();}
function updateCategoryParents(){for(const g of CATEGORY_GROUPS){const p=document.querySelector(`.categoryGroupCheck[data-group="${g.id}"]`),kids=[...document.querySelectorAll(`.categoryLeafCheck[data-group="${g.id}"]`)];if(!p)continue;const n=kids.filter(x=>x.checked).length;p.checked=n===kids.length;p.indeterminate=n>0&&n<kids.length;}}
function updateCategorySummary(){const sum=el('categorySummary');if(!sum)return;const ids=selectedCategories();if(ids.length===CATEGORY_LEAVES.length)sum.textContent=tr('Wszystkie kategorie','All categories');else if(!ids.length)sum.textContent=tr('Brak kategorii','No categories');else{const labels=ids.slice(0,3).map(categoryLabel);sum.textContent=`${ids.length}/${CATEGORY_LEAVES.length}: ${labels.join(', ')}${ids.length>3?'…':''}`;}}
function renderCategories(selected=null){
  const prior=selected===null?CATEGORY_LEAVES:selected;const initial=new Set(prior);
  el('categories').innerHTML=CATEGORY_GROUPS.map(g=>`<div class="category-group"><label class="category-parent"><input type="checkbox" class="categoryGroupCheck" data-group="${g.id}" checked> <span>${esc(state.lang==='en'?g.en:g.pl)}</span><span class="cat-count" data-group-count="${g.id}"></span></label><div class="category-children">${g.children.map(c=>`<label class="category-leaf"><input type="checkbox" class="categoryLeafCheck" data-group="${g.id}" value="${c[0]}" ${initial.has(c[0])?'checked':''}><span>${esc(state.lang==='en'?c[2]:c[1])}</span><span class="cat-count" data-cat-count="${c[0]}"></span></label>`).join('')}</div></div>`).join('');
  updateCategoryParents();updateCategorySummary();updateCategoryCounts();
}
function updateCategoryCounts(){if(!state.items?.length)return;const counts=Object.fromEntries(CATEGORY_LEAVES.map(x=>[x,0]));for(const it of state.items)counts[categoryForItem(it.id)]++;for(const [id,n] of Object.entries(counts)){const x=document.querySelector(`[data-cat-count="${id}"]`);if(x)x.textContent=fmt(n);}for(const g of CATEGORY_GROUPS){const n=g.children.reduce((a,c)=>a+(counts[c[0]]||0),0),x=document.querySelector(`[data-group-count="${g.id}"]`);if(x)x.textContent=fmt(n);}}
function setItems(items){state.items=items;state.itemById=new Map(items.map(x=>[x.id,x]));updateCategoryCounts();}
function itemDisplayName(item){if(!item)return'';return state.lang==='en'?(item.nameEn||item.name||item.namePl||item.id):(item.namePl||item.name||item.nameEn||item.id);}
function displayItemNameById(id,fallback=''){return itemDisplayName(state.itemById.get(id))||fallback||id;}
function displayOpportunityName(o){return displayItemNameById(o.itemId,state.lang==='en'?(o.itemNameEn||o.itemName):(o.itemNamePl||o.itemName));}

function setProgress(p,text){el('progressBar').style.width=clamp(p)+'%';el('progressText').textContent=text;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function setDbStatus(txt,good=true){el('localDbStatus').textContent=txt;el('localDbStatus').style.color=good?'var(--good)':'var(--bad)';}

function openLocalDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains('items'))d.createObjectStore('items',{keyPath:'id'});
      if(!d.objectStoreNames.contains('prices')){const s=d.createObjectStore('prices',{keyPath:'key'});s.createIndex('item_id','item_id',{unique:false});s.createIndex('city','city',{unique:false});}
      if(!d.objectStoreNames.contains('history'))d.createObjectStore('history',{keyPath:'key'});
      if(!d.objectStoreNames.contains('watchlist'))d.createObjectStore('watchlist',{keyPath:'itemId'});
      if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'key'});
      if(!d.objectStoreNames.contains('opportunities'))d.createObjectStore('opportunities',{keyPath:'key'});
      if(!d.objectStoreNames.contains('scan_runs')){const s=d.createObjectStore('scan_runs',{keyPath:'id',autoIncrement:true});s.createIndex('ts','ts',{unique:false});}
      if(!d.objectStoreNames.contains('market_stats'))d.createObjectStore('market_stats',{keyPath:'key'});
      if(!d.objectStoreNames.contains('portfolios'))d.createObjectStore('portfolios',{keyPath:'key'});
    };
    req.onsuccess=()=>{db=req.result;resolve(db);};req.onerror=()=>reject(req.error);
  });
}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('DB abort'));});}
async function dbPut(store,value){const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);await txDone(tx);}
async function dbPutMany(store,values){if(!values?.length)return;const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store);for(const v of values)s.put(v);await txDone(tx);}
async function dbGet(store,key){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function dbGetAll(store){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
async function dbClear(store){const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();await txDone(tx);}

async function updateDbInfo(){
  if(!db)return;
  const [prices,hist,ops]=await Promise.all(['prices','history','opportunities'].map(dbGetAll));
  const newest=prices.reduce((m,x)=>Math.max(m,x.cachedAt||0),0);
  el('localDbInfo').textContent=state.lang==='en'?`IndexedDB: ${fmt(prices.length)} prices • ${fmt(hist.length)} volume histories • ${fmt(ops.length)} routes${newest?' • cache '+new Date(newest).toLocaleString(locale()):''}.`:`IndexedDB: ${fmt(prices.length)} cen • ${fmt(hist.length)} historii wolumenu • ${fmt(ops.length)} tras${newest?' • cache '+new Date(newest).toLocaleString(locale()):''}.`;
}
async function saveWatch(){await dbClear('watchlist');await dbPutMany('watchlist',[...state.watched].map(itemId=>({itemId})));}
function currentSettings(){
  const ids=['languageSelect','itemQuery','tier','enchant','quality','scanLimit','mode','premium','setupFee','undercut','transport','minProfit','minVolumeDay','excludeSame','autoRefresh','autoStart','useCache'];
  const v={};for(const id of ids){const x=el(id);if(x)v[id]=x.type==='checkbox'?x.checked:x.value;}
  v.markets=selectedMarkets();v.categories=selectedCategories();v._uiSchema=4;return v;
}
async function saveSettings(){if(!db)return;await dbPut('settings',{key:'ui',value:currentSettings(),savedAt:now()});scheduleAuto();}
async function loadSettings(){
  const rec=await dbGet('settings','ui');if(!rec?.value)return;
  const v={...rec.value};
  // v5.2.4: only price + volume are result criteria.
  if((+v._uiSchema||1)<4){Object.assign(v,{minProfit:'0',minVolumeDay:'0',quality:'all',_uiSchema:4});}
  for(const [id,val] of Object.entries(v)){const x=el(id);if(!x||id==='markets'||id==='categories'||id==='_uiSchema')continue;if(x.type==='checkbox')x.checked=!!val;else x.value=String(val);}
  if(Array.isArray(v.markets)){const set=new Set(v.markets);document.querySelectorAll('.marketCheck').forEach(x=>x.checked=set.has(x.value));}
  if(Array.isArray(v.categories))setSelectedCategories(v.categories);
  applyLanguage(v.languageSelect||'pl',false);
}
function queueSaveSettings(){clearTimeout(settingsTimer);settingsTimer=setTimeout(()=>saveSettings().catch(()=>{}),350);}

function renderMarkets(){el('markets').innerHTML=MARKETS.map((m,i)=>`<label class="check"><input type="checkbox" class="marketCheck" value="${esc(m.api)}" ${i<7?'checked':''}> ${esc(m.label)}</label>`).join('');}
function selectedMarkets(){return [...document.querySelectorAll('.marketCheck:checked')].map(x=>x.value);}
function normalizeItem(x){const id=x.UniqueName||x.uniqueName||x.unique_name||x.item_id||x.id;if(!id)return null;const names=x.LocalizedNames||x.localizedNames||x.localized_names||{};const namePl=names['PL-PL']||names['pl-PL']||null,nameEn=names['EN-US']||names['en-US']||x.LocalizedName||x.name||null,name=namePl||nameEn||id;return{id:String(id),name:String(name),namePl:String(namePl||nameEn||id),nameEn:String(nameEn||namePl||id),index:x.Index??x.index??null};}
function isLikelyTradeable(id){if(!/^T[2-8]_/.test(id))return false;const bad=['QUESTITEM','UNIQUE','TOKEN','SKILLBOOK','JOURNAL_EMPTY','FURNITURE_','MOBDROP_','TREASURE_','FACTION_','CRYSTAL_','DEBUG','NONTRADABLE'];return !bad.some(k=>id.includes(k));}
async function fetchJson(url,timeout=18000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}}
async function loadItems(){
  let lastErr=null;const meta=await dbGet('settings','items_meta'),cached=await dbGetAll('items');
  if(cached.length&&cached.some(x=>x.nameEn)&&meta?.fetchedAt&&now()-meta.fetchedAt<7*864e5){setItems(cached);el('dbStatus').textContent=fmt(cached.length);return;}
  for(const url of ITEMS_URLS){try{const j=await fetchJson(url,25000),arr=Array.isArray(j)?j:(j.items||Object.values(j));let items=arr.map(normalizeItem).filter(Boolean).filter(x=>isLikelyTradeable(x.id));items=[...new Map(items.map(x=>[x.id,x])).values()];setItems(items);await dbClear('items');await dbPutMany('items',items);await dbPut('settings',{key:'items_meta',fetchedAt:now(),source:url});el('dbStatus').textContent=fmt(items.length);return;}catch(e){lastErr=e;}}
  if(cached.length){setItems(cached);el('dbStatus').textContent=fmt(cached.length);return;}throw lastErr||new Error('Nie udało się pobrać bazy przedmiotów');
}
async function pingApi(){try{await fetchJson(`${API}/api/v2/stats/prices/T4_BAG.json?locations=Caerleon&qualities=1`,9000);state.lastApiOk=true;el('apiStatus').textContent='online';el('apiStatus').style.color='var(--good)';return true;}catch{state.lastApiOk=false;el('apiStatus').textContent=navigator.onLine?'błąd/CORS':'offline';el('apiStatus').style.color='var(--bad)';return false;}}
function itemTierEnchant(id){const base=String(id).split('@')[0],t=+( /^T(\d)_/.exec(base)?.[1]||0),e=String(id).includes('@')?+(String(id).split('@').pop()||0):0;return{tier:t,enchant:e};}
function liquidItemPriority(id){
  const {tier,enchant}=itemTierEnchant(id),tierScore=({4:8,5:10,6:11,7:8,8:6})[tier]||0,enchScore=({0:9,1:7,2:5,3:3,4:1})[enchant]||0;
  let cat=0;if(/_(ORE|WOOD|HIDE|FIBER|ROCK|METALBAR|PLANKS|LEATHER|CLOTH|STONEBLOCK)/.test(id))cat=7;else if(/_(MEAL|FOOD|POTION)/.test(id))cat=6;else if(/_(BAG|CAPE)/.test(id))cat=5;else if(/_(MAIN_|2H_|ARMOR_|HEAD_|SHOES_|OFF_)/.test(id))cat=4;else if(/MOUNT/.test(id))cat=3;
  return tierScore+enchScore+cat;
}
function balancedItemTake(items,limit){
  const tierOrder={6:0,5:1,4:2,7:3,8:4};
  const buckets=new Map();
  for(const it of items){const te=itemTierEnchant(it.id),cat=categoryForItem(it.id),key=`${cat}|${te.tier}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(it);}
  for(const arr of buckets.values())arr.sort((a,b)=>liquidItemPriority(b.id)-liquidItemPriority(a.id)||a.id.localeCompare(b.id));
  const keys=[...buckets.keys()].sort((a,b)=>{const [ca,ta]=a.split('|'),[cb,tb]=b.split('|');const ti=(tierOrder[+ta]??9)-(tierOrder[+tb]??9);return ti||ca.localeCompare(cb);});
  const out=[];let moved=true;
  while(out.length<limit&&moved){moved=false;for(const k of keys){const arr=buckets.get(k);if(arr?.length){out.push(arr.shift());moved=true;if(out.length>=limit)break;}}}
  return out;
}
function buildItemSelection(){
  const q=el('itemQuery').value.trim().toLowerCase(),tier=el('tier').value,ench=el('enchant').value,limit=clamp(+el('scanLimit').value||500,10,2500),cats=new Set(selectedCategories());if(!cats.size)return[];
  let a=state.items.filter(it=>{const id=it.id,{tier:t,enchant:e}=itemTierEnchant(id);if(t<4||t>8)return false;if(tier!=='all'&&String(t)!==tier)return false;if(ench!=='all'&&String(e)!==ench)return false;if(!cats.has(categoryForItem(id)))return false;const names=[it.name,it.namePl,it.nameEn,id].filter(Boolean).map(x=>String(x).toLowerCase());if(q&&!names.some(x=>x.includes(q)))return false;return true;});
  if(q){a.sort((x,y)=>liquidItemPriority(y.id)-liquidItemPriority(x.id)||x.id.localeCompare(y.id));return a.slice(0,limit);}
  return balancedItemTake(a,limit);
}
function batchesByUrl(items,locations,qualities){const out=[];let batch=[];const fixed=`${API}/api/v2/stats/prices/.json?locations=${encodeURIComponent(locations.join(','))}&qualities=${encodeURIComponent(qualities.join(','))}`;for(const it of items){const test=[...batch,it.id],len=fixed.length+encodeURIComponent(test.join(',')).length;if(len>3400&&batch.length){out.push(batch);batch=[it];}else batch=test;}if(batch.length)out.push(batch);return out;}
function normalizePriceRow(r,source='api'){return {...r,item_id:String(r.item_id),city:String(r.city),quality:+r.quality||1,sell_price_min:+r.sell_price_min||0,buy_price_max:+r.buy_price_max||0,key:dbKeyPrice(r),cachedAt:now(),_source:source};}
async function persistPriceRows(rows){const normalized=rows.map(r=>normalizePriceRow(r,'api'));await dbPutMany('prices',normalized);return normalized;}
async function cachedRowsFor(items,markets,qualities){const ids=new Set(items.map(x=>x.id)),ms=new Set(markets),qs=new Set(qualities.map(Number)),all=await dbGetAll('prices');return all.filter(r=>ids.has(r.item_id)&&ms.has(r.city)&&qs.has(+r.quality)).map(r=>({...r,_source:'cache'}));}
function mergeRows(fresh,cached){const m=new Map();for(const r of cached||[])m.set(dbKeyPrice(r),r);for(const r of fresh||[])m.set(dbKeyPrice(r),r);return [...m.values()];}

async function updateMarketStats(freshRows){
  const all=await dbGetAll('market_stats'),map=new Map(all.map(x=>[x.key,x]));
  for(const r of freshRows){
    const key=statKey(r.item_id,r.city,+r.quality||1),s=map.get(key)||{key,itemId:r.item_id,city:r.city,quality:+r.quality||1,firstSeen:now(),sellUpdates:0,buyUpdates:0,sellChangeCount:0,buyChangeCount:0};
    const updateSide=(side,price,date)=>{
      if(!(price>0)||!date)return;
      const lastDate=s[`last${side}Date`],lastPrice=s[`last${side}Price`];
      if(lastDate!==date){
        s[`${side.toLowerCase()}Updates`]=(s[`${side.toLowerCase()}Updates`]||0)+1;
        if(lastPrice>0&&lastPrice!==price)s[`${side.toLowerCase()}ChangeCount`]=(s[`${side.toLowerCase()}ChangeCount`]||0)+1;
        const emaKey=`${side.toLowerCase()}Ema`,devKey=`${side.toLowerCase()}DevEma`,prev=s[emaKey];
        if(Number.isFinite(prev)){const alpha=.22,d=Math.abs(price-prev)/Math.max(1,prev);s[devKey]=Number.isFinite(s[devKey])?(.78*s[devKey]+.22*d):d;s[emaKey]=.78*prev+.22*price;}else{s[emaKey]=price;s[devKey]=0;}
        s[`last${side}Date`]=date;s[`last${side}Price`]=price;s.lastObservedAt=now();
      }
    };
    updateSide('Sell',+r.sell_price_min,r.sell_price_min_date);
    updateSide('Buy',+r.buy_price_max,r.buy_price_max_date);
    s.scanSeen=(s.scanSeen||0)+1;s.lastScanAt=now();map.set(key,s);
  }
  state.marketStats=map;await dbPutMany('market_stats',[...map.values()]);
}
function statsFor(itemId,city,q){return state.marketStats.get(statKey(itemId,city,q));}
function persistenceScore(stat,side){
  if(!stat)return 28;
  const u=stat[`${side}Updates`]||0,c=stat[`${side}ChangeCount`]||0,dev=stat[`${side}DevEma`]||0,seen=Math.max(1,stat.scanSeen||1);
  const updateRatio=clamp(u/seen,0,1),updateScore=clamp(15+60*updateRatio+8*Math.log1p(u));
  const changeRatio=u?c/u:0,changeHealth=clamp(72-90*Math.max(0,changeRatio-.35));
  const stability=clamp(100-dev*350);
  const recencyH=stat.lastObservedAt?Math.max(0,(now()-stat.lastObservedAt)/36e5):168,recency=100*Math.pow(.5,recencyH/48);
  return clamp(.40*updateScore+.20*changeHealth+.25*stability+.15*recency);
}
function spreadScore(r){
  const ask=+r.sell_price_min,bid=+r.buy_price_max;if(!(ask>0&&bid>0))return 38;
  const mid=(ask+bid)/2,spread=(ask-bid)/Math.max(1,mid)*100;
  if(spread<0)return clamp(20+spread*3);
  return clamp(100-spread*2.6);
}
function freshnessScore(a,b,halfLife){
  if(!Number.isFinite(a)||!Number.isFinite(b))return 0;const sa=100*Math.pow(.5,a/halfLife),sb=100*Math.pow(.5,b/halfLife);return clamp(Math.min(sa,sb)*.65+Math.sqrt(sa*sb)*.35);
}
function profitScore(profit,roi){const r=100*(1-Math.exp(-Math.max(0,roi)/24)),p=100*(1-Math.exp(-Math.max(0,profit)/60000));return clamp(.58*r+.42*p);}
function baseConfidence(b,d,mode,cfg){
  const prof=PROFILE[cfg.riskProfile]||PROFILE.balanced,ageA=ageHours(b.sell_price_min_date),destDate=mode==='instant'?d.buy_price_max_date:d.sell_price_min_date,ageB=ageHours(destDate),fresh=freshnessScore(ageA,ageB,prof.freshHalfLife),spr=.5*spreadScore(b)+.5*spreadScore(d),persA=persistenceScore(statsFor(b.item_id,b.city,+b.quality),'sell'),persB=persistenceScore(statsFor(d.item_id,d.city,+d.quality),mode==='instant'?'buy':'sell'),persistence=(persA+persB)/2;
  let dataQuality=(b._source==='cache'||d._source==='cache')?48:82,warnings=[];
  const crossedSrc=+b.buy_price_max>0&&+b.buy_price_max>+b.sell_price_min, crossedDst=+d.sell_price_min>0&&+d.buy_price_max>+d.sell_price_min,crossed=crossedSrc||crossedDst;
  if(crossed)warnings.push('skrzyżowane notowania — możliwa różnica czasu aktualizacji');
  if(ageA>cfg.maxAge*.75||ageB>cfg.maxAge*.75)warnings.push('cena blisko limitu świeżości');
  if(spreadScore(d)<35)warnings.push('duży spread na rynku docelowym');
  let confidence=.45*fresh+.22*spr+.20*persistence+.13*clamp(dataQuality);
  if(crossed)confidence-=prof.crossedPenalty;
  confidence=clamp(confidence);
  return{confidence,components:{freshness:fresh,spread:spr,persistence,dataQuality:clamp(dataQuality),liquidity:null,volatility:null,historyPlausibility:null,value:null},warnings,age:Math.max(ageA,ageB),crossed};
}
function cfgFromUI(){return{minProfit:+el('minProfit')?.value||0,minVolumeDay:+el('minVolumeDay')?.value||0,excludeSame:!!el('excludeSame')?.checked,tax:el('premium').value==='yes'?4:8,setup:+el('setupFee').value||0,undercut:+el('undercut').value||0,transport:+el('transport').value||0,riskProfile:'balanced',maxAge:72};}
function portfolioCfg(){return{budget:Math.max(0,+el('portfolioBudget').value||0),reservePct:clamp(+el('portfolioReservePct').value||0,0,90),maxItemPct:clamp(+el('portfolioMaxItemPct').value||20,1,100),maxRoutePct:clamp(+el('portfolioMaxRoutePct').value||40,1,100),maxPositions:clamp(+el('portfolioMaxPositions').value||12,1,50),maxUnits:clamp(+el('portfolioMaxUnits').value||25,1,500),liquidityDays:Math.max(.1,+el('portfolioLiquidityDays').value||1),riskProfile:el('riskProfile').value||'balanced'};}
function modelLabel(o){if(o.dest==='Black Market')return'Black Market';if(o.mode==='instant')return'Instant arbitrage';if(o.history?.sourceDiscount>=12)return'Mean reversion';if((o.cityDiscount||0)>=12)return'City gap';return'Relist spread';}
function recalcScore(o,cfg){
  const pScore=profitScore(o.profit,o.roi),vDaily=Math.max(0,o.volume?.effectiveDaily||0),vScore=o.volume?volumeScale(vDaily):0;
  o.priceScore=pScore;o.volumeScore=vScore;
  o.riskProfit=Math.max(0,o.profit)*clamp(o.confidence||0,0,100)/100; // informational only
  // Core ranking = price + volume. Confidence/freshness/liquidity are not selection criteria.
  o.score=o.volume?clamp(.58*pScore+.42*vScore):clamp(.72*pScore);
  o.priceVolumeScore=o.score;
  o.model=modelLabel(o);return o;
}
function calcMode(rowsByItem,itemMap,mode,cfg,diag){
  const result=[],md=diag.modes[mode]={items:0,qualities:0,pairs:0,rejectSame:0,rejectNonPositive:0,acceptedPairs:0,signals:0};
  for(const [itemId,rows] of rowsByItem){
    md.items++;
    const byQ=new Map();for(const r of rows){const q=+r.quality||1;if(!byQ.has(q))byQ.set(q,[]);byQ.get(q).push(r);}
    for(const qRows of byQ.values()){
      md.qualities++;
      // Audit fix v5.2.4: do not mix Normal..Masterpiece when calculating the city median.
      const cityAsks=qRows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>+r.sell_price_min),cityMedian=median(cityAsks);
      // Broad scan: every valid ask is a buy candidate. Price thresholds are applied later in filteredResults().
      const buys=qRows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>({...r,_ageSell:ageHours(r.sell_price_min_date)}));
      const destinations=mode==='instant'?qRows.filter(r=>+r.buy_price_max>0).map(r=>({...r,_destPrice:+r.buy_price_max,_destAge:ageHours(r.buy_price_max_date),_destDate:r.buy_price_max_date})):qRows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>({...r,_destPrice:+r.sell_price_min*(1-cfg.undercut/100),_destAge:ageHours(r.sell_price_min_date),_destDate:r.sell_price_min_date}));
      for(const b of buys){for(const d of destinations){
        md.pairs++;
        if(cfg.excludeSame&&b.city===d.city){md.rejectSame++;continue;}
        const buy=Math.round(+b.sell_price_min),gross=mode==='relist'?Math.max(1,Math.floor(+d._destPrice)):Math.round(+d._destPrice);if(!(buy>0&&gross>0))continue;
        const tax=Math.ceil(gross*cfg.tax/100),setup=mode==='relist'?Math.ceil(gross*cfg.setup/100):0,fees=tax+setup,capitalPerUnit=buy+cfg.transport+setup,profit=gross-fees-buy-cfg.transport,roi=profit/Math.max(1,capitalPerUnit)*100;
        // Only a non-positive net result is discarded. ROI/profit/freshness/confidence are soft result filters now.
        if(!(profit>0)){md.rejectNonPositive++;continue;}
        const base=baseConfidence(b,d,mode,cfg),item=itemMap.get(itemId)||{id:itemId,name:itemId,namePl:itemId,nameEn:itemId};
        const cityDiscount=Number.isFinite(cityMedian)&&cityMedian>0?(1-buy/cityMedian)*100:0,cityValue=Number.isFinite(cityMedian)&&cityMedian>0?sourceValueScore(buy,{median:cityMedian}):50;base.components.value=cityValue;
        if(cityDiscount>65)base.warnings.push('cena zakupu ekstremalnie poniżej bieżącej mediany miast — sprawdź świeżość');
        const o={schemaVersion:10,key:`${itemId}|${b.quality}|${b.city}|${d.city}|${mode}`,itemId,itemName:itemDisplayName(item),itemNamePl:item.namePl||item.name,itemNameEn:item.nameEn||item.name,quality:+b.quality,source:b.city,dest:d.city,buy,sell:gross,profit,roi,fees,taxFee:tax,setupFee:setup,transportCost:cfg.transport,capitalPerUnit,sourceDate:b.sell_price_min_date,destDate:d._destDate,age:base.age,confidence:base.confidence,components:base.components,warnings:base.warnings,cityMedian,cityDiscount,mode,history:null,calculatedAt:now(),sourceRow:b,destRow:d};
        recalcScore(o,cfg);result.push(o);md.acceptedPairs++;
      }}
    }
  }
  // v5.2.4: keep every positive route. Filtering is only price + volume in the result table.
  result.sort((a,b)=>(b.profit||0)-(a.profit||0));
  md.signals=result.length;return result;
}
function calcOpportunities(rowsByItem,itemMap,mode,cfg){
  const diag={modes:{},itemsWithRows:rowsByItem.size};
  let out;if(mode==='smart')out=[...calcMode(rowsByItem,itemMap,'instant',cfg,diag),...calcMode(rowsByItem,itemMap,'relist',cfg,diag)];else out=calcMode(rowsByItem,itemMap,mode,cfg,diag);
  state.scanDiagnostics={...(state.scanDiagnostics||{}),...diag};return out;
}
async function saveOpportunities(ops){await dbClear('opportunities');const cleaned=ops.map(({sourceRow,destRow,...o})=>o);await dbPutMany('opportunities',cleaned);}

function parseHistoryTime(v){
  if(v===null||v===undefined||v==='')return NaN;
  if(typeof v==='number'||/^\d+$/.test(String(v))){
    const n=Number(v);if(!Number.isFinite(n))return NaN;
    if(n>6e17)return ((n-621355968000000000)/10000);
    if(n>1e12)return n;
    if(n>1e9)return n*1000;
  }
  const t=parseAodpTime(v);return Number.isFinite(t)?t:NaN;
}
function utcDayKey(ms){const d=new Date(ms);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;}
function historyMetrics(data,windowDays=30){
  const raw=(data||[]).map((x,i)=>({price:+x.avg_price||0,volume:Math.max(0,+x.item_count||0),time:parseHistoryTime(x.timestamp),i})).filter(x=>x.price>0||x.volume>0);
  if(!raw.length)return null;
  const validTimes=raw.filter(x=>Number.isFinite(x.time));
  const todayKey=utcDayKey(now()),dailyMap=new Map();
  if(validTimes.length){
    for(const x of validTimes){const k=utcDayKey(x.time),r=dailyMap.get(k)||{volume:0,priceVol:0,volForPrice:0,prices:[]};r.volume+=x.volume;if(x.price>0){r.prices.push(x.price);if(x.volume>0){r.priceVol+=x.price*x.volume;r.volForPrice+=x.volume;}}dailyMap.set(k,r);}
  }
  const complete=[];
  if(validTimes.length){
    for(let n=1;n<=windowDays;n++){const d=new Date(now()-n*864e5),k=utcDayKey(d.getTime()),r=dailyMap.get(k);complete.push({day:k,volume:r?.volume||0,price:r?(r.volForPrice>0?r.priceVol/r.volForPrice:median(r.prices.filter(Boolean))):NaN});}
  }else{
    const ordered=[...raw].slice(-windowDays).reverse();for(let n=0;n<windowDays;n++){const x=ordered[n];complete.push({day:`fallback-${n}`,volume:x?.volume||0,price:x?.price||NaN});}
  }
  const today=dailyMap.get(todayKey)?.volume||0;
  const win=n=>{const a=complete.slice(0,n),vols=a.map(x=>x.volume),total=vols.reduce((p,c)=>p+c,0),active=vols.filter(v=>v>0).length,avg=total/Math.max(1,n),med=median(vols),activeRatio=active/Math.max(1,n);return{days:n,total,avg,medianDaily:Number.isFinite(med)?med:0,active,activeRatio};};
  const w1=win(1),w3=win(3),w7=win(7),w14=win(14),w30=win(30);
  const prices=raw.filter(x=>x.price>0).map(x=>x.price),volumes=raw.map(x=>x.volume),med=median(prices),avg=mean(prices),mad=median(prices.map(x=>Math.abs(x-med))),robustVol=med>0?(1.4826*mad/med):1,totalVol=w30.total,dailyVol=w30.avg,activeDailyVol=mean(volumes)||0,sumVol=raw.reduce((a,x)=>a+x.volume,0),vwap=sumVol>0?raw.reduce((a,x)=>a+x.price*x.volume,0)/sumVol:avg;
  const regularity=clamp((.65*w30.activeRatio+.35*w7.activeRatio)*100),trendPct=w14.avg>0?(w3.avg/w14.avg-1)*100:0;
  const nz=complete.slice(0,30).map(x=>x.volume),volMean=mean(nz)||0,volSd=Math.sqrt(mean(nz.map(v=>(v-volMean)**2))||0),volumeCv=volMean>0?volSd/volMean:9,stability=clamp(100-volumeCv*32);
  return{median:med,avg,vwap,mad,robustVol,dailyVol,activeDailyVol,totalVol,windowDays,points:raw.length,todayVol:today,volumes:{d1:w1,d3:w3,d7:w7,d14:w14,d30:w30},regularity,trendPct,volumeCv,volumeStability:stability};
}
function volumeScale(avgPerDay){return clamp(100*Math.log10(1+Math.max(0,avgPerDay))/Math.log10(201));}
function liquidityScoreFromMetrics(m){if(!m)return 0;const v=volumeScale(m.volumes?.d7?.avg??m.dailyVol??0),regularity=m.regularity??0,stability=m.volumeStability??0,trend=clamp(50+(m.trendPct||0)*.6);return clamp(.54*v+.28*regularity+.12*stability+.06*trend);}
function effectiveTradeVolume(sm,dm,o){
  const src=sm?.volumes?.d7?.avg??sm?.dailyVol??0,dst=dm?.volumes?.d7?.avg??dm?.dailyVol??0;
  if(o.dest==='Black Market')return src*.55;
  if(o.mode==='instant')return src&&dst?Math.min(src,dst)*.62:(src||dst)*.45;
  return src&&dst?Math.min(src,dst):(src||dst||0);
}
function quantityRecommendations(o,sm,dm){
  const daily=Math.max(0,effectiveTradeVolume(sm,dm,o)),reg=Math.min(sm?.regularity??50,dm?.regularity??sm?.regularity??50)/100;
  const stability=Math.min(sm?.volumeStability??60,dm?.volumeStability??sm?.volumeStability??60)/100;
  const reliability=.55+.25*reg+.20*stability;
  const modeFactor=o.dest==='Black Market'?.45:o.mode==='instant'?.55:1;
  const capacity=daily*modeFactor*reliability;
  const q={safe:Math.floor(capacity*.18),normal:Math.floor(capacity*.38),aggressive:Math.floor(capacity*.70)};
  if(daily>0){q.safe=Math.max(1,q.safe);q.normal=Math.max(q.safe,Math.max(1,q.normal));q.aggressive=Math.max(q.normal,Math.max(1,q.aggressive));}
  q.safe=clamp(q.safe,0,500);q.normal=clamp(q.normal,0,1000);q.aggressive=clamp(q.aggressive,0,2000);q.dailyCapacity=capacity;
  q.exitDaysNormal=q.normal>0&&capacity>0?q.normal/capacity:Infinity;
  return q;
}
function liquidityScore(vol){return clamp(18+21*Math.log10(1+Math.max(0,vol)));}

function volatilityScore(v){return clamp(100-v*260);}
function sourceValueScore(current,m){
  if(!m?.median)return 50;const ratio=current/m.median,discount=(1-ratio)*100;
  if(ratio<.38)return 18;if(ratio<.55)return 45;if(ratio<=1)return clamp(58+discount*1.1);return clamp(58-(ratio-1)*120);
}
function destinationPlausibility(o,m){
  if(!m?.median)return 50;const ratio=o.sell/m.median;
  if(o.mode==='instant'){if(ratio>1.65)return 12;if(ratio>1.35)return 35;if(ratio>.95)return 82;if(ratio>.65)return 95;return 62;}
  if(ratio>1.5)return 18;if(ratio>1.2)return 48;if(ratio>.8)return 92;if(ratio>.5)return 70;return 38;
}
async function historyFor(itemId,city,quality){
  const key=`${itemId}|${city}|${quality}`,cached=await dbGet('history',key);if(cached?.fetchedAt&&cached?.rangeDays>=32&&now()-cached.fetchedAt<4*36e5)return cached.data||[];
  const end=new Date(),start=new Date(now()-32*864e5),ds=d=>d.toISOString().slice(0,10),url=`${API}/api/v2/stats/history/${encodeURIComponent(itemId)}.json?date=${ds(start)}&end_date=${ds(end)}&locations=${encodeURIComponent(city)}&qualities=${quality}&time-scale=24`;
  try{const j=await fetchJson(url,18000),h=(j||[]).find(x=>x.item_id===itemId&&x.location===city&&+x.quality===+quality),data=h?.data||[];await dbPut('history',{key,itemId,city,quality:+quality,data,rangeDays:32,timeScale:24,fetchedAt:now()});return data;}catch{return cached?.data||[];}
}
function volumeHistoryKey(itemId,city,quality){return `${itemId}|${city}|${quality}`;}
function historyItemBatches(itemIds,city,qualities,start,end){
  const out=[];let batch=[];
  const fixed=`${API}/api/v2/stats/history/.json?date=${start}&end_date=${end}&locations=${encodeURIComponent(city)}&qualities=${qualities.join(',')}&time-scale=24`;
  for(const id of itemIds){const test=[...batch,id],len=fixed.length+encodeURIComponent(test.join(',')).length;if(len>3200&&batch.length){out.push(batch);batch=[id];}else batch=test;}
  if(batch.length)out.push(batch);return out;
}
async function loadVolumeHistoriesForOpportunities(ops,qualities,force=false){
  if(!ops?.length)return new Map();
  const wantedByCity=new Map();
  for(const o of ops){
    if(!wantedByCity.has(o.source))wantedByCity.set(o.source,new Set());wantedByCity.get(o.source).add(o.itemId);
    if(o.dest!=='Black Market'){if(!wantedByCity.has(o.dest))wantedByCity.set(o.dest,new Set());wantedByCity.get(o.dest).add(o.itemId);}
  }
  const all=await dbGetAll('history'),cache=new Map(all.map(x=>[x.key,x]));
  const endD=new Date(),startD=new Date(now()-32*864e5),ds=d=>d.toISOString().slice(0,10),startS=ds(startD),endS=ds(endD),jobs=[];
  for(const [city,set] of wantedByCity){
    const stale=[];
    for(const id of set){let needs=force;if(!needs){for(const q of qualities){const c=cache.get(volumeHistoryKey(id,city,q));if(!(c?.fetchedAt&&c?.rangeDays>=32&&now()-c.fetchedAt<4*36e5)){needs=true;break;}}}if(needs)stale.push(id);}
    for(const batch of historyItemBatches(stale,city,qualities,startS,endS))jobs.push({city,batch});
  }
  for(let i=0;i<jobs.length;i++){
    if(state.stop)break;const job=jobs[i],ids=job.batch.join(','),url=`${API}/api/v2/stats/history/${encodeURIComponent(ids).replace(/%2C/g,',')}.json?date=${startS}&end_date=${endS}&locations=${encodeURIComponent(job.city)}&qualities=${qualities.join(',')}&time-scale=24`;
    let rows=[];try{const j=await fetchJson(url,25000);rows=Array.isArray(j)?j:[];}catch{rows=[];}
    const returned=new Map();
    for(const h of rows){const itemId=String(h.item_id||''),city=String(h.location||job.city),q=+h.quality||1;if(!itemId)continue;const rec={key:volumeHistoryKey(itemId,city,q),itemId,city,quality:q,data:Array.isArray(h.data)?h.data:[],rangeDays:32,timeScale:24,fetchedAt:now()};returned.set(rec.key,rec);cache.set(rec.key,rec);}
    const writes=[...returned.values()];
    for(const id of job.batch){for(const q of qualities){const key=volumeHistoryKey(id,job.city,q);if(!returned.has(key)){const rec={key,itemId:id,city:job.city,quality:+q,data:[],rangeDays:32,timeScale:24,fetchedAt:now()};writes.push(rec);cache.set(key,rec);}}}
    await dbPutMany('history',writes);setProgress(76+((i+1)/Math.max(1,jobs.length))*22,state.lang==='en'?`Volume ${i+1}/${jobs.length} • ${job.city}`:`Wolumen ${i+1}/${jobs.length} • ${job.city}`);if(i<jobs.length-1)await sleep(160);
  }
  return cache;
}
function attachSimpleVolume(o,cache){
  const srcRec=cache.get(volumeHistoryKey(o.itemId,o.source,o.quality)),dstRec=o.dest==='Black Market'?null:cache.get(volumeHistoryKey(o.itemId,o.dest,o.quality));
  const sm=historyMetrics(srcRec?.data||[]),dm=historyMetrics(dstRec?.data||[]),buyDay=sm?.volumes?.d7?.avg??0,sellDay=dm?.volumes?.d7?.avg??null;
  const tradeDay=sellDay===null?null:Math.min(buyDay,sellDay),trade7=sellDay===null?null:Math.min(sm?.volumes?.d7?.total??0,dm?.volumes?.d7?.total??0),trade30=sellDay===null?null:Math.min(sm?.volumes?.d30?.total??0,dm?.volumes?.d30?.total??0);
  o.volume={source:sm?.volumes||null,destination:dm?.volumes||null,buyDaily:buyDay,sellDaily:sellDay,effectiveDaily:tradeDay,trade7,trade30,profitVolumeDaily:tradeDay===null?0:Math.max(0,o.profit)*tradeDay};o.profitVolumeDaily=o.volume.profitVolumeDaily;o.history={source:sm,destination:dm,points:srcRec?.data||[],basis:'AODP sell history; historical market activity, not current order-book depth'};return o;
}
async function enrichAllVolume(force=false){
  if(!state.opportunities.length)return;const qualities=el('quality').value==='all'?[1,2,3,4,5]:[+el('quality').value];el('validateBtn').disabled=true;el('validateBtn').innerHTML=`<span class="spinner"></span>${tr('Wolumen…','Volume…')}`;
  try{const cache=await loadVolumeHistoriesForOpportunities(state.opportunities,qualities,force);for(const o of state.opportunities)attachSimpleVolume(o,cache);await saveOpportunities(state.opportunities);render();await updateDbInfo();}finally{el('validateBtn').disabled=false;el('validateBtn').textContent=tr('Odśwież wolumen','Refresh volume');}
}

function crossedFlag(o){const b=o.sourceRow,d=o.destRow;return !!((b&&+b.buy_price_max>0&&+b.sell_price_min>0&&+b.buy_price_max>+b.sell_price_min)||(d&&+d.buy_price_max>0&&+d.sell_price_min>0&&+d.buy_price_max>+d.sell_price_min));}
async function enrichOne(o,cfg){
  const srcData=await historyFor(o.itemId,o.source,o.quality),dstData=o.dest==='Black Market'?[]:await historyFor(o.itemId,o.dest,o.quality),sm=historyMetrics(srcData),dm=historyMetrics(dstData);
  state.history.set(`${o.itemId}|${o.source}|${o.quality}`,srcData);if(dstData.length)state.history.set(`${o.itemId}|${o.dest}|${o.quality}`,dstData);
  const sourceValue=sourceValueScore(o.buy,sm),plaus=destinationPlausibility(o,dm),srcLiq=liquidityScoreFromMetrics(sm),dstLiq=dm?liquidityScoreFromMetrics(dm):srcLiq*.7,liq=o.dest==='Black Market'?srcLiq*.72:(sm&&dm?Math.min(srcLiq,dstLiq):(srcLiq||dstLiq||0)),vol=volatilityScore(dm?.robustVol??sm?.robustVol??.4);
  let historyPlausibility=.55*plaus+.45*sourceValue,warnings=[...(o.warnings||[])],severeAnomaly=false;
  const sourceRatio=sm?.median?o.buy/sm.median:null,destRatio=dm?.median?o.sell/dm.median:null;
  const sourceDiscount=sourceRatio?Math.max(-200,(1-sourceRatio)*100):null;
  if(sourceRatio&&sourceRatio<.38){historyPlausibility-=30;severeAnomaly=true;warnings.push('cena zakupu ekstremalnie poniżej 30-dniowej mediany — możliwy stary rekord');}
  if(o.mode==='instant'&&destRatio&&destRatio>1.65){historyPlausibility-=30;severeAnomaly=true;warnings.push('buy order znacznie powyżej historycznej ceny sprzedaży — wysoka szansa nieaktualnego sygnału');}
  if(liq<35)warnings.push('niski historyczny obrót');if(vol<35)warnings.push('wysoka zmienność ceny');
  const c=o.components||{},fresh=c.freshness??50,spread=c.spread??50,persist=c.persistence??40,dataQ=c.dataQuality??50,prof=PROFILE[cfg.riskProfile]||PROFILE.balanced;
  o.components={...c,liquidity:liq,volatility:vol,historyPlausibility:clamp(historyPlausibility),value:sourceValue};
  let conf=.28*fresh+.14*spread+.14*persist+.08*dataQ+.18*liq+.12*vol+.06*clamp(historyPlausibility);
  if(crossedFlag(o))conf-=prof.crossedPenalty*.45;
  if(severeAnomaly)conf-=prof.anomalyPenalty;
  o.confidence=clamp(conf);
  const qty=quantityRecommendations(o,sm,dm),effectiveDaily=effectiveTradeVolume(sm,dm,o),dailyModelUnits=qty.dailyCapacity||0;
  o.volume={source:sm?.volumes||null,destination:dm?.volumes||null,sourceRegularity:sm?.regularity??0,destinationRegularity:dm?.regularity??null,effectiveDaily,liquidityScore:liq,sourceLiquidity:srcLiq,destinationLiquidity:dstLiq,trendPct:dm?.trendPct??sm?.trendPct??0,qty,profitPerDayNominal:Math.max(0,o.profit)*dailyModelUnits,profitPerDayModel:Math.max(0,o.profit)*dailyModelUnits*clamp(o.confidence||0,0,100)/100,proxy:o.mode==='instant'?'destination sell-history volume is a liquidity proxy, not buy-order depth':null};
  o.history={source:sm,destination:dm,sourceDiscount,destinationRatio:destRatio,points:srcData,basis:'AODP sell history; 30 full-day volume windows; destination history is a valuation/liquidity proxy for instant buy orders'};
  o.warnings=[...new Set(warnings)];recalcScore(o,cfg);return o;
}
async function enrichTop(limit,manual=false){
  const cfg=cfgFromUI(),top=[...state.opportunities].sort((a,b)=>profitScore(b.profit,b.roi)-profitScore(a.profit,a.roi)||(b.profit||0)-(a.profit||0)).slice(0,limit);if(!top.length)return;
  el('validateBtn').disabled=true;el('validateBtn').innerHTML=`<span class="spinner"></span>${tr('Modele…','Models…')}`;
  for(let i=0;i<top.length;i++){if(state.stop)break;await enrichOne(top[i],cfg);setProgress(84+(i+1)/top.length*15,state.lang==='en'?`Volume ${i+1}/${top.length} • 30d history…`:`Wolumen ${i+1}/${top.length} • historia 30d…`);await sleep(170);}
  await saveOpportunities(state.opportunities);el('validateBtn').disabled=false;el('validateBtn').textContent=tr('Przelicz wolumen','Recalculate volume');render();await updateDbInfo();if(manual)setProgress(100,state.lang==='en'?`Recalculated volume for top ${top.length} by price.`:`Przeliczono wolumen dla top ${top.length} wg ceny.`);
}

function diagnosticTotals(){
  const d=state.scanDiagnostics||{},m=Object.values(d.modes||{}),sum=k=>m.reduce((a,x)=>a+(x[k]||0),0);return{pairs:sum('pairs'),same:sum('rejectSame'),nonPositive:sum('rejectNonPositive'),accepted:sum('acceptedPairs'),signals:sum('signals')};
}
function renderScanDiagnostics(){
  const d=state.scanDiagnostics;if(!d||!el('scanDiagnostics'))return;const t=diagnosticTotals(),shown=filteredResults().length;
  const msg=state.lang==='en'?`Selected ${fmt(d.selectedItems||0)} / matching ${fmt(d.matchingItems||0)} • API rows ${fmt(d.apiRows||0)} • item IDs with data ${fmt(d.itemsWithRows||0)} • pairs ${fmt(t.pairs)} • non-positive ${fmt(t.nonPositive)} • positive route candidates ${fmt(t.accepted)} • profitable routes ${fmt(state.opportunities.length)} • shown ${fmt(shown)}`:`Wybrano ${fmt(d.selectedItems||0)} z ${fmt(d.matchingItems||0)} pasujących • rekordy API ${fmt(d.apiRows||0)} • itemy z danymi ${fmt(d.itemsWithRows||0)} • pary ${fmt(t.pairs)} • niedodatnie ${fmt(t.nonPositive)} • dodatnie kandydaty tras ${fmt(t.accepted)} • zyskowne trasy ${fmt(state.opportunities.length)} • pokazane ${fmt(shown)}`;
  el('scanDiagnostics').textContent=msg;
  if(el('kpiItemsMeta'))el('kpiItemsMeta').textContent=state.lang==='en'?`${fmt(d.apiRows||0)} API rows`:`${fmt(d.apiRows||0)} rekordów API`;
  if(!shown&&el('emptyState')){
    let hint=state.lang==='en'?'No opportunities after current result filters. ':'Brak okazji po obecnych filtrach wyników. ';
    if(!d.apiRows)hint+=state.lang==='en'?'The API returned no price rows for this selection.':'API nie zwróciło rekordów cen dla tego wyboru.';
    else if(!state.opportunities.length)hint+=state.lang==='en'?'No positive-profit cross-market routes were found in the fetched price snapshot.':'W pobranym zestawie cen nie znaleziono tras między marketami z dodatnim zyskiem po opłatach.';
    else hint+=state.lang==='en'?'Profitable routes exist — lower minimum profit or minimum volume.':'Zyskowne trasy istnieją — zmniejsz minimalny zysk albo minimalny wolumen.';
    el('emptyState').textContent=hint;
  }
}
function countMatchingItems(){const q=el('itemQuery').value.trim().toLowerCase(),tier=el('tier').value,ench=el('enchant').value,cats=new Set(selectedCategories());return state.items.filter(it=>{const {tier:t,enchant:e}=itemTierEnchant(it.id);if(t<4||t>8)return false;if(tier!=='all'&&String(t)!==tier)return false;if(ench!=='all'&&String(e)!==ench)return false;if(!cats.has(categoryForItem(it.id)))return false;if(q){const names=[it.name,it.namePl,it.nameEn,it.id].filter(Boolean).map(x=>String(x).toLowerCase());if(!names.some(x=>x.includes(q)))return false;}return true;}).length;}

async function scan(opts={}){
  if(el('scanBtn').disabled&&!opts.auto)return;const markets=selectedMarkets();if(markets.length<2){if(!opts.auto)alert(tr('Wybierz co najmniej dwa markety.','Select at least two markets.'));return;}
  const items=buildItemSelection();if(!items.length){if(!opts.auto)alert(tr('Brak przedmiotów pasujących do filtrów.','No items match the selected filters/categories.'));return;}state.scanDiagnostics={selectedItems:items.length,matchingItems:countMatchingItems(),apiRows:0,itemsWithRows:0,modes:{}};
  const qualities=el('quality').value==='all'?[1,2,3,4,5]:[+el('quality').value],batches=batchesByUrl(items,markets,qualities),scanId=++state.scanId;state.stop=false;state.raw=[];state.opportunities=[];el('scanBtn').disabled=true;el('stopBtn').disabled=false;el('validateBtn').disabled=true;setProgress(0,state.lang==='en'?`${opts.auto?'Auto-scan':'Start'}: ${fmt(items.length)} items…`:`${opts.auto?'Auto-skan':'Start'}: ${fmt(items.length)} przedmiotów…`);
  const fresh=[];let errors=0;
  for(let i=0;i<batches.length;i++){if(state.stop||scanId!==state.scanId)break;const ids=batches[i].map(x=>x.id).join(','),url=`${API}/api/v2/stats/prices/${encodeURIComponent(ids).replace(/%2C/g,',')}.json?locations=${encodeURIComponent(markets.join(','))}&qualities=${qualities.join(',')}`;try{const j=await fetchJson(url,18000);if(Array.isArray(j))fresh.push(...j);state.lastApiOk=true;el('apiStatus').textContent='online';el('apiStatus').style.color='var(--good)';}catch{errors++;state.lastApiOk=false;el('apiStatus').textContent=navigator.onLine?tr('częściowy błąd','partial error'):'offline';el('apiStatus').style.color='var(--bad)';}setProgress((i+1)/batches.length*70,state.lang==='en'?`Prices ${i+1}/${batches.length} • rows ${fmt(fresh.length)}`:`Ceny ${i+1}/${batches.length} • rekordy ${fmt(fresh.length)}`);if(i<batches.length-1)await sleep(180);}
  const normalizedFresh=fresh.length?await persistPriceRows(fresh):[];state.scanDiagnostics.apiRows=normalizedFresh.length;if(normalizedFresh.length)await updateMarketStats(normalizedFresh);else state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));
  let cached=[];if(el('useCache').checked&&(errors||!normalizedFresh.length))cached=await cachedRowsFor(items,markets,qualities);const rows=mergeRows(normalizedFresh,cached);state.raw=rows;
  if(!rows.length){el('scanBtn').disabled=false;el('stopBtn').disabled=true;setProgress(0,tr('Brak danych API i brak lokalnego cache.','No API data and no local cache.'));await updateDbInfo();return;}
  const map=new Map(items.map(x=>[x.id,x])),byItem=new Map();for(const r of rows){if(!byItem.has(r.item_id))byItem.set(r.item_id,[]);byItem.get(r.item_id).push(r);}
  const cfg=cfgFromUI();state.opportunities=calcOpportunities(byItem,map,el('mode').value,cfg);render();renderScanDiagnostics();
  if(!state.stop&&state.opportunities.length){setProgress(74,state.lang==='en'?`Found ${fmt(state.opportunities.length)} profitable routes. Loading volume…`:`Znaleziono ${fmt(state.opportunities.length)} zyskownych tras. Pobieram wolumen…`);await enrichAllVolume(false);}else await saveOpportunities(state.opportunities);
  await dbPut('scan_runs',{ts:now(),items:items.length,markets,qualities,apiRows:normalizedFresh.length,cacheRows:cached.length,errors,opportunities:state.opportunities.length,auto:!!opts.auto});
  el('kpiItems').textContent=fmt(items.length);el('lastScan').textContent=new Date().toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});el('scanBtn').disabled=false;el('stopBtn').disabled=true;el('validateBtn').disabled=state.opportunities.length===0;renderScanDiagnostics();setProgress(100,state.stop?tr('Skan przerwany.','Scan stopped.'):(state.lang==='en'?`Done: ${fmt(state.opportunities.length)} profitable routes with prices and volume.`:`Gotowe: ${fmt(state.opportunities.length)} zyskownych tras z cenami i wolumenem.`));await updateDbInfo();render();await saveSettings();
}

function portfolioExecutionFactor(profile){return profile==='conservative'?.08:profile==='aggressive'?.25:.15;}
function portfolioCapitalPerUnit(o){if(Number.isFinite(+o.capitalPerUnit)&&+o.capitalPerUnit>0)return +o.capitalPerUnit;const setup=o.mode==='relist'?(+o.setupFee||0):0;return Math.max(1,(+o.buy||0)+(+o.transportCost||0)+setup);}
function estimatedLiquidityCap(o,pcfg){
  const q=o.volume?.qty,base=pcfg.riskProfile==='conservative'?q?.safe:pcfg.riskProfile==='aggressive'?q?.aggressive:q?.normal;
  let cap=Number.isFinite(+base)?Math.floor(+base*pcfg.liquidityDays):0;
  if(!cap){const daily=+o.volume?.effectiveDaily||0,factor=portfolioExecutionFactor(pcfg.riskProfile);cap=daily>0?Math.floor(daily*pcfg.liquidityDays*factor):0;}
  return clamp(Math.max(0,cap),0,pcfg.maxUnits);
}
function portfolioReason(o,cap){
  const parts=[];
  parts.push(state.lang==='en'?`profit ${fmt(o.profit)}/unit`:`zysk ${fmt(o.profit)}/szt.`);
  if((o.volume?.effectiveDaily||0)>0)parts.push(state.lang==='en'?`${o.volume.effectiveDaily.toFixed(1)}/day volume`:`wolumen ${o.volume.effectiveDaily.toFixed(1)}/dzień`);
  if(o.dest==='Black Market')parts.push('Black Market');
  parts.push(state.lang==='en'?`volume cap ${cap} units`:`limit wolumenu ${cap} szt.`);return parts.join(' • ');
}
function makePortfolioCandidates(pcfg){
  const raw=state.opportunities.filter(o=>o.profit>0&&Number.isFinite(o.buy)&&o.buy>0&&(o.volume?.effectiveDaily||0)>0);
  const bestPerItem=new Map();
  for(const o of raw){
    const capital=portfolioCapitalPerUnit(o),cap=estimatedLiquidityCap(o,pcfg);if(cap<=0)continue;
    const daily=Math.max(0,o.volume?.effectiveDaily||0),ppd=Math.max(0,o.volume?.profitPerDayNominal||0),pScore=profitScore(o.profit,o.roi),vScore=volumeScale(daily);
    const utility=.58*pScore+.42*vScore + 10*(1-Math.exp(-ppd/250000));
    const modelProfit=Math.max(0,o.riskProfit||0);
    const c={...o,_capital:capital,_qtyCap:cap,_exec:1,_modelUnitProfit:modelProfit,_riskRoi:modelProfit/Math.max(1,capital)*100,_portfolioUtility:utility,_reason:portfolioReason(o,cap)};
    const k=o.itemId+'|'+o.quality,prev=bestPerItem.get(k);if(!prev||c._portfolioUtility>prev._portfolioUtility)bestPerItem.set(k,c);
  }
  return [...bestPerItem.values()].sort((a,b)=>b._portfolioUtility-a._portfolioUtility);
}
function allocatePortfolio(candidates,pcfg){
  const budget=pcfg.budget,investable=budget*(1-pcfg.reservePct/100),itemCap=investable*pcfg.maxItemPct/100,routeCap=investable*pcfg.maxRoutePct/100;
  const pos=new Map(),itemUse=new Map(),routeUse=new Map();let used=0,guard=0;
  const routeKey=o=>`${o.source}→${o.dest}`;
  while(guard++<20000){
    let best=null,bestMarginal=-Infinity;
    for(const c of candidates){
      const current=pos.get(c.key),units=current?.units||0;if(units>=c._qtyCap)continue;
      if(!current&&pos.size>=pcfg.maxPositions)continue;
      const cost=c._capital;if(used+cost>investable+1e-6)continue;
      const itemK=c.itemId+'|'+c.quality,routeK=routeKey(c);
      if((itemUse.get(itemK)||0)+cost>itemCap+1e-6)continue;if((routeUse.get(routeK)||0)+cost>routeCap+1e-6)continue;
      const saturation=units/Math.max(1,c._qtyCap),diversify=current?1:1.08,marginal=c._portfolioUtility*(1-.58*saturation)*diversify;
      if(marginal>bestMarginal){bestMarginal=marginal;best=c;}
    }
    if(!best)break;
    let rec=pos.get(best.key);if(!rec){rec={opportunityKey:best.key,itemId:best.itemId,itemName:best.itemName,itemNamePl:best.itemNamePl,itemNameEn:best.itemNameEn,quality:best.quality,source:best.source,dest:best.dest,mode:best.mode,model:best.model,buy:best.buy,sell:best.sell,profitPerUnit:best.profit,capitalPerUnit:best._capital,modelProfitPerUnit:best._modelUnitProfit,confidence:best.confidence,score:best.score,utility:best._portfolioUtility,liquidityCap:best._qtyCap,volumeDaily:best.volume?.effectiveDaily||0,liquidityScore:best.volume?.liquidityScore||best.components?.liquidity||0,profitPerDayModel:best.volume?.profitPerDayModel||0,reason:best._reason,units:0};pos.set(best.key,rec);}
    rec.units++;const cost=best._capital;used+=cost;const itemK=best.itemId+'|'+best.quality,routeK=routeKey(best);itemUse.set(itemK,(itemUse.get(itemK)||0)+cost);routeUse.set(routeK,(routeUse.get(routeK)||0)+cost);
  }
  const positions=[...pos.values()].map(x=>({...x,capital:x.units*x.capitalPerUnit,nominalProfit:x.units*x.profitPerUnit,modelProfit:x.units*x.modelProfitPerUnit}));
  positions.sort((a,b)=>b.utility-a.utility);positions.forEach((x,i)=>x.rank=i+1);
  const capital=positions.reduce((s,x)=>s+x.capital,0),nominalProfit=positions.reduce((s,x)=>s+x.nominalProfit,0),modelProfit=positions.reduce((s,x)=>s+x.modelProfit,0),free=Math.max(0,budget-capital),weightedConfidence=capital?positions.reduce((s,x)=>s+x.confidence*x.capital,0)/capital:0,weightedScore=capital?positions.reduce((s,x)=>s+x.score*x.capital,0)/capital:0;
  const maxRouteShare=investable?Math.max(0,...routeUse.values())/investable*100:0,maxItemShare=investable?Math.max(0,...itemUse.values())/investable*100:0;
  return{schemaVersion:9,key:'latest',createdAt:now(),config:pcfg,summary:{budget,investable,capital,free,targetReserve:budget-investable,nominalProfit,modelProfit,modelRoi:capital?modelProfit/capital*100:0,nominalRoi:capital?nominalProfit/capital*100:0,weightedConfidence,weightedScore,maxRouteShare,maxItemShare,positions:positions.length},positions};
}
function renderPortfolio(){
  const pf=state.portfolio,body=el('portfolioBody'),empty=el('portfolioEmpty');if(!body)return;
  if(!pf?.positions?.length){body.innerHTML='';empty.style.display='block';el('portfolioExportBtn').disabled=true;['pfBudget','pfCapital','pfFree','pfProfit','pfExpected'].forEach(id=>el(id).textContent='0');el('pfRoi').textContent='0%';el('portfolioStatus').textContent=tr('Nie zbudowano portfela.','Portfolio not built.');if(el('portfolioNote'))el('portfolioNote').textContent=tr('Najpierw wykonaj skan i zbuduj portfel z aktualnych sygnałów.','Run a scan first and build a portfolio from current signals.');return;}
  empty.style.display='none';el('portfolioExportBtn').disabled=false;const s=pf.summary;
  el('pfBudget').textContent=fmt(s.budget);el('pfCapital').textContent=fmt(s.capital);el('pfFree').textContent=fmt(s.free);el('pfProfit').textContent='+'+fmt(s.nominalProfit);el('pfExpected').textContent='+'+fmt(s.modelProfit);el('pfRoi').textContent=pct(s.modelRoi);
  el('portfolioStatus').textContent=state.lang==='en'?`${s.positions} positions • price × volume allocation • max route ${s.maxRouteShare.toFixed(0)}%`:`${s.positions} pozycji • alokacja cena × wolumen • trasa max ${s.maxRouteShare.toFixed(0)}%`;
  body.innerHTML=pf.positions.map(x=>`<tr><td><b>${x.rank}</b></td><td><div class="itemcell"><img loading="lazy" src="${itemIcon(x.itemId,x.quality)}" alt=""><div><div class="itemname">${esc(displayItemNameById(x.itemId,state.lang==='en'?(x.itemNameEn||x.itemName):(x.itemNamePl||x.itemName)))}</div><div class="itemid">${esc(x.itemId)} • ${qualityName[x.quality]||x.quality}</div></div></div></td><td><div class="route"><b>${esc(marketLabel(x.source))}</b> → <b>${esc(marketLabel(x.dest))}</b></div><span class="tag info">${esc(translateDynamic(x.model||x.mode))}</span></td><td class="qty">${fmt(x.units)}</td><td>${(x.volumeDaily||0).toLocaleString(locale(),{maximumFractionDigits:1})}</td><td>${(x.liquidityScore||0).toFixed(0)}/100</td><td>${fmt(x.capital)}</td><td class="profit">+${fmt(x.nominalProfit)}</td><td class="profit">+${fmt(x.modelProfit)}</td><td>${(x.confidence||0).toFixed(0)}/100</td><td>${(x.utility||0).toFixed(1)}</td><td class="portfolio-reason">${esc(translateDynamic(x.reason))}</td></tr>`).join('');
  el('portfolioNote').innerHTML=state.lang==='en'?`Portfolio uses <b>${fmt(s.capital)}</b> of ${fmt(s.budget)} silver. Planned reserve: <b>${fmt(s.targetReserve)}</b>. Selection is based on price/profit and historical volume; Confidence is displayed only as additional information. Maximum exposure — item: <b>${s.maxItemShare.toFixed(1)}%</b>; route: <b>${s.maxRouteShare.toFixed(1)}%</b>.`:`Portfel używa <b>${fmt(s.capital)}</b> z ${fmt(s.budget)} silver. Planowana rezerwa: <b>${fmt(s.targetReserve)}</b>. Dobór opiera się na cenie/zysku i historycznym wolumenie; Confidence jest tylko informacją dodatkową. Maks. ekspozycja — przedmiot: <b>${s.maxItemShare.toFixed(1)}%</b>; trasa: <b>${s.maxRouteShare.toFixed(1)}%</b>.`;
}
async function buildPortfolio(opts={}){
  if(!state.opportunities.length){if(!opts.silent)alert(tr('Najpierw wykonaj skan okazji.','Run an opportunity scan first.'));return null;}
  const btn=el('portfolioBtn');if(btn){btn.disabled=true;btn.innerHTML=`<span class="spinner"></span>${tr('Portfel…','Portfolio…')}`;}
  try{
    if(!opts.skipEnrich){const need=[...state.opportunities].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,40).some(o=>!o.history);if(need)await enrichTop(Math.min(40,state.opportunities.length));}
    const pcfg=portfolioCfg(),candidates=makePortfolioCandidates(pcfg);state.portfolio=allocatePortfolio(candidates,pcfg);await dbPut('portfolios',state.portfolio);renderPortfolio();await updateDbInfo();
    if(!state.portfolio.positions.length&&!opts.silent)alert(tr('Brak okazji z analizą wolumenu spełniających limity portfela. Zwiększ zakres analizy wolumenu albo budżet/limity koncentracji.','No volume-analyzed opportunities meet the portfolio limits. Increase volume analysis depth or budget/concentration limits.'));
    return state.portfolio;
  }finally{if(btn){btn.disabled=false;btn.textContent=tr('Zbuduj portfel','Build portfolio');}}
}
async function loadCachedPortfolio(){const pf=await dbGet('portfolios','latest');if(pf?.schemaVersion===9){state.portfolio=pf;renderPortfolio();return true;}state.portfolio=null;renderPortfolio();return false;}
function exportPortfolioCsv(){const pf=state.portfolio;if(!pf?.positions?.length)return;const cols=['rank','item_id','name','quality','source','destination','model','units','capital','buy_unit','sell_unit','profit_unit','nominal_profit','model_profit','confidence','price_volume_score','volume_day','liquidity_score','profit_day_model','liquidity_cap','reason'],lines=[cols.join(';'),...pf.positions.map(x=>[x.rank,x.itemId,displayItemNameById(x.itemId,state.lang==='en'?(x.itemNameEn||x.itemName):(x.itemNamePl||x.itemName)),qualityName[x.quality],marketLabel(x.source),marketLabel(x.dest),x.model,x.units,Math.round(x.capital),Math.round(x.buy),Math.round(x.sell),Math.round(x.profitPerUnit),Math.round(x.nominalProfit),Math.round(x.modelProfit),(x.confidence||0).toFixed(1),(x.score||0).toFixed(1),(x.volumeDaily||0).toFixed(2),(x.liquidityScore||0).toFixed(1),Math.round(x.profitPerDayModel||0),x.liquidityCap,translateDynamic(x.reason)].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';'))],blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='albion_portfolio_v5_2_3.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

function modelTags(o){let tags=[`<span class="tag info">${esc(o.model||modelLabel(o))}</span>`];if(o.history?.sourceDiscount>=12)tags.push(`<span class="tag good">- ${o.history.sourceDiscount.toFixed(0)}% ${tr('vs mediana','vs median')}</span>`);return `<div class="modelbox">${tags.join('')}</div>`;}
function flag(o){if(o.confidence>=78&&o.age<=6)return`<span class="tag good">${tr('wysoka pewność','high confidence')}</span>`;if(o.warnings?.some(x=>x.includes('ekstremalnie')||x.includes('znacznie powyżej')))return`<span class="tag bad">${tr('anomalia','anomaly')}</span>`;if(o.confidence<35)return`<span class="tag bad">${tr('wysokie ryzyko','high risk')}</span>`;if(o.age>24)return`<span class="tag bad">${tr('stara cena','stale price')}</span>`;if(o.confidence>=60)return`<span class="tag">${tr('dobry sygnał','good signal')}</span>`;return`<span class="tag warn">${tr('zweryfikuj','verify')}</span>`;}
function markPreset(name){state.resultPreset=name||'custom';document.querySelectorAll('[data-result-preset]').forEach(b=>b.classList.toggle('active',b.dataset.resultPreset===state.resultPreset));}
function syncResultPreset(){const c=cfgFromUI(),isAll=c.minProfit<=0&&c.minVolumeDay<=0;markPreset(isAll?'all':'custom');}
function setResultPreset(name){
  const set=(id,v)=>{const x=el(id);if(x)x.value=String(v);};
  if(name==='volume'){set('minProfit',0);set('minVolumeDay',0.1);}
  else if(name==='active'){set('minProfit',0);set('minVolumeDay',5);}
  else if(name==='margin'){set('minProfit',1000);set('minVolumeDay',0);}
  else {name='all';set('minProfit',0);set('minVolumeDay',0);}
  markPreset(name);queueSaveSettings();render();
}
function filteredResults(){
  let a=[...state.opportunities],q=el('resultSearch').value.trim().toLowerCase(),cfg=cfgFromUI();
  if(q)a=a.filter(o=>[displayOpportunityName(o),o.itemNamePl,o.itemNameEn,o.itemId,o.source,o.dest].some(x=>String(x).toLowerCase().includes(q)));if(state.watchOnly)a=a.filter(o=>state.watched.has(o.itemId));a=a.filter(o=>(o.profit??-Infinity)>=cfg.minProfit);if(cfg.minVolumeDay>0)a=a.filter(o=>Number.isFinite(o.volume?.effectiveDaily)&&(o.volume.effectiveDaily||0)>=cfg.minVolumeDay);
  const sort=el('sortBy').value;a.sort((x,y)=>sort==='profit'?y.profit-x.profit:sort==='volume'?(y.volume?.effectiveDaily??-1)-(x.volume?.effectiveDaily??-1):sort==='buy'?x.buy-y.buy:sort==='sell'?y.sell-x.sell:(y.profitVolumeDaily||0)-(x.profitVolumeDaily||0));return a;
}
function volumeFmt(v){return Number.isFinite(v)?v.toLocaleString(locale(),{maximumFractionDigits:1}):'—';}
function simpleModeLabel(o){if(o.dest==='Black Market')return 'Black Market';return o.mode==='instant'?tr('Do buy orderu','To buy order'):tr('Wystaw sell order','List sell order');}
function render(){
  const a=filteredResults();if(el('resultCountMeta'))el('resultCountMeta').textContent=state.lang==='en'?`${fmt(a.length)} shown / ${fmt(state.opportunities.length)} profitable routes`:`${fmt(a.length)} pokazanych / ${fmt(state.opportunities.length)} zyskownych tras`;el('emptyState').style.display=a.length?'none':'block';
  el('resultsBody').innerHTML=a.map((o,i)=>{const v=o.volume||{},v7=Number.isFinite(v.trade7)?fmt(v.trade7):'—',v30=Number.isFinite(v.trade30)?fmt(v.trade30):'—';return `<tr><td><button class="star ${state.watched.has(o.itemId)?'on':''}" data-watch="${esc(o.itemId)}">★</button></td><td><div class="itemcell"><img loading="lazy" src="${itemIcon(o.itemId,o.quality)}" alt=""><div><div class="itemname">${esc(displayOpportunityName(o))}</div><div class="itemid">${esc(o.itemId)} • ${qualityName[o.quality]||o.quality}</div></div></div></td><td><span class="tag info">${esc(simpleModeLabel(o))}</span></td><td class="route"><b>${esc(marketLabel(o.source))}</b></td><td>${fmt(o.buy)}</td><td class="route"><b>${esc(marketLabel(o.dest))}</b></td><td>${fmt(o.sell)}</td><td class="profit">+${fmt(o.profit)}</td><td>${volumeFmt(v.buyDaily)}</td><td>${volumeFmt(v.sellDaily)}</td><td><b>${volumeFmt(v.effectiveDaily)}</b></td><td>${v7}</td><td>${v30}</td><td class="profit">${fmt(o.profitVolumeDaily||0)}</td><td><button class="btn" data-detail="${i}">${tr('Szczegóły','Details')}</button></td></tr>`;}).join('');
  const bestProfit=a.reduce((m,x)=>Math.max(m,x.profit||0),0),withVol=a.filter(x=>Number.isFinite(x.volume?.effectiveDaily)),maxVol=withVol.reduce((m,x)=>Math.max(m,x.volume.effectiveDaily||0),0),bestTrade=a.reduce((m,x)=>Math.max(m,x.profitVolumeDaily||0),0);el('kpiCount').textContent=fmt(a.length);el('kpiProfit').textContent=fmt(bestProfit);el('kpiVolume').textContent=withVol.length?volumeFmt(maxVol):'—';el('kpiTradeProfit').textContent=fmt(bestTrade);el('kpiVolumeRows').textContent=fmt(withVol.length);renderScanDiagnostics();document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=async()=>{const id=b.dataset.watch;state.watched.has(id)?state.watched.delete(id):state.watched.add(id);await saveWatch();render();});document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(a[+b.dataset.detail]));
}
function compCard(label,v,desc=''){return `<div class="detail-card"><small>${esc(label)}</small><b>${Number.isFinite(v)?v.toFixed(0)+'/100':'—'}</b>${desc?`<small>${esc(desc)}</small>`:''}</div>`;}
function openDetail(o){
  el('detailTitle').textContent=`${displayOpportunityName(o)} — ${marketLabel(o.source)} → ${marketLabel(o.dest)}`;const v=o.volume||{};
  el('detailCards').innerHTML=`<div class="detail-card"><small>${tr('Cena kupna','Buy price')}</small><b>${fmt(o.buy)}</b></div><div class="detail-card"><small>${tr('Cena sprzedaży','Sell price')}</small><b>${fmt(o.sell)}</b></div><div class="detail-card"><small>${tr('Zysk netto / szt.','Net profit / unit')}</small><b class="profit">+${fmt(o.profit)}</b></div><div class="detail-card"><small>${tr('Wolumen handlowy / dzień','Trade volume / day')}</small><b>${volumeFmt(v.effectiveDaily)}</b></div><div class="detail-card"><small>${tr('Vol. zakup / dzień','Buy-market volume / day')}</small><b>${volumeFmt(v.buyDaily)}</b></div><div class="detail-card"><small>${tr('Vol. sprzedaż / dzień','Sell-market volume / day')}</small><b>${volumeFmt(v.sellDaily)}</b></div><div class="detail-card"><small>${tr('Wolumen 7 dni','7-day volume')}</small><b>${Number.isFinite(v.trade7)?fmt(v.trade7):'—'}</b></div><div class="detail-card"><small>${tr('Wolumen 30 dni','30-day volume')}</small><b>${Number.isFinite(v.trade30)?fmt(v.trade30):'—'}</b></div>`;
  const data=state.history.get(`${o.itemId}|${o.source}|${o.quality}`)||o.history?.points||[];drawChart(data,o.buy);const note=o.dest==='Black Market'?tr('Dla Black Market publiczna historia AODP nie daje porównywalnego wolumenu aktualnego buy orderu, dlatego wolumen sprzedaży i wolumen handlowy są oznaczone jako brak.','For Black Market, public AODP history does not provide comparable current buy-order volume, so destination/trade volume is unavailable.'):tr('Wolumen jest liczony z historycznych sell orders AODP. Wolumen handlowy to mniejszy z wolumenu rynku zakupu i sprzedaży. Nie jest to głębokość bieżącego order booka.','Volume is calculated from AODP historical sell orders. Trade volume is the lower of buy-market and sell-market activity. It is not current order-book depth.');el('detailNote').innerHTML=`${tr('Kup','Buy')}: <b>${fmt(o.buy)}</b> — ${esc(marketLabel(o.source))}. ${tr('Sprzedaj','Sell')}: <b>${fmt(o.sell)}</b> — ${esc(marketLabel(o.dest))}. ${tr('Zysk po opłatach','Profit after fees')}: <b class="profit">+${fmt(o.profit)}</b> / ${tr('szt.','unit')}.<br><span class="muted">${esc(note)}</span>`;el('detailDialog').showModal();
}
function drawChart(data,current){const svg=el('historyChart'),pts=(data||[]).map(x=>({p:+x.avg_price,t:parseHistoryTime(x.timestamp)})).filter(x=>x.p>0&&Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);if(!pts.length){svg.innerHTML=`<text x="440" y="110" text-anchor="middle" fill="#8392a8" font-size="13">${tr('Brak historii dla tego sygnału.','No history for this signal.')}</text>`;return;}const w=880,h=220,pad=25,min=Math.min(...pts.map(x=>x.p),current),max=Math.max(...pts.map(x=>x.p),current),span=Math.max(1,max-min),x=i=>pad+i*(w-pad*2)/Math.max(1,pts.length-1),y=v=>h-pad-(v-min)/span*(h-pad*2),path=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.p).toFixed(1)).join(' '),cy=y(current);svg.innerHTML=`<line x1="${pad}" y1="${cy}" x2="${w-pad}" y2="${cy}" stroke="#d6a84b" stroke-dasharray="6 5" opacity=".7"/><path d="${path}" fill="none" stroke="#64b5f6" stroke-width="2.5"/><text x="${pad}" y="17" fill="#93a3b8" font-size="11">${tr('30 dni','30 days')} • AODP sell history</text><text x="${w-pad}" y="${Math.max(15,cy-6)}" text-anchor="end" fill="#d6a84b" font-size="11">${tr('zakup','buy')} ${fmt(current)}</text>`;}
function exportCsv(){const a=filteredResults();if(!a.length)return;const cols=['item_id','name','quality','mode','buy_market','buy_price','sell_market','sell_price','net_profit_unit','buy_volume_day','sell_volume_day','trade_volume_day','trade_volume_7d','trade_volume_30d','profit_x_volume_day'],lines=[cols.join(';'),...a.map(o=>[o.itemId,displayOpportunityName(o),qualityName[o.quality],simpleModeLabel(o),marketLabel(o.source),Math.round(o.buy),marketLabel(o.dest),Math.round(o.sell),Math.round(o.profit),Number.isFinite(o.volume?.buyDaily)?o.volume.buyDaily.toFixed(2):'',Number.isFinite(o.volume?.sellDaily)?o.volume.sellDaily.toFixed(2):'',Number.isFinite(o.volume?.effectiveDaily)?o.volume.effectiveDaily.toFixed(2):'',Number.isFinite(o.volume?.trade7)?Math.round(o.volume.trade7):'',Number.isFinite(o.volume?.trade30)?Math.round(o.volume.trade30):'',Math.round(o.profitVolumeDaily||0)].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';'))],blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),ael=document.createElement('a');ael.href=u;ael.download='albion_europe_price_volume_v5_2_4.csv';ael.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function loadCachedOpportunities(){let ops=await dbGetAll('opportunities');ops=ops.filter(x=>x.schemaVersion===10);if(!ops.length){await dbClear('opportunities');return false;}state.opportunities=ops;el('validateBtn').disabled=false;const newest=ops.reduce((m,x)=>Math.max(m,x.calculatedAt||0),0);el('lastScan').textContent=newest?new Date(newest).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})+' cache':'cache';setProgress(0,state.lang==='en'?`Showing ${fmt(ops.length)} opportunities from local.db.`:`Pokazano ${fmt(ops.length)} okazji z local.db.`);render();return true;}
async function exportDB(){const payload={format:'albion-market-local-db',version:DB_VERSION,exportedAt:new Date().toISOString(),stores:{}};for(const s of DB_STORES)payload.stores[s]=await dbGetAll(s);const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`albion-local-db-v5_2_4-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function importDBFile(file){const txt=await file.text(),j=JSON.parse(txt);if(j?.format!=='albion-market-local-db'||!j.stores)throw new Error(tr('Nieprawidłowy backup','Invalid backup'));for(const s of DB_STORES){await dbClear(s);if(Array.isArray(j.stores[s]))await dbPutMany(s,j.stores[s]);}state.watched=new Set((await dbGetAll('watchlist')).map(x=>x.itemId));setItems(await dbGetAll('items'));state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));await loadSettings();await loadCachedOpportunities();await updateDbInfo();}
async function clearCache(){if(!confirm(tr('Wyczyścić ceny, historię, modele rynku i zapisane okazje? Baza przedmiotów i ustawienia zostaną.','Clear prices, history, market models and saved opportunities? Item database and settings will remain.')))return;for(const s of ['prices','history','opportunities','scan_runs','market_stats','portfolios'])await dbClear(s);state.opportunities=[];state.history.clear();state.marketStats.clear();render();await updateDbInfo();setProgress(0,tr('Lokalny cache i profile modeli wyczyszczone.','Local cache and model profiles cleared.'));}
function scheduleAuto(){clearInterval(autoTimer);const m=+el('autoRefresh').value||0;if(m>0)autoTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!el('scanBtn').disabled)scan({auto:true}).catch(()=>{});},m*60000);}
function bind(){
  el('languageSelect').onchange=e=>applyLanguage(e.target.value,true);el('allCategories').onclick=()=>{setSelectedCategories(CATEGORY_LEAVES);queueSaveSettings();};el('clearCategories').onclick=()=>{setSelectedCategories([]);queueSaveSettings();};el('equipmentCategories').onclick=()=>{setSelectedCategories([...EQUIPMENT_CATEGORIES]);queueSaveSettings();};el('allMarkets').onclick=()=>{document.querySelectorAll('.marketCheck').forEach(x=>x.checked=true);queueSaveSettings();};el('royalMarkets').onclick=()=>{document.querySelectorAll('.marketCheck').forEach(x=>x.checked=!!MARKETS.find(m=>m.api===x.value)?.royal);queueSaveSettings();};
  el('scanBtn').onclick=()=>scan();el('stopBtn').onclick=()=>{state.stop=true;state.scanId++;el('stopBtn').disabled=true;el('scanBtn').disabled=false;};el('validateBtn').onclick=()=>enrichAllVolume(true);el('resultSearch').oninput=render;el('sortBy').onchange=render;['minProfit','minVolumeDay'].forEach(id=>{const x=el(id);if(!x)return;x.oninput=render;x.onchange=()=>{render();queueSaveSettings();};});el('watchOnly').onclick=()=>{state.watchOnly=!state.watchOnly;el('watchOnly').textContent=state.watchOnly?tr('★ Wszystkie wyniki','★ All results'):tr('★ Obserwowane','★ Watched');render();};el('exportBtn').onclick=exportCsv;el('closeDialog').onclick=()=>el('detailDialog').close();el('dbExportBtn').onclick=exportDB;el('dbImportBtn').onclick=()=>el('dbImportFile').click();el('dbImportFile').onchange=async e=>{try{if(e.target.files[0])await importDBFile(e.target.files[0]);setProgress(100,tr('Backup local.db zaimportowany.','local.db backup imported.'));}catch(err){alert(tr('Import nieudany: ','Import failed: ')+err.message);}e.target.value='';};el('loadCacheBtn').onclick=loadCachedOpportunities;el('dbClearBtn').onclick=clearCache;
  document.querySelectorAll('thead th[data-sort]').forEach(th=>th.onclick=()=>{const key=th.dataset.sort;if(['profitVolume','profit','volume','buy','sell'].includes(key)){el('sortBy').value=key;render();}});document.querySelectorAll('input,select').forEach(x=>{if(!['resultSearch','dbImportFile'].includes(x.id))x.addEventListener('change',queueSaveSettings);});document.addEventListener('change',e=>{if(e.target.classList?.contains('marketCheck'))queueSaveSettings();if(e.target.classList?.contains('categoryGroupCheck')){const g=e.target.dataset.group;document.querySelectorAll(`.categoryLeafCheck[data-group="${g}"]`).forEach(x=>x.checked=e.target.checked);updateCategoryParents();updateCategorySummary();queueSaveSettings();}if(e.target.classList?.contains('categoryLeafCheck')){updateCategoryParents();updateCategorySummary();queueSaveSettings();}});window.addEventListener('online',pingApi);window.addEventListener('offline',()=>{el('apiStatus').textContent='offline';el('apiStatus').style.color='var(--bad)';});
}
async function init(){renderMarkets();renderCategories(CATEGORY_LEAVES);bind();try{await openLocalDB();setDbStatus(tr('gotowa','ready'));const w=await dbGetAll('watchlist');state.watched=new Set(w.map(x=>x.itemId));state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));await loadSettings();syncResultPreset();await updateDbInfo();setProgress(3,tr('Ładowanie bazy przedmiotów…','Loading item database…'));await loadItems();await loadCachedOpportunities();setProgress(0,state.opportunities.length?tr('Gotowy — pokazano ostatni cache.','Ready — showing latest cache.'):tr('Gotowy — łączenie z API…','Ready — connecting to API…'));await pingApi();scheduleAuto();if(el('autoStart').value==='yes'&&navigator.onLine)setTimeout(()=>scan({auto:true}).catch(()=>{}),700);}catch(e){setDbStatus(tr('błąd','error'),false);el('dbStatus').textContent=tr('błąd','error');setProgress(0,tr('Błąd inicjalizacji: ','Initialization error: ')+(e.message||e));}
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}
init();
})();
