// Sólo režim (trénink) v Chromiu desktop 1440×900 a WebKitu iPhone 13:
//  - úvod → „Zkusit sám“ → nabídka, adresa #solo přímo, tlačítko Zpět prohlížeče
//  - Hádání: kresba se přehrává v čase (inkoust roste), tip bez diakritiky velkými písmeny → odhalení s časem, vzdání,
//    8 ukázek se v sezení neopakují, mód Zrcadlově
//  - Kreslení: prst / myš → Hotovo → zakódování, uložení, načtení, přehrání, kontrola shody (+ simulovaná chyba), módy Zrcadlově a Poslepu
//  - žádný síťový požadavek na synchronizaci (mantledb, /api/), žádné chyby v konzoli, na iPhonu bez scrollu stránky
// node tests/solo.cjs [URL]   (výchozí http://127.0.0.1:8810/?api=local, živě např. https://sachasportrezervace-arch.github.io/caranice/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const URL0 = process.argv[2] || "http://127.0.0.1:8810/?api=local";
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });
const base = (() => { const u = new URL(URL0); u.hash = ""; return u.toString(); })();
const withHash = h => { const u = new URL(base); u.hash = h; return u.toString(); };

let pass = 0, fail = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const noDia = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const HOUSE = [[[.25, .55], [.25, .85], [.75, .85], [.75, .55], [.25, .55]], [[.2, .57], [.5, .3], [.8, .57]], [[.45, .85], [.45, .7], [.55, .7], [.55, .85]]];
const SUN = [[[.5, .3], [.6, .4], [.5, .5], [.4, .4], [.5, .3]], [[.5, .15], [.5, .22]], [[.7, .4], [.78, .4]], [[.3, .4], [.22, .4]]];
const SCRIBBLE = [[[.2, .2], [.8, .3], [.2, .5], [.8, .6], [.2, .8]]];

