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
const DB_VERSION=4;
const DB_STORES=['items','prices','history','watchlist','settings','opportunities','scan_runs','market_stats','portfolios'];
const PROFILE = {
  conservative:{freshHalfLife:8, confidenceWeight:.62, profitWeight:.28, valueWeight:.10, crossedPenalty:42, anomalyPenalty:42},
  balanced:{freshHalfLife:14, confidenceWeight:.50, profitWeight:.38, valueWeight:.12, crossedPenalty:30, anomalyPenalty:30},
  aggressive:{freshHalfLife:24, confidenceWeight:.38, profitWeight:.50, valueWeight:.12, crossedPenalty:18, anomalyPenalty:20}
};

const el = id => document.getElementById(id);
const state = {items:[],raw:[],opportunities:[],portfolio:null,stop:false,watched:new Set(),history:new Map(),scanId:0,watchOnly:false,lastApiOk:false,marketStats:new Map()};
let db=null,settingsTimer=null,autoTimer=null;

const fmt = n => Number.isFinite(+n) ? Math.round(+n).toLocaleString('pl-PL') : '—';
const pct = n => Number.isFinite(+n) ? (+n).toFixed(1).replace('.',',')+'%' : '—';
const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const now = () => Date.now();
const clamp = (n,a=0,b=100) => Math.max(a,Math.min(b,n));
const ageHours = d => {const t=Date.parse(d);return Number.isFinite(t)?Math.max(0,(now()-t)/36e5):Infinity;};
const ageText = h => !Number.isFinite(h)?'brak':h<1?Math.round(h*60)+' min':h<48?h.toFixed(1)+' h':(h/24).toFixed(1)+' d';
const marketLabel = api => MARKETS.find(m=>m.api===api)?.label || api;
const itemIcon = (id,q=1) => `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?quality=${q}&size=64`;
const dbKeyPrice = r => `${r.item_id}|${r.city}|${+r.quality||1}`;
const statKey = (itemId,city,quality) => `${itemId}|${city}|${quality}`;
const median = a => {if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const mean = a => a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;

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
  el('localDbInfo').textContent=`IndexedDB: ${fmt(prices.length)} cen • ${fmt(hist.length)} serii historii • ${fmt(stats.length)} profili rynku • ${fmt(ops.length)} okazji • ${fmt(portfolios.length)} portfeli${newest?' • cache '+new Date(newest).toLocaleString('pl-PL'):''}.`;
}
async function saveWatch(){await dbClear('watchlist');await dbPutMany('watchlist',[...state.watched].map(itemId=>({itemId})));}
function currentSettings(){
  const ids=['itemQuery','tier','enchant','quality','scanLimit','mode','riskProfile','analysisDepth','premium','setupFee','undercut','transport','minProfit','minRoi','maxAge','minBuy','minConfidence','excludeSame','onlyFreshBoth','portfolioBudget','portfolioReservePct','portfolioMaxItemPct','portfolioMaxRoutePct','portfolioMaxPositions','portfolioMaxUnits','portfolioMinConfidence','portfolioLiquidityDays','autoPortfolio','autoRefresh','autoStart','useCache'];
  const v={};for(const id of ids){const x=el(id);if(x)v[id]=x.type==='checkbox'?x.checked:x.value;}
  v.markets=selectedMarkets();return v;
}
async function saveSettings(){if(!db)return;await dbPut('settings',{key:'ui',value:currentSettings(),savedAt:now()});scheduleAuto();}
async function loadSettings(){
  const rec=await dbGet('settings','ui');if(!rec?.value)return;
  const v=rec.value;for(const [id,val] of Object.entries(v)){const x=el(id);if(!x||id==='markets')continue;if(x.type==='checkbox')x.checked=!!val;else x.value=String(val);}
  if(Array.isArray(v.markets)){const set=new Set(v.markets);document.querySelectorAll('.marketCheck').forEach(x=>x.checked=set.has(x.value));}
}
function queueSaveSettings(){clearTimeout(settingsTimer);settingsTimer=setTimeout(()=>saveSettings().catch(()=>{}),350);}

