/* Bun Bites — a gentle food + symptom tracker with a bunny friend. */
"use strict";

// Edit this line to change the little note on the welcome screen.
const GIFT_NOTE = "Made with love by Ty 💗";

const STORE_KEY = "bunbites.v1";
const MEALS = [["breakfast","Breakfast","🌅"],["lunch","Lunch","☀️"],["dinner","Dinner","🌙"],["snack","Snacks","🍓"]];
const SYMPTOMS = [
  ["pain","Bladder pain","bladder"],["urgency","Urgency","bladder"],["frequency","Frequency","bladder"],
  ["bloating","Bloating","gut"],["cramps","Tummy cramps","gut"]
];
const IC_LABEL = {F:"Bladder friendly",T:"Try it",C:"Caution",U:"Not rated"};
const STAGES = [[0,"Baby bun",.62],[90,"Little bun",.74],[330,"Teen bun",.87],[800,"Grown bun",1]];
const XP_FOOD = 5, XP_CHECK = 10, XP_DAY_CAP = 40;
const ACCESSORIES = [
  {id:"bow",name:"Pink bow",e:"🎀",days:1},
  {id:"daisy",name:"Daisy",e:"🌼",days:3},
  {id:"carrot",name:"Carrot plushie",e:"🥕",days:5},
  {id:"crown",name:"Flower crown",e:"💐",days:7},
  {id:"scarf",name:"Cozy scarf",e:"🧣",days:10},
  {id:"garden",name:"Tulip garden",e:"🌷",days:14},
  {id:"glasses",name:"Study glasses",e:"👓",days:21},
  {id:"nurse",name:"Nurse cap",e:"🩺",days:30},
  {id:"house",name:"Bunny hutch",e:"🏡",days:45},
  {id:"rainbow",name:"Rainbow",e:"🌈",days:60},
];

