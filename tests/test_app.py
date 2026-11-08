"""End-to-end checks of the flows Addy actually uses. Run: pytest tests -q"""
import datetime, json
from conftest import start, state, log_food

OFF_PRODUCT = {"status": 1, "product": {"product_name": "Whole Cashews", "brands": "Planters", "serving_size": "1 oz (28 g)",
    "serving_quantity": 28, "nutriments": {"energy-kcal_100g": 571, "proteins_100g": 17.9, "carbohydrates_100g": 32.1, "fat_100g": 46.4},
    "ingredients_text": "cashews, peanut oil, sea salt", "allergens_tags": ["en:nuts"]}}


def test_onboarding_and_reload_keeps_data(page):
    start(page, "Mochi")
    log_food(page, "banana")
    page.reload()
    assert page.locator(".mini .name").inner_text() == "Mochi"
    assert [e["name"] for e in state(page)["entries"]] == ["Banana"]


def test_names_are_escaped(page):
    start(page, 'B&B <b>x</b>')
    assert page.locator(".mini .name").inner_text() == 'B&B <b>x</b>'
    assert page.locator(".mini .name b").count() == 0


def test_portion_validation(page):
    start(page)
    page.click('[data-a="add"] >> nth=0'); page.fill("#q", "banana"); page.click('#results [data-a="pick"] >> nth=0')
    page.fill("#servc", "0"); page.click('[data-a="logpick"]')
    assert "between 0 and 20" in page.locator(".toast").inner_text()
    page.fill("#servc", "1.5"); page.click('[data-a="logpick"]')
    assert state(page)["entries"][0]["servings"] == 1.5


def test_search_ranks_main_word(page):
    start(page)
    top = page.evaluate("searchFoods('rice').slice(0,2).map(f=>f.name)")
    assert top[0] in ("White rice", "Brown rice"), top


def test_edit_move_and_delete_with_undo(page):
    start(page)
    log_food(page, "banana"); log_food(page, "rice")
    page.click('[data-a="entry"] >> nth=0')
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    page.fill("#edate", yesterday); page.click('[data-a="saveentry"]')
    assert sorted(e["date"] for e in state(page)["entries"])[0] == yesterday
    page.click('[data-a="entry"] >> nth=0'); page.click('[data-a="delentry"]')
    assert len(state(page)["entries"]) == 1
    page.click(".toast .undo")
    assert len(state(page)["entries"]) == 2


def test_swipe_left_deletes(page):
    start(page)
    log_food(page, "banana")
    page.locator(".swipe .item").first.scroll_into_view_if_needed()
    box = page.locator(".swipe .item").first.bounding_box()
    x, y = box["x"] + box["width"] - 30, box["y"] + box["height"] / 2
    page.evaluate("""([x,y])=>{const el=document.elementFromPoint(x,y);const t=(xx)=>new Touch({identifier:1,target:el,clientX:xx,clientY:y});
      el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t(x)]}));
      for(const d of [20,80,160]) el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,touches:[t(x-d)]}));
      el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));}""", [x, y])
    page.wait_for_timeout(350)
    assert state(page)["entries"] == []
    assert page.locator(".sheet").count() == 0


def test_checkin_tags_and_quick_good_day(page):
    start(page)
    page.click('[data-a="checkin"] >> nth=0')
    page.locator('input[data-s="pain"]').fill("6")
    page.click('[data-a="ctag"][data-tag="stress"]')
    page.click('[data-a="savecheck"]')
    c = state(page)["checkins"][0]
    assert c["pain"] == 6 and c["tags"] == ["stress"]


def test_custom_food_keeps_focus_and_can_be_edited(page):
    start(page)
    page.click('[data-a="nav"][data-v="foods"]'); page.click('[data-a="customnew"]')
    page.fill("#cname", "Spicy tomato soup"); page.click("#cserv")
    assert page.evaluate("document.activeElement.id") == "cserv"
    assert page.locator("#cauto .chip.on").inner_text().strip().endswith("Caution")
    page.fill("#ck", "-50"); page.click('[data-a="csave"]')
    assert state(page)["custom"][0]["kcal"] == 0          # negatives clamped
    page.click('[data-a="foodinfo"] >> nth=0'); page.click('[data-a="editcustom"]')
    page.fill("#ck", "220"); page.click('[data-a="csave"]')
    assert state(page)["custom"][0]["kcal"] == 220


def test_saved_meal_and_repeat_yesterday(page):
    start(page)
    y = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    page.evaluate(f"""S.entries.push({{id:'y1',date:'{y}',time:'08:00',ts:tsOf('{y}','08:00'),meal:'breakfast',name:'Oatmeal',foodKey:'db:oatmeal',serving:'1 cup',servings:1,kcal:166,p:6,c:28,f:4,ic:'F',dairy:false}}); save(); render();""")
    page.click('[data-a="repeat"][data-meal="breakfast"]')
    assert any(e["date"] == datetime.date.today().isoformat() and e["name"] == "Oatmeal" for e in state(page)["entries"])
    log_food(page, "banana")
    page.evaluate("S.entries.forEach(e=>{ if(e.date===today()) e.meal='breakfast'; }); save(); render();")
    page.click('[data-a="savemealask"][data-meal="breakfast"]'); page.fill("#mealname", "Usual breakfast"); page.click('[data-a="savemeal"]')
    assert state(page)["meals"][0]["name"] == "Usual breakfast" and len(state(page)["meals"][0]["items"]) == 2