function renderMarkets(){el('markets').innerHTML=MARKETS.map((m,i)=>`<label class="check"><input type="checkbox" class="marketCheck" value="${esc(m.api)}" ${i<7?'checked':''}> ${esc(m.label)}</label>`).join('');}
function selectedMarkets(){return [...document.querySelectorAll('.marketCheck:checked')].map(x=>x.value);}
function normalizeItem(x){const id=x.UniqueName||x.uniqueName||x.unique_name||x.item_id||x.id;if(!id)return null;const names=x.LocalizedNames||x.localizedNames||x.localized_names||{};const name=names['PL-PL']||names['pl-PL']||names['EN-US']||names['en-US']||x.LocalizedName||x.name||id;return{id:String(id),name:String(name),index:x.Index??x.index??null};}
function isLikelyTradeable(id){if(!/^T[2-8]_/.test(id))return false;const bad=['QUESTITEM','UNIQUE','TOKEN','SKILLBOOK','JOURNAL_EMPTY','FURNITURE_','MOBDROP_','TREASURE_','FACTION_','CRYSTAL_','DEBUG','NONTRADABLE'];return !bad.some(k=>id.includes(k));}
async function fetchJson(url,timeout=18000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}}
async function loadItems(){
  let lastErr=null;const meta=await dbGet('settings','items_meta'),cached=await dbGetAll('items');
  if(cached.length&&meta?.fetchedAt&&now()-meta.fetchedAt<7*864e5){state.items=cached;el('dbStatus').textContent=fmt(cached.length);return;}
  for(const url of ITEMS_URLS){try{const j=await fetchJson(url,25000),arr=Array.isArray(j)?j:(j.items||Object.values(j));let items=arr.map(normalizeItem).filter(Boolean).filter(x=>isLikelyTradeable(x.id));items=[...new Map(items.map(x=>[x.id,x])).values()];state.items=items;await dbClear('items');await dbPutMany('items',items);await dbPut('settings',{key:'items_meta',fetchedAt:now(),source:url});el('dbStatus').textContent=fmt(items.length);return;}catch(e){lastErr=e;}}
  if(cached.length){state.items=cached;el('dbStatus').textContent=fmt(cached.length);return;}throw lastErr||new Error('Nie udało się pobrać bazy przedmiotów');
}
async function pingApi(){try{await fetchJson(`${API}/api/v2/stats/prices/T4_BAG.json?locations=Caerleon&qualities=1`,9000);state.lastApiOk=true;el('apiStatus').textContent='online';el('apiStatus').style.color='var(--good)';return true;}catch{state.lastApiOk=false;el('apiStatus').textContent=navigator.onLine?'błąd/CORS':'offline';el('apiStatus').style.color='var(--bad)';return false;}}
function priority(id){let p=0;if(/_(BAG|CAPE|MOUNT|POTION|MEAL|FOOD|ORE|METALBAR|WOOD|PLANKS|HIDE|LEATHER|FIBER|CLOTH|ROCK|STONEBLOCK)/.test(id))p+=5;if(/_(MAIN_|2H_|ARMOR_|HEAD_|SHOES_|OFF_)/.test(id))p+=4;const t=+(/^T(\d)/.exec(id)?.[1]||0);p+=t;if(id.includes('@'))p+=2;return p;}
function buildItemSelection(){const q=el('itemQuery').value.trim().toLowerCase(),tier=el('tier').value,ench=el('enchant').value,limit=clamp(+el('scanLimit').value||500,10,2500);let a=state.items.filter(it=>{const id=it.id,base=id.split('@')[0],t=/^T(\d)_/.exec(base)?.[1],e=id.includes('@')?id.split('@').pop():'0';if(tier!=='all'&&t!==tier)return false;if(ench!=='all'&&e!==ench)return false;if(q&&!(it.name.toLowerCase().includes(q)||id.toLowerCase().includes(q)))return false;return true;});if(!q)a.sort((a,b)=>priority(b.id)-priority(a.id));return a.slice(0,limit);}
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
  if(!stat)return 28;const u=stat[`${side}Updates`]||0,c=stat[`${side}ChangeCount`]||0,dev=stat[`${side}DevEma`]||0;
  const updateScore=clamp(18+Math.log1p(u)*21),changeHealth=u?clamp(35+50*(c/u)):35,stability=clamp(100-dev*350);
  return clamp(.55*updateScore+.20*changeHealth+.25*stability);
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
  const crossedSrc=+b.buy_price_max>0&&+b.buy_price_max>+b.sell_price_min, crossedDst=+d.sell_price_min>0&&+d.buy_price_max>+d.sell_price_min;
  if(crossedSrc||crossedDst){dataQuality-=prof.crossedPenalty;warnings.push('skrzyżowane notowania — możliwa różnica czasu aktualizacji');}
  if(ageA>cfg.maxAge*.75||ageB>cfg.maxAge*.75)warnings.push('cena blisko limitu świeżości');
  if(spreadScore(d)<35)warnings.push('duży spread na rynku docelowym');
  const confidence=clamp(.45*fresh+.22*spr+.20*persistence+.13*clamp(dataQuality));
  return{confidence,components:{freshness:fresh,spread:spr,persistence,dataQuality:clamp(dataQuality),liquidity:null,volatility:null,historyPlausibility:null,value:null},warnings,age:Math.max(ageA,ageB)};
}
function cfgFromUI(){return{minBuy:+el('minBuy').value||0,minProfit:+el('minProfit').value||0,minRoi:+el('minRoi').value||0,maxAge:+el('maxAge').value||24,minConfidence:+el('minConfidence').value||0,excludeSame:el('excludeSame').checked,freshBoth:el('onlyFreshBoth').checked,tax:el('premium').value==='yes'?4:8,setup:+el('setupFee').value||0,undercut:+el('undercut').value||0,transport:+el('transport').value||0,riskProfile:el('riskProfile').value||'balanced'};}
function portfolioCfg(){return{budget:Math.max(0,+el('portfolioBudget').value||0),reservePct:clamp(+el('portfolioReservePct').value||0,0,90),maxItemPct:clamp(+el('portfolioMaxItemPct').value||20,1,100),maxRoutePct:clamp(+el('portfolioMaxRoutePct').value||40,1,100),maxPositions:clamp(+el('portfolioMaxPositions').value||12,1,50),maxUnits:clamp(+el('portfolioMaxUnits').value||25,1,500),minConfidence:clamp(+el('portfolioMinConfidence').value||55,0,100),liquidityDays:Math.max(.1,+el('portfolioLiquidityDays').value||1),riskProfile:el('riskProfile').value||'balanced'};}
function modelLabel(o){if(o.dest==='Black Market')return'Black Market';if(o.mode==='instant')return'Instant arbitrage';if(o.history?.sourceDiscount>=12)return'Mean reversion';if((o.cityDiscount||0)>=12)return'City gap';return'Relist spread';}
function recalcScore(o,cfg){
  const prof=PROFILE[cfg.riskProfile]||PROFILE.balanced,pScore=profitScore(o.profit,o.roi),value=o.components?.value??50;
  o.riskProfit=Math.max(0,o.profit)*(0.20+0.80*(o.confidence/100));
  o.score=clamp(prof.confidenceWeight*o.confidence+prof.profitWeight*pScore+prof.valueWeight*value);
  o.model=modelLabel(o);return o;
}
function calcMode(rowsByItem,itemMap,mode,cfg){
  const result=[];
  for(const [itemId,rows] of rowsByItem){
    const cityAsks=rows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>+r.sell_price_min),cityMedian=median(cityAsks);
    const buys=rows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>=cfg.minBuy).map(r=>({...r,_ageSell:ageHours(r.sell_price_min_date)}));
    const destinations=mode==='instant'?rows.filter(r=>+r.buy_price_max>0).map(r=>({...r,_destPrice:+r.buy_price_max,_destAge:ageHours(r.buy_price_max_date),_destDate:r.buy_price_max_date})):rows.filter(r=>r.city!=='Black Market'&&+r.sell_price_min>0).map(r=>({...r,_destPrice:+r.sell_price_min*(1-cfg.undercut/100),_destAge:ageHours(r.sell_price_min_date),_destDate:r.sell_price_min_date}));
    for(const b of buys){for(const d of destinations){
      if(cfg.excludeSame&&b.city===d.city)continue;if(+b.quality!==+d.quality)continue;if(cfg.freshBoth&&(b._ageSell>cfg.maxAge||d._destAge>cfg.maxAge))continue;
      const buy=+b.sell_price_min,gross=d._destPrice;if(!(buy>0&&gross>0))continue;
      const tax=Math.ceil(gross*cfg.tax/100),setup=mode==='relist'?Math.ceil(gross*cfg.setup/100):0,fees=tax+setup,profit=gross-fees-buy-cfg.transport,roi=profit/buy*100,capitalPerUnit=buy+cfg.transport+setup;
      if(profit<cfg.minProfit||roi<cfg.minRoi)continue;
      const base=baseConfidence(b,d,mode,cfg),item=itemMap.get(itemId)||{id:itemId,name:itemId};
      const cityDiscount=Number.isFinite(cityMedian)&&cityMedian>0?(1-buy/cityMedian)*100:0;
      const cityValue=Number.isFinite(cityMedian)&&cityMedian>0?sourceValueScore(buy,{median:cityMedian}):50;
      base.components.value=cityValue;
      if(cityDiscount>65)base.warnings.push('cena zakupu ekstremalnie poniżej bieżącej mediany miast — sprawdź świeżość');
      const o={schemaVersion:4,key:`${itemId}|${b.quality}|${b.city}|${d.city}|${mode}`,itemId,itemName:item.name,quality:+b.quality,source:b.city,dest:d.city,buy,sell:gross,profit,roi,fees,taxFee:tax,setupFee:setup,transportCost:cfg.transport,capitalPerUnit,sourceDate:b.sell_price_min_date,destDate:d._destDate,age:base.age,confidence:base.confidence,components:base.components,warnings:base.warnings,cityMedian,cityDiscount,mode,history:null,calculatedAt:now(),sourceRow:b,destRow:d};
      recalcScore(o,cfg);result.push(o);
    }}
  }
  const best=new Map();for(const o of result){const k=o.itemId+'|'+o.quality+'|'+o.mode;if(!best.has(k)||best.get(k).score<o.score)best.set(k,o);}return [...best.values()];
}
function calcOpportunities(rowsByItem,itemMap,mode,cfg){
  if(mode==='smart')return[...calcMode(rowsByItem,itemMap,'instant',cfg),...calcMode(rowsByItem,itemMap,'relist',cfg)];
  return calcMode(rowsByItem,itemMap,mode,cfg);
}
async function saveOpportunities(ops){await dbClear('opportunities');const cleaned=ops.map(({sourceRow,destRow,...o})=>o);await dbPutMany('opportunities',cleaned);}

