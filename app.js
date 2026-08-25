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
const DB_VERSION=7;
const DB_STORES=['items','prices','history','watchlist','settings','opportunities','scan_runs','market_stats','portfolios'];
const PROFILE = {
  conservative:{freshHalfLife:8, confidenceWeight:.40, profitWeight:.22, valueWeight:.08, liquidityWeight:.30, crossedPenalty:42, anomalyPenalty:42},
  balanced:{freshHalfLife:14, confidenceWeight:.35, profitWeight:.30, valueWeight:.10, liquidityWeight:.25, crossedPenalty:30, anomalyPenalty:30},
  aggressive:{freshHalfLife:24, confidenceWeight:.28, profitWeight:.38, valueWeight:.10, liquidityWeight:.24, crossedPenalty:18, anomalyPenalty:20}
};

const el = id => document.getElementById(id);
const state = {items:[],itemById:new Map(),raw:[],opportunities:[],portfolio:null,stop:false,watched:new Set(),history:new Map(),scanId:0,watchOnly:false,lastApiOk:false,marketStats:new Map(),lang:'pl',scanDiagnostics:null};
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
  'brak istotnych ostrzeżeń modelu.':'no material model warnings.','Ryzyka:':'Risks:','Portfel v5.2:':'Portfolio v5.2:','skrzyżowane notowania — możliwa różnica czasu aktualizacji':'crossed quotes — timestamps may be out of sync','cena blisko limitu świeżości':'price near the freshness limit','duży spread na rynku docelowym':'large spread in destination market','cena zakupu ekstremalnie poniżej bieżącej mediany miast — sprawdź świeżość':'buy price extremely below the current city median — verify freshness','cena zakupu ekstremalnie poniżej 30-dniowej mediany — możliwy stary rekord':'buy price extremely below the 30-day median — possibly stale record','buy order znacznie powyżej historycznej ceny sprzedaży — wysoka szansa nieaktualnego sygnału':'buy order far above historical sell price — high chance of a stale signal','niski historyczny obrót':'low historical volume','wysoka zmienność ceny':'high price volatility','Polski':'Polish'
};
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
  document.title=state.lang==='en'?'Albion Europe Market Scanner v5.2 — Volume & Liquidity Intelligence':'Albion Europe Market Scanner v5.2 — Wolumen i płynność';
  if(el('itemQuery'))el('itemQuery').placeholder=tr('np. Bag, T6_BAG, peleryna…','e.g. Bag, T6_BAG, cape…');
  if(el('resultSearch'))el('resultSearch').placeholder=tr('Filtruj wyniki po nazwie, ID lub mieście…','Filter results by name, ID or city…');
  const catSelection=selectedCategories();renderCategories(catSelection);translateTextNodes(document.body);updateCategorySummary();renderPortfolio();render();if(db)updateDbInfo().catch(()=>{});if(persist&&db)queueSaveSettings();
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
  const [prices,hist,ops,stats,portfolios]=await Promise.all(['prices','history','opportunities','market_stats','portfolios'].map(dbGetAll));
  const newest=prices.reduce((m,x)=>Math.max(m,x.cachedAt||0),0);
  el('localDbInfo').textContent=state.lang==='en'?`IndexedDB: ${fmt(prices.length)} prices • ${fmt(hist.length)} history series • ${fmt(stats.length)} market profiles • ${fmt(ops.length)} opportunities • ${fmt(portfolios.length)} portfolios${newest?' • cache '+new Date(newest).toLocaleString(locale()):''}.`:`IndexedDB: ${fmt(prices.length)} cen • ${fmt(hist.length)} serii historii • ${fmt(stats.length)} profili rynku • ${fmt(ops.length)} okazji • ${fmt(portfolios.length)} portfeli${newest?' • cache '+new Date(newest).toLocaleString(locale()):''}.`;
}
async function saveWatch(){await dbClear('watchlist');await dbPutMany('watchlist',[...state.watched].map(itemId=>({itemId})));}
function currentSettings(){
  const ids=['languageSelect','itemQuery','tier','enchant','quality','scanLimit','mode','riskProfile','analysisDepth','premium','setupFee','undercut','transport','minProfit','minRoi','maxAge','minBuy','minConfidence','minVolumeDay','minVolume7','minLiquidityScore','maxExitDays','requireVolume','excludeSame','onlyFreshBoth','portfolioBudget','portfolioReservePct','portfolioMaxItemPct','portfolioMaxRoutePct','portfolioMaxPositions','portfolioMaxUnits','portfolioMinConfidence','portfolioLiquidityDays','autoPortfolio','autoRefresh','autoStart','useCache'];
  const v={};for(const id of ids){const x=el(id);if(x)v[id]=x.type==='checkbox'?x.checked:x.value;}
  v.markets=selectedMarkets();v.categories=selectedCategories();return v;
}
async function saveSettings(){if(!db)return;await dbPut('settings',{key:'ui',value:currentSettings(),savedAt:now()});scheduleAuto();}
async function loadSettings(){
  const rec=await dbGet('settings','ui');if(!rec?.value)return;
  const v=rec.value;for(const [id,val] of Object.entries(v)){const x=el(id);if(!x||id==='markets'||id==='categories')continue;if(x.type==='checkbox')x.checked=!!val;else x.value=String(val);}
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
function cfgFromUI(){return{minBuy:+el('minBuy').value||0,minProfit:+el('minProfit').value||0,minRoi:+el('minRoi').value||0,maxAge:+el('maxAge').value||24,minConfidence:+el('minConfidence').value||0,minVolumeDay:+el('minVolumeDay')?.value||0,minVolume7:+el('minVolume7')?.value||0,minLiquidityScore:+el('minLiquidityScore')?.value||0,maxExitDays:+el('maxExitDays')?.value||999,requireVolume:!!el('requireVolume')?.checked,excludeSame:el('excludeSame').checked,freshBoth:el('onlyFreshBoth').checked,tax:el('premium').value==='yes'?4:8,setup:+el('setupFee').value||0,undercut:+el('undercut').value||0,transport:+el('transport').value||0,riskProfile:el('riskProfile').value||'balanced'};}
function portfolioCfg(){return{budget:Math.max(0,+el('portfolioBudget').value||0),reservePct:clamp(+el('portfolioReservePct').value||0,0,90),maxItemPct:clamp(+el('portfolioMaxItemPct').value||20,1,100),maxRoutePct:clamp(+el('portfolioMaxRoutePct').value||40,1,100),maxPositions:clamp(+el('portfolioMaxPositions').value||12,1,50),maxUnits:clamp(+el('portfolioMaxUnits').value||25,1,500),minConfidence:clamp(+el('portfolioMinConfidence').value||55,0,100),liquidityDays:Math.max(.1,+el('portfolioLiquidityDays').value||1),riskProfile:el('riskProfile').value||'balanced'};}
function modelLabel(o){if(o.dest==='Black Market')return'Black Market';if(o.mode==='instant')return'Instant arbitrage';if(o.history?.sourceDiscount>=12)return'Mean reversion';if((o.cityDiscount||0)>=12)return'City gap';return'Relist spread';}
function recalcScore(o,cfg){
  const prof=PROFILE[cfg.riskProfile]||PROFILE.balanced,pScore=profitScore(o.profit,o.roi),value=o.components?.value??50,liq=o.components?.liquidity??38;
  o.riskProfit=Math.max(0,o.profit)*clamp(o.confidence||0,0,100)/100;
  o.score=clamp(prof.confidenceWeight*o.confidence+prof.profitWeight*pScore+prof.valueWeight*value+prof.liquidityWeight*liq);
  o.model=modelLabel(o);return o;
}
function calcMode(rowsByItem,itemMap,mode,cfg,diag){
  const result=[],md=diag.modes[mode]={items:0,qualities:0,pairs:0,rejectSame:0,rejectStale:0,rejectProfit:0,rejectRoi:0,acceptedPairs:0,signals:0};
  for(const [itemId,rows] of rowsByItem){
    md.items++;
    const cityAsks=rows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>+r.sell_price_min),cityMedian=median(cityAsks);
    const byQ=new Map();for(const r of rows){const q=+r.quality||1;if(!byQ.has(q))byQ.set(q,[]);byQ.get(q).push(r);}
    for(const qRows of byQ.values()){
      md.qualities++;
      const buys=qRows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>=cfg.minBuy).map(r=>({...r,_ageSell:ageHours(r.sell_price_min_date)}));
      const destinations=mode==='instant'?qRows.filter(r=>+r.buy_price_max>0).map(r=>({...r,_destPrice:+r.buy_price_max,_destAge:ageHours(r.buy_price_max_date),_destDate:r.buy_price_max_date})):qRows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>({...r,_destPrice:+r.sell_price_min*(1-cfg.undercut/100),_destAge:ageHours(r.sell_price_min_date),_destDate:r.sell_price_min_date}));
      for(const b of buys){for(const d of destinations){
        md.pairs++;
        if(cfg.excludeSame&&b.city===d.city){md.rejectSame++;continue;}
        if(cfg.freshBoth&&(b._ageSell>cfg.maxAge||d._destAge>cfg.maxAge)){md.rejectStale++;continue;}
        const buy=Math.round(+b.sell_price_min),gross=mode==='relist'?Math.max(1,Math.floor(+d._destPrice)):Math.round(+d._destPrice);if(!(buy>0&&gross>0))continue;
        const tax=Math.ceil(gross*cfg.tax/100),setup=mode==='relist'?Math.ceil(gross*cfg.setup/100):0,fees=tax+setup,capitalPerUnit=buy+cfg.transport+setup,profit=gross-fees-buy-cfg.transport,roi=profit/Math.max(1,capitalPerUnit)*100;
        if(profit<cfg.minProfit){md.rejectProfit++;continue;}if(roi<cfg.minRoi){md.rejectRoi++;continue;}
        const base=baseConfidence(b,d,mode,cfg),item=itemMap.get(itemId)||{id:itemId,name:itemId,namePl:itemId,nameEn:itemId};
        const cityDiscount=Number.isFinite(cityMedian)&&cityMedian>0?(1-buy/cityMedian)*100:0,cityValue=Number.isFinite(cityMedian)&&cityMedian>0?sourceValueScore(buy,{median:cityMedian}):50;base.components.value=cityValue;
        if(cityDiscount>65)base.warnings.push('cena zakupu ekstremalnie poniżej bieżącej mediany miast — sprawdź świeżość');
        const o={schemaVersion:7,key:`${itemId}|${b.quality}|${b.city}|${d.city}|${mode}`,itemId,itemName:itemDisplayName(item),itemNamePl:item.namePl||item.name,itemNameEn:item.nameEn||item.name,quality:+b.quality,source:b.city,dest:d.city,buy,sell:gross,profit,roi,fees,taxFee:tax,setupFee:setup,transportCost:cfg.transport,capitalPerUnit,sourceDate:b.sell_price_min_date,destDate:d._destDate,age:base.age,confidence:base.confidence,components:base.components,warnings:base.warnings,cityMedian,cityDiscount,mode,history:null,calculatedAt:now(),sourceRow:b,destRow:d};
        recalcScore(o,cfg);result.push(o);md.acceptedPairs++;
      }}
    }
  }
  const best=new Map();for(const o of result){const k=o.itemId+'|'+o.quality+'|'+o.mode;if(!best.has(k)||best.get(k).score<o.score)best.set(k,o);}md.signals=best.size;return [...best.values()];
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
  const daily=Math.max(0,effectiveTradeVolume(sm,dm,o)),conf=clamp(o.confidence||0)/100,reg=Math.min(sm?.regularity??50,dm?.regularity??sm?.regularity??50)/100;
  const reliability=.45+.35*conf+.20*reg;
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
  o.volume={source:sm?.volumes||null,destination:dm?.volumes||null,sourceRegularity:sm?.regularity??0,destinationRegularity:dm?.regularity??null,effectiveDaily,liquidityScore:liq,sourceLiquidity:srcLiq,destinationLiquidity:dstLiq,trendPct:dm?.trendPct??sm?.trendPct??0,qty,profitPerDayNominal:Math.max(0,o.profit)*dailyModelUnits,profitPerDayModel:Math.max(0,o.profit)*dailyModelUnits*o.confidence/100,proxy:o.mode==='instant'?'destination sell-history volume is a liquidity proxy, not buy-order depth':null};
  o.history={source:sm,destination:dm,sourceDiscount,destinationRatio:destRatio,points:srcData,basis:'AODP sell history; 30 full-day volume windows; destination history is a valuation/liquidity proxy for instant buy orders'};
  o.warnings=[...new Set(warnings)];recalcScore(o,cfg);return o;
}
async function enrichTop(limit,manual=false){
  const cfg=cfgFromUI(),top=[...state.opportunities].sort((a,b)=>b.score-a.score).slice(0,limit);if(!top.length)return;
  el('validateBtn').disabled=true;el('validateBtn').innerHTML=`<span class="spinner"></span>${tr('Modele…','Models…')}`;
  for(let i=0;i<top.length;i++){if(state.stop)break;await enrichOne(top[i],cfg);setProgress(84+(i+1)/top.length*15,state.lang==='en'?`History models ${i+1}/${top.length} • 30d volume • liquidity • volatility • anomaly…`:`Modele historii ${i+1}/${top.length} • wolumen 30d • płynność • volatility • anomaly…`);await sleep(170);}
  await saveOpportunities(state.opportunities);el('validateBtn').disabled=false;el('validateBtn').textContent=tr('Przelicz modele historii','Recalculate history models');render();await updateDbInfo();if(manual)setProgress(100,state.lang==='en'?`Recalculated history models for top ${top.length}.`:`Przeliczono modele historii dla top ${top.length}.`);
}