def test_barcode_photo_and_cache(page):
    start(page)
    calls = []
    page.route("**openfoodfacts.org/**", lambda r: (calls.append(1), r.fulfill(status=200, content_type="application/json", body=json.dumps(OFF_PRODUCT))))
    page.click('[data-a="add"] >> nth=0'); page.click('[data-a="tab"][data-tab="scan"]')
    page.fill("#bcode", "0029000016743"); page.click('[data-a="lookup"]')
    page.wait_for_selector("#cname")
    assert page.input_value("#cname") == "Planters Whole Cashews" and page.input_value("#ck") == "160"
    page.click('[data-a="tab"][data-tab="search"]'); page.click('[data-a="tab"][data-tab="scan"]')
    page.fill("#bcode", "0029000016743"); page.click('[data-a="lookup"]')
    page.wait_for_selector("#cname")
    assert len(calls) == 1, "second lookup should come from the on-phone cache"


def test_restore_rejects_garbage_and_cleans_bad_data(page):
    start(page)
    page.click('[data-a="settings"]'); page.click('[data-a="import"]')
    page.fill("#pastebk", "not json"); page.click('[data-a="restorepaste"]')
    assert "doesn't look like" in page.locator(".toast").inner_text()
    bad = json.dumps({"petName": "Mo", "entries": [{"name": "Banana", "date": "2026-11-01", "kcal": "105", "servings": None}, None, {"x": 1}],
                      "checkins": [{"date": "2026-11-02", "pain": 99, "urgency": -5, "tags": "x"}], "marks": [], "settings": None})
    page.fill("#pastebk", bad); page.click('[data-a="restorepaste"]')
    s = state(page)
    assert [(e["name"], e["kcal"], e["servings"]) for e in s["entries"]] == [("Banana", 105, 1)]
    assert (s["checkins"][0]["pain"], s["checkins"][0]["urgency"], s["checkins"][0]["tags"]) == (10, 0, [])


def test_corrupt_storage_does_not_crash(page):
    page.evaluate("localStorage.setItem('bunbites.v1','{broken')"); page.reload()
    assert page.locator("#petname").count() == 1
    assert any(k.startswith("bunbites.v1.broken") for k in page.evaluate("Object.keys(localStorage)"))


def test_every_screen_renders_with_a_year_of_data(page):
    start(page)
    page.evaluate("""(()=>{ const foods=['Oatmeal','Coffee','Chicken breast','Pizza, cheese','White rice','Mild cheddar'];
      for(let i=1;i<=365;i++){ const d=addDays(today(),-i);
        foods.slice(0,4).forEach((n,j)=>{ const b=BUILTIN.find(f=>f.name===foods[(i+j)%foods.length]); const t=['08:00','12:00','15:00','19:00'][j];
          S.entries.push({id:uid(),date:d,time:t,ts:tsOf(d,t),meal:'lunch',name:b.name,foodKey:b.key,serving:b.serving,servings:1,kcal:b.kcal,p:b.p,c:b.c,f:b.f,ic:b.ic,dairy:b.dairy}); });
        S.checkins.push({id:uid(),date:d,time:'21:00',ts:tsOf(d,'21:00'),pain:i%7,urgency:1,frequency:1,bloating:i%5,cramps:0,tags:[]}); }
      save(); })()""")
    page.reload()
    for v in ["today", "foods", "insights", "bunny"]:
        ms = page.evaluate(f"(()=>{{view='{v}'; const t=performance.now(); render(); return performance.now()-t}})()")
        assert ms < 250, f"{v} took {ms:.0f} ms"


def test_evening_nudge(page):
    start(page)
    page.evaluate("S.checkins=[]; save(); Date.prototype.getHours=function(){return 20}; render();")
    assert page.locator('[data-a="feelgoodquick"]').count() == 1
    page.click('[data-a="feelgoodquick"]')
    assert page.locator('[data-a="feelgoodquick"]').count() == 0


def test_flare_day_gentle_picks(page):
    start(page)
    # she marks rice as safe and coffee as a trigger; coffee must never be suggested
    page.evaluate("S.marks['white rice']='safe'; S.marks['coffee']='trigger'; save(); render();")
    page.click('[data-a="flare"]')
    picks = page.locator('[data-a="gpick"]').all_inner_texts()
    assert picks and "White rice" in picks[0], picks
    assert not any("Coffee" in p for p in picks)
    assert not any(n in " ".join(picks) for n in ["Milk", "Ice cream", "Cottage", "Ricotta"]), "dairy staples should be skipped"
    page.click('[data-a="gpick"] >> nth=0')
    assert state(page)["entries"][0]["name"] == "White rice"
    page.click(".toast .undo")
    assert state(page)["entries"] == []
    page.click('[data-a="flare"]')
    assert page.locator('[data-a="gpick"]').count() == 0