function historyMetrics(data){
  const prices=(data||[]).map(x=>+x.avg_price).filter(x=>x>0),volumes=(data||[]).map(x=>+x.item_count).filter(x=>Number.isFinite(x)&&x>=0);if(!prices.length)return null;
  const med=median(prices),avg=mean(prices),mad=median(prices.map(x=>Math.abs(x-med))),robustVol=med>0?(1.4826*mad/med):1,dailyVol=mean(volumes)||0;
  return{median:med,avg,mad,robustVol,dailyVol,points:prices.length};
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
  const key=`${itemId}|${city}|${quality}`,cached=await dbGet('history',key);if(cached?.fetchedAt&&now()-cached.fetchedAt<6*36e5)return cached.data||[];
  const end=new Date(),start=new Date(now()-14*864e5),ds=d=>d.toISOString().slice(0,10),url=`${API}/api/v2/stats/history/${encodeURIComponent(itemId)}.json?date=${ds(start)}&end_date=${ds(end)}&locations=${encodeURIComponent(city)}&qualities=${quality}&time-scale=24`;
  try{const j=await fetchJson(url,18000),h=(j||[]).find(x=>x.item_id===itemId&&x.location===city&&+x.quality===+quality),data=h?.data||[];await dbPut('history',{key,itemId,city,quality:+quality,data,fetchedAt:now()});return data;}catch{return cached?.data||[];}
}
async function enrichOne(o,cfg){
  const srcData=await historyFor(o.itemId,o.source,o.quality),dstData=o.dest==='Black Market'?[]:await historyFor(o.itemId,o.dest,o.quality),sm=historyMetrics(srcData),dm=historyMetrics(dstData);
  state.history.set(`${o.itemId}|${o.source}|${o.quality}`,srcData);if(dstData.length)state.history.set(`${o.itemId}|${o.dest}|${o.quality}`,dstData);
  const sourceValue=sourceValueScore(o.buy,sm),plaus=destinationPlausibility(o,dm),liq=liquidityScore(dm?.dailyVol??sm?.dailyVol??0),vol=volatilityScore(dm?.robustVol??sm?.robustVol??.4);
  let historyPlausibility=.55*plaus+.45*sourceValue,warnings=[...(o.warnings||[])];
  const sourceRatio=sm?.median?o.buy/sm.median:null,destRatio=dm?.median?o.sell/dm.median:null;
  const sourceDiscount=sourceRatio?Math.max(-200,(1-sourceRatio)*100):null;
  if(sourceRatio&&sourceRatio<.38){historyPlausibility-=30;warnings.push('cena zakupu ekstremalnie poniżej 14-dniowej mediany — możliwy stary rekord');}
  if(o.mode==='instant'&&destRatio&&destRatio>1.65){historyPlausibility-=30;warnings.push('buy order znacznie powyżej historycznej ceny sprzedaży — wysoka szansa nieaktualnego sygnału');}
  if(liq<35)warnings.push('niski historyczny obrót');if(vol<35)warnings.push('wysoka zmienność ceny');
  const c=o.components||{},fresh=c.freshness??50,spread=c.spread??50,persist=c.persistence??40,dataQ=c.dataQuality??50;
  o.components={...c,liquidity:liq,volatility:vol,historyPlausibility:clamp(historyPlausibility),value:sourceValue};
  o.confidence=clamp(.28*fresh+.14*spread+.14*persist+.08*dataQ+.18*liq+.12*vol+.06*clamp(historyPlausibility));
  o.history={source:sm,destination:dm,sourceDiscount,destinationRatio:destRatio,points:srcData,basis:'AODP sell history; destination history is a valuation proxy for instant buy orders'};
  o.warnings=[...new Set(warnings)];recalcScore(o,cfg);return o;
}
async function enrichTop(limit,manual=false){
  const cfg=cfgFromUI(),top=[...state.opportunities].sort((a,b)=>b.score-a.score).slice(0,limit);if(!top.length)return;
  el('validateBtn').disabled=true;el('validateBtn').innerHTML='<span class="spinner"></span>Modele…';
  for(let i=0;i<top.length;i++){if(state.stop)break;await enrichOne(top[i],cfg);setProgress(84+(i+1)/top.length*15,`Modele historii ${i+1}/${top.length} • liquidity • volatility • anomaly…`);await sleep(170);}
  await saveOpportunities(state.opportunities);el('validateBtn').disabled=false;el('validateBtn').textContent='Przelicz modele historii';render();await updateDbInfo();if(manual)setProgress(100,`Przeliczono modele historii dla top ${top.length}.`);
}