function diagnosticTotals(){
  const d=state.scanDiagnostics||{},m=Object.values(d.modes||{}),sum=k=>m.reduce((a,x)=>a+(x[k]||0),0);return{pairs:sum('pairs'),same:sum('rejectSame'),stale:sum('rejectStale'),profit:sum('rejectProfit'),roi:sum('rejectRoi'),accepted:sum('acceptedPairs'),signals:sum('signals')};
}
function renderScanDiagnostics(){
  const d=state.scanDiagnostics;if(!d||!el('scanDiagnostics'))return;const t=diagnosticTotals(),shown=filteredResults().length;
  const msg=state.lang==='en'?`Selected ${fmt(d.selectedItems||0)} / matching ${fmt(d.matchingItems||0)} • API rows ${fmt(d.apiRows||0)} • item IDs with data ${fmt(d.itemsWithRows||0)} • pairs ${fmt(t.pairs)} • stale rejected ${fmt(t.stale)} • low profit ${fmt(t.profit)} • low ROI ${fmt(t.roi)} • signals ${fmt(state.opportunities.length)} • shown ${fmt(shown)}`:`Wybrano ${fmt(d.selectedItems||0)} z ${fmt(d.matchingItems||0)} pasujących • rekordy API ${fmt(d.apiRows||0)} • itemy z danymi ${fmt(d.itemsWithRows||0)} • pary ${fmt(t.pairs)} • odrzucone za wiek ${fmt(t.stale)} • niski zysk ${fmt(t.profit)} • niskie ROI ${fmt(t.roi)} • sygnały ${fmt(state.opportunities.length)} • pokazane ${fmt(shown)}`;
  el('scanDiagnostics').textContent=msg;
  if(el('kpiItemsMeta'))el('kpiItemsMeta').textContent=state.lang==='en'?`${fmt(d.apiRows||0)} API rows`:`${fmt(d.apiRows||0)} rekordów API`;
  if(!shown&&el('emptyState')){
    let hint=state.lang==='en'?'No opportunities after current filters. ':'Brak okazji po obecnych filtrach. ';
    if(!d.apiRows)hint+=state.lang==='en'?'The API returned no price rows for this selection.':'API nie zwróciło rekordów cen dla tego wyboru.';
    else if(t.stale>Math.max(t.profit,t.roi))hint+=state.lang==='en'?'Most candidate pairs were rejected by price freshness. Temporarily try 48–72 h or disable “both prices fresh”.':'Najwięcej par odpadło przez świeżość cen. Testowo ustaw 48–72 h albo wyłącz „obie ceny muszą być świeże”.';
    else if(t.profit+t.roi>0)hint+=state.lang==='en'?'Most pairs fail profit/ROI thresholds. For a diagnostic scan set min profit and ROI to 0.':'Większość par nie przechodzi progu zysku/ROI. Do testu ustaw min. zysk i ROI na 0.';
    else if(state.opportunities.length&&!shown)hint+=state.lang==='en'?'Signals exist but are hidden by Confidence/volume/result filters.':'Sygnały istnieją, ale ukrywają je filtry Confidence/wolumenu/wyników.';
    el('emptyState').textContent=hint;
  }
}
function countMatchingItems(){const q=el('itemQuery').value.trim().toLowerCase(),tier=el('tier').value,ench=el('enchant').value,cats=new Set(selectedCategories());return state.items.filter(it=>{const {tier:t,enchant:e}=itemTierEnchant(it.id);if(t<4||t>8)return false;if(tier!=='all'&&String(t)!==tier)return false;if(ench!=='all'&&String(e)!==ench)return false;if(!cats.has(categoryForItem(it.id)))return false;if(q){const names=[it.name,it.namePl,it.nameEn,it.id].filter(Boolean).map(x=>String(x).toLowerCase());if(!names.some(x=>x.includes(q)))return false;}return true;}).length;}