async function suite(label, browserType, ctxOpts, touch) {
  const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  [${label}] ${name}${extra ? "  (" + extra + ")" : ""}`); };
  const browser = await browserType.launch();
  const ctx = await browser.newContext(ctxOpts);
  const p = await ctx.newPage();
  const errs = [], net = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => m.type() === "error" && !/404/.test(m.text()) && errs.push("console: " + m.text().slice(0, 200)));
  p.on("dialog", d => d.accept());
  p.on("request", r => { if (/mantledb|\/api\//.test(r.url())) net.push(r.method() + " " + r.url()); });
  const shot = name => p.screenshot({ path: path.join(SH, `solo-${label}-${name}.png`) });
  const st = () => p.evaluate(() => window.__car ? __car.state() : {});
  const info = () => p.evaluate(() => __car.solo.info());
  const waitView = (re, timeout = 15000) => p.waitForFunction(re => window.__car && new RegExp(re).test(__car.state().view), re.source, { timeout })
    .catch(async e => { console.log("ČEKÁNÍ NA", re, "STAV", JSON.stringify(await st().catch(() => ({})))); throw e; });
  const ink = () => p.evaluate(() => { const c = document.getElementById("cv"); if (!c) return -1; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
  const fits = () => p.evaluate(() => { const r = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; }; const cv = r("#platno"); return { sh: document.documentElement.scrollHeight, ih: innerHeight, sy: scrollY, cvBot: cv && cv.bottom, cvW: cv && cv.width, cvH: cv && cv.height, iw: innerWidth }; });
  const inView = sels => p.evaluate(sels => sels.map(q => { const e = document.querySelector(q); if (!e) return q + ": chybí"; const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 && r.width > 0 ? "" : `${q}: ${Math.round(r.top)}–${Math.round(r.bottom)} z ${innerHeight}`; }).filter(Boolean), sels);
  const noPageScroll = async name => { const f = await fits(); check(`${name}: stránka se neposouvá`, f.sh <= f.ih + 1 && f.sy === 0, JSON.stringify({ sh: f.sh, ih: f.ih, sy: f.sy })); };
  const noEmoji = async name => { const t = await p.evaluate(() => document.body.innerText); check(`${name}: bez emoji`, !/\p{Extended_Pictographic}/u.test(t)); };
  async function drawShapes(shapes) {
    if (touch) {
      await p.evaluate(async shapes => {
        const cv = document.getElementById("cv"), r = cv.getBoundingClientRect(), sl = ms => new Promise(f => setTimeout(f, ms));
        const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, button: type === "pointermove" ? -1 : 0, buttons: type === "pointerup" ? 0 : 1 }));
        for (const pts of shapes) {
          ev("pointerdown", ...pts[0]);
          for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
            for (let s = 1; s <= 8; s++) { ev("pointermove", x0 + (x1 - x0) * s / 8, y0 + (y1 - y0) * s / 8); await sl(16); }
          }
          ev("pointerup", ...pts[pts.length - 1]);
          await sl(120);
        }
      }, shapes);
    } else {
      const b = await p.locator("#cv").boundingBox();
      for (const pts of shapes) {
        await p.mouse.move(b.x + pts[0][0] * b.width, b.y + pts[0][1] * b.height);
        await p.mouse.down();
        for (const [x, y] of pts.slice(1)) await p.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps: 8 });
        await p.mouse.up();
        await sleep(120);
      }
    }
  }

  // ---- úvod → Zkusit sám → nabídka
  await p.goto(base);
  await p.waitForSelector("#bCreate");
  await sleep(300);
  check("úvod: tlačítko „Zkusit sám“ je vedle „Vyzvat soupeře“ a je sekundární", await p.evaluate(() => { const s = document.getElementById("bSolo"), c = document.getElementById("bCreate"); return !!s && s.textContent.trim() === "Zkusit sám" && s.getBoundingClientRect().height < c.getBoundingClientRect().height; }));
  if (touch) { const bad = await inView(["#bSolo", "#bCreate", "#fName"]); check("úvod na iPhonu: jméno, Vyzvat i Zkusit sám bez posunu", !bad.length, bad.join("; ")); await noPageScroll("úvod"); }
  await shot("1-uvod");
  await p.click("#bSolo");
  await waitView(/^solo:menu$/);
  check("po kliku je v adrese #solo", (await p.evaluate(() => location.hash)) === "#solo");
  await shot("2-nabidka");
  if (touch) { const bad = await inView(["#bHadat", "#bKreslit", "#bUvod"]); check("nabídka na iPhonu celá na obrazovce", !bad.length, bad.join("; ")); await noPageScroll("nabídka"); }
  await noEmoji("nabídka");
  await p.goBack();
  await p.waitForSelector("#bCreate");
  check("tlačítko Zpět prohlížeče vrátí na úvod", (await st()).view === "setup");
  await p.goForward();
  await waitView(/^solo:menu$/);

  // ---- hádání: kresba se přehrává v čase
  await p.click("#bHadat");
  await waitView(/^solo:guess$/);
  const w1 = await p.evaluate(() => __car.solo.word());
  check("hádání: slovo ukázky existuje a hráč ho nevidí na obrazovce", !!w1 && !(await p.evaluate(() => document.body.innerText)).toLowerCase().includes(w1.toLowerCase()), w1);
  await sleep(900);
  const i1 = await ink(); await sleep(2600); const i2 = await ink(); await sleep(3600); const i3 = await ink();
  check("hádání: kresba se přehrává v původním tempu (inkoust roste v čase)", i2 > i1 && i3 > i2, `${i1} → ${i2} → ${i3}`);
  await shot("3-hadani");
  if (touch) {
    const f = await fits();
    check("iPhone hádání: plátno celé na obrazovce a široké aspoň 62 %", f.cvBot <= f.ih && f.cvW >= 0.62 * f.iw, JSON.stringify(f));
    const bad = await inView(["#fTip", "#bVzdat", "#sazka", "#bNap"]); check("iPhone hádání: tip, vzdání, lišta i nápověda ve viewportu", !bad.length, bad.join("; "));
    await noPageScroll("hádání");
  } else {
    const f = await fits(); check("desktop hádání: plátno aspoň 55 % výšky okna", f.cvH >= 0.55 * f.ih && f.sh <= f.ih + 1, JSON.stringify(f));
  }
  await p.fill("#fTip", "xyzabc"); await p.press("#fTip", "Enter"); await sleep(200);
  const tipTxt = await p.evaluate(() => (document.getElementById("tipy") || document.getElementById("bubTipy")).innerText);
  check("špatný tip se zapíše", /xyzabc/.test(tipTxt), tipTxt);
  await p.click("#bNap"); await sleep(150);
  check("nápověda ukáže počet písmen", (await p.locator("#pismena i").count()) === [...w1.replace(/\s/g, "")].length + (w1.split(/\s+/).length - 1));
  await p.fill("#fTip", noDia(w1).toUpperCase()); await p.press("#fTip", "Enter");
  await waitView(/^solo:reveal$/);
  await sleep(350);
  const rev = await p.evaluate(() => ({ verdikt: document.querySelector(".verdikt").innerText, popis: document.querySelector("#sazka .popis").innerText, svg: document.querySelectorAll("#mini svg path").length, slovo: document.querySelector(".stitek .slovo").innerText }));
  check("správný tip bez diakritiky velkými písmeny → Uhodnuto s časem", /Uhodnuto/.test(rev.verdikt) && /Uhodnuto za \d+,\d s/.test(rev.popis) && /Kresba trvala \d+,\d s/.test(rev.popis) && rev.slovo === w1, JSON.stringify(rev));
  check("odhalení ukazuje celou kresbu", rev.svg > 3, String(rev.svg));
  check("hlavička počítá uhodnuto", (await info()).uh === 1);
  await shot("4-odhaleni");
  await noEmoji("odhalení");
  if (touch) { const bad = await inView(["#bDalsi", "#bVyzvat", ".stitek", "#mini"]); check("iPhone odhalení: tlačítka i kresba ve viewportu", !bad.length, bad.join("; ")); await noPageScroll("odhalení"); }

  // ---- vzdání a neopakování ukázek
  const words = [w1];
  let seenMirror = false;
  for (let n = 2; n <= 8; n++) {
    await p.click("#bDalsi");
    await waitView(/^solo:guess$/);
    const w = await p.evaluate(() => __car.solo.word()), inf = await info();
    words.push(w);
    if (inf.mod === "zrcadlo" && !seenMirror) {
      seenMirror = true;
      await sleep(3500);
      const chip = await p.evaluate(() => ({ mod: !!document.querySelector(".platno .mod") && /Zrcadlově/.test(document.querySelector(".platno .mod").innerText), osa: !!document.querySelector(".platno .osa") }));
      const k = await ink();
      check("zrcadlová ukázka: štítek Zrcadlově, osa a kresba na plátně", chip.mod && chip.osa && k > 20, JSON.stringify({ ...chip, ink: k }));
      await shot("5-zrcadlo");
    }
    if (n === 2) { await p.click("#bVzdat"); await waitView(/^solo:reveal$/); const v = await p.evaluate(() => document.querySelector(".verdikt").innerText); check("vzdání: odhalí slovo a řekne Vzdáno", /Vzdáno/.test(v) && (await p.evaluate(() => document.querySelector(".stitek .slovo").innerText)) === w, v); await shot("6-vzdano"); }
    else { await p.click("#bVzdat"); await waitView(/^solo:reveal$/); }
  }
  check("8 ukázek v sezení = 8 různých slov, žádná se neopakuje", new Set(words).size === 8, words.join(", "));
  check("zrcadlová ukázka se v osmi objevila", seenMirror);
  const lastLabel = await p.evaluate(() => document.getElementById("bDalsi").innerText);
  check("po poslední ukázce tlačítko nabídne začít znovu", /Znovu/.test(lastLabel), lastLabel);
  await p.click("#bDalsi"); await waitView(/^solo:guess$/);
  const w9 = await p.evaluate(() => __car.solo.word());
  check("devátá ukázka není stejná jako osmá (cyklus se spravedlivě otočí)", w9 !== words[7] && (await info()).used === 1, `${w9} po ${words[7]}`);

  // ---- kreslení s kontrolou uložení
  await p.click("#bZpet");
  await waitView(/^solo:menu$/);
  await p.evaluate(() => { __car.solo.hooks.mod = ""; });
  await p.click("#bKreslit");
  await waitView(/^solo:draw$/);
  const wd = await p.evaluate(() => __car.solo.word());
  check("kreslení: hráč dostane slovo a plátno s prázdným stavem", !!wd && (await p.locator("#prazdne").isVisible()) && (await p.evaluate(() => document.querySelector(".stitek .slovo").innerText)) === wd, wd);
  await shot("7-kresleni-prazdne");
  const y0 = await p.evaluate(() => scrollY);
  await drawShapes(HOUSE); await drawShapes(SUN); await drawShapes(SCRIBBLE);
  await sleep(200);
  const inkD = await ink(), y1 = await p.evaluate(() => scrollY), ta = await p.evaluate(() => getComputedStyle(document.getElementById("cv")).touchAction);
  check("kreslení kreslí na plátno, stránka se nehne, touch-action none", inkD > 80 && y0 === y1 && ta === "none", `inkoust ${inkD}, scroll ${y0}->${y1}, touch-action ${ta}`);
  if (touch) { const bad = await inView(["#bDone", "#bUndo", ".barvy .barva:last-child", "#sazka"]); check("iPhone kreslení: Hotovo, Zpět, poslední barva i lišta ve viewportu", !bad.length, bad.join("; ")); await noPageScroll("kreslení"); }
  await shot("8-kresleni");
  await p.click("#bDone");
  await waitView(/^solo:play$/);
  await sleep(300);
  const last = (await info()).last;
  const ls = await p.evaluate(() => { try { const o = JSON.parse(localStorage.getItem("car-solo-kresba")); return { kod: (o.kod || "").length, slovo: o.slovo }; } catch (e) { return null; } });
  check("po Hotovo: zakódováno, uloženo, načteno, shoduje se", last && last.saved && last.same && last.bytes > 100 && !last.err && last.slovo === wd, JSON.stringify(last));
  check("v localStorage leží uložená kresba (kód i slovo)", ls && ls.kod === last.bytes && ls.slovo === wd, JSON.stringify(ls));
  const kon = await p.evaluate(() => ({ n: document.querySelectorAll(".kontrola").length, ok: document.querySelectorAll(".kontrola.ok").length, txt: document.getElementById("kontroly").innerText, chyba: !!document.getElementById("chyba") }));
  check("kontrola ukazuje velikost v kB a 3× zelenou, žádnou chybu", kon.n === 3 && kon.ok === 3 && /\d+,\d+ kB/.test(kon.txt) && !kon.chyba, JSON.stringify(kon).slice(0, 200));
  // přehrání v původním tempu: hned po Znovu málo, na konci víc
  await p.click("#bZnovu"); await sleep(60);
  const r0 = await ink(); const durMs = await p.evaluate(() => { const t = document.getElementById("pT").innerText; return +t.split("/")[1].replace(",", ".").replace(/[^\d.]/g, "") * 1000; });
  await sleep(Math.min(9000, durMs + 400)); const r1 = await ink();
  check("přehrání z uloženého kódu: kresba se v čase doplňuje a na konci je celá", r1 > r0 + 20 && r1 > 80, `${r0} → ${r1}, trvá ${Math.round(durMs)} ms`);
  await shot("9-prehrani");
  await noEmoji("přehrání");
  if (touch) { const bad = await inView(["#bDalsi", "#bVyzvat", "#kontroly", "#bZnovu", "#sazka"]); check("iPhone přehrání: kontrola i tlačítka ve viewportu", !bad.length, bad.join("; ")); await noPageScroll("přehrání"); }

  // ---- simulovaná chyba při načtení
  await p.evaluate(() => { __car.solo.hooks.fault = true; });
  await p.click("#bDalsi"); await waitView(/^solo:draw$/);
  await drawShapes(HOUSE);
  await p.click("#bDone"); await waitView(/^solo:play$/); await sleep(300);
  const bad = await p.evaluate(() => ({ chyba: document.getElementById("chyba") ? document.getElementById("chyba").innerText : "", ne: document.querySelectorAll(".kontrola.ne").length }));
  check("když se načtená kresba neshoduje, hra ukáže chybu", /liší/.test(bad.chyba) && bad.ne >= 1 && (await info()).last.same === false, JSON.stringify(bad));
  await shot("10-chyba");
  if (touch) { const b2 = await inView(["#bDalsi", "#bVyzvat", "#chyba"]); check("iPhone chyba: hláška i tlačítka ve viewportu", !b2.length, b2.join("; ")); await noPageScroll("chyba"); }
  await p.evaluate(() => { __car.solo.hooks.fault = false; });

  // ---- módy při kreslení
  await p.evaluate(() => { __car.solo.hooks.mod = "zrcadlo"; });
  await p.click("#bDalsi"); await waitView(/^solo:draw$/);
  check("mód Zrcadlově při kreslení: štítek a osa", await p.evaluate(() => /Zrcadlově/.test(document.querySelector(".platno .mod").innerText) && !!document.querySelector(".platno .osa")));
  await drawShapes([[[.2, .3], [.35, .55], [.2, .8]]]); await sleep(150);
  const mirInk = await p.evaluate(() => { const c = document.getElementById("cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height), w = c.width; let l = 0, r = 0; for (let y = 0; y < c.height; y += 2) for (let x = 0; x < w; x += 2) if (d.data[(y * w + x) * 4 + 3] > 0) (x < w / 2 ? l++ : r++); return { l, r }; });
  check("zrcadlo: čára vlevo se objeví i vpravo", mirInk.l > 20 && mirInk.r > 20 && Math.abs(mirInk.l - mirInk.r) < 0.25 * (mirInk.l + mirInk.r), JSON.stringify(mirInk));
  await p.click("#bDone"); await waitView(/^solo:play$/);
  check("zrcadlo: kontrola shody prošla", (await info()).last.same === true);
  await p.evaluate(() => { __car.solo.hooks.mod = "poslepu"; });
  await p.click("#bDalsi"); await waitView(/^solo:draw$/);
  await drawShapes(HOUSE); await sleep(150);
  check("poslepu: při kreslení plátno zůstává prázdné a je vidět nápis", (await ink()) === 0 && (await p.locator(".slepe").isVisible()));
  await shot("11-poslepu");
  await p.click("#bDone"); await waitView(/^solo:play$/); await sleep(Math.min(6000, 2500));
  check("poslepu: po Hotovo se kresba přehraje", (await ink()) > 50 && (await info()).last.same === true);
  await p.evaluate(() => { __car.solo.hooks.mod = undefined; });

  // ---- konec: Vyzvat soupeře vede do normální výzvy
  await p.click("#bVyzvat");
  await p.waitForSelector("#bCreate");
  check("Vyzvat soupeře: návrat na úvod a z adresy zmizelo #solo", (await st()).view === "setup" && (await p.evaluate(() => location.hash)) === "");

  // ---- přímá adresa #solo
  const q = await ctx.newPage();
  q.on("pageerror", e => errs.push("pageerror(q): " + e.message));
  q.on("console", m => m.type() === "error" && !/404/.test(m.text()) && errs.push("console(q): " + m.text().slice(0, 200)));
  q.on("request", r => { if (/mantledb|\/api\//.test(r.url())) net.push("q " + r.method() + " " + r.url()); });
  await q.goto(withHash("solo"));
  await q.waitForFunction(() => window.__car && __car.state().view === "solo:menu", null, { timeout: 15000 });
  await q.click("#bHadat");
  await q.waitForFunction(() => window.__car && __car.state().view === "solo:guess", null, { timeout: 15000 });
  await sleep(2500);
  const qInk = await q.evaluate(() => { const c = document.getElementById("cv"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
  check("adresa #solo otevře nabídku přímo a hádání funguje", qInk > 10, `inkoust ${qInk}`);
  await q.close();

  check("během celého sóla žádný požadavek na mantledb ani /api/", net.length === 0, net.slice(0, 3).join(" | "));
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 4).join(" | "));
  await browser.close();
}

(async () => {
  await suite("Chromium", chromium, { viewport: { width: 1440, height: 900 } }, false);
  await suite("iPhone", webkit, { ...devices["iPhone 13"] }, true);
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CHYBA", e); process.exit(2); });