async function scan(opts={}){
  if(el('scanBtn').disabled&&!opts.auto)return;const markets=selectedMarkets();if(markets.length<2){if(!opts.auto)alert('Wybierz co najmniej dwa markety.');return;}
  const items=buildItemSelection();if(!items.length){if(!opts.auto)alert('Brak przedmiotów pasujących do filtrów.');return;}
  const qualities=el('quality').value==='all'?[1,2,3,4,5]:[+el('quality').value],batches=batchesByUrl(items,markets,qualities),scanId=++state.scanId;state.stop=false;state.raw=[];state.opportunities=[];state.portfolio=null;renderPortfolio();el('scanBtn').disabled=true;el('stopBtn').disabled=false;el('validateBtn').disabled=true;setProgress(0,`${opts.auto?'Auto-skan':'Start'}: ${fmt(items.length)} przedmiotów, ${batches.length} partii…`);
  const fresh=[];let errors=0;
  for(let i=0;i<batches.length;i++){if(state.stop||scanId!==state.scanId)break;const ids=batches[i].map(x=>x.id).join(','),url=`${API}/api/v2/stats/prices/${encodeURIComponent(ids).replace(/%2C/g,',')}.json?locations=${encodeURIComponent(markets.join(','))}&qualities=${qualities.join(',')}`;try{const j=await fetchJson(url,18000);if(Array.isArray(j))fresh.push(...j);state.lastApiOk=true;el('apiStatus').textContent='online';el('apiStatus').style.color='var(--good)';}catch{errors++;state.lastApiOk=false;el('apiStatus').textContent=navigator.onLine?'częściowy błąd':'offline';el('apiStatus').style.color='var(--bad)';}setProgress((i+1)/batches.length*72,`API ${i+1}/${batches.length} • rekordy: ${fmt(fresh.length)}${errors?' • błędy: '+errors:''}`);if(i<batches.length-1)await sleep(210);}
  const normalizedFresh=fresh.length?await persistPriceRows(fresh):[];if(normalizedFresh.length)await updateMarketStats(normalizedFresh);else state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));
  let cached=[];if(el('useCache').checked&&(errors||!normalizedFresh.length))cached=await cachedRowsFor(items,markets,qualities);const rows=mergeRows(normalizedFresh,cached);state.raw=rows;
  if(!rows.length){el('scanBtn').disabled=false;el('stopBtn').disabled=true;setProgress(0,'Brak danych API i brak lokalnego cache.');await updateDbInfo();return;}
  const map=new Map(items.map(x=>[x.id,x])),byItem=new Map();for(const r of rows){if(!byItem.has(r.item_id))byItem.set(r.item_id,[]);byItem.get(r.item_id).push(r);}
  const cfg=cfgFromUI();state.opportunities=calcOpportunities(byItem,map,el('mode').value,cfg);await saveOpportunities(state.opportunities);render();
  const depth=+el('analysisDepth').value||0;if(depth>0&&!state.stop){setProgress(83,`Wstępnie ${fmt(state.opportunities.length)} okazji. Uruchamiam modele historyczne…`);await enrichTop(Math.min(depth,state.opportunities.length));}
  if(!state.stop&&el('autoPortfolio')?.checked){setProgress(98,'Optymalizacja portfela według budżetu i ryzyka…');await buildPortfolio({skipEnrich:true,silent:true});}
  await dbPut('scan_runs',{ts:now(),items:items.length,markets,qualities,apiRows:normalizedFresh.length,cacheRows:cached.length,errors,opportunities:state.opportunities.length,analysisDepth:depth,portfolioPositions:state.portfolio?.positions?.length||0,auto:!!opts.auto});
  el('kpiItems').textContent=fmt(items.length);el('lastScan').textContent=new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});el('scanBtn').disabled=false;el('stopBtn').disabled=true;el('validateBtn').disabled=state.opportunities.length===0;setProgress(100,state.stop?'Skan przerwany.':`Gotowe: ${fmt(state.opportunities.length)} sygnałów • modele ${depth?'historyczne + lokalne':'lokalne'} • API ${fmt(normalizedFresh.length)}${cached.length?' • cache '+fmt(cached.length):''}.`);await updateDbInfo();render();await saveSettings();
}


