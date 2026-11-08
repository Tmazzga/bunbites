# Bun Bites 🐰

A food and symptom tracker for IC and dairy sensitivity, with a bunny that grows as you log. Everything is plain HTML/JS with no build step and no backend. Data lives in the phone's local storage.

## Files
- `index.html`: layout and styles
- `app.js`: the app. Edit `GIFT_NOTE` at the top to change the welcome-screen note.
- `foods.js`: built-in food list (nutrition estimates plus IC/dairy flags) and the keyword lists for auto-flagging
- `sw.js`: offline caching. **Bump `VERSION` whenever you change files.**
- `manifest.webmanifest` and `icons/`: home-screen install

## Host it on GitHub Pages (~5 min)
1. Create a new public repo on github.com, e.g. `bunbites`.
2. Add file → Upload files → drag in **everything in this folder**, including the `icons` folder. Commit.
3. Go to Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save.
4. Wait about a minute. The app is live at `https://<your-username>.github.io/bunbites/`.

HTTPS is required for the camera (barcode scanning) and offline mode, and GitHub Pages provides it.

## Install on her iPhone
1. Open the link in **Safari** (not Chrome or Instagram's in-app browser).
2. Tap Share → **Add to Home Screen** → Add.
3. Open it from the home-screen icon from then on. Opening from the icon is what keeps her data from being cleared.
4. The first time she scans, iOS asks for camera permission. Tap Allow.

## 5-minute iPhone test (do this before you give it to her)
Use your own iPhone, then reset the app (Settings → Erase everything) when you're done.
1. **Install:** open the link in Safari → Share → Add to Home Screen. Launch it from the icon. It should open full-screen with no Safari bars, and the pink bunny icon should look right.
2. **Name + log:** name the bunny, add a food, do a check-in. Close the app completely (swipe it away), reopen it, and confirm everything's still there.
3. **Scan:** Add food → Scan → Start scanning. Allow the camera. Scan 2–3 packaged things from your pantry and check the calories against the label.
4. **Online search:** search something not in the list (e.g. "Chobani"), tap "Search more foods online", and pick a result.
5. **Offline:** turn on Airplane Mode, open the app from the icon, and log a food. It should work. Then try Scan in Airplane Mode: the camera should still open (only the product lookup needs internet).
6. **Backup:** Settings → Save backup → Save to Files. Then Settings → Restore → pick that file.
7. **Look:** check that nothing is hidden under the notch or the home bar, and that the keyboard doesn't cover the input you're typing in.

If something breaks, send me a screenshot and say which step.

## Updating later
Edit the files, bump `VERSION` in `sw.js`, and re-upload. She'll get the new version the next time she opens the app with internet. Her data isn't touched.

## Test locally
`python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Notes
- Built-in calories are typical estimates. Scanned products use Open Food Facts label data.
- IC ratings follow the ICA / IC Network food lists. Personal "safe"/"trigger" marks override them.
- Insights compare days she ate a food (or a trigger group like tomato, caffeine, citrus or dairy) with days she didn't, using symptoms of 4/10+ within 24h, and run a Fisher exact test so random bad days don't get blamed on food. "Likely trigger" = strong evidence; "Worth watching" = weaker signal. Suspects are re-checked with stronger triggers' days removed, so foods eaten alongside a real trigger get cleared. In simulations this finds about 98% of real triggers after 60 days of logging, with roughly one false flag every 3 months.
- To move to a new phone: Settings → Save backup → restore on the new phone.