/* ---------------- state ---------------- */
function freshState(){
  return {version:1, petName:"", createdAt:Date.now(), entries:[], checkins:[], custom:[], favorites:[], marks:{},
    settings:{targetsOn:false,kcal:2000,p:100,c:225,f:65,flare:false,theme:"auto"}, xpByDate:{}, equipped:[], seenUnlocks:[], meals:[], lastBackup:0, backupSnooze:0};
}
function sanitize(d){
  const f = freshState(), arr = x => Array.isArray(x) ? x : [], obj = x => x && typeof x==="object" && !Array.isArray(x) ? x : {};
  const num = (x, def=0) => typeof x==="number" && isFinite(x) ? x : (isFinite(parseFloat(x)) ? parseFloat(x) : def);
  const out = Object.assign(f, obj(d));
  out.settings = Object.assign(freshState().settings, obj(d && d.settings));
  out.entries = arr(out.entries).filter(e => e && typeof e.name==="string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date||"")).map(e => {
    const x = Object.assign({}, e); x.id = String(x.id || uid()); x.time = /^\d{2}:\d{2}$/.test(x.time||"") ? x.time : "12:00";
    x.ts = num(x.ts, tsOf(x.date, x.time)); x.servings = num(x.servings, 1) > 0 ? num(x.servings, 1) : 1;
    ["kcal","p","c","f"].forEach(k => x[k] = Math.max(0, num(x[k])));
    if(!MEALS.some(m=>m[0]===x.meal)) x.meal = "snack"; if(!["F","T","C","U"].includes(x.ic)) x.ic = "U"; x.dairy = !!x.dairy; x.serving = String(x.serving || "1 serving");
    return x; });
  out.checkins = arr(out.checkins).filter(c => c && /^\d{4}-\d{2}-\d{2}$/.test(c.date||"")).map(c => {
    const x = Object.assign({}, c); x.id = String(x.id || uid()); x.time = /^\d{2}:\d{2}$/.test(x.time||"") ? x.time : "12:00"; x.ts = num(x.ts, tsOf(x.date, x.time));
    SYMPTOMS.forEach(([k]) => x[k] = Math.min(10, Math.max(0, Math.round(num(x[k]))))); x.tags = arr(x.tags).filter(t => typeof t==="string"); x.note = String(x.note || "");
    return x; });
  out.custom = arr(out.custom).filter(c => c && c.key && c.name); out.favorites = arr(out.favorites).filter(k => typeof k==="string");
  out.meals = arr(out.meals).filter(m => m && m.name && Array.isArray(m.items)); out.equipped = arr(out.equipped); out.seenUnlocks = arr(out.seenUnlocks);
  out.marks = obj(out.marks); out.xpByDate = obj(out.xpByDate); out.petName = String(out.petName || "").slice(0, 20);
  return out;
}
let S = freshState();
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return sanitize(JSON.parse(raw));
  }catch(e){
    try{ const raw = localStorage.getItem(STORE_KEY); if(raw) localStorage.setItem(STORE_KEY+".broken."+Date.now(), raw); }catch(_){}
  }
  return freshState();
}
let saveOk = true;
function save(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(S)); saveOk = true; }
  catch(e){ saveOk = false; toast("Couldn't save. Your phone may be out of space. Make a backup in Settings"); }
}
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
const darkMQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme(){
  const t = S.settings.theme || "auto";
  const dark = t==="dark" || (t==="auto" && darkMQ && darkMQ.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.getElementById("themecolor"); if(m) m.content = dark ? "#1d1418" : "#fde4ec";
}


/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const pad = n => String(n).padStart(2,"0");
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const addDays = (ds, n) => { const d = new Date(ds+"T12:00"); d.setDate(d.getDate()+n); return dstr(d); };
const tsOf = (date, time) => new Date(`${date}T${time||"12:00"}`).getTime();
const r0 = n => Math.round(n||0);
const fmtNum = n => r0(n).toLocaleString();
function prettyDate(ds){
  if(ds===today()) return "Today";
  if(ds===addDays(today(),-1)) return "Yesterday";
  const d = new Date(ds+"T12:00");
  return d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
}
function fmtTime(t){ if(!t) return ""; let [h,m]=t.split(":").map(Number); const ap=h>=12?"pm":"am"; h=h%12||12; return `${h}:${pad(m)}${ap}`; }
function guessMeal(){ const h = new Date().getHours(); return h<10.5?"breakfast":h<15?"lunch":h<21?"dinner":"snack"; }
function servingsLabel(n){ const m={0.25:"¼",0.5:"½",0.75:"¾",1.5:"1½",2.5:"2½"}; return m[n] || (Math.round(n*100)/100); }

/* ---------------- boot state (after helpers exist) ---------------- */
S = load();
applyTheme();
if(darkMQ){ try{ darkMQ.addEventListener("change", applyTheme); }catch(e){ darkMQ.addListener && darkMQ.addListener(applyTheme); } }

/* ---------------- foods ---------------- */
const CAT_STARTS = {"Water":"Drinks","Banana":"Fruit","Broccoli":"Veggies & beans","White rice":"Grains & bread","Eggs":"Protein & nuts","Mozzarella":"Dairy","Pizza, cheese":"Meals & takeout","Potato chips, plain":"Snacks & sweets","Ketchup":"Sauces & extras"};
const FOOD_CATS = Object.values(CAT_STARTS);
let _cat = "Drinks";
const BUILTIN = FOOD_ROWS.map(r => (_cat = CAT_STARTS[r[0]] || _cat, {cat:_cat, key:"db:"+r[0].toLowerCase(), name:r[0], serving:r[1], kcal:r[2], p:r[3], c:r[4], f:r[5], ic:r[6], dairy:!!r[7], soothe:!!r[8], kw:(r[9]||"").toLowerCase(), src:"db"}));
function allFoods(){ return S.custom.map(c => Object.assign({src:"custom", kw:""}, c)).concat(BUILTIN); }
function foodByKey(k){ return allFoods().find(f => f.key===k); }
function markOf(nameOrKey){ return S.marks[(nameOrKey||"").toLowerCase()]; }
function nameKey(name){ return (name||"").trim().toLowerCase(); }

function classifyText(text){
  const t = " " + (text||"").toLowerCase() + " ";
  let ic = "U";
  const hitsC = IC_CAUTION_WORDS.filter(w => t.includes(w)), hitsT = IC_TRY_WORDS.filter(w => t.includes(w));
  if(hitsC.length) ic = "C"; else if(hitsT.length) ic = "T";
  let cleaned = t; DAIRY_FREE_WORDS.forEach(w => cleaned = cleaned.split(w).join(" "));
  const dairy = DAIRY_WORDS.some(w => cleaned.includes(w));
  return {ic, dairy, hits: hitsC.length ? hitsC : hitsT};
}
function searchFoods(q){
  q = q.trim().toLowerCase();
  let list = allFoods();
  if(S.settings.flare) list = list.filter(f => f.ic==="F" && markOf(f.name)!=="trigger" || markOf(f.name)==="safe");
  if(!q) return list.slice(0, 60);
  const words = q.split(/\s+/);
  const freq = {}; S.entries.forEach(e=>{ const k=nameKey(e.name); freq[k]=(freq[k]||0)+1; });
  const scored = [];
  for(const f of list){
    const n = f.name.toLowerCase(), hay = " " + (n + " " + f.kw).replace(/[^a-z0-9%&'é ]+/g," ");
    if(!words.every(w => hay.includes(" " + w))) continue;
    let s = 0;
    const head = n.split(/[,(]/)[0].trim().split(/\s+/).pop();
    if(n===q) s+=100; if(n.startsWith(q)) s+=30; if(n.includes(q)) s+=20;
    if(head===words[words.length-1] || head===words[words.length-1]+"s" || head+"s"===words[words.length-1]) s+=45;
    s -= n.length*0.15;
    s += Math.min(25, (freq[n]||0)*5);
    if(S.favorites.includes(f.key)) s+=15; if(f.src==="custom") s+=10;
    scored.push([s,f]);
  }
  return scored.sort((a,b)=>b[0]-a[0]).map(x=>x[1]).slice(0,60);
}
function icBadge(ic, name){
  const m = markOf(name);
  if(m==="safe") return `<span class="b safe">My safe food</span>`;
  if(m==="trigger") return `<span class="b trig">My trigger</span>`;
  return `<span class="b ${ic}">${IC_LABEL[ic]||"Not rated"}</span>`;
}
function effectiveIC(ic, name){ const m=markOf(name); return m==="safe"?"F":m==="trigger"?"C":ic; }
function badges(f){
  return icBadge(f.ic, f.name) + (f.dairy?` <span class="b milk">Dairy</span>`:"") + (f.soothe && f.ic==="F" && S.settings.flare?` <span class="b soothe">Soothing</span>`:"");
}

/* ---------------- xp / bunny ---------------- */
function addXP(n){
  const d = today(); const cur = S.xpByDate[d]||0;
  const add = Math.max(0, Math.min(n, XP_DAY_CAP-cur));
  S.xpByDate[d] = cur + add; return add;
}
const totalXP = () => Object.values(S.xpByDate).reduce((a,b)=>a+b,0);
function stageInfo(){
  const xp = totalXP(); let i = 0;
  STAGES.forEach((s,j)=>{ if(xp>=s[0]) i=j; });
  const next = STAGES[i+1];
  return {i, name:STAGES[i][1], scale:STAGES[i][2], xp, pct: next ? (xp-STAGES[i][0])/(next[0]-STAGES[i][0])*100 : 100, next};
}
function loggedDays(){
  const set = new Set(); S.entries.forEach(e=>set.add(e.date)); S.checkins.forEach(c=>set.add(c.date)); return set;
}
function streak(){
  const set = loggedDays(); let d = today(); if(!set.has(d)) d = addDays(d,-1);
  let n=0; while(set.has(d)){ n++; d=addDays(d,-1); } return n;
}
function unlocked(){ const n = loggedDays().size; return ACCESSORIES.filter(a => n >= a.days); }
function checkUnlocks(){
  const fresh = unlocked().filter(a => !S.seenUnlocks.includes(a.id));
  if(!fresh.length) return;
  fresh.forEach(a => S.seenUnlocks.push(a.id)); save();
  const a = fresh[fresh.length-1];
  pendingUnlock = Object.assign({}, a, {more: fresh.length-1});
  setTimeout(showPendingUnlock, 450);
}
let pendingUnlock = null, addReturn = null;
function showPendingUnlock(){
  if(!pendingUnlock || $("#layer").innerHTML) return;
  const a = pendingUnlock; pendingUnlock = null;
  openModal(`<div class="center"><div style="font-size:56px">${a.e}</div><h2>New goodie unlocked!</h2>
    <p class="muted">${esc(S.petName||"Your bunny")} earned the <b>${a.name}</b> for logging ${a.days} day${a.days>1?"s":""}.${a.more?` Plus ${a.more} more goodie${a.more>1?"s":""} waiting in the closet!`:""}</p>
    <div class="row"><button class="btn soft" data-a="close">Later</button><button class="btn" data-a="wear" data-id="${a.id}">Put it on</button></div></div>`);
}

function bunnySVG(opts={}){
  const st = opts.stage ?? stageInfo();
  const sleepy = opts.sleepy ?? false;
  const eq = new Set(opts.equipped ?? S.equipped);
  const s = st.scale;
  const ear = sleepy ? 28 : 10;
  let bg = "", fg = "", outside = "";
  if(eq.has("rainbow")) bg += `<g opacity=".55" fill="none" stroke-width="9"><path d="M20 150a90 90 0 0 1 180 0" stroke="#f8a5c2"/><path d="M30 150a80 80 0 0 1 160 0" stroke="#fde2b8"/><path d="M40 150a70 70 0 0 1 140 0" stroke="#c9ead4"/><path d="M50 150a60 60 0 0 1 120 0" stroke="#d8c8f2"/></g>`;
  if(eq.has("house")) bg += `<g transform="translate(6 112)"><path d="M0 40 L32 10 L64 40Z" fill="#f48fb1"/><rect x="6" y="38" width="52" height="48" rx="4" fill="#fff0f5" stroke="#f3c6d3" stroke-width="3"/><path d="M22 86v-22a10 10 0 0 1 20 0v22" fill="#e9c7d3"/></g>`;
  if(eq.has("garden")) { const tulip=(x,c)=>`<g transform="translate(${x} 176)"><path d="M0 30V6" stroke="#8cc9a0" stroke-width="3"/><path d="M-7 4 q0-12 7-12 q7 0 7 12 q-3 4-7 4 q-4 0-7-4z" fill="${c}"/></g>`; outside += tulip(18,"#f48fb1")+tulip(36,"#c8a8e9")+tulip(184,"#f8a5c2")+tulip(202,"#fde2b8"); }
  if(eq.has("carrot")) outside += `<g transform="translate(172 168) rotate(18)"><path d="M0 0 L9 34 L18 0Z" fill="#f6a35b"/><path d="M4 8h8M5 16h7M7 24h4" stroke="#e08a3e" stroke-width="2"/><path d="M9 0 q-8-12-2-14 M9 0 q0-14 4-14 M9 0 q8-10 10-6" stroke="#7fb894" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
  if(eq.has("scarf")) fg += `<path d="M66 140 q44 18 88 0 l2 12 q-46 20 -92 0z" fill="#f06292"/><path d="M128 150 l10 28 l-12 2 l-6-26z" fill="#ec407a"/><path d="M80 146v8M96 150v8M112 151v8M140 145v8" stroke="#fff" stroke-width="2" opacity=".6"/>`;
  if(eq.has("glasses")) fg += `<g fill="none" stroke="#8a6676" stroke-width="3"><circle cx="92" cy="104" r="12"/><circle cx="128" cy="104" r="12"/><path d="M104 104h12"/></g>`;
  if(eq.has("crown")) { const fl=[[74,72,"#f8a5c2"],[88,64,"#fde2b8"],[102,60,"#c8a8e9"],[118,60,"#f8a5c2"],[132,64,"#fde2b8"],[146,72,"#c8a8e9"]]; fg += `<path d="M70 76 q40-24 80 0" stroke="#8cc9a0" stroke-width="4" fill="none"/>` + fl.map(([x,y,c])=>`<circle cx="${x}" cy="${y}" r="7" fill="${c}"/><circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>`).join(""); }
  if(eq.has("nurse")) fg += `<g transform="translate(110 64)"><path d="M-22 6 q22-22 44 0 l-3 8 h-38z" fill="#fff" stroke="#f3c6d3" stroke-width="2.5"/><path d="M-3 -4h6v4h4v6h-4v4h-6v-4h-4v-6h4z" fill="#f06292"/></g>`;
  if(eq.has("daisy")) fg += `<g transform="translate(76 74)">${[0,60,120,180,240,300].map(a=>`<ellipse rx="4" ry="8" transform="rotate(${a}) translate(0 -7)" fill="#fff" stroke="#f3e3c0"/>`).join("")}<circle r="4.5" fill="#f8c95b"/></g>`;
  if(eq.has("bow")) fg += `<g transform="translate(140 70) rotate(15)"><path d="M0 0 L-16 -9 L-16 9Z M0 0 L16 -9 L16 9Z" fill="#f06292"/><circle r="5" fill="#ec407a"/></g>`;
  const eyes = sleepy
    ? `<path d="M85 104 q7 6 14 0 M121 104 q7 6 14 0" stroke="#4a2c3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : `<circle cx="92" cy="103" r="7" fill="#4a2c3a"/><circle cx="128" cy="103" r="7" fill="#4a2c3a"/><circle cx="94.5" cy="100" r="2.5" fill="#fff"/><circle cx="130.5" cy="100" r="2.5" fill="#fff"/>`;
  const k = opts.fit ? Math.min(1, s + .15) : 1;
  const vb = opts.fit ? `${(110-110*k).toFixed(1)} ${(215-215*k).toFixed(1)} ${(220*k).toFixed(1)} ${(215*k).toFixed(1)}` : "0 0 220 215";
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-label="bunny">
  ${bg}
  <ellipse cx="110" cy="206" rx="${50*s+8}" ry="7" fill="#e0688f" opacity=".1"/>
  <g class="bun" transform="translate(110 205) scale(${s}) translate(-110 -205)">
    <circle cx="162" cy="172" r="15" fill="#fff" stroke="#f3c6d3" stroke-width="3"/>
    <ellipse cx="110" cy="162" rx="52" ry="44" fill="#fff" stroke="#f3c6d3" stroke-width="3"/>
    <ellipse cx="84" cy="201" rx="18" ry="8" fill="#fff" stroke="#f3c6d3" stroke-width="3"/>
    <ellipse cx="136" cy="201" rx="18" ry="8" fill="#fff" stroke="#f3c6d3" stroke-width="3"/>
    <g transform="rotate(-${ear} 92 82)"><ellipse cx="90" cy="46" rx="15" ry="38" fill="#fff" stroke="#f3c6d3" stroke-width="3"/><ellipse cx="90" cy="48" rx="7" ry="27" fill="#f8bbd0"/></g>
    <g transform="rotate(${ear} 128 82)"><ellipse cx="130" cy="46" rx="15" ry="38" fill="#fff" stroke="#f3c6d3" stroke-width="3"/><ellipse cx="130" cy="48" rx="7" ry="27" fill="#f8bbd0"/></g>
    <circle cx="110" cy="106" r="47" fill="#fff" stroke="#f3c6d3" stroke-width="3"/>
    ${eyes}
    <ellipse cx="80" cy="120" rx="9" ry="5.5" fill="#f8a5c2" opacity=".65"/><ellipse cx="140" cy="120" rx="9" ry="5.5" fill="#f8a5c2" opacity=".65"/>
    <path d="M104 113 q6-4 12 0 q-6 7 -12 0z" fill="#f48fb1"/>
    <path d="M110 118 q-1 6 -8 6 M110 118 q1 6 8 6" stroke="#c97a95" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="95" cy="160" rx="11" ry="8" fill="#fff" stroke="#f3c6d3" stroke-width="2.5"/><ellipse cx="125" cy="160" rx="11" ry="8" fill="#fff" stroke="#f3c6d3" stroke-width="2.5"/>
    ${fg}
  </g>
  ${outside}
</svg>`;
}

/* ---------------- ui plumbing ---------------- */
let lastViewKey = "", view = "today", day = today(), sheetState = null, lastToday = today();
const browse = {q:"", ic:null, cat:"All"};
function toast(msg, undo){
  document.querySelectorAll(".toast").forEach(x=>x.remove());
  const t = document.createElement("div"); t.className="toast"; t.textContent=msg;
  if(undo){ const b=document.createElement("button"); b.textContent="Undo"; b.className="undo"; b.onclick=()=>{ undo(); t.remove(); }; t.appendChild(b); }
  document.body.appendChild(t);
  setTimeout(()=>{ t.classList.add("out"); setTimeout(()=>t.remove(), 250); }, undo ? 5000 : 2200);
}
function sheetSig(){ const st=sheetState||{}; return [st.mode, st.tab, st.pick?st.pick.key:"", st.id||"", st.key||""].join("|"); }
function openSheet(html){
  const cur = document.querySelector("#layer .overlay:not(.center) .sheet");
  const sig = sheetSig();
  const tall = sheetState && sheetState.mode==="add" && !sheetState.pick;
  if(cur){ const keep = cur.dataset.sig===sig ? cur.scrollTop : 0; cur.innerHTML = `<div class="grab"></div>${html}`; cur.dataset.sig = sig; cur.classList.toggle("tall", !!tall); cur.scrollTop = keep; return; }
  $("#layer").innerHTML = `<div class="overlay" data-a="bg"><div class="sheet ${tall?"tall":""}" data-sig="${esc(sig)}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
}
function openModal(html){ $("#layer").innerHTML = `<div class="overlay center" data-a="bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; }
function closeLayer(){ $("#layer").innerHTML = ""; sheetState = null; addReturn = null; stopScanner(); if(pendingUnlock) setTimeout(showPendingUnlock, 350); }
function celebrate(gained){
  render();
  const b = document.querySelector("#app .bun-wrap");
  if(b){ b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop");
    const sc = b.parentElement;
    for(let i=0;i<3;i++){ const h=document.createElement("span"); h.className="heart"; h.textContent=["💗","🌸","✨"][i];
      h.style.left=(40+Math.random()*20)+"%"; h.style.top=(40+Math.random()*20)+"%"; h.style.animationDelay=(i*.15)+"s"; sc.appendChild(h); setTimeout(()=>h.remove(),1600); } }
  checkUnlocks();
}

/* ---------------- renderers ---------------- */
function render(){
  if(!S.petName){ $("#nav").innerHTML=""; $("#app").innerHTML = renderWelcome(); return; }
  $("#nav").innerHTML = [["today","Today","🏠"],["foods","Foods","🥕"],["insights","Insights","🔎"],["bunny","Bunny","🐰"]]
    .map(([k,l,i])=>`<button class="${view===k?"on":""}" data-a="nav" data-v="${k}"><span class="ic">${i}</span>${l}</button>`).join("");
  const fn = {today:renderToday, foods:renderFoods, insights:renderInsights, bunny:renderBunny}[view];
  const key = view+day;
  if(key!==lastViewKey){ lastViewKey=key; const ap=$("#app"); ap.classList.add("anim"); clearTimeout(render._t); render._t=setTimeout(()=>ap.classList.remove("anim"),450); }
  $("#app").innerHTML = fn();
}

function renderWelcome(){
  return `<div class="welcome">
    <div class="bobble">${bunnySVG({stage:{scale:.8}, equipped:["bow"]})}</div>
    <h1 style="margin:2px 0 6px">Hi Addy! 🌸</h1>
    <p class="muted" style="margin:0 6px">This little bun wants to keep you company while you figure out what your body loves (and what it doesn't).</p>
    <div class="feat"><div><span>🥕</span>Log food fast</div><div><span>💭</span>Track how you feel</div><div><span>🔎</span>Find your triggers</div></div>
    <div class="card" style="text-align:left">
      <label class="field"><span>Name your bunny</span><input class="inp" id="petname" maxlength="20" placeholder="e.g. Clover" autocomplete="off"></label>
      <button class="btn" style="width:100%" data-a="start">Let's go!</button>
    </div>
    <p class="small muted">${esc(GIFT_NOTE)}</p>
  </div>`;
}

function dayTotals(ds){
  const t={kcal:0,p:0,c:0,f:0};
  S.entries.filter(e=>e.date===ds).forEach(e=>{ t.kcal+=e.kcal*e.servings; t.p+=e.p*e.servings; t.c+=e.c*e.servings; t.f+=e.f*e.servings; });
  return t;
}
function hitTargets(ds){
  if(!S.settings.targetsOn) return false;
  const t = dayTotals(ds), s = S.settings;
  if(!S.entries.some(e=>e.date===ds)) return false;
  return ["kcal","p","c","f"].every(k => s[k]>0 && Math.abs(t[k]-s[k]) <= s[k]*0.1);
}
function ring(val, goal, label, color, unit){
  const pct = goal>0 ? Math.min(val/goal,1) : 0, R=30, C=2*Math.PI*R, left = r0(goal-val);
  return `<div><div class="ring"><svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="${R}" stroke="#fbe3eb" stroke-width="8" fill="none"/>
    <circle cx="36" cy="36" r="${R}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}" style="transition:stroke-dashoffset .6s"/></svg>
    <span><b style="font-size:15px">${fmtNum(val)}</b></span></div><div class="small" style="font-weight:800;margin-top:4px">${label}</div>
    <div class="small muted" style="font-size:11px;font-weight:700">${left>=0?`${fmtNum(left)}${unit} left`:`${fmtNum(-left)}${unit} over`}</div></div>`;
}

function greeting(){ const h=new Date().getHours(); return h<5?"Up late":h<12?"Good morning":h<17?"Good afternoon":h<21?"Good evening":"Good night"; }
function renderToday(){
  const st = stageInfo(), isToday = day===today();
  const loggedToday = loggedDays().has(today());
  const ents = S.entries.filter(e=>e.date===day).sort((a,b)=>a.ts-b.ts);
  const chks = S.checkins.filter(c=>c.date===day).sort((a,b)=>a.ts-b.ts);
  const t = dayTotals(day), s = S.settings, str = streak(), days = loggedDays().size;
  const nm = esc(S.petName);
  const moods = loggedToday ? [`Yay, you checked in today! 💗`,`*happy binky* 🐇`,`You're doing great, Addy.`,`Thanks for looking after you.`] : [`Zzz… log something to wake me up!`];
  const mood = moods[(new Date().getDate()) % moods.length];
  const caution = ents.filter(e=>effectiveIC(e.ic,e.name)==="C").length, dairy = ents.filter(e=>e.dairy).length;
  const totalsHTML = s.targetsOn
    ? `<div class="rings">${ring(t.kcal,s.kcal,"Calories","#f06292","")}${ring(t.p,s.p,"Protein","#b18be0","g")}${ring(t.c,s.c,"Carbs","#eea44b","g")}${ring(t.f,s.f,"Fat","#6fb187","g")}</div>${hitTargets(day)?`<p class="center small" style="margin:12px 0 0;font-weight:800;color:var(--pink-d)">🎀 Target day! Nice balance.</p>`:""}`
    : `<div class="totals"><div><b>${fmtNum(t.kcal)}</b><span class="small muted">calories</span></div><div><b>${r0(t.p)}g</b><span class="small muted">protein</span></div><div><b>${r0(t.c)}g</b><span class="small muted">carbs</span></div><div><b>${r0(t.f)}g</b><span class="small muted">fat</span></div></div>`;
  return `
  <div class="hello">${isToday?`${greeting()}, Addy`:"Looking back"}</div>
  <div class="top">
    <div class="datenav"><button class="iconbtn" data-a="day" data-n="-1" aria-label="Previous day">‹</button><button class="datebtn" data-a="gotoday">${prettyDate(day)}${isToday?"":`<small>tap for today</small>`}</button><button class="iconbtn" data-a="day" data-n="1" aria-label="Next day" ${isToday?"disabled":""}>›</button></div>
    <button class="iconbtn" data-a="settings" aria-label="Settings">⚙️</button>
  </div>
  <div class="card mini" >
    <div class="mini-bun" data-a="pet"><div class="bun-wrap">${bunnySVG({sleepy:!loggedToday, fit:true})}</div></div>
    <div class="mini-info">
      <div class="bubble">${mood}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px"><b class="name">${nm}</b><span class="small muted" style="font-weight:800">${st.name}</span></div>
      <div class="xpbar"><i style="width:${st.pct}%"></i></div>
      <div class="small" style="font-weight:700;color:var(--ink-2)">${days?`🌸 ${days} day${days===1?"":"s"} logged${str>1?` · 🔥 ${str} in a row`:""}`:"🌱 Your first day starts now"}</div>
    </div>
  </div>
  ${isToday && backupDue() ? `<div class="card nudge">
    <span style="font-size:26px">💾</span><div style="flex:1"><b>Back up ${nm}'s notes?</b><div class="small muted">${S.lastBackup?`Last backup ${Math.floor((Date.now()-S.lastBackup)/864e5)} days ago.`:"No backup yet."} Takes 5 seconds.</div></div>
    <div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm" data-a="export">Back up</button><button class="btn ghost sm" data-a="snoozebk">Later</button></div></div>` : ""}
  <div class="actions">
    <button class="btn big" data-a="add"><span>🥕</span>Add food</button>
    <button class="btn soft big" data-a="checkin"><span>💭</span>How I feel</button>
  </div>
  ${isToday && new Date().getHours()>=17 && !S.checkins.some(c=>c.date===today()) ? `<div class="card nudge" style="border-color:var(--pink)">
    <span style="font-size:28px">💭</span><div style="flex:1"><b>How was today?</b><div class="small muted">One quick check-in helps ${nm} learn what agrees with you.</div></div>
    <div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm" data-a="feelgoodquick">😊 Good day</button><button class="btn soft sm" data-a="checkin">Log it</button></div></div>` : ""}
  <button class="flarepill ${s.flare?"on":""}" data-a="flare" aria-pressed="${s.flare}">
    <span>${s.flare?"🌙":"🌤️"}</span><span style="flex:1;text-align:left"><b>Flare-day mode</b> <span class="small">${s.flare?"on: gentle foods only":"off"}</span></span><span class="switch ${s.flare?"on":""}"></span>
  </button>
  <div class="card">${totalsHTML}
    ${(caution||dairy)?`<div class="chips" style="margin-top:12px;justify-content:center">${caution?`<span class="b C">${caution} caution food${caution>1?"s":""}</span>`:""}${dairy?`<span class="b milk">${dairy} with dairy</span>`:""}</div>`:""}
  </div>
  ${MEALS.map(([k,l,i])=>{
    const list = ents.filter(e=>e.meal===k);
    const kc = list.reduce((a,e)=>a+e.kcal*e.servings,0);
    const yest = list.length ? [] : S.entries.filter(e=>e.date===addDays(day,-1) && e.meal===k);
    return `<div class="card meal">
      <div class="meal-h"><h3><span class="mi">${i}</span>${l}</h3>
        <span class="meal-r">${list.length?`<span class="kc">${fmtNum(kc)} cal</span>`:""}${list.length>1?`<button class="tbtn" data-a="savemealask" data-meal="${k}" aria-label="Save as meal">🍱</button>`:""}<button class="tbtn plus" data-a="add" data-meal="${k}" aria-label="Add to ${l}">＋</button></span></div>
      ${list.length ? list.map(e=>`<div class="swipe" data-del="entry" data-id="${e.id}"><button class="item" data-a="entry" data-id="${e.id}" aria-label="Edit ${esc(e.name)}"><span class="dot ${effectiveIC(e.ic,e.name)}"></span><span class="t"><b>${esc(e.name)}</b><span class="small muted">${servingsLabel(e.servings)} × ${esc(e.serving)}${e.dairy?" · 🥛":""}${markOf(e.name)==="trigger"?" · 🚩 my trigger":""}</span></span><span class="k">${fmtNum(e.kcal*e.servings)}</span><span class="chev">›</span></button></div>`).join("")
        : `<div class="emptyrow"><button class="addslot" data-a="add" data-meal="${k}">＋ Add ${l.toLowerCase()}</button>${yest.length?`<button class="addslot alt" data-a="repeat" data-meal="${k}">↻ Same as yesterday</button>`:""}</div>`}
    </div>`;
  }).join("")}
  <div class="card meal">
    <div class="meal-h"><h3><span class="mi">💭</span>How I felt</h3><span class="meal-r"><button class="tbtn plus" data-a="checkin" aria-label="Add check-in">＋</button></span></div>
    ${chks.length ? chks.map(c=>{
      const bl = Math.max(c.pain,c.urgency,c.frequency), gu = Math.max(c.bloating,c.cramps);
      return `<div class="swipe" data-del="check" data-id="${c.id}"><button class="item" data-a="editcheck" data-id="${c.id}" aria-label="Edit check-in"><span style="font-size:24px">${feelEmoji(Math.max(bl,gu))}</span><span class="t"><b>${fmtTime(c.time)}</b><span class="small muted">Bladder ${bl}/10 · Tummy ${gu}/10${(c.tags||[]).length?" · "+c.tags.map(t=>(CTX_TAGS.find(x=>x[0]===t)||[])[2]||"").join(""):""}${c.note?" · "+esc(c.note):""}</span></span>
        <span class="sev"><i style="background:${sevColor(bl)}"></i><i style="background:${sevColor(gu)}"></i></span><span class="chev">›</span></button></div>`;
    }).join("") : `<div class="emptyrow"><button class="addslot" data-a="checkin">Log how you feel, even on good days 💗</button></div>`}
  </div>`;
}
function sevInk(n){ return n<=2?"#3f9a62":n<=5?"#c7841f":"#d0475a"; }
function sevColor(n){ return n<=1?"#9fd3b0":n<=3?"#cfe3a6":n<=5?"#f6cf8c":n<=7?"#f2a07f":"#e2687a"; }
function backupDue(){
  if(loggedDays().size < 3) return false;
  const last = Math.max(S.lastBackup||0, S.backupSnooze||0);
  return Date.now() - last > 14*864e5;
}
function feelEmoji(n){ return n===0?"😊":n<=3?"🙂":n<=6?"😕":"😣"; }

function renderFoods(){
  const favs = allFoods().filter(f=>S.favorites.includes(f.key));
  return `<div class="top"><h1>Foods</h1><button class="iconbtn" data-a="settings" aria-label="Settings">⚙️</button></div>
  <details class="infobox"><summary><span>ⓘ How the ratings work</span><span>⌄</span></summary>
    <p>Bladder ratings come from the IC food lists (Interstitial Cystitis Association / IC Network). Everyone's different, so tap any food to mark it as <b>your</b> safe food or trigger, and your mark beats the list. Calories are typical estimates; scanned labels are exact.</p></details>
  ${favs.length?`<div class="card"><h2>⭐ Saved foods <span class="fcount">${favs.length}</span></h2>${favs.map(foodRow).join("")}</div>`:""}
  ${S.custom.length?`<div class="card"><h2>🧁 My custom & scanned <span class="fcount">${S.custom.length}</span></h2>${S.custom.map(foodRow).join("")}</div>`:""}
  <button class="btn soft" style="width:100%;margin-bottom:14px" data-a="customnew">＋ Make a custom food</button>
  <div class="card"><h2>📖 Food guide</h2>
    <input class="inp" id="browseq" placeholder="Search ${BUILTIN.length} foods…" value="${esc(browse.q)}" autocomplete="off">
    <div class="fade-r"><div class="chips scroll" style="margin:10px 0 6px" id="catchips">${["All",...FOOD_CATS].map(c=>`<button class="chip ${(browse.cat||"All")===c?"on":""}" data-a="browsecat" data-cat="${c}">${c}</button>`).join("")}</div></div>
    <div class="fade-r"><div class="chips scroll" style="margin:0 0 8px" id="icchips">${["F","T","C"].map(k=>`<button class="chip ${browse.ic===k?"on":""}" data-a="browseic" data-ic="${k}"><span class="dot ${k}"></span>${IC_LABEL[k]}</button>`).join("")}<button class="chip ${browse.ic==="milk"?"on":""}" data-a="browseic" data-ic="milk">🚫🥛 Dairy-free</button></div></div>
    <div id="browselist">${browseList()}</div>
  </div>`;
}
function browseList(){
  const q = browse.q, ic = browse.ic, cat = browse.cat && browse.cat!=="All" ? browse.cat : null;
  let list = q ? searchFoods(q) : BUILTIN.slice();
  if(cat) list = list.filter(f=>f.cat===cat);
  if(ic==="milk") list = list.filter(f=>!f.dairy); else if(ic) list = list.filter(f=>effectiveIC(f.ic,f.name)===ic);
  if(!list.length) return `<div class="empty">No matches</div>`;
  if(q) return list.slice(0,120).map(foodRow).join("");
  const groups = {}; list.forEach(f=>(groups[f.cat||"Mine"] ||= []).push(f));
  return Object.entries(groups).map(([c,fs])=>`<div class="sec-h">${c}<span class="fcount">${fs.length}</span></div>${fs.map(foodRow).join("")}`).join("");
}
function foodRow(f){
  return `<button class="item" data-a="foodinfo" data-key="${esc(f.key)}"><span class="dot ${effectiveIC(f.ic,f.name)}"></span><span class="t"><b>${esc(f.name)}</b><span class="small muted">${esc(f.serving)} · ${fmtNum(f.kcal)} cal${markOf(f.name)==="safe"?" · 💚 my safe food":markOf(f.name)==="trigger"?" · 🚩 my trigger":""}</span></span>${f.dairy?`<span class="mtag">Dairy</span>`:""}${S.favorites.includes(f.key)?"<span>⭐</span>":""}</button>`;
}

/* ---------- insights ---------- */
const CAT_RX = TRIGGER_CATS.map(c => ({...c, rx: new RegExp("(^|[^a-z])(" + c.words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|") + ")(?![a-z])", "i")}));
const CTX_TAGS = [["period","Period","🩸"],["stress","Stressed","😮‍💨"],["sleep","Poor sleep","🥱"],["med","New/changed med","💊"],["sick","Sick","🤧"],["active","Lots of activity","🏃‍♀️"]];
const BAD = 4;
function catsFor(f){
  const b = f.foodKey && f.foodKey.startsWith("db:") ? BUILTIN.find(x=>x.key===f.foodKey) : null;
  const c = !b && f.foodKey ? S.custom.find(x=>x.key===f.foodKey) : null;
  const text = " " + [f.name, b&&b.kw, f.ingr, c&&c.ingr].filter(Boolean).join(" ").toLowerCase() + " ";
  const out = CAT_RX.filter(c => c.rx.test(text)).map(c=>c.id);
  if(f.dairy) out.push("dairy");
  return out;
}
const CAT_INFO = id => id==="dairy" ? {label:"Dairy", e:"🥛"} : TRIGGER_CATS.find(c=>c.id===id);
// One "day" = everything eaten that date. Its outcome = worst symptoms logged from the first bite until 24h after the last.
function dayOutcomes(){
  const byDay = {};
  for(const e of S.entries){ (byDay[e.date] ||= []).push(e); }
  const checks = S.checkins;
  const days = [];
  for(const [d, es] of Object.entries(byDay)){
    const t0 = Math.min(...es.map(e=>e.ts)), t1 = Math.max(...es.map(e=>e.ts)) + 24*3600*1000;
    const cs = checks.filter(c => c.ts > t0 && c.ts <= t1);
    if(!cs.length) continue;
    const bl = Math.max(...cs.map(c=>Math.max(c.pain,c.urgency,c.frequency)));
    const gu = Math.max(...cs.map(c=>Math.max(c.bloating,c.cramps)));
    const foods = new Set(es.map(e=>nameKey(e.name)));
    const cats = new Set(es.flatMap(e => e.cats || catsFor(e)));
    const names = {}; es.forEach(e=>names[nameKey(e.name)] = e.name);
    days.push({d, bl, gu, bad: bl>=BAD || gu>=BAD, blBad: bl>=BAD, guBad: gu>=BAD, foods, cats, names});
  }
  return days;
}
function compare(days, has){
  const w = days.filter(has), wo = days.filter(d=>!has(d));
  const rate = (arr,k) => arr.length ? arr.filter(d=>d[k]).length/arr.length : null;
  return {nW:w.length, nWo:wo.length, w, wo,
    bl:[rate(w,"blBad"), rate(wo,"blBad")], gu:[rate(w,"guBad"), rate(wo,"guBad")], any:[rate(w,"bad"), rate(wo,"bad")]};
}
// one-sided Fisher exact test: chance of seeing >= a rough days among n1 "had it" days if the food made no difference
const _lf = [0]; function lfact(n){ for(let i=_lf.length;i<=n;i++) _lf[i]=_lf[i-1]+Math.log(i); return _lf[n]; }
function fisherGreater(a, n1, b, n2){
  const K = a+b, N = n1+n2; if(n1===0 || n2===0 || K===0) return 1;
  const lc = (n,k) => lfact(n)-lfact(k)-lfact(n-k);
  let p = 0; const denom = lc(N, K);
  for(let x=a; x<=Math.min(n1,K); x++) p += Math.exp(lc(n1,x)+lc(n2,K-x)-denom);
  return Math.min(1, p);
}
function testFactor(days, has){
  const w = days.filter(has), wo = days.filter(d=>!has(d));
  let best = null;
  for(const k of ["bl","gu"]){
    const key = k==="bl"?"blBad":"guBad";
    const a = w.filter(d=>d[key]).length, b = wo.filter(d=>d[key]).length;
    const rW = w.length? a/w.length : 0, rWo = wo.length? b/wo.length : 0;
    const p = fisherGreater(a, w.length, b, wo.length);
    const s = {k, w:rW, ref:rWo, lift:rW-rWo, p, a, n:w.length};
    if(!best || s.p < best.p) best = s;
  }
  return {cmp:{nW:w.length, nWo:wo.length, w, wo}, s:best};
}
function analyze(){
  const days = dayOutcomes();
  const base = days.length ? days.filter(d=>d.bad).length/days.length : 0;
  const P_FLAG = 0.035;
  const ok = (t) => t.cmp.nW >= 3 && t.cmp.nWo >= 2 && t.s.w >= .5 && t.s.lift >= .25 && t.s.p < P_FLAG;
  const names = {}; days.forEach(d=>Object.assign(names, d.names));
  const cands = [];
  for(const id of new Set(days.flatMap(d=>[...d.cats]))){ const t = testFactor(days, d=>d.cats.has(id)); if(ok(t)) cands.push({kind:"group", id, ...CAT_INFO(id), ...t, has:d=>d.cats.has(id)}); }
  for(const [k, name] of Object.entries(names)){ const t = testFactor(days, d=>d.foods.has(k)); if(ok(t)) cands.push({kind:"food", k, name, ...t, has:d=>d.foods.has(k)}); }
  cands.sort((x,y)=>x.s.p-y.s.p || (x.kind==="group"?-1:1));
  // step through strongest first; a weaker suspect must still stand out on days without the stronger ones
  const accepted = [], cleared = [];
  const foodCats = k => { const b = BUILTIN.find(f=>f.key==="db:"+k) || S.custom.find(c=>nameKey(c.name)===k) || {}; return catsFor({name:names[k], foodKey:b.key, dairy:b.dairy}); };
  for(const c of cands){
    const parent = c.kind==="food" ? accepted.find(a=>a.kind==="group" && foodCats(c.k).includes(a.id)) : null;
    if(parent){ c.partOf = parent; accepted.push(c); continue; }
    const blockers = accepted.filter(a=>!(a.kind==="group" && c.kind==="food" && foodCats(c.k).includes(a.id)));
    if(!blockers.length){ accepted.push(c); continue; }
    const rest = days.filter(d=>!blockers.some(a=>a.has(d)));
    const t2 = testFactor(rest, c.has);
    const label = blockers.map(a=>a.kind==="group"?a.label.toLowerCase():a.name).slice(0,2).join(" / ");
    if(t2.cmp.nW === 0){ c.note = `Always eaten with ${label}, so it's hard to tell which one it is`; accepted.push(c); }
    else if(t2.cmp.nW >= 2 && t2.s.w >= .5 && t2.s.lift >= .2 && t2.s.p < 0.2){ accepted.push(c); }
    else { c.note = `Seems fine without ${label}`; c.cleared = true; cleared.push(c); }
  }
  const groups = accepted.filter(c=>c.kind==="group");
  const foods = accepted.filter(c=>c.kind==="food");
  const safe = [];
  for(const [k, name] of Object.entries(names)){
    const w = days.filter(d=>d.foods.has(k)); if(w.length >= 3 && w.every(d=>!d.bad)) safe.push({k, name, n:w.length});
  }
  safe.sort((a,b)=>b.n-a.n);
  // dairy check
  const dairy = compare(days, d=>d.cats.has("dairy"));
  const avg = (arr,k) => arr.length ? arr.reduce((a,d)=>a+d[k],0)/arr.length : null;
  dairy.avgGu = [avg(dairy.w,"gu"), avg(dairy.wo,"gu")]; dairy.avgBl = [avg(dairy.w,"bl"), avg(dairy.wo,"bl")];
  // context tags (per check-in)
  const tagStats = CTX_TAGS.map(([id,label,e])=>{
    const w = S.checkins.filter(c=>(c.tags||[]).includes(id)), wo = S.checkins.filter(c=>!(c.tags||[]).includes(id));
    const m = c => Math.max(c.pain,c.urgency,c.frequency,c.bloating,c.cramps);
    const av = arr => arr.length ? arr.reduce((a,c)=>a+m(c),0)/arr.length : null;
    return {id,label,e,n:w.length, w:av(w), wo:av(wo)};
  }).filter(t=>t.n>=2 && t.wo!==null);
  return {days:days.length, checks:S.checkins.length, base, groups, foods, cleared, safe, dairy, tagStats};
}
const pct = x => x===null ? "–" : Math.round(x*100)+"%";
function twin(s, n){
  const strong = s.p < 0.01 && n >= 4;
  return {pill: `<span class="pill ${strong?"strong":"maybe"}">${strong?"Likely trigger":"Worth watching"}</span>`,
    bars: `<div class="twin"><span>Had it</span><span class="tb"><i style="width:${Math.round(s.w*100)}%;background:var(--bad)"></i></span><span>${pct(s.w)}</span>
      <span>Didn't</span><span class="tb"><i style="width:${Math.round(s.ref*100)}%;background:var(--ok)"></i></span><span>${pct(s.ref)}</span></div>`};
}
function suspectLine(s){ return `Rough ${s.k==="bl"?"bladder":"tummy"} after <b>${pct(s.w)}</b> of days you had it vs ${pct(s.ref)} without`; }
function weekData(end){
  const days = []; for(let i=6;i>=0;i--) days.push(addDays(end,-i));
  return days.map(d=>{
    const cs = S.checkins.filter(c=>c.date===d);
    const es = S.entries.filter(e=>e.date===d);
    return {d, bl: cs.length?Math.max(...cs.map(c=>Math.max(c.pain,c.urgency,c.frequency))):null,
      gu: cs.length?Math.max(...cs.map(c=>Math.max(c.bloating,c.cramps))):null,
      kcal: es.reduce((a,e)=>a+e.kcal*e.servings,0), n:es.length, tags:[...new Set(cs.flatMap(c=>c.tags||[]))],
      caution: es.filter(e=>effectiveIC(e.ic,e.name)==="C").map(e=>e.name), dairy: es.filter(e=>e.dairy).length};
  });
}
function renderInsights(){
  if(!S.entries.length && !S.checkins.length) return `<div class="top"><h1>Insights</h1><button class="iconbtn" data-a="settings" aria-label="Settings">⚙️</button></div>
    <div class="card center" style="padding:24px 18px">
      <div style="font-size:44px">🔎</div><h2 style="margin:6px 0">Your patterns will show up here</h2>
      <p class="muted small" style="margin:0 0 16px">${esc(S.petName)} needs about a week of notes to start spotting what agrees with you.</p>
      <div style="text-align:left">
        <div class="ins"><span style="font-size:22px">🥕</span><div class="t"><b>Log what you eat</b><div class="small muted">Even roughly. Saved meals make it quick.</div></div></div>
        <div class="ins"><span style="font-size:22px">💭</span><div class="t"><b>Check in once or twice a day</b><div class="small muted">Good days matter just as much as rough ones.</div></div></div>
        <div class="ins"><span style="font-size:22px">🍅</span><div class="t"><b>See your triggers</b><div class="small muted">Like tomato, caffeine or dairy, plus a summary for your doctor.</div></div></div>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn" data-a="add">Add food</button><button class="btn soft" data-a="checkin">How I feel</button></div>
    </div>`;
  const A = analyze(), W = weekData(today());
  const logged = W.filter(d=>d.n||d.bl!==null);
  const avg = arr => { const v = arr.filter(x=>x!==null); return v.length ? (v.reduce((a,b)=>a+b,0)/v.length) : null; };
  const avgBl = avg(W.map(d=>d.bl)), avgGu = avg(W.map(d=>d.gu));
  const kDays = W.filter(d=>d.n);
  const avgK = kDays.length ? kDays.reduce((a,d)=>a+d.kcal,0)/kDays.length : 0;
  const cautionCounts = {}; W.forEach(d=>d.caution.forEach(n=>cautionCounts[n]=(cautionCounts[n]||0)+1));
  const topCaution = Object.entries(cautionCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const dairyTotal = W.reduce((a,d)=>a+d.dairy,0);
  const needMore = A.days < 5;
  const Dy = A.dairy, dairyReady = Dy.nW>=2 && Dy.nWo>=2;
  const bar = (v, max, color) => `<div class="bar"><i style="width:${v===null?0:Math.min(100,v/max*100)}%;background:${color}"></i></div>`;
  const prevW = weekData(addDays(today(),-7));
  const pAvg = arr => { const v=arr.filter(x=>x!==null); return v.length? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const pBl = pAvg(prevW.map(d=>d.bl)), pGu = pAvg(prevW.map(d=>d.gu));
  const trend = (now, prev) => now===null||prev===null ? "this week" : Math.abs(now-prev)<.3 ? "same as last wk" : now<prev ? `▼ ${(prev-now).toFixed(1)} vs last wk` : `▲ ${(now-prev).toFixed(1)} vs last wk`;
  return `<div class="top"><h1>Insights</h1><button class="iconbtn" data-a="settings" aria-label="Settings">⚙️</button></div>
  <div class="tiles">
    <div class="tile"><small>Logged</small><b>${logged.length}/7</b><i>days this week</i></div>
    <div class="tile"><small>Bladder</small><b style="color:${avgBl===null?"inherit":sevInk(Math.round(avgBl))}">${avgBl===null?"–":avgBl.toFixed(1)}</b><i>${trend(avgBl,pBl)}</i></div>
    <div class="tile"><small>Tummy</small><b style="color:${avgGu===null?"inherit":sevInk(Math.round(avgGu))}">${avgGu===null?"–":avgGu.toFixed(1)}</b><i>${trend(avgGu,pGu)}</i></div>
  </div>
  ${A.days < 30 ? `<div class="card" style="padding:12px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>📈 Learning your patterns</b><span class="small muted" style="font-weight:800">${A.days} / 30 days</span></div>
    <div class="xpbar"><i style="width:${Math.round(A.days/30*100)}%"></i></div>
    <div class="small muted">${A.days<5?"Patterns start showing after about 5 days.":A.days<15?"Early patterns showing. They get sharper every day you check in.":"Getting close! Around 30 days, results are much more reliable."} A day counts when you log food <i>and</i> how you felt.</div></div>` : ""}
  <div class="card">
    <h2>🔎 Possible triggers</h2>
    ${needMore ? `<div class="empty">Keep logging meals and a "How I feel" or two each day (good days too!). After about a week, patterns show up here.<br><br><b>${A.days}</b> of 5 days with check-ins so far.</div>` : `
      <h3 style="margin-top:4px">Trigger groups</h3>
      ${A.groups.length ? A.groups.map(g=>{ const tw = twin(g.s, g.cmp.nW); return `<div class="ins"><span style="font-size:26px;align-self:flex-start">${g.e}</span><div class="t"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${g.label}</b>${tw.pill}</div>
        <div class="small muted">Rough ${g.s.k==="bl"?"bladder":"tummy"} days · ${g.cmp.nW} days with it</div>${tw.bars}</div></div>`; }).join("")
        : `<div class="empty">No group stands out yet 🎉</div>`}
      <h3 style="margin-top:14px">Specific foods</h3>
      ${A.foods.length ? A.foods.map(s=>{ const tw = twin(s.s, s.cmp.nW); const bf = BUILTIN.find(b=>b.key==="db:"+s.k) || S.custom.find(c=>nameKey(c.name)===s.k) || {}; const grp = A.groups.find(g=>catsFor({name:s.name, foodKey:bf.key, dairy:bf.dairy}).includes(g.id));
        return `<div class="ins"><div class="t"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(s.name)}</b>${tw.pill}</div>
        <div class="small muted">Rough ${s.s.k==="bl"?"bladder":"tummy"} days · ${s.cmp.nW} days with it${grp?` · part of ${grp.e} ${grp.label}`:""}</div>${tw.bars}
        ${s.note?`<div class="small" style="color:var(--try);font-weight:700;margin-top:4px">⚠️ ${esc(s.note)}</div>`:""}
        <button class="chip ${markOf(s.name)==="trigger"?"on":""}" style="margin-top:8px" data-a="markname" data-name="${esc(s.name)}" data-m="trigger">${markOf(s.name)==="trigger"?"🚩 Marked as my trigger":"🚩 Mark as my trigger"}</button></div></div>`; }).join("")
        : `<div class="empty">No single food stands out yet.</div>`}
      ${A.cleared.length?`<div class="small muted" style="margin-top:8px">Probably innocent bystanders: ${A.cleared.map(c=>`${esc(c.name)} (${esc(c.note.toLowerCase())})`).join("; ")}</div>`:""}`}
    <p class="small muted" style="margin-bottom:0">Compares days you ate something with days you didn't (rough = 4+ out of 10 within 24h), and only flags differences too big to be a coincidence. "Worth watching" means try cutting it for a week and see. It gets more accurate the longer you log. These are patterns, not proof, so bring them to your doctor.</p>
  </div>
  <div class="card"><h2>🥛 Dairy check</h2>
    ${dairyReady ? `<div class="small muted" style="margin-bottom:8px">Average worst tummy score</div>
      <div class="setrow" style="border:0;padding:4px 0"><span>With dairy <span class="muted small">(${Dy.nW} days)</span></span><b>${Dy.avgGu[0].toFixed(1)} / 10</b></div>${bar(Dy.avgGu[0],10,"#c8a8e9")}
      <div class="setrow" style="border:0;padding:4px 0;margin-top:6px"><span>Dairy-free <span class="muted small">(${Dy.nWo} days)</span></span><b>${Dy.avgGu[1].toFixed(1)} / 10</b></div>${bar(Dy.avgGu[1],10,"#c8a8e9")}
      <p class="small" style="margin:10px 0 0;font-weight:700">${Dy.avgGu[0]-Dy.avgGu[1]>=1.5?"Your tummy does noticeably worse on dairy days.":Dy.avgGu[0]-Dy.avgGu[1]>=.5?"Dairy days are a little rougher on your tummy.":"Dairy doesn't seem to make much difference so far 🎉"}
      <span class="muted" style="font-weight:600"> Bladder: ${Dy.avgBl[0].toFixed(1)} with vs ${Dy.avgBl[1].toFixed(1)} without.</span></p>`
      : `<div class="empty">Needs at least 2 dairy days and 2 dairy-free days with check-ins (${Dy.nW} and ${Dy.nWo} so far).</div>`}
  </div>
  ${A.tagStats.length?`<div class="card"><h2>🗓️ Other things that matter</h2>${A.tagStats.map(t=>`<div class="ins"><span style="font-size:22px">${t.e}</span><div class="t"><b>${t.label}</b><div class="small muted">Avg worst symptom ${t.w.toFixed(1)} vs ${t.wo.toFixed(1)} otherwise · ${t.n} check-ins</div></div></div>`).join("")}
    <p class="small muted" style="margin-bottom:0">Not everything is food! Tag check-ins so food doesn't get blamed for these.</p></div>`:""}
  ${A.safe.length?`<div class="card"><h2>💚 Seem to agree with you</h2>${A.safe.slice(0,8).map(s=>`<div class="ins"><div class="t"><b>${esc(s.name)}</b><div class="small muted">${s.n} days with no rough patch after</div></div><button class="btn soft sm" data-a="markname" data-name="${esc(s.name)}" data-m="safe">${markOf(s.name)==="safe"?"Marked ✓":"Mark safe"}</button></div>`).join("")}</div>`:""}
  <div class="card" id="weekly">
    <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">📅 This week</h2><button class="btn soft sm" data-a="copyweek">Copy text</button></div>
    <div class="small muted">${prettyDate(W[0].d)} – ${prettyDate(W[6].d)} · for your doctor</div>
    <div class="week">${W.map(d=>`<div class="d ${d.d===today()?"today":""}"><div class="bars">
      <i style="height:${d.bl===null?2:Math.max(4,d.bl*8)}px;background:${d.bl===null?"#eee":"#e2687a"}"></i>
      <i style="height:${d.gu===null?2:Math.max(4,d.gu*8)}px;background:${d.gu===null?"#eee":"#c8a8e9"}"></i></div>
      <small>${new Date(d.d+"T12:00").toLocaleDateString(undefined,{weekday:"narrow"})}</small></div>`).join("")}</div>
    <div class="legend"><span><i style="background:#e2687a"></i>Worst bladder</span><span><i style="background:#c8a8e9"></i>Worst tummy</span></div>
    <div class="spacer"></div>
    <div class="setrow"><span>Days logged</span><b>${logged.length} / 7</b></div>
    <div class="setrow"><span>Avg worst bladder</span><b>${avgBl===null?"–":avgBl.toFixed(1)+" / 10"}</b></div>
    <div class="setrow"><span>Avg worst tummy</span><b>${avgGu===null?"–":avgGu.toFixed(1)+" / 10"}</b></div>
    <div class="setrow"><span>Avg calories (logged days)</span><b>${kDays.length?fmtNum(avgK):"–"}</b></div>
    <div class="setrow"><span>Foods with dairy</span><b>${dairyTotal}</b></div>
    <div class="setrow" style="align-items:flex-start"><span>Caution foods eaten</span><b style="text-align:right">${topCaution.length?topCaution.map(([n,c])=>`${esc(n)}${c>1?" ×"+c:""}`).join("<br>"):(kDays.length?"None 🎉":"–")}</b></div>
    ${A.groups.length||A.foods.length?`<div class="setrow" style="align-items:flex-start"><span>Possible triggers</span><b style="text-align:right">${[...A.groups.map(g=>g.label),...A.foods.map(s=>esc(s.name))].slice(0,6).join("<br>")}</b></div>`:""}
  </div>`;
}
function weekText(){
  const W = weekData(today()), A = analyze();
  const tagName = id => (CTX_TAGS.find(t=>t[0]===id)||[,id])[1].toLowerCase();
  const lines = [`Food & symptom summary: ${W[0].d} to ${W[6].d}`, ""];
  W.forEach(d=>{
    lines.push(`${new Date(d.d+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}: bladder ${d.bl===null?"-":d.bl+"/10"}, tummy ${d.gu===null?"-":d.gu+"/10"}, ${d.n} foods${d.caution.length?" (caution: "+d.caution.join(", ")+")":""}${d.dairy?", "+d.dairy+" dairy":""}${d.tags.length?" [" + d.tags.map(tagName).join(", ") + "]":""}`);
  });
  if(A.groups.length) lines.push("", "Possible trigger groups (pattern, not proof): " + A.groups.map(g=>`${g.label} (${pct(g.s.w)} vs ${pct(g.s.ref)})`).join(", "));
  if(A.foods.length) lines.push("Possible trigger foods: " + A.foods.map(s=>s.name).join(", "));
  const Dy = A.dairy; if(Dy.nW>=2 && Dy.nWo>=2) lines.push(`Dairy check: avg worst tummy ${Dy.avgGu[0].toFixed(1)}/10 on dairy days vs ${Dy.avgGu[1].toFixed(1)}/10 dairy-free`);
  const marks = Object.entries(S.marks); if(marks.length){ lines.push("", "My triggers: " + (marks.filter(m=>m[1]==="trigger").map(m=>m[0]).join(", ")||"none"), "My safe foods: " + (marks.filter(m=>m[1]==="safe").map(m=>m[0]).join(", ")||"none")); }
  return lines.join("\n");
}

/* ---------- bunny tab ---------- */
function renderBunny(){
  const st = stageInfo(), days = loggedDays().size, un = new Set(unlocked().map(a=>a.id));
  const targetDays = [...loggedDays()].filter(hitTargets).length;
  const path = STAGES.map((x,i)=>`${i?`<span class="ln ${i<=st.i?"done":""}"></span>`:""}<span class="st ${i<st.i?"done":i===st.i?"now":""}"><i></i>${x[1].replace(" bun","")}</span>`).join("");
  return `<div class="top"><h1>${esc(S.petName)}</h1><button class="iconbtn" data-a="settings" aria-label="Settings">⚙️</button></div>
  <div class="card bunnycard"><div class="scene" data-a="pet" style="height:240px"><div class="bun-wrap">${bunnySVG({sleepy:!loggedDays().has(today())})}</div></div>
    <div class="bunnyinfo">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:18px">${st.name}</b><span class="small muted" style="font-weight:800">${st.next?`${st.next[0]-st.xp} 🥕 to ${st.next[1]}`:"All grown up 💗"}</span></div>
      <div class="xpbar"><i style="width:${st.pct}%"></i></div>
      <div class="path">${path}</div>
      <div class="small muted">Every meal (+${XP_FOOD}) or check-in (+${XP_CHECK}) helps ${esc(S.petName)} grow, up to ${XP_DAY_CAP} 🥕 a day. A hard day counts just as much as a good one.</div></div></div>
  <div class="card"><h2>👗 Closet <span class="fcount">${un.size}/${ACCESSORIES.length}</span></h2><div class="closet">${ACCESSORIES.map(a=>{
      const has = un.has(a.id), on = S.equipped.includes(a.id), left = a.days - days;
      return `<button class="acc ${on?"on":""} ${has?"":"locked"}" data-a="${has?"equip":"noop"}" data-id="${a.id}"><span class="e">${a.e}</span><b>${a.name}</b><small>${has?(on?"Wearing ✓":"Tap to wear"):`${left} more day${left===1?"":"s"}`}</small>${has?"":`<div class="mini-bar"><i style="width:${Math.min(100,days/a.days*100)}%"></i></div>`}</button>`;}).join("")}</div>
    <p class="small muted" style="margin-bottom:0">Goodies unlock by total days logged, so missing a day never takes anything away.</p></div>
  <div class="card"><h2>🏅 Badges</h2><div class="stattiles">
    <div><b>🌸 ${days}</b><small>days logged</small></div>
    <div><b>🔥 ${streak()}</b><small>day streak</small></div>
    <div><b>💭 ${S.checkins.length}</b><small>check-ins</small></div>
    <div><b>🎀 ${S.settings.targetsOn?targetDays:"–"}</b><small>${S.settings.targetsOn?"target days":"targets off"}</small></div>
  </div></div>`;
}

/* ---------------- sheets ---------------- */
function openAdd(meal){
  sheetState = {mode:"add", tab:"search", meal: meal||guessMeal(), q:"", pick:null, servings:1};
  drawAdd();
}
function drawAdd(){
  const st = sheetState;
  let scanDelay = 0; if(scanner){ stopScanner(); scanDelay = 450; }
  if(st.pick) return drawPortion();
  const mealChips = MEALS.map(([k,l,i])=>`<button class="${st.meal===k?"on":""}" data-a="meal" data-meal="${k}"><span>${i}</span>${l}</button>`).join("");
  let body = "";
  if(st.tab==="search"){
    body = `<div class="search"><input class="inp" id="q" type="search" enterkeyhint="search" placeholder="Search foods… (e.g. chicken, latte)" value="${esc(st.q)}" autocomplete="off" autocorrect="off"></div>
      ${S.settings.flare?`<div class="note" style="margin-bottom:8px">🌙 Flare-day mode is on, so only gentle foods are shown.</div>`:""}
      <div id="results">${resultsHTML()}</div>`;
  } else if(st.tab==="saved"){
    const favs = allFoods().filter(f=>S.favorites.includes(f.key));
    const recent = []; const seen = new Set();
    S.entries.slice().sort((a,b)=>b.ts-a.ts).forEach(e=>{ const k=nameKey(e.name); if(!seen.has(k) && recent.length<12){ seen.add(k); recent.push(e); }});
    const mealsHTML = (S.meals||[]).map(m=>`<div class="result"><button class="t" style="text-align:left" data-a="logmeal" data-id="${m.id}"><b>🍱 ${esc(m.name)}</b>
      <div class="small muted">${m.items.length} items · ${fmtNum(m.items.reduce((a,x)=>a+x.kcal*x.servings,0))} cal · ${esc(m.items.map(x=>x.name).join(", "))}</div></button>
      <button class="star" data-a="delmeal" data-id="${m.id}" aria-label="delete meal">✕</button></div>`).join("");
    body = `${mealsHTML?`<h3>🍱 Saved meals</h3>${mealsHTML}<div class="spacer"></div>`:""}<h3>⭐ Saved</h3>${favs.length?favs.map(resultRow).join(""):`<div class="empty">Tap the ☆ on any food to save it here.</div>`}
      <div class="spacer"></div><h3>🕒 Recent</h3>${recent.length?recent.map(e=>resultRow(entryAsFood(e))).join(""):`<div class="empty">Foods you log will show up here.</div>`}`;
  } else if(st.tab==="scan"){
    body = scanHTML();
  } else if(st.tab==="custom"){
    body = customFormHTML(st.customDraft || {});
  }
  openSheet(`<div class="sheet-h"><h2>Add food</h2><button class="btn ghost sm" data-a="close">Done</button></div>
    <div class="mealseg">${mealChips}</div>
    <div class="tabs">${[["search","Search"],["saved","Saved"],["scan","Scan"],["custom","Custom"]].map(([k,l])=>`<button class="${st.tab===k?"on":""}" data-a="tab" data-tab="${k}">${l}</button>`).join("")}</div>
    ${body}`);
  if(st.tab==="scan" && st.scanning) setTimeout(()=>{ if(sheetState===st && st.scanning && st.tab==="scan") startScanner(); }, scanDelay);
}
function entryAsFood(e){ return {key: e.foodKey || ("e:"+nameKey(e.name)), name:e.name, serving:e.serving, kcal:e.kcal, p:e.p, c:e.c, f:e.f, ic:e.ic, dairy:e.dairy, src:e.src, ingr:e.ingr}; }
function resultsHTML(){
  const list = searchFoods(sheetState.q);
  let html = list.map(resultRow).join("");
  if(sheetState.q.trim()){
    const g = classifyText(sheetState.q);
    html += `<button class="result" data-a="quickcustom" style="border:2px dashed var(--line)"><span style="font-size:22px">✏️</span><span class="t"><b>Add "${esc(sheetState.q.trim())}"</b><div class="small muted">Not listed? Enter it yourself · auto-check: ${IC_LABEL[g.ic]}${g.dairy?", dairy":""}</div></span></button>`;
  }
  const q = sheetState.q.trim(), off = sheetState.off;
  if(q.length>=2){
    if(off && off.q===q){
      if(off.loading) html += `<div class="note">Searching online… 🔎</div>`;
      else if(off.err) html += `<div class="note">${off.err}</div>`;
      else html += `<h3 style="margin:10px 0 6px">🌐 Online results <span class="muted small">(Open Food Facts)</span></h3>` + (off.items.length ? off.items.map((p,i)=>`<button class="result" data-a="offpick" data-i="${i}"><span class="t"><b>${esc(offName(p))}</b><div class="small muted">${esc(p.serving_size||"per 100 g")} · tap to check & add</div></span><span>›</span></button>`).join("") : `<div class="empty">Nothing found online either. Use ✏️ above.</div>`);
    } else html += `<button class="btn soft" style="width:100%;margin-top:4px" data-a="offsearch">🌐 Search more foods online</button>`;
  }
  return html || `<div class="empty">No matches. Try Custom.</div>`;
}
const offSearchCache = {};
function offName(p){ return [p.brands && p.brands.split(",")[0].trim(), p.product_name].filter(Boolean).join(" ") || "Food"; }
async function offSearch(){
  const q = sheetState.q.trim(); if(!q) return;
  sheetState.off = {q, loading:true, items:[]}; $("#results").innerHTML = resultsHTML();
  try{
    const url = "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=20&search_terms=" + encodeURIComponent(q) +
      "&fields=code,product_name,brands,serving_size,serving_quantity,nutriments,ingredients_text,ingredients_text_en,allergens_tags";
    if(offSearchCache[q]){ sheetState.off = {q, items: offSearchCache[q]}; if($("#results")) $("#results").innerHTML = resultsHTML(); return; }
    const r = await fetchT(url, 9000); if(!r.ok) throw new Error(r.status);
    const j = await r.json();
    const items = (j.products||[]).filter(p=>p.product_name && p.nutriments && (p.nutriments["energy-kcal_100g"]!==undefined || p.nutriments["energy-kcal_serving"]!==undefined)).slice(0,12);
    offSearchCache[q] = items;
    if(sheetState && sheetState.off && sheetState.off.q===q){ sheetState.off = {q, items}; }
  }catch(e){
    if(sheetState && sheetState.off) sheetState.off = {q, items:[], err: navigator.onLine===false ? "You're offline. Online search needs internet." : (e && e.name==="AbortError" ? "Online search is taking too long right now. Try again in a bit, or add it yourself with ✏️." : "Online search didn't respond. Try again in a minute, or add it yourself with ✏️.")};
  }
  if(sheetState && sheetState.tab==="search" && $("#results")) $("#results").innerHTML = resultsHTML();
}
function resultRow(f){
  return `<div class="result"><button class="t" style="text-align:left" data-a="pick" data-key="${esc(f.key)}"><b>${esc(f.name)}</b>
    <div class="small muted" style="margin:2px 0 4px">${esc(f.serving)} · ${fmtNum(f.kcal)} cal · P${r0(f.p)} C${r0(f.c)} F${r0(f.f)}</div>${badges(f)}</button>
    <button class="star ${S.favorites.includes(f.key)?"on":""}" data-a="fav" data-key="${esc(f.key)}" aria-label="save">${S.favorites.includes(f.key)?"★":"☆"}</button></div>`;
}
function lookupForPick(key){
  return foodByKey(key) || (()=>{ const e = S.entries.slice().reverse().find(x=>("e:"+nameKey(x.name))===key || x.foodKey===key); return e?entryAsFood(e):null; })();
}
function drawPortion(){
  const st = sheetState, f = st.pick, n = st.servings;
  const opts = [0.5,1,1.5,2];
  openSheet(`<div class="sheet-h"><button class="btn ghost sm" data-a="back">‹ Back</button><span><button class="star ${S.favorites.includes(f.key)?"on":""}" data-a="fav" data-key="${esc(f.key)}" aria-label="Save food">${S.favorites.includes(f.key)?"★":"☆"}</button><button class="btn ghost sm" data-a="close">Done</button></span></div>
    <h2 style="font-size:21px">${esc(f.name)}</h2><div style="margin-bottom:12px">${badges(f)}</div>
    ${f.soothe?`<div class="note" style="margin-bottom:12px">💜 Often soothing during a flare.</div>`:""}
    <div class="card">
      <h3>How much? <span class="muted small">(1 serving = ${esc(f.serving)})</span></h3>
      <div class="chips" style="margin:10px 0">${opts.map(o=>`<button class="chip ${n===o?"on":""}" data-a="serv" data-n="${o}">${servingsLabel(o)}</button>`).join("")}
        <input class="inp" id="servc" type="number" inputmode="decimal" step="0.25" min="0" style="width:90px;padding:8px 10px" placeholder="other" value="${opts.includes(n)?"":n}"></div>
      <div class="totals" id="ptotals" style="margin-top:8px"><div><b>${fmtNum(f.kcal*n)}</b><span class="small muted">cal</span></div><div><b>${r0(f.p*n)}g</b><span class="small muted">protein</span></div><div><b>${r0(f.c*n)}g</b><span class="small muted">carbs</span></div><div><b>${r0(f.f*n)}g</b><span class="small muted">fat</span></div></div>
    </div>
    <div class="grid2" style="margin-bottom:14px">
      <label class="field" style="margin:0"><span>Meal</span><select class="inp" id="pmeal">${MEALS.map(([k,l])=>`<option value="${k}" ${st.meal===k?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="field" style="margin:0"><span>Time</span><input class="inp" id="ptime" type="time" value="${st.time||nowTime()}"></label>
    </div>
    <button class="btn" style="width:100%" data-a="logpick" id="plog">Add to ${MEALS.find(m=>m[0]===st.meal)[1]} · ${fmtNum(f.kcal*n)} cal</button>`);
}
function logFood(f, servings, meal, time){
  const e = {id:uid(), date:day, time, ts:tsOf(day,time), meal, name:f.name, foodKey:f.key, serving:f.serving, servings,
    kcal:+f.kcal||0, p:+f.p||0, c:+f.c||0, f:+f.f||0, ic:f.ic||"U", dairy:!!f.dairy, src:f.src||"db"};
  if(f.ingr) e.ingr = f.ingr.slice(0,600);
  e.cats = catsFor(e);
  S.entries.push(e);
  const g = day===today() ? addXP(XP_FOOD) : 0;
  save();
  return g;
}

/* custom food form */
function customAuto(d){
  const g = d.name ? classifyText(d.name + " " + (d.ingredients||"")) : {ic:"U",dairy:false};
  const ic = d.ic || g.ic, dairy = d.dairy ?? g.dairy;
  const t = " "+(d.name||"")+" "+(d.ingredients||"")+" "; const gs = CAT_RX.filter(c=>c.rx.test(t)).map(c=>c.e+" "+c.label);
  return `<span class="small muted" style="font-weight:800">Bladder rating ${d.name&&!d.icTouched?"(auto-checked, change if needed)":""}</span>
    <div class="chips" style="margin:6px 0 12px">${["F","T","C","U"].map(k=>`<button class="chip ${ic===k?"on":""}" data-a="cic" data-ic="${k}"><span class="dot ${k}"></span>${IC_LABEL[k]}</button>`).join("")}</div>
    <div class="setrow" style="padding:4px 0"><span><b>Contains dairy</b></span><button class="switch ${dairy?"on":""}" data-a="cdairy" aria-label="Contains dairy" aria-pressed="${!!dairy}"></button></div>
    ${gs.length?`<div class="small muted" style="margin-top:6px">Spotted: ${esc(gs.join(", "))}</div>`:""}
    ${d.barcode?`<div class="small muted">Barcode ${esc(d.barcode)}</div>`:""}`;
}
function patchCustom(){ const el = $("#cauto"); if(el) el.innerHTML = customAuto(sheetState.customDraft); }
function customFormHTML(d){
  return `<div class="card">
    <label class="field"><span>Food name</span><input class="inp" id="cname" maxlength="60" value="${esc(d.name||"")}" placeholder="e.g. Mom's chicken pot pie"></label>
    <label class="field"><span>Serving size</span><input class="inp" id="cserv" value="${esc(d.serving||"1 serving")}"></label>
    <span class="small muted" style="font-weight:800">Per serving (from the label, or your best guess)</span>
    <div class="grid4" style="margin:6px 0 12px">
      <label><span class="small muted">Cal</span><input class="inp" id="ck" type="number" inputmode="decimal" value="${d.kcal??""}"></label>
      <label><span class="small muted">Protein</span><input class="inp" id="cp" type="number" inputmode="decimal" value="${d.p??""}"></label>
      <label><span class="small muted">Carbs</span><input class="inp" id="cc" type="number" inputmode="decimal" value="${d.c??""}"></label>
      <label><span class="small muted">Fat</span><input class="inp" id="cf" type="number" inputmode="decimal" value="${d.f??""}"></label>
    </div>
    <div id="cauto">${customAuto(d)}</div>
  </div>
  <div class="row"><button class="btn soft" data-a="csave" data-log="0">Save only</button><button class="btn" data-a="csave" data-log="1">Save + add</button></div>`;
}
function readCustomForm(){
  const d = sheetState.customDraft || (sheetState.customDraft = {});
  d.name = $("#cname").value.trim(); d.serving = $("#cserv").value.trim() || "1 serving";
  const num = (id, max) => { const v = parseFloat($(id).value); return isFinite(v) ? Math.min(max, Math.max(0, Math.round(v*10)/10)) : 0; };
  d.kcal = num("#ck", 5000); d.p = num("#cp", 500); d.c = num("#cc", 1000); d.f = num("#cf", 500);
  return d;
}

/* barcode scanning */
let scanner = null, scanLibLoading = null;
function scanHTML(){
  const st = sheetState;
  if(st.scanResult) return customFormHTML(st.customDraft);
  return `<div class="note" style="margin-bottom:10px">Product info comes from Open Food Facts (needs internet). Always double-check against the label!</div>
    <button class="btn" style="width:100%;margin-bottom:10px" data-a="photoscan">📸 Snap a photo of the barcode</button>
    <input type="file" id="bcphoto" accept="image/*" capture="environment" style="display:none"><div id="scanfile" style="display:none"></div>
    <div class="small muted center" style="margin:-2px 0 10px">Best for shiny or crinkly bags. Fill the photo with the barcode, in good light.</div>
    ${st.scanning?`<div id="reader"></div><div class="small muted center" style="margin-top:6px">${st.scanSlow?"Having trouble? Try the photo button above, or type the number below.":"Hold it flat and steady, about 6 inches away"}</div><div class="spacer"></div><button class="btn soft" style="width:100%" data-a="stopscan">Stop camera</button>`:`<button class="btn soft" style="width:100%" data-a="startscan">🎥 Live scan</button>`}
    <div class="spacer"></div><div class="card"><label class="field" style="margin:0"><span>Or type the barcode number</span>
    <div class="row"><input class="inp" id="bcode" inputmode="numeric" placeholder="e.g. 041196910759"><button class="btn sm" data-a="lookup">Look up</button></div></label></div>
    ${st.scanMsg?`<div class="note">${st.scanMsg}</div>`:""}`;
}
function loadScanLib(){
  if(window.Html5Qrcode) return Promise.resolve();
  if(scanLibLoading) return scanLibLoading;
  scanLibLoading = new Promise((res, rej)=>{
    const s = document.createElement("script"); s.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    s.onload = res; s.onerror = () => { scanLibLoading = null; rej(new Error("load")); }; document.head.appendChild(s);
  });
  return scanLibLoading;
}
async function startScanner(){
  try{
    await loadScanLib();
    if(!$("#reader") || scanner) return;
    const F = window.Html5QrcodeSupportedFormats;
    scanner = new Html5Qrcode("reader", {formatsToSupport:[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.CODE_128].filter(x=>x!==undefined), verbose:false, experimentalFeatures:{useBarCodeDetectorIfSupported:true}});
    const st0 = sheetState;
    await scanner.start({facingMode:"environment"}, {fps:15, qrbox:(w,h)=>({width:Math.floor(w*0.9), height:Math.floor(Math.min(h*0.6, w*0.5))}), aspectRatio:1.4,
        videoConstraints:{facingMode:"environment", width:{ideal:1920}, height:{ideal:1080}, advanced:[{focusMode:"continuous"}]}},
      code => { stopScanner(); sheetState.scanning=false; lookupBarcode(code); }, ()=>{});
    setTimeout(()=>{ if(sheetState===st0 && st0.scanning && scanner && !st0.scanSlow){ st0.scanSlow = true; const n=document.querySelector("#reader + .small"); if(n) n.textContent="Having trouble? Try the photo button above, or type the number below."; } }, 12000);
  }catch(e){
    scanner = null; sheetState.scanning = false;
    sheetState.scanMsg = "Couldn't start the camera. Check that camera access is allowed for this app, that you're online, or type the barcode number instead.";
    if(sheetState.tab==="scan") drawAdd();
  }
}
// Phone photos are huge and barcodes are often small or tilted: try the original, then resized,
// center-zoomed, rotated and high-contrast versions until one decodes.
async function photoVariants(file){
  const out = [file];
  try{
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src = URL.createObjectURL(file); });
    const mk = (w, h, draw) => new Promise(res => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, c); c.toBlob(b => res(b ? new File([b], "v.jpg", {type:"image/jpeg"}) : null), "image/jpeg", 0.92); });
    const W = img.naturalWidth, H = img.naturalHeight;
    const fit = (max) => { const k = Math.min(1, max/Math.max(W,H)); return [Math.round(W*k), Math.round(H*k)]; };
    const [w1,h1] = fit(1600);
    out.push(await mk(w1, h1, g => g.drawImage(img, 0, 0, w1, h1)));
    for(const z of [0.6, 0.4]){ // zoom into the middle
      const cw = W*z, ch = H*z, [w2,h2] = [Math.round(Math.min(1400, cw)), Math.round(Math.min(1400, cw)*ch/cw)];
      out.push(await mk(w2, h2, g => g.drawImage(img, (W-cw)/2, (H-ch)/2, cw, ch, 0, 0, w2, h2)));
    }
    out.push(await mk(h1, w1, g => { g.translate(h1/2, w1/2); g.rotate(Math.PI/2); g.drawImage(img, -w1/2, -h1/2, w1, h1); }));
    out.push(await mk(w1, h1, g => { g.filter = "grayscale(1) contrast(1.8)"; g.drawImage(img, 0, 0, w1, h1); }));
    URL.revokeObjectURL(img.src);
  }catch(_){}
  return out.filter(Boolean);
}
async function scanPhoto(file){
  sheetState.scanMsg = "Reading the barcode… 🔎"; drawAdd();
  try{
    await loadScanLib();
    const F = window.Html5QrcodeSupportedFormats;
    const reader = new Html5Qrcode("scanfile", {formatsToSupport:[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.CODE_128].filter(x=>x!==undefined), verbose:false, experimentalFeatures:{useBarCodeDetectorIfSupported:true}});
    let code = null;
    for(const variant of await photoVariants(file)){
      try{ const res = await reader.scanFileV2(variant, false); code = res && (res.decodedText || res); if(code) break; }catch(_){}
    }
    try{ reader.clear(); }catch(_){}
    if(!code) throw new Error("no barcode");
    sheetState.scanMsg = ""; lookupBarcode(String(code));
  }catch(e){
    sheetState.scanMsg = navigator.onLine===false && !window.Html5Qrcode ? "The scanner needs internet the first time. Type the number below instead."
      : "Couldn't read a barcode in that photo. Try again closer, with the barcode flat and filling most of the picture, or type the number below.";
    if(sheetState && sheetState.tab==="scan") drawAdd();
  }
}
function stopScanner(){ if(scanner){ const s=scanner; scanner=null; s.stop().then(()=>s.clear()).catch(()=>{}); } }
let lookingUp = false;
async function lookupBarcode(code){
  code = String(code).replace(/\D/g,"");
  if(!code){ toast("Type the numbers under the barcode"); return; }
  if(code.length<6 || code.length>14){ toast("That barcode looks too short or too long"); return; }
  if(lookingUp) return; lookingUp = true;
  try{ await lookupBarcodeInner(code); } finally { lookingUp = false; }
}
async function lookupBarcodeInner(code){
  const existing = S.custom.find(c=>c.barcode===code);
  if(existing){ sheetState.pick = existing; sheetState.servings = 1; drawAdd(); toast("Found in your foods!"); return; }
  const cached = offCacheGet(code);
  if(cached){ sheetState.customDraft = offToDraft(cached, code); sheetState.scanResult = true; sheetState.scanMsg = ""; drawAdd(); toast("Found it! Check the numbers"); return; }
  sheetState.scanMsg = "Looking it up… 🔎"; drawAdd();
  try{
    const r = await fetchT(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments,ingredients_text,ingredients_text_en,allergens_tags,traces_tags`, 8000);
    const j = await r.json();
    if(j.status!==1 || !j.product) throw new Error("nf");
    offCachePut(code, j.product);
    sheetState.customDraft = offToDraft(j.product, code);
    sheetState.scanResult = true; sheetState.scanMsg = "";
    drawAdd();
    toast(sheetState.customDraft.ingredients ? "Found it! Check the numbers" : "Found it! No ingredients listed, so check the rating");
  }catch(e){
    sheetState.scanMsg = (navigator.onLine===false ? `You're offline, so I can't look up <b>${esc(code)}</b> right now. Try again with internet, or add it yourself.` : `Couldn't find <b>${esc(code)}</b> in the online database. You can add it as a custom food instead.`) + `<div class="spacer"></div><button class="btn sm" data-a="scancustom">＋ Add as custom food</button>`;
    sheetState.customDraft = {barcode: code};
    drawAdd();
  }
}

function fetchT(url, ms=8000){ const c = new AbortController(); const t = setTimeout(()=>c.abort(), ms); return fetch(url, {signal:c.signal}).finally(()=>clearTimeout(t)); }
const OFF_CACHE_KEY = "bunbites.offcache";
function offCacheGet(code){ try{ return (JSON.parse(localStorage.getItem(OFF_CACHE_KEY)||"{}"))[code] || null; }catch(e){ return null; } }
function offCachePut(code, product){ try{ const m = JSON.parse(localStorage.getItem(OFF_CACHE_KEY)||"{}"); m[code] = product; const ks = Object.keys(m); if(ks.length>150) ks.slice(0, ks.length-150).forEach(k=>delete m[k]); localStorage.setItem(OFF_CACHE_KEY, JSON.stringify(m)); }catch(e){} }
function offToDraft(p, code){
  const n = p.nutriments||{};
  const sq = parseFloat(p.serving_quantity);
  const per = k => { const sv = n[k+"_serving"]; if(sv!==undefined && sv!=="") return +sv; const h = n[k+"_100g"]; if(h===undefined) return 0; return sq? +h*sq/100 : +h; };
  let kcal = n["energy-kcal_serving"]; if(kcal===undefined||kcal===""){ const h = n["energy-kcal_100g"] ?? (n["energy_100g"]? n["energy_100g"]/4.184 : 0); kcal = sq? h*sq/100 : h; }
  const ingr = (p.ingredients_text_en || p.ingredients_text || "");
  const name = offName(p);
  const g = classifyText(name + " " + ingr);
  const allergenDairy = (p.allergens_tags||[]).includes("en:milk");
  const d = {name, serving: p.serving_size || (sq? sq+" g" : "100 g"), kcal:Math.round(+kcal||0), p:Math.round(per("proteins")*10)/10, c:Math.round(per("carbohydrates")*10)/10, f:Math.round(per("fat")*10)/10,
    ic: g.ic==="U" && ingr ? "F" : g.ic, dairy: allergenDairy || g.dairy, ingredients: ingr};
  if(code || p.code) d.barcode = String(code || p.code);
  return d;
}

/* check-in */
function openCheckin(existing){
  const c = existing || {pain:0,urgency:0,frequency:0,bloating:0,cramps:0,note:"",time:nowTime()};
  sheetState = {mode:"check", c: Object.assign({}, c, {tags:[...(c.tags||[])]}), id: existing && existing.id};
  openSheet(`<div class="sheet-h"><h2>How do you feel?</h2><button class="btn ghost sm" data-a="close">✕</button></div>
    ${existing?"":`<button class="btn soft" style="width:100%;margin-bottom:16px" data-a="feelgood">😊 Feeling good! (all zeros)</button>`}
    <div class="card">
      <div class="small muted" style="font-weight:800;margin-bottom:10px">🫧 BLADDER</div>
      ${SYMPTOMS.filter(s=>s[2]==="bladder").map(sliderHTML).join("")}
      <div class="small muted" style="font-weight:800;margin:4px 0 10px">🌀 TUMMY / DAIRY</div>
      ${SYMPTOMS.filter(s=>s[2]==="gut").map(sliderHTML).join("")}
      <span class="small muted" style="font-weight:800;display:block;margin-bottom:6px">ANYTHING ELSE GOING ON?</span>
      <div class="chips" style="margin-bottom:14px">${CTX_TAGS.map(([id,l,e])=>`<button class="chip ${(sheetState.c.tags||[]).includes(id)?"on":""}" data-a="ctag" data-tag="${id}">${e} ${l}</button>`).join("")}</div>
      <label class="field"><span>Notes (optional)</span><input class="inp" id="cnote" value="${esc(c.note||"")}" placeholder="Period, stress, slept badly, new med…"></label>
      <div class="grid2"><label class="field" style="margin:0"><span>Time</span><input class="inp" id="ctime" type="time" value="${c.time}"></label>
      ${existing?`<label class="field" style="margin:0"><span>Day</span><input class="inp" id="cdate" type="date" max="${today()}" value="${c.date}"></label>`:""}</div>
    </div>
    <div class="row">${existing?`<button class="btn danger" data-a="delcheck">Delete</button>`:""}<button class="btn" data-a="savecheck">Save</button></div>`);
}
function sliderHTML([k,l]){
  const v = sheetState.c[k]||0;
  return `<div class="slider"><div class="lab"><span>${l}</span><em id="v-${k}" style="background:${sevColor(v)}">${feelEmoji(v)} ${v}</em></div><input type="range" min="0" max="10" step="1" value="${v}" data-s="${k}" aria-label="${l}, 0 to 10"></div>`;
}

/* entry edit */
function openEntry(id){
  const e = S.entries.find(x=>x.id===id); if(!e) return;
  sheetState = {mode:"entry", id, servings:e.servings};
  const m = markOf(e.name);
  openSheet(`<div class="sheet-h"><h2>${esc(e.name)}</h2><button class="btn ghost sm" data-a="close">✕</button></div>
    <div style="margin-bottom:12px">${badges(e)}</div>
    <div class="card">
      <h3>Servings <span class="muted small">(1 = ${esc(e.serving)})</span></h3>
      <input class="inp" id="eserv" type="number" inputmode="decimal" step="0.25" min="0" value="${e.servings}">
      <div class="small muted" style="margin-top:8px">Per serving: ${fmtNum(e.kcal)} cal · P${r0(e.p)} C${r0(e.c)} F${r0(e.f)}</div>
      <div style="margin-top:4px;font-weight:800" id="etotal">Total: ${fmtNum(e.kcal*e.servings)} cal</div>
      <div class="grid2" style="margin-top:12px">
        <label class="field" style="margin:0"><span>Meal</span><select class="inp" id="emeal">${MEALS.map(([k,l])=>`<option value="${k}" ${e.meal===k?"selected":""}>${l}</option>`).join("")}</select></label>
        <label class="field" style="margin:0"><span>Time</span><input class="inp" id="etime" type="time" value="${e.time}"></label>
      </div>
      <label class="field" style="margin:12px 0 0"><span>Day</span><input class="inp" id="edate" type="date" max="${today()}" value="${e.date}"></label>
    </div>
    <div class="card"><h3>Does this food bother you?</h3>
      <div class="chips" style="margin-top:8px"><button class="chip ${m==="safe"?"on":""}" data-a="markname" data-name="${esc(e.name)}" data-m="safe">💚 My safe food</button><button class="chip ${m==="trigger"?"on":""}" data-a="markname" data-name="${esc(e.name)}" data-m="trigger">🚩 My trigger</button>${m?`<button class="chip" data-a="markname" data-name="${esc(e.name)}" data-m="">Clear</button>`:""}</div></div>
    <div class="row"><button class="btn danger" data-a="delentry">Delete</button><button class="btn" data-a="saveentry">Save</button></div>`);
}

/* food info (from Foods tab) */
function openFoodInfo(key){
  const f = foodByKey(key); if(!f) return;
  sheetState = Object.assign(sheetState||{}, {mode:"info", key});
  const m = markOf(f.name);
  openSheet(`<div class="sheet-h"><h2>${esc(f.name)}</h2><button class="btn ghost sm" data-a="close">✕</button></div>
    <div style="margin-bottom:12px">${badges(f)} ${f.soothe?'<span class="b soothe">Often soothing</span>':""}</div>
    <div class="card"><div class="small muted" style="font-weight:800;margin-bottom:8px">Per ${esc(f.serving)}${f.src==="db"?" (estimate)":""}</div>
      <div class="totals"><div><b>${fmtNum(f.kcal)}</b><span class="small muted">cal</span></div><div><b>${r0(f.p)}g</b><span class="small muted">protein</span></div><div><b>${r0(f.c)}g</b><span class="small muted">carbs</span></div><div><b>${r0(f.f)}g</b><span class="small muted">fat</span></div></div></div>
    <div class="card"><h3>For me, this food is…</h3>
      <div class="chips" style="margin-top:8px"><button class="chip ${m==="safe"?"on":""}" data-a="markname" data-name="${esc(f.name)}" data-m="safe">💚 Safe</button><button class="chip ${m==="trigger"?"on":""}" data-a="markname" data-name="${esc(f.name)}" data-m="trigger">🚩 A trigger</button>${m?`<button class="chip" data-a="markname" data-name="${esc(f.name)}" data-m="">Use list rating</button>`:""}</div>
      <p class="small muted" style="margin-bottom:0">List rating: ${IC_LABEL[f.ic]}</p></div>
    <div class="row">
      <button class="btn soft" data-a="fav" data-key="${esc(f.key)}">${S.favorites.includes(f.key)?"★ Saved":"☆ Save"}</button>
      ${f.src==="custom"?`<button class="btn soft" data-a="editcustom" data-key="${esc(f.key)}">✏️ Edit</button><button class="btn danger" data-a="delcustom" data-key="${esc(f.key)}">Delete</button>`:""}
      <button class="btn" data-a="logfrominfo" data-key="${esc(f.key)}">Log it</button>
    </div>`);
}

/* settings */
function openSettings(){
  const s = S.settings;
  sheetState = {mode:"settings"};
  openSheet(`<div class="sheet-h"><h2>Settings</h2><button class="btn ghost sm" data-a="close">Done</button></div>
    <div class="card">
      <label class="field"><span>Bunny's name</span><input class="inp" id="sname" value="${esc(S.petName)}" maxlength="20"></label>
    </div>
    <div class="card"><h3>🎨 Look</h3>
      <div class="seg">${[["auto","Auto"],["light","☀️ Light"],["dark","🌙 Dark"]].map(([k,l])=>`<button class="${(S.settings.theme||"auto")===k?"on":""}" data-a="theme" data-t="${k}">${l}</button>`).join("")}</div>
      <p class="small muted" style="margin:8px 0 0">Auto follows your iPhone's dark mode, so late-night logging is easy on the eyes.</p>
    </div>
    <div class="card">
      <div class="setrow"><span><b>Daily targets</b><div class="small muted">Optional calorie & macro goals</div></span><button class="switch ${s.targetsOn?"on":""}" data-a="targets" aria-label="Daily targets" aria-pressed="${s.targetsOn}"></button></div>
      ${s.targetsOn?`<div class="grid4" style="margin-top:8px">
        <label><span class="small muted">Calories</span><input class="inp" id="tk" type="number" inputmode="numeric" value="${s.kcal}"></label>
        <label><span class="small muted">Protein g</span><input class="inp" id="tp" type="number" inputmode="numeric" value="${s.p}"></label>
        <label><span class="small muted">Carbs g</span><input class="inp" id="tc" type="number" inputmode="numeric" value="${s.c}"></label>
        <label><span class="small muted">Fat g</span><input class="inp" id="tf" type="number" inputmode="numeric" value="${s.f}"></label></div>`:""}
    </div>
    <div class="card"><h3>💾 Backup</h3>
      <p class="small muted">Everything is saved on this phone automatically. Make a backup now and then (or before getting a new phone).</p>
      <div class="row"><button class="btn soft" data-a="export">Save backup</button><button class="btn soft" data-a="import">Restore</button></div>
      <input type="file" id="importfile" accept=".json,application/json" style="display:none">
      <p class="small muted" style="margin-bottom:0">${S.entries.length} foods · ${S.checkins.length} check-ins stored${saveOk?"":" · ⚠️ last save failed"}</p>
    </div>
    <div class="card"><h3>About the ratings</h3><p class="small muted" style="margin:0">Bladder ratings (Friendly / Try it / Caution) follow the Interstitial Cystitis Association and IC Network food lists. Built-in calories are typical estimates, so labels and scans are more exact. This app spots patterns but isn't medical advice. Check with your doctor or dietitian.</p></div>
    <button class="linkdanger" data-a="resetask">Erase everything…</button>
    <p class="center small muted">${esc(GIFT_NOTE)}</p>`);
}
function saveSettingsFields(){
  const n = $("#sname"); if(n && n.value.trim()) S.petName = n.value.trim();
  const g = id => { const el=$(id); return el? (parseFloat(el.value)||0) : null; };
  if($("#tk")){ S.settings.kcal=g("#tk"); S.settings.p=g("#tp"); S.settings.c=g("#tc"); S.settings.f=g("#tf"); }
  save();
}
async function exportBackup(){
  const data = JSON.stringify(S);
  const name = `bunbites-backup-${today()}.json`;
  try{
    const file = new File([data], name, {type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:"Bun Bites backup"}); backedUp(); toast("Backup saved 💗 Keep it in Files or iCloud"); return; }
  }catch(e){ if(e && e.name==="AbortError") return; }
  try{
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data],{type:"application/json"})); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); backedUp(); toast("Backup saved");
  }catch(e){
    try{ await navigator.clipboard.writeText(data); backedUp(); toast("Backup copied: paste it into Notes"); }catch(_){ toast("Couldn't export on this device"); }
  }
}
function backedUp(){ S.lastBackup = Date.now(); save(); if(!$("#layer").innerHTML) render(); }
function importBackup(text){
  try{
    const d = JSON.parse(text);
    if(!d || typeof d!=="object" || !Array.isArray(d.entries)) throw 0;
    const clean = sanitize(d);
    if(!clean.petName) clean.petName = S.petName || "Bun";
    S = clean; save(); applyTheme(); closeLayer(); render(); toast(`Backup restored 💗 ${S.entries.length} food${S.entries.length===1?"":"s"}, ${S.checkins.length} check-in${S.checkins.length===1?"":"s"}`);
  }catch(e){ toast("That file doesn't look like a Bun Bites backup"); }
}