async function scan(opts={}){
  if(el('scanBtn').disabled&&!opts.auto)return;const markets=selectedMarkets();if(markets.length<2){if(!opts.auto)alert(tr('Wybierz co najmniej dwa markety.','Select at least two markets.'));return;}
  const items=buildItemSelection();if(!items.length){if(!opts.auto)alert(tr('Brak przedmiotów pasujących do filtrów.','No items match the selected filters/categories.'));return;}state.scanDiagnostics={selectedItems:items.length,matchingItems:countMatchingItems(),apiRows:0,itemsWithRows:0,modes:{}};
  const qualities=el('quality').value==='all'?[1,2,3,4,5]:[+el('quality').value],batches=batchesByUrl(items,markets,qualities),scanId=++state.scanId;state.stop=false;state.raw=[];state.opportunities=[];state.portfolio=null;renderPortfolio();el('scanBtn').disabled=true;el('stopBtn').disabled=false;el('validateBtn').disabled=true;setProgress(0,state.lang==='en'?`${opts.auto?'Auto-scan':'Start'}: ${fmt(items.length)} items, ${batches.length} batches…`:`${opts.auto?'Auto-skan':'Start'}: ${fmt(items.length)} przedmiotów, ${batches.length} partii…`);
  const fresh=[];let errors=0;
  for(let i=0;i<batches.length;i++){if(state.stop||scanId!==state.scanId)break;const ids=batches[i].map(x=>x.id).join(','),url=`${API}/api/v2/stats/prices/${encodeURIComponent(ids).replace(/%2C/g,',')}.json?locations=${encodeURIComponent(markets.join(','))}&qualities=${qualities.join(',')}`;try{const j=await fetchJson(url,18000);if(Array.isArray(j))fresh.push(...j);state.lastApiOk=true;el('apiStatus').textContent='online';el('apiStatus').style.color='var(--good)';}catch{errors++;state.lastApiOk=false;el('apiStatus').textContent=navigator.onLine?tr('częściowy błąd','partial error'):'offline';el('apiStatus').style.color='var(--bad)';}setProgress((i+1)/batches.length*72,state.lang==='en'?`API ${i+1}/${batches.length} • records: ${fmt(fresh.length)}${errors?' • errors: '+errors:''}`:`API ${i+1}/${batches.length} • rekordy: ${fmt(fresh.length)}${errors?' • błędy: '+errors:''}`);if(i<batches.length-1)await sleep(210);}
  const normalizedFresh=fresh.length?await persistPriceRows(fresh):[];state.scanDiagnostics.apiRows=normalizedFresh.length;if(normalizedFresh.length)await updateMarketStats(normalizedFresh);else state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));
  let cached=[];if(el('useCache').checked&&(errors||!normalizedFresh.length))cached=await cachedRowsFor(items,markets,qualities);const rows=mergeRows(normalizedFresh,cached);state.raw=rows;
  if(!rows.length){el('scanBtn').disabled=false;el('stopBtn').disabled=true;setProgress(0,tr('Brak danych API i brak lokalnego cache.','No API data and no local cache.'));await updateDbInfo();return;}
  const map=new Map(items.map(x=>[x.id,x])),byItem=new Map();for(const r of rows){if(!byItem.has(r.item_id))byItem.set(r.item_id,[]);byItem.get(r.item_id).push(r);}
  const cfg=cfgFromUI();state.opportunities=calcOpportunities(byItem,map,el('mode').value,cfg);await saveOpportunities(state.opportunities);render();renderScanDiagnostics();
  const depth=+el('analysisDepth').value||0;if(depth>0&&!state.stop){setProgress(83,state.lang==='en'?`Initial ${fmt(state.opportunities.length)} opportunities. Running historical models…`:`Wstępnie ${fmt(state.opportunities.length)} okazji. Uruchamiam modele historyczne…`);await enrichTop(Math.min(depth,state.opportunities.length));}
  if(!state.stop&&el('autoPortfolio')?.checked){setProgress(98,tr('Optymalizacja portfela według budżetu i ryzyka…','Optimizing portfolio by budget and risk…'));await buildPortfolio({skipEnrich:false,silent:true});}
  await dbPut('scan_runs',{ts:now(),items:items.length,markets,qualities,apiRows:normalizedFresh.length,cacheRows:cached.length,errors,opportunities:state.opportunities.length,analysisDepth:depth,portfolioPositions:state.portfolio?.positions?.length||0,auto:!!opts.auto});
  el('kpiItems').textContent=fmt(items.length);el('lastScan').textContent=new Date().toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});el('scanBtn').disabled=false;el('stopBtn').disabled=true;el('validateBtn').disabled=state.opportunities.length===0;renderScanDiagnostics();setProgress(100,state.stop?tr('Skan przerwany.','Scan stopped.'):(state.lang==='en'?`Done: ${fmt(state.opportunities.length)} signals • models ${depth?'historical + local':'local'} • API ${fmt(normalizedFresh.length)}${cached.length?' • cache '+fmt(cached.length):''}.`:`Gotowe: ${fmt(state.opportunities.length)} sygnałów • modele ${depth?'historyczne + lokalne':'lokalne'} • API ${fmt(normalizedFresh.length)}${cached.length?' • cache '+fmt(cached.length):''}.`));await updateDbInfo();render();await saveSettings();
}


