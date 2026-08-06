(()=>{
'use strict';

const SAVE_KEY='recycleRushPlayableV1';
const stationNames=['分类台','塑料破碎机','纸张压缩机','包装站','仓库','装车区'];
const stationIcons=['♻️','🧴','📄','📦','🏭','🚚'];
const basePerLevel=[60000,80000,70000,65000,50000,55000];
const stationBaseCost=[900000,1200000,1000000,1100000,780000,850000];
const workerNames=['分拣员','破碎机操作员','压缩机操作员','包装员','仓管员','装车员'];
const researchDefs=[
 {name:'高效电机',icon:'⚙️',desc:'全厂产量 +8%/级',base:450,effect:'production'},
 {name:'智能排班',icon:'🧠',desc:'工人效率 +6%/级',base:550,effect:'workers'},
 {name:'绿色供应链',icon:'🌱',desc:'订单奖励 +10%/级',base:650,effect:'orders'},
 {name:'离线管理',icon:'⏰',desc:'离线效率 +10%/级',base:800,effect:'offline'},
 {name:'批量采购',icon:'🏷️',desc:'升级成本 -4%/级',base:950,effect:'discount'},
 {name:'生态认证',icon:'🌍',desc:'生态贡献 +12%/级',base:1200,effect:'eco'}
];
const collectionDefs=[
 {key:'plastic',name:'再生塑料颗粒',icon:'🧴',target:100,rewardGems:30,rewardEco:160},
 {key:'paper',name:'再生纸浆',icon:'📄',target:100,rewardGems:25,rewardEco:140},
 {key:'box',name:'再生纸板',icon:'📦',target:100,rewardGems:20,rewardEco:120},
 {key:'metal',name:'再生金属',icon:'🔩',target:120,rewardGems:40,rewardEco:220}
];
const taskDefs=[
 {key:'plastic',name:'回收塑料',icon:'♻️',target:5000,reward:50000000},
 {key:'paper',name:'压缩纸张',icon:'📄',target:2500,reward:40000000},
 {key:'box',name:'打包再生品',icon:'📦',target:2000,reward:30000000},
 {key:'factory',name:'升级新区域',icon:'📍',target:1,rewardEco:500}
];

const defaults=()=>({
 version:1,
 coins:125600000,
 gems:1248,
 eco:12600,
 factoryLevel:8,
 permits:0,
 stations:[25,30,28,26,20,22],
 workers:[1,1,1,1,1,1],
 research:[0,0,0,0,0,0],
 collections:{plastic:32,paper:25,box:18,metal:0},
 collectionClaims:{plastic:0,paper:0,box:0,metal:0},
 tasks:{plastic:3200,paper:1800,box:1200,factory:0},
 taskClaims:{plastic:false,paper:false,box:false,factory:false},
 boosts:{doubleUntil:0,truckUntil:0},
 offlineBank:0,
 lastSeen:Date.now(),
 lastDaily:'',
 sound:true,
 tutorialSeen:false,
 totalEarned:0,
 totalUpgrades:0
});

let state=defaults();
let els={};
let tickTimer=null;
let saveTimer=null;
let currentPanel='factory';
let lastTick=performance.now();
let audioCtx=null;

function load(){
 try{
   const raw=localStorage.getItem(SAVE_KEY);
   if(raw){
     const saved=JSON.parse(raw);
     state={...defaults(),...saved};
     state.stations=[...defaults().stations,...(saved.stations||[])].slice(0,6);
     state.workers=[...defaults().workers,...(saved.workers||[])].slice(0,6);
     state.research=[...defaults().research,...(saved.research||[])].slice(0,6);
     state.boosts={...defaults().boosts,...(saved.boosts||{})};
     state.collections={...defaults().collections,...(saved.collections||{})};
     state.collectionClaims={...defaults().collectionClaims,...(saved.collectionClaims||{})};
     state.tasks={...defaults().tasks,...(saved.tasks||{})};
     state.taskClaims={...defaults().taskClaims,...(saved.taskClaims||{})};
   }
 }catch(e){ console.warn('save load failed',e); }
 const now=Date.now();
 const elapsed=Math.max(0,Math.min(now-(state.lastSeen||now),2*60*60*1000));
 if(elapsed>15000){
   state.offlineBank=Math.floor(productionRate(false)*(elapsed/1000)*offlineEfficiency());
 }
 state.lastSeen=now;
}

function save(){
 state.lastSeen=Date.now();
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch(e){console.warn('save failed',e);}
}

function money(n){
 if(!Number.isFinite(n)) return '0';
 const abs=Math.abs(n);
 const units=[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']];
 for(const [v,s] of units) if(abs>=v) return (n/v).toFixed(abs>=v*100?0:abs>=v*10?1:2).replace(/\.0+$/,'')+s;
 return Math.floor(n).toLocaleString('zh-CN');
}
function duration(ms){
 if(ms<=0)return '00:00';
 const s=Math.ceil(ms/1000),m=Math.floor(s/60),r=s%60;
 return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
function discount(){return Math.max(.65,1-(state.research[4]||0)*.04);}
function workerBonus(){return 1+state.workers.reduce((a,v)=>a+Math.max(0,v-1)*.012,0)+(state.research[1]||0)*.06;}
function factoryBonus(){return 1+(state.factoryLevel-1)*.035+state.permits*.2;}
function researchBonus(){return 1+(state.research[0]||0)*.08;}
function boostMultiplier(){
 const now=Date.now();
 return (state.boosts.doubleUntil>now?2:1)*(state.boosts.truckUntil>now?1.5:1);
}
function productionRate(withBoost=true){
 const raw=state.stations.reduce((sum,l,i)=>sum+l*basePerLevel[i],0);
 let value=raw*factoryBonus()*workerBonus()*researchBonus();
 if(withBoost)value*=boostMultiplier();
 return value;
}
function offlineEfficiency(){return Math.min(.9,.5+(state.research[3]||0)*.1);}
function stationRate(i){return state.stations[i]*basePerLevel[i]*factoryBonus()*workerBonus()*researchBonus();}
function stationCost(i,qty=1){
 let total=0,l=state.stations[i];
 for(let k=0;k<qty;k++) total+=stationBaseCost[i]*Math.pow(1.12,Math.max(0,l+k-18));
 return Math.floor(total*discount());
}
function workerCost(i){return Math.floor((3500000+i*800000)*Math.pow(1.55,state.workers[i]-1)*discount());}
function researchCost(i){return Math.floor(researchDefs[i].base*Math.pow(1.7,state.research[i]));}
function factoryCost(){return Math.floor(256000000*Math.pow(2.15,state.factoryLevel-8));}
function bottleneck(){
 let idx=0,min=Infinity;
 state.stations.forEach((lv,i)=>{const cap=lv*basePerLevel[i];if(cap<min){min=cap;idx=i;}});
 return idx;
}
function completedTaskCount(){
 return taskDefs.filter(t=>taskProgress(t)>=t.target&&!state.taskClaims[t.key]).length;
}
function taskProgress(t){return t.key==='factory'?(state.factoryLevel>=9?1:0):Math.min(t.target,state.tasks[t.key]||0);}

function sound(freq=520,dur=.08){
 if(!state.sound)return;
 try{
   audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
   const o=audioCtx.createOscillator(),g=audioCtx.createGain();
   o.frequency.value=freq;o.type='sine';g.gain.value=.04;
   o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.stop(audioCtx.currentTime+dur);
 }catch{}
}
function vibrate(ms=20){try{navigator.vibrate?.(ms);}catch{}}
function showToast(msg){
 els.toast.textContent=msg;els.toast.classList.add('show');
 clearTimeout(showToast.t);showToast.t=setTimeout(()=>els.toast.classList.remove('show'),1300);
}
function coinFx(x,y,text){
 const d=document.createElement('div');d.className='coin-fx';d.style.left=x+'%';d.style.top=y+'%';d.textContent=text;els.fx.appendChild(d);setTimeout(()=>d.remove(),950);
}
function levelFx(x,y,text){
 const d=document.createElement('div');d.className='level-pop';d.style.left=x+'%';d.style.top=y+'%';d.textContent=text;els.fx.appendChild(d);setTimeout(()=>d.remove(),850);
}

function renderHUD(){
 const rate=productionRate();
 els.coins.textContent=money(state.coins);
 els.rate.textContent='+'+money(rate)+'/s';
 els.gems.textContent=money(state.gems);
 els.factoryLevel.textContent=state.factoryLevel;
 els.eco.textContent=money(state.eco);
 const b=bottleneck();
 state.stations.forEach((lv,i)=>{
   const e=els.stationLives[i];
   e.innerHTML=`${i+1} ${stationNames[i]}<small>Lv.${lv}</small>`;
   e.classList.toggle('bottleneck',i===b);
   e.classList.toggle('affordable',state.coins>=stationCost(i));
   els.stationHits[i].classList.toggle('affordable',state.coins>=stationCost(i));
 });
 const fc=factoryCost();
 els.factoryUpgrade.innerHTML=`Lv.${state.factoryLevel} → Lv.${state.factoryLevel+1}<small>🪙 ${money(fc)}</small>`;
 els.missionBadge.textContent=completedTaskCount();
 els.missionBadge.classList.toggle('hidden',completedTaskCount()===0);
 const now=Date.now();
 const d=state.boosts.doubleUntil-now,t=state.boosts.truckUntil-now;
 els.doubleTimer.classList.toggle('on',d>0);els.doubleTimer.textContent='×2 '+duration(d);
 els.truckTimer.classList.toggle('on',t>0);els.truckTimer.textContent='运输 '+duration(t);
 const bank=state.offlineBank||Math.floor(productionRate(false)*Math.min(120,(now-state.lastSeen)/1000)*offlineEfficiency());
 els.offlineTimer.classList.toggle('on',bank>0);els.offlineTimer.textContent='可领 '+money(bank);
}

function tick(now){
 const dt=Math.min(.5,(now-lastTick)/1000||0);lastTick=now;
 const earned=productionRate()*dt;
 state.coins+=earned;state.totalEarned+=earned;
 const scale=dt*boostMultiplier();
 state.tasks.plastic=Math.min(5000,state.tasks.plastic+22*scale);
 state.tasks.paper=Math.min(2500,state.tasks.paper+13*scale);
 state.tasks.box=Math.min(2000,state.tasks.box+9*scale);
 state.collections.plastic=Math.min(100,state.collections.plastic+.045*scale);
 state.collections.paper=Math.min(100,state.collections.paper+.035*scale);
 state.collections.box=Math.min(100,state.collections.box+.025*scale);
 if(state.factoryLevel>=9)state.tasks.factory=1;
 renderHUD();
 tickTimer=requestAnimationFrame(tick);
}

function openSheet(title,html,panel){
 currentPanel=panel||currentPanel;
 els.sheetTitle.textContent=title;
 els.sheetBody.innerHTML=html;
 els.shade.classList.add('open');els.sheet.classList.add('open');
 bindSheetActions();
}
function closeSheet(){els.shade.classList.remove('open');els.sheet.classList.remove('open');}

function stationPanel(i){
 const lv=state.stations[i],cost=stationCost(i),cost10=stationCost(i,10);
 const isBottle=bottleneck()===i;
 openSheet(`${stationIcons[i]} ${i+1}号 ${stationNames[i]}`,`
  <div class="card">
   <div class="row wrap">
    <div class="stat">等级<b>Lv.${lv}</b></div>
    <div class="stat">当前产能<b>${money(stationRate(i))}/s</b></div>
    <div class="stat">生产状态<b>${isBottle?'⚠️ 瓶颈':'✅ 顺畅'}</b></div>
   </div>
  </div>
  <div class="card">
   <h3>升级预览</h3>
   <div class="row"><span>产能提升</span><b class="price">+${money(basePerLevel[i]*factoryBonus()*workerBonus()*researchBonus())}/s</b></div>
   <div class="progress"><i style="width:${Math.min(100,(lv%10)*10)}%"></i></div>
   <p class="muted">每 10 级触发里程碑：设备外观升级并额外提高 25% 产能。</p>
  </div>
  <div class="grid2">
   <button class="btn green" data-upgrade="${i}" data-qty="1" ${state.coins<cost?'disabled':''}>升级 1 次<br>🪙 ${money(cost)}</button>
   <button class="btn blue" data-upgrade="${i}" data-qty="10" ${state.coins<cost10?'disabled':''}>升级 10 次<br>🪙 ${money(cost10)}</button>
  </div>
  <button class="btn gold wide" data-max-upgrade="${i}" style="margin-top:10px">尽可能升级</button>
 `,'station');
}

function tasksPanel(){
 const cards=taskDefs.map(t=>{
  const p=taskProgress(t),done=state.taskClaims[t.key],claim=p>=t.target&&!done;
  return `<div class="card task-card ${claim?'claimable':''} ${done?'done':''}">
   <div class="row"><div class="row" style="justify-content:flex-start"><div class="iconbox">${t.icon}</div><div><div class="item-title">${t.name}</div><div class="muted">${Math.floor(p).toLocaleString()} / ${t.target.toLocaleString()}</div></div></div><span class="pill ${claim?'':'warn'}">${done?'已领取':claim?'可领取':'进行中'}</span></div>
   <div class="progress" style="margin:9px 0"><i style="width:${Math.min(100,p/t.target*100)}%"></i></div>
   <button class="btn green wide" data-claim-task="${t.key}" ${!claim?'disabled':''}>${t.reward?'领取 🪙 '+money(t.reward):'领取 🌍 '+money(t.rewardEco)}</button>
  </div>`;
 }).join('');
 openSheet('📋 当前任务',cards,'tasks');
}

function factoryPanel(){
 const fc=factoryCost();
 const avg=Math.round(state.stations.reduce((a,b)=>a+b,0)/6);
 openSheet('🏭 工厂总览',`
  <div class="card">
   <div class="row wrap">
    <div class="stat">工厂等级<b>Lv.${state.factoryLevel}</b></div>
    <div class="stat">每秒利润<b>${money(productionRate())}</b></div>
    <div class="stat">绿色认证<b>${state.permits} 次</b></div>
   </div>
  </div>
  <div class="card"><h3>社区回收站进度</h3><div class="progress"><i style="width:${Math.min(100,avg)}%"></i></div><p class="muted">平均设备等级 ${avg}，当前瓶颈：${stationNames[bottleneck()]}。</p></div>
  <button class="btn green wide" data-factory-upgrade ${state.coins<fc?'disabled':''}>工厂升级 Lv.${state.factoryLevel} → Lv.${state.factoryLevel+1}<br>🪙 ${money(fc)}</button>
  <div class="card" style="margin-top:11px"><h3>绿色认证</h3><p>工厂达到 Lv.10 后可认证重建。保留研究、宝石和收藏，获得永久产量 +20%。</p><button class="btn gold wide" data-prestige ${state.factoryLevel<10?'disabled':''}>申请认证并重建</button></div>
 `,'factory');
}

function workersPanel(){
 const html=state.workers.map((lv,i)=>{
  const c=workerCost(i);return `<div class="card"><div class="row"><div class="row" style="justify-content:flex-start"><div class="iconbox">👷</div><div><div class="item-title">${workerNames[i]}</div><div class="muted">Lv.${lv} · 效率 +${Math.max(0,lv-1)*1.2}%</div></div></div><button class="btn green" data-worker="${i}" ${state.coins<c?'disabled':''}>升级<br>🪙${money(c)}</button></div></div>`;
 }).join('');
 openSheet('👷 工人管理',html,'workers');
}

function researchPanel(){
 const html=researchDefs.map((r,i)=>{
  const lv=state.research[i],c=researchCost(i);return `<div class="card"><div class="row"><div class="row" style="justify-content:flex-start"><div class="iconbox">${r.icon}</div><div><div class="item-title">${r.name} Lv.${lv}</div><div class="muted">${r.desc}</div></div></div><button class="btn blue" data-research="${i}" ${state.eco<c?'disabled':''}>研究<br>🌍${money(c)}</button></div></div>`;
 }).join('');
 openSheet('🧪 绿色研究',`<div class="card"><div class="row"><b>可用生态贡献</b><b class="price">🌍 ${money(state.eco)}</b></div></div>${html}`,'research');
}

function collectionPanel(){
 const html=collectionDefs.map(d=>{
  const p=state.collections[d.key]||0,ready=p>=d.target;
  return `<div class="card"><div class="row"><div class="row" style="justify-content:flex-start"><div class="iconbox">${d.icon}</div><div><div class="item-title">${d.name}</div><div class="muted">已完成 ${state.collectionClaims[d.key]||0} 套</div></div></div><span class="pill ${ready?'':'warn'}">${Math.floor(p)} / ${d.target}</span></div><div class="progress" style="margin:9px 0"><i style="width:${Math.min(100,p/d.target*100)}%"></i></div><button class="btn green wide" data-collection="${d.key}" ${!ready?'disabled':''}>领取 💎${d.rewardGems} + 🌍${d.rewardEco}</button></div>`;
 }).join('');
 openSheet('📋 产品收藏',html,'collection');
}

function shopPanel(){
 const today=new Date().toISOString().slice(0,10),dailyAvailable=state.lastDaily!==today;
 openSheet('🏪 工厂商店',`
  <div class="card"><div class="row"><div><div class="item-title">每日免费补给</div><div class="muted">现金、宝石和生态贡献</div></div><button class="btn gold" data-daily ${!dailyAvailable?'disabled':''}>${dailyAvailable?'领取':'明日再来'}</button></div></div>
  <div class="grid2">
   <div class="card"><h3>⚡ 高压电池</h3><p class="muted">双倍收益 10 分钟</p><button class="btn blue wide" data-shop="battery" ${state.gems<60?'disabled':''}>💎 60</button></div>
   <div class="card"><h3>🤖 自动主管</h3><p class="muted">所有工人 +1 级</p><button class="btn blue wide" data-shop="manager" ${state.gems<180?'disabled':''}>💎 180</button></div>
   <div class="card"><h3>💰 城市合同</h3><p class="muted">立即获得 30 秒利润</p><button class="btn blue wide" data-shop="contract" ${state.gems<40?'disabled':''}>💎 40</button></div>
   <div class="card"><h3>🌱 生态礼包</h3><p class="muted">获得 1,000 生态贡献</p><button class="btn blue wide" data-shop="eco" ${state.gems<120?'disabled':''}>💎 120</button></div>
  </div>
  <div class="card"><div class="row"><span>声音</span><button class="btn dark" data-sound>${state.sound?'已开启':'已关闭'}</button></div></div>
 `,'shop');
}

function rewardAdPanel(type){
 const configs={
  double:{title:'×2 双倍收益',desc:'观看演示广告后，全部生产线收益翻倍 5 分钟。',button:'启动双倍收益'},
  truck:{title:'🚚 快速运输',desc:'观看演示广告后，运输效率提高 50%，持续 5 分钟。',button:'启动快速运输'},
  offline:{title:'🪙 离线收益',desc:`当前可领取 ${money(state.offlineBank)}，观看演示广告可领取双倍。`,button:'双倍领取'}
 };
 const c=configs[type];
 openSheet(c.title,`<div class="card reward-ad" id="rewardAd"><h3>${c.title}</h3><p>${c.desc}</p><div class="adbar"><i></i></div><button class="btn gold wide" data-reward-ad="${type}">${c.button}</button>${type==='offline'?'<button class="btn ghost wide" data-offline-normal style="margin-top:8px">直接领取</button>':''}</div>`,'reward');
}

function bindSheetActions(){
 els.sheetBody.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>upgradeStation(+b.dataset.upgrade,+b.dataset.qty));
 els.sheetBody.querySelectorAll('[data-max-upgrade]').forEach(b=>b.onclick=()=>maxUpgrade(+b.dataset.maxUpgrade));
 els.sheetBody.querySelectorAll('[data-claim-task]').forEach(b=>b.onclick=()=>claimTask(b.dataset.claimTask));
 els.sheetBody.querySelector('[data-factory-upgrade]')?.addEventListener('click',upgradeFactory);
 els.sheetBody.querySelector('[data-prestige]')?.addEventListener('click',prestige);
 els.sheetBody.querySelectorAll('[data-worker]').forEach(b=>b.onclick=()=>upgradeWorker(+b.dataset.worker));
 els.sheetBody.querySelectorAll('[data-research]').forEach(b=>b.onclick=()=>upgradeResearch(+b.dataset.research));
 els.sheetBody.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>claimCollection(b.dataset.collection));
 els.sheetBody.querySelector('[data-daily]')?.addEventListener('click',claimDaily);
 els.sheetBody.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>buyShop(b.dataset.shop));
 els.sheetBody.querySelector('[data-sound]')?.addEventListener('click',()=>{state.sound=!state.sound;save();shopPanel();});
 els.sheetBody.querySelector('[data-reward-ad]')?.addEventListener('click',e=>runRewardAd(e.currentTarget.dataset.rewardAd));
 els.sheetBody.querySelector('[data-offline-normal]')?.addEventListener('click',()=>claimOffline(false));
}

function upgradeStation(i,qty){
 const cost=stationCost(i,qty);if(state.coins<cost){showToast('现金不足');return;}
 state.coins-=cost;state.stations[i]+=qty;state.totalUpgrades+=qty;
 sound(680,.1);vibrate(25);coinFx([51,74,45,76,45,80][i],[25,25,44,47,63,67][i],`Lv.${state.stations[i]}`);levelFx([51,74,45,76,45,80][i],[25,25,44,47,63,67][i],`+${qty}级`);
 save();renderHUD();stationPanel(i);
}
function maxUpgrade(i){
 let qty=0;
 while(qty<100){const next=stationCost(i,1);if(state.coins<next)break;state.coins-=next;state.stations[i]++;qty++;}
 if(!qty){showToast('现金不足');return;} state.totalUpgrades+=qty;sound(760,.12);save();showToast(`连续升级 ${qty} 次`);stationPanel(i);
}
function claimTask(key){
 const def=taskDefs.find(t=>t.key===key);if(!def||taskProgress(def)<def.target||state.taskClaims[key])return;
 state.taskClaims[key]=true;if(def.reward){const bonus=1+(state.research[2]||0)*.1;state.coins+=def.reward*bonus;coinFx(18,20,'+'+money(def.reward*bonus));}if(def.rewardEco)state.eco+=def.rewardEco;
 sound(820,.12);vibrate(30);save();tasksPanel();renderHUD();
}
function upgradeFactory(){
 const c=factoryCost();if(state.coins<c){showToast('现金不足');return;}state.coins-=c;state.factoryLevel++;state.eco+=500;state.tasks.factory=1;sound(900,.18);vibrate(50);coinFx(80,88,'工厂升级!');save();factoryPanel();renderHUD();
}
function prestige(){
 if(state.factoryLevel<10)return;
 if(!confirm('确认绿色认证并重建？设备等级会重置为 10，研究、宝石、收藏和永久加成保留。'))return;
 state.permits++;state.factoryLevel=8;state.stations=[10,10,10,10,10,10];state.coins=50000000;state.eco+=2000;state.taskClaims.factory=false;state.tasks.factory=0;sound(980,.22);save();factoryPanel();renderHUD();
}
function upgradeWorker(i){const c=workerCost(i);if(state.coins<c)return;state.coins-=c;state.workers[i]++;sound(620,.08);save();workersPanel();renderHUD();}
function upgradeResearch(i){const c=researchCost(i);if(state.eco<c)return;state.eco-=c;state.research[i]++;sound(720,.1);save();researchPanel();renderHUD();}
function claimCollection(key){const d=collectionDefs.find(x=>x.key===key);if(!d||state.collections[key]<d.target)return;state.collections[key]-=d.target;state.collectionClaims[key]=(state.collectionClaims[key]||0)+1;state.gems+=d.rewardGems;state.eco+=d.rewardEco;sound(840,.12);save();collectionPanel();renderHUD();}
function claimDaily(){const today=new Date().toISOString().slice(0,10);if(state.lastDaily===today)return;state.lastDaily=today;state.coins+=productionRate(false)*20;state.gems+=25;state.eco+=250;sound(850,.12);save();shopPanel();renderHUD();}
function buyShop(type){
 const costs={battery:60,manager:180,contract:40,eco:120},c=costs[type];if(state.gems<c)return;state.gems-=c;
 if(type==='battery')state.boosts.doubleUntil=Math.max(Date.now(),state.boosts.doubleUntil)+10*60*1000;
 if(type==='manager')state.workers=state.workers.map(v=>v+1);
 if(type==='contract')state.coins+=productionRate(false)*30;
 if(type==='eco')state.eco+=1000;
 sound(760,.1);save();shopPanel();renderHUD();
}
function runRewardAd(type){
 const box=els.sheetBody.querySelector('#rewardAd'),btn=els.sheetBody.querySelector('[data-reward-ad]');if(!box||box.classList.contains('running'))return;
 box.classList.add('running');btn.disabled=true;btn.textContent='广告播放中…';
 setTimeout(()=>{
   if(type==='double')state.boosts.doubleUntil=Math.max(Date.now(),state.boosts.doubleUntil)+5*60*1000;
   if(type==='truck')state.boosts.truckUntil=Math.max(Date.now(),state.boosts.truckUntil)+5*60*1000;
   if(type==='offline')claimOffline(true,false);
   sound(900,.12);save();renderHUD();closeSheet();showToast('奖励已发放');
 },1650);
}
function claimOffline(double=true,close=true){
 const reward=Math.floor(state.offlineBank*(double?2:1));if(reward<=0){showToast('暂无离线收益');return;}state.coins+=reward;state.offlineBank=0;coinFx(90,49,'+'+money(reward));sound(820,.1);save();renderHUD();if(close)closeSheet();showToast(`领取 ${money(reward)}`);
}

function navigate(name,index){
 els.navActive.style.left=(index*20)+'%';
 if(name==='工厂')factoryPanel();
 if(name==='工人')workersPanel();
 if(name==='研究')researchPanel();
 if(name==='收集')collectionPanel();
 if(name==='商店')shopPanel();
}

function cacheEls(){
 els={
  art:document.getElementById('art'),fx:document.getElementById('fx'),toast:document.getElementById('toast'),shade:document.getElementById('shade'),sheet:document.getElementById('sheet'),sheetTitle:document.getElementById('sheetTitle'),sheetBody:document.getElementById('sheetBody'),closeSheet:document.getElementById('closeSheet'),
  coins:document.getElementById('coinsLive'),rate:document.getElementById('rateLive'),gems:document.getElementById('gemsLive'),factoryLevel:document.getElementById('factoryLevelLive'),eco:document.getElementById('ecoLive'),factoryUpgrade:document.getElementById('factoryUpgradeLive'),missionBadge:document.getElementById('missionBadge'),doubleTimer:document.getElementById('doubleTimer'),truckTimer:document.getElementById('truckTimer'),offlineTimer:document.getElementById('offlineTimer'),navActive:document.getElementById('navActive'),
  stationLives:Array.from({length:6},(_,i)=>document.getElementById('stationLive'+(i+1))),stationHits:[...document.querySelectorAll('[data-station]')]
 };
}

function bindMain(){
 els.stationHits.forEach(b=>b.onclick=()=>stationPanel(+b.dataset.station-1));
 document.querySelector('[data-action="double"]').onclick=()=>rewardAdPanel('double');
 document.querySelector('[data-action="truck"]').onclick=()=>rewardAdPanel('truck');
 document.querySelector('[data-action="offline"]').onclick=()=>rewardAdPanel('offline');
 document.querySelector('[data-action="factory"]').onclick=factoryPanel;
 document.querySelector('[data-action="tasks"]').onclick=tasksPanel;
 document.querySelectorAll('[data-nav]').forEach((b,i)=>b.onclick=()=>navigate(b.dataset.nav,i));
 document.querySelector('[data-action="menu"]').onclick=()=>openSheet('⚙️ 设置',`<div class="card"><button class="btn dark wide" data-sound-main>${state.sound?'关闭声音':'开启声音'}</button><button class="btn red wide" data-reset style="margin-top:10px">清除存档并重新开始</button></div>`,'settings');
 els.sheetBody.addEventListener('click',e=>{
   if(e.target.matches('[data-sound-main]')){state.sound=!state.sound;save();closeSheet();showToast(state.sound?'声音已开启':'声音已关闭');}
   if(e.target.matches('[data-reset]')){if(confirm('确定清除全部进度？')){localStorage.removeItem(SAVE_KEY);location.reload();}}
 });
 els.closeSheet.onclick=closeSheet;els.shade.onclick=closeSheet;
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else{const gap=Math.min(2*60*60*1000,Date.now()-state.lastSeen);if(gap>15000){state.offlineBank+=productionRate(false)*(gap/1000)*offlineEfficiency();showToast('离线收益已累计');}state.lastSeen=Date.now();}});
 window.addEventListener('pagehide',save);
}

function maybeTutorial(){
 const t=document.getElementById('tutorial');
 if(state.tutorialSeen){t.classList.add('hidden');return;}
 t.querySelector('button').onclick=()=>{state.tutorialSeen=true;t.classList.add('hidden');save();stationPanel(bottleneck());};
}

function boot(){
 if(window.__rrBooted)return;window.__rrBooted=true;
 cacheEls();load();bindMain();maybeTutorial();renderHUD();
 lastTick=performance.now();tickTimer=requestAnimationFrame(tick);
 saveTimer=setInterval(save,5000);
 if(state.offlineBank>0)setTimeout(()=>rewardAdPanel('offline'),650);
}

window.RecycleRush={boot,state:()=>state};
})();