function portfolioExecutionFactor(profile){return profile==='conservative'?.08:profile==='aggressive'?.25:.15;}
function portfolioCapitalPerUnit(o){if(Number.isFinite(+o.capitalPerUnit)&&+o.capitalPerUnit>0)return +o.capitalPerUnit;const setup=o.mode==='relist'?(+o.setupFee||0):0;return Math.max(1,(+o.buy||0)+(+o.transportCost||0)+setup);}
function estimatedLiquidityCap(o,pcfg){
  const src=+o.history?.source?.dailyVol||0,dst=+o.history?.destination?.dailyVol||0;
  let daily=src&&dst?Math.min(src,dst):(src||dst||0),factor=portfolioExecutionFactor(pcfg.riskProfile);
  if(o.mode==='instant')factor*=.72;if(o.dest==='Black Market')factor*=.62;
  let cap=daily>0?Math.floor(daily*pcfg.liquidityDays*factor):(pcfg.riskProfile==='aggressive'?2:1);
  if((o.confidence||0)<50)cap=Math.min(cap,1);else if((o.confidence||0)<65)cap=Math.min(cap,3);
  if((o.age||0)>12)cap=Math.min(cap,2);
  return clamp(Math.max(1,cap),1,pcfg.maxUnits);
}
function portfolioReason(o,cap){
  const parts=[];if((o.confidence||0)>=80)parts.push('wysoka pewność');else if((o.confidence||0)>=65)parts.push('dobry confidence');
  if((o.score||0)>=75)parts.push('wysoki Opportunity');if((o.history?.sourceDiscount||0)>=12)parts.push('zakup poniżej mediany');
  if((o.components?.liquidity||0)>=65)parts.push('dobra płynność');if(o.dest==='Black Market')parts.push('Black Market');
  parts.push(`limit płynności ${cap} szt.`);return parts.join(' • ');
}
function makePortfolioCandidates(pcfg){
  const raw=state.opportunities.filter(o=>o.profit>0&&o.roi>0&&(o.confidence||0)>=pcfg.minConfidence&&Number.isFinite(o.buy)&&o.buy>0);
  const bestPerItem=new Map();
  for(const o of raw){
    const capital=portfolioCapitalPerUnit(o),cap=estimatedLiquidityCap(o,pcfg),exec=clamp(.15+.85*(o.confidence||0)/100,0,1),modelProfit=Math.max(0,o.profit)*exec;
    const riskRoi=modelProfit/Math.max(1,capital)*100,liq=o.components?.liquidity??40,fresh=o.components?.freshness??50;
    const utility=riskRoi*(.50+.50*(o.score||0)/100)*(.72+.28*liq/100)*(.80+.20*fresh/100);
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
    let rec=pos.get(best.key);if(!rec){rec={opportunityKey:best.key,itemId:best.itemId,itemName:best.itemName,quality:best.quality,source:best.source,dest:best.dest,mode:best.mode,model:best.model,buy:best.buy,sell:best.sell,profitPerUnit:best.profit,capitalPerUnit:best._capital,modelProfitPerUnit:best._modelUnitProfit,confidence:best.confidence,score:best.score,utility:best._portfolioUtility,liquidityCap:best._qtyCap,reason:best._reason,units:0};pos.set(best.key,rec);}
    rec.units++;const cost=best._capital;used+=cost;const itemK=best.itemId+'|'+best.quality,routeK=routeKey(best);itemUse.set(itemK,(itemUse.get(itemK)||0)+cost);routeUse.set(routeK,(routeUse.get(routeK)||0)+cost);
  }
  const positions=[...pos.values()].map(x=>({...x,capital:x.units*x.capitalPerUnit,nominalProfit:x.units*x.profitPerUnit,modelProfit:x.units*x.modelProfitPerUnit}));
  positions.sort((a,b)=>b.utility-a.utility);positions.forEach((x,i)=>x.rank=i+1);
  const capital=positions.reduce((s,x)=>s+x.capital,0),nominalProfit=positions.reduce((s,x)=>s+x.nominalProfit,0),modelProfit=positions.reduce((s,x)=>s+x.modelProfit,0),free=Math.max(0,budget-capital),weightedConfidence=capital?positions.reduce((s,x)=>s+x.confidence*x.capital,0)/capital:0,weightedScore=capital?positions.reduce((s,x)=>s+x.score*x.capital,0)/capital:0;
  const maxRouteShare=investable?Math.max(0,...routeUse.values())/investable*100:0,maxItemShare=investable?Math.max(0,...itemUse.values())/investable*100:0;
  return{schemaVersion:4,key:'latest',createdAt:now(),config:pcfg,summary:{budget,investable,capital,free,targetReserve:budget-investable,nominalProfit,modelProfit,modelRoi:capital?modelProfit/capital*100:0,nominalRoi:capital?nominalProfit/capital*100:0,weightedConfidence,weightedScore,maxRouteShare,maxItemShare,positions:positions.length},positions};
}
function renderPortfolio(){
  const pf=state.portfolio,body=el('portfolioBody'),empty=el('portfolioEmpty');if(!body)return;
  if(!pf?.positions?.length){body.innerHTML='';empty.style.display='block';el('portfolioExportBtn').disabled=true;['pfBudget','pfCapital','pfFree','pfProfit','pfExpected'].forEach(id=>el(id).textContent='0');el('pfRoi').textContent='0%';el('portfolioStatus').textContent='Nie zbudowano portfela.';return;}
  empty.style.display='none';el('portfolioExportBtn').disabled=false;const s=pf.summary;
  el('pfBudget').textContent=fmt(s.budget);el('pfCapital').textContent=fmt(s.capital);el('pfFree').textContent=fmt(s.free);el('pfProfit').textContent='+'+fmt(s.nominalProfit);el('pfExpected').textContent='+'+fmt(s.modelProfit);el('pfRoi').textContent=pct(s.modelRoi);
  el('portfolioStatus').textContent=`${s.positions} pozycji • confidence ${s.weightedConfidence.toFixed(0)}/100 • ekspozycja trasy max ${s.maxRouteShare.toFixed(0)}% budżetu`;
  body.innerHTML=pf.positions.map(x=>`<tr><td><b>${x.rank}</b></td><td><div class="itemcell"><img loading="lazy" src="${itemIcon(x.itemId,x.quality)}" alt=""><div><div class="itemname">${esc(x.itemName)}</div><div class="itemid">${esc(x.itemId)} • ${qualityName[x.quality]||x.quality}</div></div></div></td><td><div class="route"><b>${esc(marketLabel(x.source))}</b> → <b>${esc(marketLabel(x.dest))}</b></div><span class="tag info">${esc(x.model||x.mode)}</span></td><td class="qty">${fmt(x.units)}</td><td>${fmt(x.capital)}</td><td class="profit">+${fmt(x.nominalProfit)}</td><td class="profit">+${fmt(x.modelProfit)}</td><td>${(x.confidence||0).toFixed(0)}/100</td><td>${(x.utility||0).toFixed(1)}</td><td class="portfolio-reason">${esc(x.reason)}</td></tr>`).join('');
  el('portfolioNote').innerHTML=`Portfel używa <b>${fmt(s.capital)}</b> z ${fmt(s.budget)} silver. Planowana rezerwa: <b>${fmt(s.targetReserve)}</b>. Maks. ekspozycja względem inwestowalnego budżetu — przedmiot: <b>${s.maxItemShare.toFixed(1)}%</b>; trasa: <b>${s.maxRouteShare.toFixed(1)}%</b>. „Zysk modelowy” to zysk nominalny ważony heurystyczną jakością sygnału, a nie statystycznie gwarantowana wartość oczekiwana.`;
}
async function buildPortfolio(opts={}){
  if(!state.opportunities.length){if(!opts.silent)alert('Najpierw wykonaj skan okazji.');return null;}
  const btn=el('portfolioBtn');if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Portfel…';}
  try{
    if(!opts.skipEnrich){const need=[...state.opportunities].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,40).some(o=>!o.history);if(need)await enrichTop(Math.min(40,state.opportunities.length));}
    const pcfg=portfolioCfg(),candidates=makePortfolioCandidates(pcfg);state.portfolio=allocatePortfolio(candidates,pcfg);await dbPut('portfolios',state.portfolio);renderPortfolio();await updateDbInfo();
    if(!state.portfolio.positions.length&&!opts.silent)alert('Brak okazji spełniających limity portfela. Zmniejsz minimalny Confidence albo zwiększ budżet/limity koncentracji.');
    return state.portfolio;
  }finally{if(btn){btn.disabled=false;btn.textContent='Zbuduj portfel';}}
}
async function loadCachedPortfolio(){const pf=await dbGet('portfolios','latest');if(pf?.schemaVersion===4){state.portfolio=pf;renderPortfolio();return true;}state.portfolio=null;renderPortfolio();return false;}
function exportPortfolioCsv(){const pf=state.portfolio;if(!pf?.positions?.length)return;const cols=['rank','item_id','name','quality','source','destination','model','units','capital','buy_unit','sell_unit','profit_unit','nominal_profit','model_profit','confidence','opportunity_score','liquidity_cap','reason'],lines=[cols.join(';'),...pf.positions.map(x=>[x.rank,x.itemId,x.itemName,qualityName[x.quality],marketLabel(x.source),marketLabel(x.dest),x.model,x.units,Math.round(x.capital),Math.round(x.buy),Math.round(x.sell),Math.round(x.profitPerUnit),Math.round(x.nominalProfit),Math.round(x.modelProfit),(x.confidence||0).toFixed(1),(x.score||0).toFixed(1),x.liquidityCap,x.reason].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';'))],blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='albion_portfolio_v4.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