function portfolioExecutionFactor(profile){return profile==='conservative'?.08:profile==='aggressive'?.25:.15;}
function portfolioCapitalPerUnit(o){if(Number.isFinite(+o.capitalPerUnit)&&+o.capitalPerUnit>0)return +o.capitalPerUnit;const setup=o.mode==='relist'?(+o.setupFee||0):0;return Math.max(1,(+o.buy||0)+(+o.transportCost||0)+setup);}
function estimatedLiquidityCap(o,pcfg){
  const q=o.volume?.qty,base=pcfg.riskProfile==='conservative'?q?.safe:pcfg.riskProfile==='aggressive'?q?.aggressive:q?.normal;
  let cap=Number.isFinite(+base)?Math.floor(+base*pcfg.liquidityDays):0;
  if(!cap){const daily=+o.volume?.effectiveDaily||0,factor=portfolioExecutionFactor(pcfg.riskProfile);cap=daily>0?Math.floor(daily*pcfg.liquidityDays*factor):0;}
  if((o.confidence||0)<50)cap=Math.min(cap,1);else if((o.confidence||0)<65)cap=Math.min(cap,3);
  if((o.age||0)>12)cap=Math.min(cap,2);
  return clamp(Math.max(0,cap),0,pcfg.maxUnits);
}
function portfolioReason(o,cap){
  const parts=[];if((o.confidence||0)>=80)parts.push(tr('wysoka pewność','high confidence'));else if((o.confidence||0)>=65)parts.push(tr('dobry confidence','good confidence'));
  if((o.score||0)>=75)parts.push(tr('wysoki Opportunity','high Opportunity'));if((o.history?.sourceDiscount||0)>=12)parts.push(tr('zakup poniżej mediany','buy below median'));
  if((o.components?.liquidity||0)>=65)parts.push(tr('dobra płynność','good liquidity'));if((o.volume?.effectiveDaily||0)>0)parts.push(state.lang==='en'?`${(o.volume.effectiveDaily).toFixed(1)}/day volume`:`wolumen ${(o.volume.effectiveDaily).toFixed(1)}/dzień`);if(o.dest==='Black Market')parts.push('Black Market');
  parts.push(state.lang==='en'?`liquidity cap ${cap} units`:`limit płynności ${cap} szt.`);return parts.join(' • ');
}
function makePortfolioCandidates(pcfg){
  const raw=state.opportunities.filter(o=>o.profit>0&&o.roi>0&&(o.confidence||0)>=pcfg.minConfidence&&Number.isFinite(o.buy)&&o.buy>0);
  const bestPerItem=new Map();
  for(const o of raw){
    const capital=portfolioCapitalPerUnit(o),cap=estimatedLiquidityCap(o,pcfg),exec=clamp((o.confidence||0)/100,0,1),modelProfit=Math.max(0,o.profit)*exec;if(cap<=0)continue;
    const riskRoi=modelProfit/Math.max(1,capital)*100,liq=o.components?.liquidity??0,fresh=o.components?.freshness??50,ppd=Math.max(0,o.volume?.profitPerDayModel||0),velocity=100*(1-Math.exp(-ppd/180000));
    const utility=(.42*riskRoi+.58*velocity)*(.58+.42*(o.score||0)/100)*(.62+.38*liq/100)*(.84+.16*fresh/100);
    const c={...o,_capital:capital,_qtyCap:cap,_exec:exec,_modelUnitProfit:modelProfit,_riskRoi:riskRoi,_portfolioUtility:utility,_reason:portfolioReason(o,cap)};
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
  return{schemaVersion:7,key:'latest',createdAt:now(),config:pcfg,summary:{budget,investable,capital,free,targetReserve:budget-investable,nominalProfit,modelProfit,modelRoi:capital?modelProfit/capital*100:0,nominalRoi:capital?nominalProfit/capital*100:0,weightedConfidence,weightedScore,maxRouteShare,maxItemShare,positions:positions.length},positions};
}
function renderPortfolio(){
  const pf=state.portfolio,body=el('portfolioBody'),empty=el('portfolioEmpty');if(!body)return;
  if(!pf?.positions?.length){body.innerHTML='';empty.style.display='block';el('portfolioExportBtn').disabled=true;['pfBudget','pfCapital','pfFree','pfProfit','pfExpected'].forEach(id=>el(id).textContent='0');el('pfRoi').textContent='0%';el('portfolioStatus').textContent=tr('Nie zbudowano portfela.','Portfolio not built.');if(el('portfolioNote'))el('portfolioNote').textContent=tr('Najpierw wykonaj skan i zbuduj portfel z aktualnych sygnałów.','Run a scan first and build a portfolio from current signals.');return;}
  empty.style.display='none';el('portfolioExportBtn').disabled=false;const s=pf.summary;
  el('pfBudget').textContent=fmt(s.budget);el('pfCapital').textContent=fmt(s.capital);el('pfFree').textContent=fmt(s.free);el('pfProfit').textContent='+'+fmt(s.nominalProfit);el('pfExpected').textContent='+'+fmt(s.modelProfit);el('pfRoi').textContent=pct(s.modelRoi);
  el('portfolioStatus').textContent=state.lang==='en'?`${s.positions} positions • confidence ${s.weightedConfidence.toFixed(0)}/100 • volume-aware allocation • max route ${s.maxRouteShare.toFixed(0)}%`:`${s.positions} pozycji • confidence ${s.weightedConfidence.toFixed(0)}/100 • alokacja wg wolumenu • trasa max ${s.maxRouteShare.toFixed(0)}%`;
  body.innerHTML=pf.positions.map(x=>`<tr><td><b>${x.rank}</b></td><td><div class="itemcell"><img loading="lazy" src="${itemIcon(x.itemId,x.quality)}" alt=""><div><div class="itemname">${esc(displayItemNameById(x.itemId,state.lang==='en'?(x.itemNameEn||x.itemName):(x.itemNamePl||x.itemName)))}</div><div class="itemid">${esc(x.itemId)} • ${qualityName[x.quality]||x.quality}</div></div></div></td><td><div class="route"><b>${esc(marketLabel(x.source))}</b> → <b>${esc(marketLabel(x.dest))}</b></div><span class="tag info">${esc(translateDynamic(x.model||x.mode))}</span></td><td class="qty">${fmt(x.units)}</td><td>${(x.volumeDaily||0).toLocaleString(locale(),{maximumFractionDigits:1})}</td><td>${(x.liquidityScore||0).toFixed(0)}/100</td><td>${fmt(x.capital)}</td><td class="profit">+${fmt(x.nominalProfit)}</td><td class="profit">+${fmt(x.modelProfit)}</td><td>${(x.confidence||0).toFixed(0)}/100</td><td>${(x.utility||0).toFixed(1)}</td><td class="portfolio-reason">${esc(translateDynamic(x.reason))}</td></tr>`).join('');
  el('portfolioNote').innerHTML=state.lang==='en'?`Portfolio uses <b>${fmt(s.capital)}</b> of ${fmt(s.budget)} silver. Planned reserve: <b>${fmt(s.targetReserve)}</b>. Maximum exposure vs investable budget — item: <b>${s.maxItemShare.toFixed(1)}%</b>; route: <b>${s.maxRouteShare.toFixed(1)}%</b>. “Model profit” is nominal profit multiplied by Confidence Score; it is not a statistically calibrated probability or a guaranteed expected value.`:`Portfel używa <b>${fmt(s.capital)}</b> z ${fmt(s.budget)} silver. Planowana rezerwa: <b>${fmt(s.targetReserve)}</b>. Maks. ekspozycja względem inwestowalnego budżetu — przedmiot: <b>${s.maxItemShare.toFixed(1)}%</b>; trasa: <b>${s.maxRouteShare.toFixed(1)}%</b>. „Zysk modelowy” to zysk nominalny pomnożony przez Confidence Score; nie jest to statystycznie skalibrowane prawdopodobieństwo ani gwarantowana wartość oczekiwana.`;
}
async function buildPortfolio(opts={}){
  if(!state.opportunities.length){if(!opts.silent)alert(tr('Najpierw wykonaj skan okazji.','Run an opportunity scan first.'));return null;}
  const btn=el('portfolioBtn');if(btn){btn.disabled=true;btn.innerHTML=`<span class="spinner"></span>${tr('Portfel…','Portfolio…')}`;}
  try{
    if(!opts.skipEnrich){const need=[...state.opportunities].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,40).some(o=>!o.history);if(need)await enrichTop(Math.min(40,state.opportunities.length));}
    const pcfg=portfolioCfg(),candidates=makePortfolioCandidates(pcfg);state.portfolio=allocatePortfolio(candidates,pcfg);await dbPut('portfolios',state.portfolio);renderPortfolio();await updateDbInfo();
    if(!state.portfolio.positions.length&&!opts.silent)alert(tr('Brak okazji spełniających limity portfela. Zmniejsz minimalny Confidence albo zwiększ budżet/limity koncentracji.','No opportunities meet the portfolio limits. Lower minimum Confidence or increase budget/concentration limits.'));
    return state.portfolio;
  }finally{if(btn){btn.disabled=false;btn.textContent=tr('Zbuduj portfel','Build portfolio');}}
}
async function loadCachedPortfolio(){const pf=await dbGet('portfolios','latest');if(pf?.schemaVersion===7){state.portfolio=pf;renderPortfolio();return true;}state.portfolio=null;renderPortfolio();return false;}
function exportPortfolioCsv(){const pf=state.portfolio;if(!pf?.positions?.length)return;const cols=['rank','item_id','name','quality','source','destination','model','units','capital','buy_unit','sell_unit','profit_unit','nominal_profit','model_profit','confidence','opportunity_score','volume_day','liquidity_score','profit_day_model','liquidity_cap','reason'],lines=[cols.join(';'),...pf.positions.map(x=>[x.rank,x.itemId,displayItemNameById(x.itemId,state.lang==='en'?(x.itemNameEn||x.itemName):(x.itemNamePl||x.itemName)),qualityName[x.quality],marketLabel(x.source),marketLabel(x.dest),x.model,x.units,Math.round(x.capital),Math.round(x.buy),Math.round(x.sell),Math.round(x.profitPerUnit),Math.round(x.nominalProfit),Math.round(x.modelProfit),(x.confidence||0).toFixed(1),(x.score||0).toFixed(1),(x.volumeDaily||0).toFixed(2),(x.liquidityScore||0).toFixed(1),Math.round(x.profitPerDayModel||0),x.liquidityCap,translateDynamic(x.reason)].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';'))],blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='albion_portfolio_v5_2.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