/* ---------------- events ---------------- */
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-a]"); if(!el) return;
  if(Date.now() - swipeJustHappened < 400 && el.closest(".swipe")) return;
  const a = el.dataset.a;
  if(a==="bg"){ if(ev.target===el){ if(sheetState&&sheetState.mode==="settings") { saveSettingsFields(); render(); } closeLayer(); } return; }
  switch(a){
    case "start": { const v = $("#petname").value.trim(); if(!v){ $("#petname").focus(); toast("Give your bunny a name 🐰"); return; } S.petName=v; save(); render(); toast(`Say hi to ${v}!`); break; }
    case "nav": view = el.dataset.v; render(); window.scrollTo(0,0); break;
    case "gotoday": if(day!==today()){ day=today(); render(); } break;
    case "day": { const n=+el.dataset.n; const nd=addDays(day,n); if(nd>today()) return; day=nd; render(); break; }
    case "pet": { const b=el.querySelector(".bun-wrap"); if(b){ b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop"); }
      const sc=el; const h=document.createElement("span"); h.className="heart"; h.textContent="💗"; h.style.left="48%"; h.style.top="35%"; sc.appendChild(h); setTimeout(()=>h.remove(),1300); break; }
    case "flare": S.settings.flare=!S.settings.flare; save(); render(); toast(S.settings.flare?"Flare-day mode on. Be gentle with yourself 💜":"Flare-day mode off"); break;
    case "add": openAdd(el.dataset.meal); break;
    case "checkin": openCheckin(); break;
    case "close": closeLayer(); render(); break;
    case "meal": sheetState.meal = el.dataset.meal; drawAdd(); break;
    case "tab": stopScanner(); sheetState.tab = el.dataset.tab; sheetState.scanning=false; sheetState.scanResult=false; sheetState.scanMsg=""; if(el.dataset.tab!=="custom") sheetState.customDraft=null; else sheetState.customDraft = sheetState.customDraft || {}; drawAdd(); break;
    case "pick": { const f = lookupForPick(el.dataset.key); if(!f) return; sheetState.pick=f; sheetState.servings=1; sheetState.time=null; drawAdd(); break; }
    case "back": sheetState.pick=null; drawAdd(); break;
    case "serv": sheetState.servings=+el.dataset.n; sheetState.meal=$("#pmeal").value; sheetState.time=$("#ptime").value; drawPortion(); break;
    case "logpick": {
      const raw = $("#servc").value.trim(), cv = parseFloat(raw);
      if(raw && !(cv>0 && cv<=20)){ toast("Enter an amount between 0 and 20 servings"); $("#servc").focus(); return; }
      if(cv>0) sheetState.servings = cv;
      sheetState.meal = $("#pmeal").value; const time = $("#ptime").value || nowTime();
      const g = logFood(sheetState.pick, sheetState.servings, sheetState.meal, time);
      const nm = sheetState.pick.name; sheetState.pick=null; sheetState.q=""; drawAdd(); celebrate(g);
      toast(`Added ${nm}${g?` · +${g} 🥕`:""}`);
      if(!S.tipEdit){ S.tipEdit = true; save(); setTimeout(()=>toast("Tip: tap a food to edit it, or swipe it left to delete"), 2400); }
      break;
    }
    case "fav": { const k=el.dataset.key; const i=S.favorites.indexOf(k);
      if(i>=0) S.favorites.splice(i,1); else {
        if(!foodByKey(k)){ const f = lookupForPick(k); if(f){
          let c = S.custom.find(x=>nameKey(x.name)===nameKey(f.name) && x.kcal===f.kcal);
          if(!c){ c = Object.assign({}, f, {key:"c:"+uid(), src:"custom"}); S.custom.push(c); }
          if(!S.favorites.includes(c.key)) S.favorites.push(c.key); save(); toast("Saved ⭐"); refreshSheet(); return; } }
        S.favorites.push(k); }
      save(); toast(i>=0?"Removed from saved":"Saved ⭐"); refreshSheet(); break; }
    case "quickcustom": sheetState.tab="custom"; sheetState.customDraft={name:sheetState.q.trim()}; drawAdd(); break;
    case "cic": { const d=readCustomForm(); d.ic=el.dataset.ic; d.icTouched=true; patchCustom(); break; }
    case "cdairy": { const d=readCustomForm(); const g=classifyText(d.name); d.dairy = !(d.dairy ?? g.dairy); d.icTouched=true; patchCustom(); break; }
    case "csave": {
      const d = readCustomForm(); if(!d.name){ toast("Give it a name"); return; }
      if(d.editKey){ const f = S.custom.find(c=>c.key===d.editKey); if(f){ const g0 = classifyText(d.name+" "+(d.ingredients||""));
          Object.assign(f, {name:d.name, serving:d.serving, kcal:d.kcal, p:d.p, c:d.c, f:d.f, ic:d.ic||g0.ic, dairy:d.dairy ?? g0.dairy}); save(); }
        closeLayer(); render(); toast("Food updated. Past logs keep their old numbers"); return; }
      const g = classifyText(d.name + " " + (d.ingredients||""));
      const food = {key:"c:"+uid(), name:d.name, serving:d.serving, kcal:d.kcal, p:d.p, c:d.c, f:d.f, ic:d.ic||g.ic, dairy: d.dairy ?? g.dairy, src:"custom"};
      if(d.barcode) food.barcode = d.barcode;
      if(d.ingredients) food.ingr = d.ingredients.slice(0,600);
      S.custom.unshift(food); if(!S.favorites.includes(food.key)) S.favorites.push(food.key); save();
      if(sheetState.mode==="customonly"){ closeLayer(); render(); toast("Saved to your foods ⭐"); return; }
      if(el.dataset.log==="1"){ const gx = logFood(food, 1, sheetState.meal, nowTime()); sheetState.customDraft=null; sheetState.scanResult=false; sheetState.tab="search"; sheetState.q=""; drawAdd(); celebrate(gx); toast(`Added ${food.name}${gx?` · +${gx} 🥕`:""}`); }
      else { sheetState.customDraft=null; sheetState.scanResult=false; sheetState.tab="saved"; drawAdd(); toast("Saved to your foods ⭐"); }
      break;
    }
    case "editcustom": { const f = S.custom.find(c=>c.key===el.dataset.key); if(!f) return;
      sheetState = {mode:"customonly", tab:"custom", meal:guessMeal(), customDraft:{name:f.name, serving:f.serving, kcal:f.kcal, p:f.p, c:f.c, f:f.f, ic:f.ic, dairy:f.dairy, icTouched:true, barcode:f.barcode, ingredients:f.ingr, editKey:f.key}};
      openSheet(`<div class="sheet-h"><h2>Edit food</h2><button class="btn ghost sm" data-a="close">✕</button></div>${customFormHTML(sheetState.customDraft)}`); break; }
    case "customnew": sheetState = {mode:"customonly", tab:"custom", meal:guessMeal(), customDraft:{}}; openSheet(`<div class="sheet-h"><h2>New food</h2><button class="btn ghost sm" data-a="close">✕</button></div>${customFormHTML({})}`); break;
    case "ctag": { const t=el.dataset.tag, tg=sheetState.c.tags; const i=tg.indexOf(t); if(i>=0) tg.splice(i,1); else tg.push(t); el.classList.toggle("on", i<0); break; }
    case "snoozebk": S.backupSnooze = Date.now() - 11*864e5; save(); render(); toast("I'll remind you in a few days"); break;
    case "repeat": {
      const k = el.dataset.meal; const src = S.entries.filter(e=>e.date===addDays(day,-1) && e.meal===k);
      let g = 0;
      src.forEach(e=>{ const n = Object.assign({}, e, {id:uid(), date:day, ts:tsOf(day,e.time)}); S.entries.push(n); if(day===today()) g += addXP(XP_FOOD); });
      save(); celebrate(g); toast(`Added ${src.length} item${src.length>1?"s":""}${g?` · +${g} 🥕`:""}`); break;
    }
    case "savemealask": { const k=el.dataset.meal; const label=MEALS.find(m=>m[0]===k)[1];
      openModal(`<h2>Save this ${label.toLowerCase()} as a meal</h2><p class="small muted">Log the whole thing in one tap next time.</p>
        <input class="inp" id="mealname" maxlength="30" placeholder="e.g. Usual oatmeal breakfast"><div class="spacer"></div>
        <div class="row"><button class="btn soft" data-a="close">Cancel</button><button class="btn" data-a="savemeal" data-meal="${k}">Save</button></div>`);
      setTimeout(()=>{ const i=$("#mealname"); if(i) i.focus(); }, 50); break; }
    case "savemeal": {
      const name = $("#mealname").value.trim(); if(!name){ toast("Give it a name"); return; }
      const items = S.entries.filter(e=>e.date===day && e.meal===el.dataset.meal).map(e=>({name:e.name, foodKey:e.foodKey, key:e.foodKey||("e:"+nameKey(e.name)), serving:e.serving, servings:e.servings, kcal:e.kcal, p:e.p, c:e.c, f:e.f, ic:e.ic, dairy:e.dairy, src:e.src, ingr:e.ingr}));
      (S.meals ||= []).push({id:uid(), name, items}); save(); closeLayer(); render(); toast("Meal saved 🍱 Find it under Add food → Saved"); break; }
    case "logmeal": {
      const m = S.meals.find(x=>x.id===el.dataset.id); if(!m) return; let g = 0;
      m.items.forEach(it=>{ g += logFood(Object.assign({}, it, {key: it.key || it.foodKey}), it.servings, sheetState.meal, nowTime()); });
      drawAdd(); celebrate(g); toast(`Added ${m.name}${g?` · +${g} 🥕`:""}`); break; }
    case "delmeal": { const id=el.dataset.id; addReturn = sheetState; openModal(`<h2>Delete this saved meal?</h2><p class="small muted">${esc((S.meals.find(m=>m.id===id)||{}).name||"")}. Past logs stay.</p><div class="row"><button class="btn soft" data-a="reopenadd">Keep</button><button class="btn danger" data-a="delmealok" data-id="${id}">Delete</button></div>`); break; }
    case "delmealok": S.meals = S.meals.filter(m=>m.id!==el.dataset.id); save(); if(addReturn){ sheetState = addReturn; addReturn=null; drawAdd(); } else closeLayer(); break;
    case "reopenadd": if(addReturn){ sheetState = addReturn; addReturn=null; drawAdd(); } else closeLayer(); break;
    case "offsearch": offSearch(); break;
    case "offpick": { const p = sheetState.off && sheetState.off.items[+el.dataset.i]; if(!p) return; sheetState.customDraft = offToDraft(p); sheetState.tab = "custom"; drawAdd(); toast("Check the numbers, then save"); break; }
    case "scancustom": sheetState.tab="custom"; sheetState.scanMsg=""; drawAdd(); break;
    case "photoscan": stopScanner(); sheetState.scanning=false; $("#bcphoto").click(); break;
    case "startscan": sheetState.scanning=true; sheetState.scanMsg=""; drawAdd(); break;
    case "stopscan": stopScanner(); sheetState.scanning=false; sheetState.scanSlow=false; drawAdd(); break;
    case "lookup": { const v=$("#bcode").value; if(v.trim()) lookupBarcode(v); break; }
    case "feelgoodquick": { const c={id:uid(),date:today(),time:nowTime(),pain:0,urgency:0,frequency:0,bloating:0,cramps:0,note:"",tags:[]}; c.ts=tsOf(c.date,c.time); S.checkins.push(c);
      const g=addXP(XP_CHECK); save(); celebrate(g); toast(`Yay! Good day logged${g?` · +${g} 🥕`:""}`); break; }
    case "feelgood": { const c={id:uid(),date:day,time:nowTime(),pain:0,urgency:0,frequency:0,bloating:0,cramps:0,note:"",tags:[]}; c.ts=tsOf(c.date,c.time); S.checkins.push(c);
      const g = day===today()?addXP(XP_CHECK):0; save(); closeLayer(); celebrate(g); toast(`Yay! Good day logged${g?` · +${g} 🥕`:""}`); break; }
    case "savecheck": {
      const c = sheetState.c; c.note=$("#cnote").value.trim(); c.time=$("#ctime").value||nowTime();
      if(sheetState.id){ const ex=S.checkins.find(x=>x.id===sheetState.id); Object.assign(ex,c); const nd=$("#cdate")&&$("#cdate").value; if(/^\d{4}-\d{2}-\d{2}$/.test(nd||"") && nd<=today()) ex.date=nd; ex.ts=tsOf(ex.date,ex.time); save(); closeLayer(); render(); toast("Updated"); }
      else { c.id=uid(); c.date=day; c.ts=tsOf(day,c.time); S.checkins.push(c); const g = day===today()?addXP(XP_CHECK):0; save(); closeLayer(); celebrate(g);
        const mx = Math.max(c.pain,c.urgency,c.frequency,c.bloating,c.cramps); toast(mx>=6?`Sorry it's a rough one 💜 ${S.petName} is here${g?` · +${g} 🥕`:""}`:`Logged${g?` · +${g} 🥕`:""}`); }
      break; }
    case "editcheck": openCheckin(S.checkins.find(x=>x.id===el.dataset.id)); break;
    case "delcheck": { const c = S.checkins.find(x=>x.id===sheetState.id); S.checkins = S.checkins.filter(x=>x.id!==sheetState.id); save(); closeLayer(); render(); toast("Check-in deleted", ()=>{ S.checkins.push(c); save(); render(); }); break; }
    case "entry": openEntry(el.dataset.id); break;
    case "saveentry": { const e=S.entries.find(x=>x.id===sheetState.id); const v=parseFloat($("#eserv").value); if(!(v>0 && v<=20)){ toast("Enter an amount between 0 and 20 servings"); return; } e.servings=v; e.meal=$("#emeal").value; e.time=$("#etime").value||e.time;
      const nd=$("#edate").value; const moved = /^\d{4}-\d{2}-\d{2}$/.test(nd) && nd<=today() && nd!==e.date; if(moved) e.date=nd;
      e.ts=tsOf(e.date,e.time); save(); closeLayer(); render(); toast(moved?`Moved to ${(p=>/^(Today|Yesterday)$/.test(p)?p.toLowerCase():p)(prettyDate(e.date))}`:"Updated"); break; }
    case "delentry": { const e = S.entries.find(x=>x.id===sheetState.id); S.entries = S.entries.filter(x=>x.id!==sheetState.id); save(); closeLayer(); render(); toast(`${e.name} removed`, ()=>{ S.entries.push(e); save(); render(); }); break; }
    case "markname": { const k=nameKey(el.dataset.name), m=el.dataset.m; if(!m || S.marks[k]===m) delete S.marks[k]; else S.marks[k]=m; save();
      toast(S.marks[k]==="safe"?"Marked as your safe food 💚":S.marks[k]==="trigger"?"Marked as your trigger 🚩":"Back to list rating"); refreshSheet(); render(); break; }
    case "foodinfo": openFoodInfo(el.dataset.key); break;
    case "logfrominfo": { const f=foodByKey(el.dataset.key); if(!f){ closeLayer(); render(); return; } day=today(); view="today"; render(); sheetState={mode:"add",tab:"search",meal:guessMeal(),q:"",pick:f,servings:1}; drawAdd(); break; }
    case "delcustom": { const k=el.dataset.key; S.custom=S.custom.filter(c=>c.key!==k); S.favorites=S.favorites.filter(x=>x!==k); save(); closeLayer(); render(); toast("Food deleted. Past logs keep it"); break; }
    case "browseic": { browse.ic = browse.ic===el.dataset.ic ? null : el.dataset.ic; $("#browselist").innerHTML = browseList(); document.querySelectorAll('[data-a="browseic"]').forEach(b=>b.classList.toggle("on", b.dataset.ic===browse.ic)); break; }
    case "browsecat": { browse.cat = el.dataset.cat; $("#browselist").innerHTML = browseList(); document.querySelectorAll('[data-a="browsecat"]').forEach(b=>b.classList.toggle("on", b.dataset.cat===browse.cat)); break; }
    case "theme": S.settings.theme = el.dataset.t; save(); applyTheme(); document.querySelectorAll('[data-a="theme"]').forEach(b=>b.classList.toggle("on", b.dataset.t===S.settings.theme)); break;
    case "settings": openSettings(); break;
    case "targets": saveSettingsFields(); S.settings.targetsOn=!S.settings.targetsOn; save(); openSettings(); break;
    case "export": saveSettingsFields(); exportBackup(); break;
    case "import": openModal(`<h2>Restore a backup</h2><p class="small muted">This replaces what's on this phone right now.</p>
      <button class="btn soft" style="width:100%;margin-bottom:10px" data-a="pickfile">Choose backup file</button>
      <textarea class="inp" id="pastebk" rows="4" placeholder="…or paste backup text here"></textarea><div class="spacer"></div>
      <div class="row"><button class="btn soft" data-a="close">Cancel</button><button class="btn" data-a="restorepaste">Restore</button></div>
      <input type="file" id="importfile2" accept=".json,application/json,text/plain" style="display:none">`); break;
    case "pickfile": $("#importfile2").click(); break;
    case "restorepaste": { const t=$("#pastebk").value.trim(); if(t) importBackup(t); break; }
    case "resetask": openModal(`<div class="center"><div style="font-size:48px">🥺</div><h2>Erase everything?</h2><p class="small muted">All foods, check-ins and ${esc(S.petName)}'s progress will be gone. Make a backup first if you might want it back.</p>
      <div class="row"><button class="btn soft" data-a="close">Keep it</button><button class="btn danger" data-a="reset">Erase</button></div></div>`); break;
    case "reset": S=freshState(); save(); applyTheme(); closeLayer(); view="today"; day=today(); render(); break;
    case "equip": { const id=el.dataset.id, i=S.equipped.indexOf(id); if(i>=0) S.equipped.splice(i,1); else S.equipped.push(id); save(); render(); break; }
    case "wear": { const id=el.dataset.id; if(!S.equipped.includes(id)) S.equipped.push(id); save(); closeLayer(); render(); break; }
    case "copyweek": { try{ await navigator.clipboard.writeText(weekText()); toast("Summary copied: paste it in a message or notes"); }catch(e){ openModal(`<h2>Weekly summary</h2><textarea class="inp" rows="12" readonly>${esc(weekText())}</textarea><div class="spacer"></div><button class="btn" style="width:100%" data-a="close">Close</button>`); } break; }
  }
});
function refreshSheet(){
  if(!sheetState) return;
  if(sheetState.mode==="add") drawAdd();
  else if(sheetState.mode==="entry") openEntry(sheetState.id);
  else if(sheetState.mode==="info") openFoodInfo(sheetState.key);
}
function reDrawCustom(){
  if(sheetState.mode==="customonly") openSheet(`<div class="sheet-h"><h2>New food</h2><button class="btn ghost sm" data-a="close">✕</button></div>${customFormHTML(sheetState.customDraft)}`);
  else drawAdd();
}
document.addEventListener("input", ev => {
  const t = ev.target;
  if(t.id==="q"){ sheetState.q = t.value; $("#results").innerHTML = resultsHTML(); }
  else if(t.id==="browseq"){ browse.q = t.value; $("#browselist").innerHTML = browseList(); }
  else if(t.id==="servc" && sheetState && sheetState.pick){ const v=parseFloat(t.value), f=sheetState.pick;
    if(v>0 && v<=20){ sheetState.servings=v; document.querySelectorAll('[data-a="serv"]').forEach(b=>b.classList.remove("on"));
      $("#ptotals").innerHTML = `<div><b>${fmtNum(f.kcal*v)}</b><span class="small muted">cal</span></div><div><b>${r0(f.p*v)}g</b><span class="small muted">protein</span></div><div><b>${r0(f.c*v)}g</b><span class="small muted">carbs</span></div><div><b>${r0(f.f*v)}g</b><span class="small muted">fat</span></div>`;
      $("#plog").textContent = `Add to ${MEALS.find(m=>m[0]===($("#pmeal").value||sheetState.meal))[1]} · ${fmtNum(f.kcal*v)} cal`; } }
  else if(t.id==="eserv"){ const e=S.entries.find(x=>x.id===sheetState.id); const v=parseFloat(t.value); $("#etotal").textContent = v>0 ? `Total: ${fmtNum(e.kcal*v)} cal · P${r0(e.p*v)} C${r0(e.c*v)} F${r0(e.f*v)}` : "Total: –"; }
  else if(t.dataset.s){ const v=+t.value; sheetState.c[t.dataset.s] = v; const pill=$("#v-"+t.dataset.s); pill.textContent = feelEmoji(v)+" "+v; pill.style.background = sevColor(v); }
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if(t.id==="bcphoto" && t.files[0]) scanPhoto(t.files[0]);
  if(t.id==="importfile2" && t.files[0]){ const r=new FileReader(); r.onload=()=>importBackup(r.result); r.readAsText(t.files[0]); }

  if(t.id==="pmeal" && sheetState){ sheetState.meal=t.value; if(sheetState.pick && $("#plog")){ const f=sheetState.pick; $("#plog").textContent = `Add to ${MEALS.find(m=>m[0]===t.value)[1]} · ${fmtNum(f.kcal*sheetState.servings)} cal`; } }
  if(["sname","tk","tp","tc","tf"].includes(t.id)){ saveSettingsFields(); }
  if(t.id==="cname" && sheetState && sheetState.customDraft){ const d=readCustomForm(); const g=classifyText(d.name+" "+(d.ingredients||"")); if(!d.icTouched){ d.ic=g.ic; d.dairy=g.dairy; } patchCustom(); }
});
document.addEventListener("focusin", ev => { if(ev.target.matches("input:not([type=range]),textarea,select")) document.body.classList.add("typing"); });
document.addEventListener("focusout", () => setTimeout(()=>{ if(!document.activeElement || !document.activeElement.matches("input:not([type=range]),textarea,select")) document.body.classList.remove("typing"); }, 50));
document.addEventListener("keydown", ev => { if(ev.key==="Escape" && $("#layer").innerHTML){ if(sheetState&&sheetState.mode==="settings") saveSettingsFields(); closeLayer(); render(); } });
(() => { // swipe a logged food / check-in left to delete
  let st = null;
  document.addEventListener("touchstart", ev => {
    const w = ev.target.closest(".swipe"); if(!w || $("#layer").innerHTML) return;
    const t = ev.touches[0]; st = {w, btn: w.querySelector(".item"), x0: t.clientX, y0: t.clientY, dx: 0, mode: null};
  }, {passive:true});
  document.addEventListener("touchmove", ev => {
    if(!st) return; const t = ev.touches[0], dx = t.clientX - st.x0, dy = t.clientY - st.y0;
    if(!st.mode){ if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)*1.3) st.mode = "h"; else if(Math.abs(dy) > 10) st.mode = "v"; }
    if(st.mode !== "h") return;
    st.dx = Math.min(0, dx); st.btn.style.transition = "none"; st.btn.style.transform = `translateX(${st.dx}px)`;
  }, {passive:true});
  document.addEventListener("touchend", () => {
    if(!st) return; const s0 = st; st = null; if(s0.mode !== "h") return;
    swipeJustHappened = Date.now();
    s0.btn.style.transition = "transform .2s";
    if(s0.dx < -90){
      s0.btn.style.transform = "translateX(-110%)";
      setTimeout(() => {
        const id = s0.w.dataset.id;
        if(s0.w.dataset.del === "entry"){ const e = S.entries.find(x=>x.id===id); if(!e) return; S.entries = S.entries.filter(x=>x.id!==id); save(); render(); toast(`${e.name} removed`, ()=>{ S.entries.push(e); save(); render(); }); }
        else { const c = S.checkins.find(x=>x.id===id); if(!c) return; S.checkins = S.checkins.filter(x=>x.id!==id); save(); render(); toast("Check-in deleted", ()=>{ S.checkins.push(c); save(); render(); }); }
      }, 180);
    } else s0.btn.style.transform = "";
  });
})();
let swipeJustHappened = 0;
(() => { // swipe a sheet down to close
  let y0 = null, sh = null, dy = 0;
  document.addEventListener("touchstart", ev => {
    const s = ev.target.closest(".sheet"); if(!s) return;
    const onHandle = ev.target.closest(".grab,.sheet-h") && !ev.target.closest("button,input,select,textarea");
    if(!onHandle && s.scrollTop > 0) return; if(!onHandle && !ev.target.closest(".grab")) return;
    y0 = ev.touches[0].clientY; sh = s; dy = 0; s.style.transition = "none";
  }, {passive:true});
  document.addEventListener("touchmove", ev => { if(y0===null) return; dy = Math.max(0, ev.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, {passive:true});
  document.addEventListener("touchend", () => { if(y0===null) return; const s = sh; y0 = null; s.style.transition = "transform .2s";
    if(dy > 90){ s.style.transform = "translateY(100%)"; setTimeout(()=>{ if(sheetState&&sheetState.mode==="settings") saveSettingsFields(); closeLayer(); render(); }, 180); }
    else s.style.transform = ""; });
})();
document.addEventListener("keydown", ev => {
  if(ev.key==="Enter" && ev.target.id==="petname"){ document.querySelector('[data-a="start"]').click(); }
  if(ev.key==="Enter" && ev.target.id==="bcode"){ lookupBarcode(ev.target.value); }
  if(ev.key==="Enter" && (ev.target.id==="q" || ev.target.id==="browseq")){ ev.preventDefault(); ev.target.blur(); }
});
setInterval(() => { const t=today(); if(t!==lastToday){ const follow = day===lastToday; lastToday=t; if(follow) day=t; if(!$("#layer").innerHTML) render(); } }, 60000);
document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible"){ const t=today(); if(t!==lastToday){ if(day===lastToday) day=t; lastToday=t; } render(); } });

// download the scanner library in the background so the first scan opens instantly
(window.requestIdleCallback || (f=>setTimeout(f, 2500)))(() => { if(navigator.onLine !== false) loadScanLib().catch(()=>{}); });
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
render();