function modelTags(o){let tags=[`<span class="tag info">${esc(o.model||modelLabel(o))}</span>`];if(o.history?.sourceDiscount>=12)tags.push(`<span class="tag good">- ${o.history.sourceDiscount.toFixed(0)}% vs mediana</span>`);return `<div class="modelbox">${tags.join('')}</div>`;}
function flag(o){if(o.confidence>=78&&o.age<=6)return'<span class="tag good">wysoka pewność</span>';if(o.warnings?.some(x=>x.includes('ekstremalnie')||x.includes('znacznie powyżej')))return'<span class="tag bad">anomalia</span>';if(o.confidence<35)return'<span class="tag bad">wysokie ryzyko</span>';if(o.age>24)return'<span class="tag bad">stara cena</span>';if(o.confidence>=60)return'<span class="tag">dobry sygnał</span>';return'<span class="tag warn">zweryfikuj</span>';}
function filteredResults(){
  let a=[...state.opportunities],q=el('resultSearch').value.trim().toLowerCase(),minC=+el('minConfidence').value||0;if(q)a=a.filter(o=>[o.itemName,o.itemId,o.source,o.dest,o.model].some(x=>String(x).toLowerCase().includes(q)));if(state.watchOnly)a=a.filter(o=>state.watched.has(o.itemId));a=a.filter(o=>(o.confidence??0)>=minC);
  const s=el('sortBy').value;a.sort((x,y)=>s==='profit'?y.profit-x.profit:s==='roi'?y.roi-x.roi:s==='age'?x.age-y.age:s==='buy'?x.buy-y.buy:s==='confidence'?(y.confidence||0)-(x.confidence||0):s==='riskProfit'?(y.riskProfit||0)-(x.riskProfit||0):(y.score||0)-(x.score||0));return a;
}
function render(){
  const a=filteredResults();el('emptyState').style.display=a.length?'none':'block';el('resultsBody').innerHTML=a.map((o,i)=>`<tr><td><button class="star ${state.watched.has(o.itemId)?'on':''}" data-watch="${esc(o.itemId)}">★</button></td><td><div class="itemcell"><img loading="lazy" src="${itemIcon(o.itemId,o.quality)}" alt=""><div><div class="itemname">${esc(o.itemName)}</div><div class="itemid">${esc(o.itemId)} • ${qualityName[o.quality]||o.quality}</div></div></div></td><td>${modelTags(o)}</td><td class="route"><b>${esc(marketLabel(o.source))}</b> → <b>${esc(marketLabel(o.dest))}</b></td><td>${fmt(o.buy)}</td><td>${fmt(o.sell)}</td><td class="${o.profit>=0?'profit':'loss'}">+${fmt(o.profit)}</td><td class="${o.roi>=0?'profit':'loss'}">${pct(o.roi)}</td><td>${fmt(o.riskProfit)}</td><td class="${o.age<=3?'fresh':o.age<=24?'stale':'old'}">${ageText(o.age)}</td><td><b>${(o.confidence||0).toFixed(0)}</b><div class="scorebar"><i style="width:${clamp(o.confidence||0)}%"></i></div></td><td><b>${(o.score||0).toFixed(0)}</b></td><td>${flag(o)}</td><td><button class="btn" data-detail="${i}">Szczegóły</button></td></tr>`).join('');
  const bestProfit=a.reduce((m,x)=>Math.max(m,x.profit),0),bestRoi=a.reduce((m,x)=>Math.max(m,x.roi),0),avgAge=a.length?mean(a.map(x=>x.age)):NaN,avgC=a.length?mean(a.map(x=>x.confidence||0)):NaN;el('kpiCount').textContent=fmt(a.length);el('kpiProfit').textContent=fmt(bestProfit);el('kpiRoi').textContent=pct(bestRoi);el('kpiAge').textContent=a.length?ageText(avgAge):'—';el('kpiConfidence').textContent=a.length?avgC.toFixed(0)+'/100':'—';
  document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=async()=>{const id=b.dataset.watch;state.watched.has(id)?state.watched.delete(id):state.watched.add(id);await saveWatch();render();});document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(a[+b.dataset.detail]));
}
function compCard(label,v,desc=''){return `<div class="detail-card"><small>${esc(label)}</small><b>${Number.isFinite(v)?v.toFixed(0)+'/100':'—'}</b>${desc?`<small>${esc(desc)}</small>`:''}</div>`;}
function openDetail(o){
  el('detailTitle').textContent=`${o.itemName} — ${marketLabel(o.source)} → ${marketLabel(o.dest)}`;el('detailCards').innerHTML=`<div class="detail-card"><small>Model</small><b>${esc(o.model||modelLabel(o))}</b></div><div class="detail-card"><small>Zysk netto</small><b class="profit">+${fmt(o.profit)}</b></div><div class="detail-card"><small>ROI</small><b class="profit">${pct(o.roi)}</b></div><div class="detail-card"><small>Confidence</small><b>${(o.confidence||0).toFixed(0)}/100</b></div>`;
  const histCity=o.source,data=state.history.get(`${o.itemId}|${histCity}|${o.quality}`)||o.history?.points||[];drawChart(data,o.buy);
  const c=o.components||{};const breakdown=`<div class="breakdown">${compCard('Świeżość',c.freshness)}${compCard('Spread',c.spread)}${compCard('Powtarzalność',c.persistence)}${compCard('Płynność',c.liquidity)}${compCard('Zmienność',c.volatility)}${compCard('Zgodność z historią',c.historyPlausibility)}</div>`;
  const warnings=o.warnings?.length?`<br><b>Ryzyka:</b> ${o.warnings.map(esc).join(' • ')}`:'<br><b>Ryzyka:</b> brak istotnych ostrzeżeń modelu.';
  const hist=o.history?.source?.median?`<br>14-dniowa mediana źródła: <b>${fmt(o.history.source.median)}</b>; średni wolumen/dzień: <b>${(o.history.source.dailyVol||0).toFixed(1)}</b>.`:'';
  const pfPos=state.portfolio?.positions?.find(x=>x.opportunityKey===o.key);const pfInfo=pfPos?`<br><b>Portfel v4:</b> priorytet #${pfPos.rank}, ${fmt(pfPos.units)} szt., kapitał ${fmt(pfPos.capital)}, zysk modelowy ${fmt(pfPos.modelProfit)}.`:'';
  el('detailNote').innerHTML=`Kupno: <b>${fmt(o.buy)}</b> w ${esc(marketLabel(o.source))}. Cel: <b>${fmt(o.sell)}</b> w ${esc(marketLabel(o.dest))}. Kapitał wymagany / szt.: <b>${fmt(portfolioCapitalPerUnit(o))}</b>. Zysk ważony pewnością: <b>${fmt(o.riskProfit)}</b>. Opportunity Score: <b>${(o.score||0).toFixed(0)}/100</b>.${hist}${pfInfo}${warnings}<br><span class="muted">Confidence Score jest heurystyką jakości sygnału, nie gwarancją wykonania transakcji ani dostępnej liczby sztuk.</span>${breakdown}`;
  el('detailDialog').showModal();
}
function drawChart(data,current){const svg=el('historyChart'),pts=(data||[]).map(x=>({p:+x.avg_price,t:Date.parse(x.timestamp)})).filter(x=>x.p>0&&Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);if(!pts.length){svg.innerHTML='<text x="440" y="110" text-anchor="middle" fill="#8392a8" font-size="13">Brak historii dla tego sygnału.</text>';return;}const w=880,h=220,pad=25,min=Math.min(...pts.map(x=>x.p),current),max=Math.max(...pts.map(x=>x.p),current),span=Math.max(1,max-min),x=i=>pad+i*(w-pad*2)/Math.max(1,pts.length-1),y=v=>h-pad-(v-min)/span*(h-pad*2),path=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.p).toFixed(1)).join(' '),cy=y(current);svg.innerHTML=`<line x1="${pad}" y1="${cy}" x2="${w-pad}" y2="${cy}" stroke="#d6a84b" stroke-dasharray="6 5" opacity=".7"/><path d="${path}" fill="none" stroke="#64b5f6" stroke-width="2.5"/><text x="${pad}" y="17" fill="#93a3b8" font-size="11">14 dni • AODP sell history</text><text x="${w-pad}" y="${Math.max(15,cy-6)}" text-anchor="end" fill="#d6a84b" font-size="11">zakup ${fmt(current)}</text>`;}
function exportCsv(){const a=filteredResults();if(!a.length)return;const cols=['item_id','name','quality','model','source','destination','buy','sell','profit','roi_pct','risk_weighted_profit','age_h','confidence','opportunity_score','mode'],lines=[cols.join(';'),...a.map(o=>[o.itemId,o.itemName,qualityName[o.quality],o.model,marketLabel(o.source),marketLabel(o.dest),Math.round(o.buy),Math.round(o.sell),Math.round(o.profit),o.roi.toFixed(2),Math.round(o.riskProfit||0),o.age.toFixed(2),(o.confidence||0).toFixed(1),(o.score||0).toFixed(1),o.mode].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'))],blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),ael=document.createElement('a');ael.href=u;ael.download='albion_europe_opportunities_v4.csv';ael.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function loadCachedOpportunities(){let ops=await dbGetAll('opportunities');ops=ops.filter(x=>x.schemaVersion===4);if(!ops.length){await dbClear('opportunities');return false;}state.opportunities=ops;el('validateBtn').disabled=false;const newest=ops.reduce((m,x)=>Math.max(m,x.calculatedAt||0),0);el('lastScan').textContent=newest?new Date(newest).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})+' cache':'cache';setProgress(0,`Pokazano ${fmt(ops.length)} okazji z local.db.`);render();return true;}
async function exportDB(){const payload={format:'albion-market-local-db',version:DB_VERSION,exportedAt:new Date().toISOString(),stores:{}};for(const s of DB_STORES)payload.stores[s]=await dbGetAll(s);const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`albion-local-db-v4-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function importDBFile(file){const txt=await file.text(),j=JSON.parse(txt);if(j?.format!=='albion-market-local-db'||!j.stores)throw new Error('Nieprawidłowy backup');for(const s of DB_STORES){await dbClear(s);if(Array.isArray(j.stores[s]))await dbPutMany(s,j.stores[s]);}state.watched=new Set((await dbGetAll('watchlist')).map(x=>x.itemId));state.items=await dbGetAll('items');state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));await loadSettings();await loadCachedOpportunities();await loadCachedPortfolio();await updateDbInfo();}
async function clearCache(){if(!confirm('Wyczyścić ceny, historię, modele rynku i zapisane okazje? Baza przedmiotów i ustawienia zostaną.'))return;for(const s of ['prices','history','opportunities','scan_runs','market_stats','portfolios'])await dbClear(s);state.opportunities=[];state.portfolio=null;state.history.clear();state.marketStats.clear();render();renderPortfolio();await updateDbInfo();setProgress(0,'Lokalny cache i profile modeli wyczyszczone.');}
function scheduleAuto(){clearInterval(autoTimer);const m=+el('autoRefresh').value||0;if(m>0)autoTimer=setInterval(()=>{if(document.visibilityState==='visible'&&!el('scanBtn').disabled)scan({auto:true}).catch(()=>{});},m*60000);}
function bind(){
  el('allMarkets').onclick=()=>{document.querySelectorAll('.marketCheck').forEach(x=>x.checked=true);queueSaveSettings();};el('royalMarkets').onclick=()=>{document.querySelectorAll('.marketCheck').forEach(x=>x.checked=!!MARKETS.find(m=>m.api===x.value)?.royal);queueSaveSettings();};
  el('scanBtn').onclick=()=>scan();el('stopBtn').onclick=()=>{state.stop=true;state.scanId++;el('stopBtn').disabled=true;el('scanBtn').disabled=false;};el('validateBtn').onclick=()=>enrichTop(Math.min(50,state.opportunities.length),true);el('portfolioBtn').onclick=()=>buildPortfolio();el('portfolioExportBtn').onclick=exportPortfolioCsv;el('resultSearch').oninput=render;el('sortBy').onchange=render;el('minConfidence').oninput=render;el('watchOnly').onclick=()=>{state.watchOnly=!state.watchOnly;el('watchOnly').textContent=state.watchOnly?'★ Wszystkie wyniki':'★ Obserwowane';render();};el('exportBtn').onclick=exportCsv;el('closeDialog').onclick=()=>el('detailDialog').close();el('dbExportBtn').onclick=exportDB;el('dbImportBtn').onclick=()=>el('dbImportFile').click();el('dbImportFile').onchange=async e=>{try{if(e.target.files[0])await importDBFile(e.target.files[0]);setProgress(100,'Backup local.db zaimportowany.');}catch(err){alert('Import nieudany: '+err.message);}e.target.value='';};el('loadCacheBtn').onclick=loadCachedOpportunities;el('dbClearBtn').onclick=clearCache;
  document.querySelectorAll('thead th[data-sort]').forEach(th=>th.onclick=()=>{const s=th.dataset.sort;if(['profit','roi','age','buy','score','confidence','riskProfit'].includes(s)){el('sortBy').value=s;render();}});
  document.querySelectorAll('input,select').forEach(x=>{if(!['resultSearch','dbImportFile','minConfidence'].includes(x.id))x.addEventListener('change',queueSaveSettings);});el('minConfidence').addEventListener('change',queueSaveSettings);['portfolioBudget','portfolioReservePct','portfolioMaxItemPct','portfolioMaxRoutePct','portfolioMaxPositions','portfolioMaxUnits','portfolioMinConfidence','portfolioLiquidityDays','riskProfile'].forEach(id=>el(id)?.addEventListener('change',()=>{if(state.portfolio?.positions?.length)el('portfolioStatus').textContent='Parametry zmienione — kliknij „Zbuduj portfel”.';}));document.addEventListener('change',e=>{if(e.target.classList?.contains('marketCheck'))queueSaveSettings();});window.addEventListener('online',pingApi);window.addEventListener('offline',()=>{el('apiStatus').textContent='offline';el('apiStatus').style.color='var(--bad)';});
}
async function init(){renderMarkets();bind();renderPortfolio();try{await openLocalDB();setDbStatus('gotowa');const w=await dbGetAll('watchlist');state.watched=new Set(w.map(x=>x.itemId));state.marketStats=new Map((await dbGetAll('market_stats')).map(x=>[x.key,x]));await loadSettings();await updateDbInfo();setProgress(3,'Ładowanie bazy przedmiotów…');await loadItems();await loadCachedOpportunities();await loadCachedPortfolio();setProgress(0,state.opportunities.length?'Gotowy — pokazano ostatni cache.':'Gotowy — łączenie z API…');await pingApi();scheduleAuto();if(el('autoStart').value==='yes'&&navigator.onLine)setTimeout(()=>scan({auto:true}).catch(()=>{}),700);}catch(e){setDbStatus('błąd',false);el('dbStatus').textContent='błąd';setProgress(0,'Błąd inicjalizacji: '+(e.message||e));}
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}
init();
})();