function modelTags(o){let tags=[`<span class="tag info">${esc(o.model||modelLabel(o))}</span>`];if(o.history?.sourceDiscount>=12)tags.push(`<span class="tag good">- ${o.history.sourceDiscount.toFixed(0)}% ${tr('vs mediana','vs median')}</span>`);return `<div class="modelbox">${tags.join('')}</div>`;}
function flag(o){if(o.confidence>=78&&o.age<=6)return`<span class="tag good">${tr('wysoka pewność','high confidence')}</span>`;if(o.warnings?.some(x=>x.includes('ekstremalnie')||x.includes('znacznie powyżej')))return`<span class="tag bad">${tr('anomalia','anomaly')}</span>`;if(o.confidence<35)return`<span class="tag bad">${tr('wysokie ryzyko','high risk')}</span>`;if(o.age>24)return`<span class="tag bad">${tr('stara cena','stale price')}</span>`;if(o.confidence>=60)return`<span class="tag">${tr('dobry sygnał','good signal')}</span>`;return`<span class="tag warn">${tr('zweryfikuj','verify')}</span>`;}
function filteredResults(){
  let a=[...state.opportunities],q=el('resultSearch').value.trim().toLowerCase(),minC=+el('minConfidence').value||0,cfg=cfgFromUI();
  if(q)a=a.filter(o=>[displayOpportunityName(o),o.itemNamePl,o.itemNameEn,o.itemId,o.source,o.dest,o.model].some(x=>String(x).toLowerCase().includes(q)));
  if(state.watchOnly)a=a.filter(o=>state.watched.has(o.itemId));
  a=a.filter(o=>(o.confidence??0)>=minC);
  a=a.filter(o=>{const v=o.volume;if(cfg.requireVolume&&!v)return false;if(!v)return !cfg.requireVolume&&cfg.minVolumeDay<=0&&cfg.minVolume7<=0&&cfg.minLiquidityScore<=0;const d=v.effectiveDaily||0,v7=Math.min(v.source?.d7?.total??Infinity,v.destination?.d7?.total??v.source?.d7?.total??0),liq=v.liquidityScore||o.components?.liquidity||0,exit=v.qty?.exitDaysNormal??Infinity;return d>=cfg.minVolumeDay&&v7>=cfg.minVolume7&&liq>=cfg.minLiquidityScore&&exit<=cfg.maxExitDays;});
  const sort=el('sortBy').value;a.sort((x,y)=>sort==='profit'?y.profit-x.profit:sort==='roi'?y.roi-x.roi:sort==='age'?x.age-y.age:sort==='buy'?x.buy-y.buy:sort==='confidence'?(y.confidence||0)-(x.confidence||0):sort==='riskProfit'?(y.riskProfit||0)-(x.riskProfit||0):sort==='liquidity'?(y.volume?.liquidityScore||0)-(x.volume?.liquidityScore||0):sort==='volume'?(y.volume?.effectiveDaily||0)-(x.volume?.effectiveDaily||0):sort==='profitDay'?(y.volume?.profitPerDayModel||0)-(x.volume?.profitPerDayModel||0):sort==='exit'?(x.volume?.qty?.exitDaysNormal??Infinity)-(y.volume?.qty?.exitDaysNormal??Infinity):(y.score||0)-(x.score||0));return a;
}
function volumeCell(o){const v=o.volume;if(!v)return'<span class="muted">—</span>';return `<b>${v.effectiveDaily.toLocaleString(locale(),{maximumFractionDigits:1})}</b><div class="itemid">7d proxy/day</div>`;}
function qtyCell(o){const q=o.volume?.qty;if(!q)return'<span class="muted">—</span>';return `<span class="fresh">${fmt(q.safe)}</span> / <b>${fmt(q.normal)}</b> / <span class="stale">${fmt(q.aggressive)}</span>`;}
function exitText(o){const d=o.volume?.qty?.exitDaysNormal;if(!Number.isFinite(d))return'—';if(d<1)return `${Math.max(1,Math.round(d*24))} h`;return `${d.toLocaleString(locale(),{maximumFractionDigits:1})} d`;}
function render(){
  const a=filteredResults();el('emptyState').style.display=a.length?'none':'block';el('resultsBody').innerHTML=a.map((o,i)=>`<tr><td><button class="star ${state.watched.has(o.itemId)?'on':''}" data-watch="${esc(o.itemId)}">★</button></td><td><div class="itemcell"><img loading="lazy" src="${itemIcon(o.itemId,o.quality)}" alt=""><div><div class="itemname">${esc(displayOpportunityName(o))}</div><div class="itemid">${esc(o.itemId)} • ${qualityName[o.quality]||o.quality}</div></div></div></td><td>${modelTags(o)}</td><td class="route"><b>${esc(marketLabel(o.source))}</b> → <b>${esc(marketLabel(o.dest))}</b></td><td>${fmt(o.buy)}</td><td>${fmt(o.sell)}</td><td class="${o.profit>=0?'profit':'loss'}">+${fmt(o.profit)}</td><td class="${o.roi>=0?'profit':'loss'}">${pct(o.roi)}</td><td>${fmt(o.riskProfit)}</td><td>${volumeCell(o)}</td><td><b>${(o.volume?.liquidityScore||0).toFixed(0)}</b><div class="scorebar"><i style="width:${clamp(o.volume?.liquidityScore||0)}%"></i></div></td><td>${qtyCell(o)}</td><td>${exitText(o)}</td><td>${fmt(o.volume?.profitPerDayModel||0)}</td><td class="${o.age<=3?'fresh':o.age<=24?'stale':'old'}">${ageText(o.age)}</td><td><b>${(o.confidence||0).toFixed(0)}</b><div class="scorebar"><i style="width:${clamp(o.confidence||0)}%"></i></div></td><td><b>${(o.score||0).toFixed(0)}</b></td><td>${flag(o)}</td><td><button class="btn" data-detail="${i}">${tr('Szczegóły','Details')}</button></td></tr>`).join('');
  const bestProfit=a.reduce((m,x)=>Math.max(m,x.profit),0),bestRoi=a.reduce((m,x)=>Math.max(m,x.roi),0),avgAge=a.length?mean(a.map(x=>x.age)):NaN,avgC=a.length?mean(a.map(x=>x.confidence||0)):NaN,withVol=a.filter(x=>x.volume),avgVol=withVol.length?mean(withVol.map(x=>x.volume.effectiveDaily||0)):NaN,avgLiq=withVol.length?mean(withVol.map(x=>x.volume.liquidityScore||0)):NaN;el('kpiCount').textContent=fmt(a.length);el('kpiProfit').textContent=fmt(bestProfit);el('kpiRoi').textContent=pct(bestRoi);el('kpiAge').textContent=a.length?ageText(avgAge):'—';el('kpiConfidence').textContent=a.length?avgC.toFixed(0)+'/100':'—';if(el('kpiVolume'))el('kpiVolume').textContent=withVol.length?avgVol.toLocaleString(locale(),{maximumFractionDigits:1}):'—';if(el('kpiLiquidity'))el('kpiLiquidity').textContent=withVol.length?avgLiq.toFixed(0)+'/100':'—';
  renderScanDiagnostics();
  document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=async()=>{const id=b.dataset.watch;state.watched.has(id)?state.watched.delete(id):state.watched.add(id);await saveWatch();render();});document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(a[+b.dataset.detail]));
}
function compCard(label,v,desc=''){return `<div class="detail-card"><small>${esc(label)}</small><b>${Number.isFinite(v)?v.toFixed(0)+'/100':'—'}</b>${desc?`<small>${esc(desc)}</small>`:''}</div>`;}
function openDetail(o){
  el('detailTitle').textContent=`${displayOpportunityName(o)} — ${marketLabel(o.source)} → ${marketLabel(o.dest)}`;const vm=o.volume,sv=vm?.source,dv=vm?.destination,qv=vm?.qty;el('detailCards').innerHTML=`<div class="detail-card"><small>${tr('Model','Model')}</small><b>${esc(o.model||modelLabel(o))}</b></div><div class="detail-card"><small>${tr('Zysk netto','Net profit')}</small><b class="profit">+${fmt(o.profit)}</b></div><div class="detail-card"><small>ROI</small><b class="profit">${pct(o.roi)}</b></div><div class="detail-card"><small>Confidence</small><b>${(o.confidence||0).toFixed(0)}/100</b></div><div class="detail-card"><small>${tr('Wolumen / dzień','Volume / day')}</small><b>${vm?vm.effectiveDaily.toLocaleString(locale(),{maximumFractionDigits:1}):'—'}</b></div><div class="detail-card"><small>Liquidity Score</small><b>${vm?(vm.liquidityScore||0).toFixed(0)+'/100':'—'}</b></div><div class="detail-card"><small>${tr('Safe / Normal / Aggressive','Safe / Normal / Aggressive')}</small><b>${qv?`${fmt(qv.safe)} / ${fmt(qv.normal)} / ${fmt(qv.aggressive)}`:'—'}</b></div><div class="detail-card"><small>Model Profit/day</small><b class="profit">${vm?'+'+fmt(vm.profitPerDayModel):'—'}</b></div>`;
  const histCity=o.source,data=state.history.get(`${o.itemId}|${histCity}|${o.quality}`)||o.history?.points||[];drawChart(data,o.buy);
  const c=o.components||{};const breakdown=`<div class="breakdown">${compCard(tr('Świeżość','Freshness'),c.freshness)}${compCard('Spread',c.spread)}${compCard(tr('Powtarzalność','Persistence'),c.persistence)}${compCard(tr('Płynność','Liquidity'),c.liquidity)}${compCard(tr('Zmienność','Volatility'),c.volatility)}${compCard(tr('Zgodność z historią','History plausibility'),c.historyPlausibility)}</div>`;
  const warnings=o.warnings?.length?`<br><b>${tr('Ryzyka:','Risks:')}</b> ${o.warnings.map(x=>esc(translateDynamic(x))).join(' • ')}`:`<br><b>${tr('Ryzyka:','Risks:')}</b> ${tr('brak istotnych ostrzeżeń modelu.','no material model warnings.')}`;
  const hist=o.history?.source?.median?(state.lang==='en'?`<br>30-day source median: <b>${fmt(o.history.source.median)}</b>; average volume/day: <b>${(o.history.source.dailyVol||0).toFixed(1)}</b>.`:`<br>30-dniowa mediana źródła: <b>${fmt(o.history.source.median)}</b>; średni wolumen/dzień: <b>${(o.history.source.dailyVol||0).toFixed(1)}</b>.`):'';
  const volInfo=vm?(state.lang==='en'?`<br><b>Volume:</b> source 1/3/7/14/30d = ${fmt(sv?.d1?.total||0)} / ${fmt(sv?.d3?.total||0)} / ${fmt(sv?.d7?.total||0)} / ${fmt(sv?.d14?.total||0)} / ${fmt(sv?.d30?.total||0)} units; destination = ${dv?`${fmt(dv.d1?.total||0)} / ${fmt(dv.d3?.total||0)} / ${fmt(dv.d7?.total||0)} / ${fmt(dv.d14?.total||0)} / ${fmt(dv.d30?.total||0)}`:'n/a'}. Regularity: source ${(vm.sourceRegularity||0).toFixed(0)}%${vm.destinationRegularity!==null?`, destination ${(vm.destinationRegularity||0).toFixed(0)}%`:''}. Estimated normal exit: <b>${exitText(o)}</b>.`:`<br><b>Wolumen:</b> źródło 1/3/7/14/30d = ${fmt(sv?.d1?.total||0)} / ${fmt(sv?.d3?.total||0)} / ${fmt(sv?.d7?.total||0)} / ${fmt(sv?.d14?.total||0)} / ${fmt(sv?.d30?.total||0)} szt.; cel = ${dv?`${fmt(dv.d1?.total||0)} / ${fmt(dv.d3?.total||0)} / ${fmt(dv.d7?.total||0)} / ${fmt(dv.d14?.total||0)} / ${fmt(dv.d30?.total||0)}`:'brak'}. Regularność: źródło ${(vm.sourceRegularity||0).toFixed(0)}%${vm.destinationRegularity!==null?`, cel ${(vm.destinationRegularity||0).toFixed(0)}%`:''}. Szacowany normalny czas wyjścia: <b>${exitText(o)}</b>.`):'';
  const pfPos=state.portfolio?.positions?.find(x=>x.opportunityKey===o.key);const pfInfo=pfPos?(state.lang==='en'?`<br><b>Portfolio v5.2:</b> priority #${pfPos.rank}, ${fmt(pfPos.units)} units, capital ${fmt(pfPos.capital)}, model profit ${fmt(pfPos.modelProfit)}.`:`<br><b>Portfel v5.2:</b> priorytet #${pfPos.rank}, ${fmt(pfPos.units)} szt., kapitał ${fmt(pfPos.capital)}, zysk modelowy ${fmt(pfPos.modelProfit)}.`):'';
  el('detailNote').innerHTML=state.lang==='en'?`Buy: <b>${fmt(o.buy)}</b> in ${esc(marketLabel(o.source))}. Target: <b>${fmt(o.sell)}</b> in ${esc(marketLabel(o.dest))}. Required capital / unit: <b>${fmt(portfolioCapitalPerUnit(o))}</b>. Confidence-weighted profit: <b>${fmt(o.riskProfit)}</b>. Opportunity Score: <b>${(o.score||0).toFixed(0)}/100</b>.${hist}${volInfo}${pfInfo}${warnings}<br><span class="muted">Confidence Score is a heuristic signal-quality measure, not a guarantee of execution or available quantity.</span>${breakdown}`:`Kupno: <b>${fmt(o.buy)}</b> w ${esc(marketLabel(o.source))}. Cel: <b>${fmt(o.sell)}</b> w ${esc(marketLabel(o.dest))}. Kapitał wymagany / szt.: <b>${fmt(portfolioCapitalPerUnit(o))}</b>. Zysk ważony pewnością: <b>${fmt(o.riskProfit)}</b>. Opportunity Score: <b>${(o.score||0).toFixed(0)}/100</b>.${hist}${volInfo}${pfInfo}${warnings}<br><span class="muted">Confidence Score jest heurystyką jakości sygnału, nie gwarancją wykonania transakcji ani dostępnej liczby sztuk.</span>${breakdown}`;
  el('detailDialog').showModal();
}
function drawChart(data,current){const svg=el('historyChart'),pts=(data||[]).map(x=>({p:+x.avg_price,t:parseHistoryTime(x.timestamp)})).filter(x=>x.p>0&&Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);if(!pts.length){svg.innerHTML=`<text x="440" y="110" text-anchor="middle" fill="#8392a8" font-size="13">${tr('Brak historii dla tego sygnału.','No history for this signal.')}</text>`;return;}const w=880,h=220,pad=25,min=Math.min(...pts.map(x=>x.p),current),max=Math.max(...pts.map(x=>x.p),current),span=Math.max(1,max-min),x=i=>pad+i*(w-pad*2)/Math.max(1,pts.length-1),y=v=>h-pad-(v-min)/span*(h-pad*2),path=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.p).toFixed(1)).join(' '),cy=y(current);svg.innerHTML=`<line x1="${pad}" y1="${cy}" x2="${w-pad}" y2="${cy}" stroke="#d6a84b" stroke-dasharray="6 5" opacity=".7"/><path d="${path}" fill="none" stroke="#64b5f6" stroke-width="2.5"/><text x="${pad}" y="17" fill="#93a3b8" font-size="11">${tr('30 dni','30 days')} • AODP sell history</text><text x="${w-pad}" y="${Math.max(15,cy-6)}" text-anchor="end" fill="#d6a84b" font-size="11">${tr('zakup','buy')} ${fmt(current)}</text>`;}
function exportCsv(){const a=filteredResults();if(!a.length)return;const cols=['item_id','name','quality','model','source','destination','buy','sell','profit','roi_pct','risk_weighted_profit','volume_day','volume_7d','liquidity_score','safe_qty','normal_qty','aggressive_qty','exit_days_normal','profit_day_model','age_h','confidence','opportunity_score','mode'],lines=[cols.join(';'),...a.map(o=>[o.itemId,displayOpportunityName(o),qualityName[o.quality],o.model,marketLabel(o.source),marketLabel(o.dest),Math.round(o.buy),Math.round(o.sell),Math.round(o.profit),o.roi.toFixed(2),Math.round(o.riskProfit||0),(o.volume?.effectiveDaily||0).toFixed(2),Math.round(Math.min(o.volume?.source?.d7?.total??0,o.volume?.destination?.d7?.total??o.volume?.source?.d7?.total??0)),(o.volume?.liquidityScore||0).toFixed(1),o.volume?.qty?.safe||0,o.volume?.qty?.normal||0,o.volume?.qty?.aggressive||0,Number.isFinite(o.volume?.qty?.exitDaysNormal)?o.volume.qty.exitDaysNormal.toFixed(2):'',Math.round(o.volume?.profitPerDayModel||0),o.age.toFixed(2),(o.confidence||0).toFixed(1),(o.score||0).toFixed(1),o.mode].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'))],blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),ael=document.createElement('a');ael.href=u;ael.download='albion_europe_opportunities_v5_2.csv';ael.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function loadCachedOpportunities(){let ops=await dbGetAll('opportunities');ops=ops.filter(x=>x.schemaVersion===7);if(!ops.length){await dbClear('opportunities');return false;}state.opportunities=ops;el('validateBtn').disabled=false;const newest=ops.reduce((m,x)=>Math.max(m,x.calculatedAt||0),0);el('lastScan').textContent=newest?new Date(newest).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})+' cache':'cache';setProgress(0,state.lang==='en'?`Showing ${fmt(ops.length)} opportunities from local.db.`:`Pokazano ${fmt(ops.length)} okazji z local.db.`);render();return true;}
async function exportDB(){const payload={format:'albion-market-local-db',version:DB_VERSION,exportedAt:new Date().toISOString(),stores:{}};for(const s of DB_STORES)payload.stores[s]=await dbGetAll(s);const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`albion-local-db-v5_2-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function importDBFile(file){const txt=await file.text(),j=JSON.parse(txt);if(j?.format!=='albion-market-local-db'||!j.stores)throw new Error(tr('Nieprawidłowy backup','Invalid backup'));for(const s of DB_STORES){await dbClear(s);if(Array.isArray(j.stores[s]))await dbPutMany(s,j.stores[s]);}state.watched=new Set((await dbGetAll('watchlist')).map(x=>x.itemId));setItems(await dbGetAll('items'));state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));await loadSettings();await loadCachedOpportunities();await loadCachedPortfolio();await updateDbInfo();}
async function clearCache(){if(!confirm(tr('Wyczyścić ceny, historię, modele rynku i zapisane okazje? Baza przedmiotów i ustawienia zostaną.','Clear prices, history, market models and saved opportunities? Item database and settings will remain.')))return;for(const s of ['prices','history','opportunities','scan_runs','market_stats','portfolios'])await dbClear(s);state.opportunities=[];state.portfolio=null;state.history.clear();state.marketStats.clear();render();renderPortfolio();await updateDbInfo();setProgress(0,tr('Lokalny cache i profile modeli wyczyszczone.','Local cache and model profiles cleared.'));}
function scheduleAuto(){clearInterval(autoTimer);const m=+el('autoRefresh').value||0;if(m>0)autoTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!el('scanBtn').disabled)scan({auto:true}).catch(()=>{});},m*60000);}
function bind(){
  el('languageSelect').onchange=e=>applyLanguage(e.target.value,true);
  el('allCategories').onclick=()=>{setSelectedCategories(CATEGORY_LEAVES);queueSaveSettings();};el('clearCategories').onclick=()=>{setSelectedCategories([]);queueSaveSettings();};el('equipmentCategories').onclick=()=>{setSelectedCategories([...EQUIPMENT_CATEGORIES]);queueSaveSettings();};
  el('allMarkets').onclick=()=>{document.querySelectorAll('.marketCheck').forEach(x=>x.checked=true);queueSaveSettings();};el('royalMarkets').onclick=()=>{document.querySelectorAll('.marketCheck').forEach(x=>x.checked=!!MARKETS.find(m=>m.api===x.value)?.royal);queueSaveSettings();};
  el('scanBtn').onclick=()=>scan();el('stopBtn').onclick=()=>{state.stop=true;state.scanId++;el('stopBtn').disabled=true;el('scanBtn').disabled=false;};el('validateBtn').onclick=()=>enrichTop(Math.min(50,state.opportunities.length),true);el('portfolioBtn').onclick=()=>buildPortfolio();el('portfolioExportBtn').onclick=exportPortfolioCsv;el('resultSearch').oninput=render;el('sortBy').onchange=render;el('minConfidence').oninput=render;['minVolumeDay','minVolume7','minLiquidityScore','maxExitDays','requireVolume'].forEach(id=>{if(el(id))el(id).oninput=render;});el('watchOnly').onclick=()=>{state.watchOnly=!state.watchOnly;el('watchOnly').textContent=state.watchOnly?tr('★ Wszystkie wyniki','★ All results'):tr('★ Obserwowane','★ Watched');render();};el('exportBtn').onclick=exportCsv;el('closeDialog').onclick=()=>el('detailDialog').close();el('dbExportBtn').onclick=exportDB;el('dbImportBtn').onclick=()=>el('dbImportFile').click();el('dbImportFile').onchange=async e=>{try{if(e.target.files[0])await importDBFile(e.target.files[0]);setProgress(100,tr('Backup local.db zaimportowany.','local.db backup imported.'));}catch(err){alert(tr('Import nieudany: ','Import failed: ')+err.message);}e.target.value='';};el('loadCacheBtn').onclick=loadCachedOpportunities;el('dbClearBtn').onclick=clearCache;
  document.querySelectorAll('thead th[data-sort]').forEach(th=>th.onclick=()=>{const s=th.dataset.sort;if(['profit','roi','age','buy','score','confidence','riskProfit','volume','liquidity','profitDay','exit'].includes(s)){el('sortBy').value=s;render();}});
  document.querySelectorAll('input,select').forEach(x=>{if(!['resultSearch','dbImportFile','minConfidence'].includes(x.id))x.addEventListener('change',queueSaveSettings);});el('minConfidence').addEventListener('change',queueSaveSettings);['portfolioBudget','portfolioReservePct','portfolioMaxItemPct','portfolioMaxRoutePct','portfolioMaxPositions','portfolioMaxUnits','portfolioMinConfidence','portfolioLiquidityDays','riskProfile'].forEach(id=>el(id)?.addEventListener('change',()=>{if(state.portfolio?.positions?.length)el('portfolioStatus').textContent=tr('Parametry zmienione — kliknij „Zbuduj portfel”.','Parameters changed — click “Build portfolio”.');}));document.addEventListener('change',e=>{if(e.target.classList?.contains('marketCheck'))queueSaveSettings();if(e.target.classList?.contains('categoryGroupCheck')){const g=e.target.dataset.group;document.querySelectorAll(`.categoryLeafCheck[data-group="${g}"]`).forEach(x=>x.checked=e.target.checked);updateCategoryParents();updateCategorySummary();queueSaveSettings();}if(e.target.classList?.contains('categoryLeafCheck')){updateCategoryParents();updateCategorySummary();queueSaveSettings();}});window.addEventListener('online',pingApi);window.addEventListener('offline',()=>{el('apiStatus').textContent='offline';el('apiStatus').style.color='var(--bad)';});
}
async function init(){renderMarkets();renderCategories(CATEGORY_LEAVES);bind();renderPortfolio();try{await openLocalDB();setDbStatus(tr('gotowa','ready'));const w=await dbGetAll('watchlist');state.watched=new Set(w.map(x=>x.itemId));state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));await loadSettings();await updateDbInfo();setProgress(3,tr('Ładowanie bazy przedmiotów…','Loading item database…'));await loadItems();await loadCachedOpportunities();await loadCachedPortfolio();setProgress(0,state.opportunities.length?tr('Gotowy — pokazano ostatni cache.','Ready — showing latest cache.'):tr('Gotowy — łączenie z API…','Ready — connecting to API…'));await pingApi();scheduleAuto();if(el('autoStart').value==='yes'&&navigator.onLine)setTimeout(()=>scan({auto:true}).catch(()=>{}),700);}catch(e){setDbStatus(tr('błąd','error'),false);el('dbStatus').textContent=tr('błąd','error');setProgress(0,tr('Błąd inicjalizacji: ','Initialization error: ')+(e.message||e));}
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}
init();
})();
