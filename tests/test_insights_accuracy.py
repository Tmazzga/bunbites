"""Does the trigger detection find real triggers without blaming innocent foods?
Simulates many fake months with one known trigger (or none) and random bad days."""
from conftest import start

SIM = r"""
(cfg)=>{
  let seed = cfg.seed; const rnd=()=>{ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; };
  const pool = ["Oatmeal","Banana","Chicken breast","White rice","Pasta","Eggs","Broccoli","Turkey sandwich","Potato chips, plain","Apple, Gala/Fuji","Salmon","Blueberries","Coffee","Pizza, cheese","Spaghetti with marinara","Ketchup","Orange juice","Mild cheddar","Greek yogurt, plain","Hot sauce"];
  let hit=0, falseFlags=0;
  for(let r=0;r<cfg.runs;r++){
    const truth = cfg.truths[r % cfg.truths.length]; const E=[], C=[]; const T0 = Date.now() - cfg.days*864e5;
    for(let d=0; d<cfg.days; d++){
      const ds = dstr(new Date(T0 + d*864e5)); const n = 3 + Math.floor(rnd()*3); const eaten = new Set();
      for(let i=0;i<n;i++){ const name = pool[Math.floor(rnd()*pool.length)]; eaten.add(name); const b = BUILTIN.find(f=>f.name===name); const t=["08:00","12:30","15:30","18:30","20:30"][i];
        const e = {id:uid(), date:ds, time:t, ts:tsOf(ds,t), meal:"lunch", name, foodKey:b.key, serving:b.serving, servings:1, kcal:b.kcal,p:b.p,c:b.c,f:b.f, ic:b.ic, dairy:b.dairy}; e.cats = catsFor(e); E.push(e); }
      const has = truth && (truth.type==="group" ? E.filter(e=>e.date===ds).some(e=>e.cats.includes(truth.id)) : eaten.has(truth.id));
      const bl = has && truth.sym==="bl" ? rnd()<cfg.pTrue : rnd()<cfg.pBg, gu = has && truth.sym==="gu" ? rnd()<cfg.pTrue : rnd()<cfg.pBg;
      if(rnd() < .9){ const lvl = x => x ? 4+Math.floor(rnd()*5) : Math.floor(rnd()*3);
        C.push({id:uid(), date:ds, time:"22:00", ts:tsOf(ds,"22:00"), pain:lvl(bl), urgency:lvl(bl), frequency:1, bloating:lvl(gu), cramps:lvl(gu), tags:[]}); }
    }
    S.entries=E; S.checkins=C; const A = analyze();
    const related = name => { if(!truth) return false; if(truth.type==="food") return name===truth.id; const b=BUILTIN.find(f=>f.name===name); return b && catsFor({name, foodKey:b.key, dairy:b.dairy}).includes(truth.id); };
    if(truth && (truth.type==="group" ? A.groups.some(g=>g.id===truth.id) : A.foods.some(f=>f.name===truth.id))) hit++;
    falseFlags += A.foods.filter(f=>!related(f.name)).length + A.groups.filter(g=>!truth || g.id!==truth.id).length;
  }
  return {hitRate: hit/cfg.runs, falsePerRun: falseFlags/cfg.runs};
}
"""
TRUTHS = [{"type": "group", "id": "caffeine", "sym": "bl"}, {"type": "group", "id": "tomato", "sym": "bl"},
          {"type": "group", "id": "dairy", "sym": "gu"}, {"type": "food", "id": "Hot sauce", "sym": "bl"}]


def test_finds_real_triggers_after_60_days(page):
    start(page)
    r = page.evaluate(SIM, dict(runs=80, seed=7, days=60, pTrue=.8, pBg=.12, truths=TRUTHS))
    assert r["hitRate"] >= 0.9, r
    assert r["falsePerRun"] <= 0.6, r


def test_rarely_blames_food_when_nothing_is_a_trigger(page):
    start(page)
    r = page.evaluate(SIM, dict(runs=80, seed=11, days=30, pTrue=.2, pBg=.2, truths=[None]))
    assert r["falsePerRun"] <= 0.5, r
