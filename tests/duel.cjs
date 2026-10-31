// Celá partie ve 2 nezávislých prohlížečích: A = Chromium desktop 1440×900 (Mark, zakladatel), B = WebKit iPhone 13 (Radka).
// Výzva → pojistka „nevyzvi sám sebe“ → přijetí → 6 kol (kreslení myší i dotykem, živý přenos, tipy, trefa, vzdání)
// → konec partie, tituly, galerie → odveta (jiná slova, jiné modifikátory) → async přehrávání → divák.
// node tests/duel.cjs [URL]   (výchozí http://127.0.0.1:8810/?api=local&limit=30)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const URL0 = process.argv[2] || "http://127.0.0.1:8810/?api=local&limit=30";
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = (p, name) => p.screenshot({ path: path.join(SH, name + ".png") });
const st = p => p.evaluate(() => window.__car ? __car.state() : {});
const waitView = (p, re, timeout = 20000) => p.waitForFunction(re => window.__car && new RegExp(re).test(__car.state().view), re.source || re, { timeout })
  .catch(async e => { console.log("ČEKÁNÍ NA", re, "STAV", JSON.stringify(await st(p).catch(() => ({})))); throw e; });
const ink = p => p.evaluate(() => { const c = document.getElementById("cv"); if (!c) return -1; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
const fits = p => p.evaluate(() => { const r = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; }; const cv = r("#platno"); return { sh: document.documentElement.scrollHeight, ih: innerHeight, sy: scrollY, cvTop: cv && cv.top, cvBot: cv && cv.bottom, cvW: cv && cv.width, cvH: cv && cv.height, iw: innerWidth }; });

// kreslení myší (desktop)
async function drawMouse(p, shapes) {
  const b = await p.locator("#cv").boundingBox();
  for (const pts of shapes) {
    await p.mouse.move(b.x + pts[0][0] * b.width, b.y + pts[0][1] * b.height);
    await p.mouse.down();
    for (const [x, y] of pts.slice(1)) await p.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps: 6 });
    await p.mouse.up();
    await sleep(120);
  }
}
// kreslení prstem: pointer události typu touch, jak je posílá Safari na iPhonu
async function drawTouch(p, shapes) {
  await p.evaluate(async shapes => {
    const cv = document.getElementById("cv"), r = cv.getBoundingClientRect(), sl = ms => new Promise(f => setTimeout(f, ms));
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, button: type === "pointermove" ? -1 : 0, buttons: type === "pointerup" ? 0 : 1 }));
    for (const pts of shapes) {
      ev("pointerdown", ...pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        for (let s = 1; s <= 6; s++) { ev("pointermove", x0 + (x1 - x0) * s / 6, y0 + (y1 - y0) * s / 6); await sl(16); }
      }
      ev("pointerup", ...pts[pts.length - 1]);
      await sl(100);
    }
  }, shapes);
}
const HOUSE = [[[.25, .55], [.25, .85], [.75, .85], [.75, .55], [.25, .55]], [[.2, .57], [.5, .3], [.8, .57]], [[.45, .85], [.45, .7], [.55, .7], [.55, .85]]];
const SUN = [[[.5, .3], [.6, .4], [.5, .5], [.4, .4], [.5, .3]], [[.5, .15], [.5, .22]], [[.7, .4], [.78, .4]], [[.3, .4], [.22, .4]]];
const SCRIBBLE = [[[.2, .2], [.8, .3], [.2, .5], [.8, .6], [.2, .8]]];

async function pick(p, i, bet) {
  await p.waitForSelector("#karty");
  await p.locator(`#karty [data-i="${i}"]`).click();
  if (bet != null) await p.evaluate(b => { const f = document.getElementById("fBet"); f.value = b; f.dispatchEvent(new Event("input")); }, bet);
  await p.click("#bGo");
}
async function guess(p, text) { await p.fill("#fTip", text); await p.press("#fTip", "Enter"); }

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errs = [];
  const watch = (n, p) => {
    p.on("pageerror", e => errs.push(n + ": " + e.message));
    p.on("console", m => m.type() === "error" && !/404/.test(m.text()) && errs.push(n + " console: " + m.text().slice(0, 200)));
    p.on("dialog", d => d.accept());
  };
  watch("A", A); watch("B", B);

  // 1) založení výzvy
  await A.goto(URL0);
  await A.waitForSelector("#bCreate");
  await shot(A, "a1-setup-desk");
  await B.goto(URL0); await B.waitForSelector("#bCreate"); await sleep(400);
  await shot(B, "b1-setup-mobil");
  const fs0 = await fits(B);
  check("iPhone: úvod bez posunu stránky", fs0.sh <= fs0.ih + 1, JSON.stringify(fs0));
  await A.fill("#fName", "Mark");
  await A.click("#bCreate");
  await waitView(A, /^share$/);
  await shot(A, "a2-share-desk");
  const link = await A.locator("#link").innerText();
  check("odkaz výzvy má tvar #r.<id>", /#r\.[0-9a-z]{10}$/.test(link), link);

  // 2) pojistka: zakladatel na stejném zařízení se nepřipojí jako soupeř
  const A2 = await ctxA.newPage(); watch("A2", A2);
  await A2.goto(link); await sleep(1500);
  const s2 = await st(A2);
  check("regrese: zakladatel po otevření svého odkazu zůstává hráč x, ne soupeř", s2.seat === "x" && !/intro/.test(s2.view), JSON.stringify(s2));
  await A2.close();

  // 3) B otevře odkaz, zkusí jméno zakladatele, pak přijme pod svým
  await B.goto(link);
  await waitView(B, /^intro$/);
  await shot(B, "b2-intro-mobil");
  await B.fill("#fName", "mark"); await B.click("#bAccept"); await sleep(800);
  const s3 = await st(B);
  check("regrese: výzvu nejde přijmout pod jménem zakladatele", s3.view === "intro" && !s3.seat && await B.locator("#bAsX").isVisible(), JSON.stringify(s3));
  await B.fill("#fName", "Radka");
  await B.locator('[data-av="holka"]').click();
  await B.click("#bAccept");
  await waitView(B, /^wait:1$/);
  await waitView(A, /^pick:1$/);
  check("po přijetí: A vybírá slovo, B čeká", true);
  await shot(A, "a3-pick-desk");
  await shot(B, "b3-wait-mobil");

  // 4) kolo 1: A kreslí myší, B hádá živě
  await pick(A, 0, 0);
  await waitView(A, /^draw:1$/);
  await waitView(B, /^guess:1$/);
  const w1 = await A.evaluate(() => __car.word(1));
  const t0 = Date.now();
  await drawMouse(A, HOUSE);
  await B.waitForFunction(() => { const c = document.getElementById("cv"); if (!c) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 64) if (d[i]) return true; return false; }, null, { timeout: 8000 });
  check("živý přenos: kresba se u hádače objeví do 4 s", Date.now() - t0 < 4000, `${Date.now() - t0} ms od začátku kreslení`);
  await shot(A, "a4-draw-desk");
  await shot(B, "b4-guess-mobil");
  const fB = await fits(B);
  check("iPhone hádání: stránka se neposouvá, plátno celé na obrazovce", fB.sh <= fB.ih + 1 && fB.cvTop >= 0 && fB.cvBot <= fB.ih && fB.cvW >= 0.7 * fB.iw, JSON.stringify(fB));
  const fA = await fits(A);
  check("desktop kreslení: plátno vysoké aspoň 55 % okna", fA.cvH >= 0.55 * fA.ih && fA.sh <= fA.ih + 1, JSON.stringify(fA));
  await guess(B, "xyzabc");
  await sleep(900);
  const tipOnA = await A.locator("#bubTipy").innerText();
  check("kreslíř vidí špatný tip soupeře živě", /xyzabc/.test(tipOnA), tipOnA);
  await guess(B, w1.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
  await waitView(B, /^reveal:1$/);
  await waitView(A, /^reveal:1$/);
  await sleep(500);
  await shot(B, "b5-reveal-mobil"); await shot(A, "a5-reveal-desk");
  const sz1 = await A.evaluate(() => JSON.stringify(__car.docs().x.h[1]).length + __car.drawSize(1));
  check("uhodnuto bez diakritiky velkými písmeny, oba vidí odhalení", true, `slovo ${w1}`);
  const sc1 = (await st(A)).score;

  // 5) kolo 2: B kreslí prstem, A hádá (trefa do okna 0–10 s)
  await B.click("#bNext"); await A.click("#bNext");
  await waitView(B, /^pick:2$/);
  await shot(B, "b6-pick-mobil");
  await pick(B, 1, 0);
  await waitView(B, /^draw:2$/);
  await waitView(A, /^guess:2$/);
  const y0 = await B.evaluate(() => scrollY);
  await drawTouch(B, SUN);
  await sleep(300);
  const inkB = await ink(B), y1 = await B.evaluate(() => scrollY), m2 = (await A.evaluate(() => __car.mods(1)))[1];
  const ta = await B.evaluate(() => getComputedStyle(document.getElementById("cv")).touchAction), sz = await B.evaluate(() => __car.drawSize(2));
  check("iPhone: kreslení prstem kreslí a stránka se nehne", sz > 20 && (m2 === "poslepu" ? inkB === 0 : inkB > 50) && y0 === y1 && ta === "none", `mód ${m2 || "-"}, kód ${sz} B, inkoust ${inkB}, scroll ${y0}->${y1}, touch-action ${ta}`);
  const fD = await fits(B);
  check("iPhone kreslení: nástroje i plátno bez posunu", fD.sh <= fD.ih + 1 && fD.cvBot <= fD.ih, JSON.stringify(fD));
  await shot(B, "b7-draw-mobil");
  await sleep(1200);
  await shot(A, "a6-guess-desk");
  const w2 = await B.evaluate(() => __car.word(2));
  await guess(A, w2);
  await waitView(A, /^reveal:2$/); await waitView(B, /^reveal:2$/);
  const r2 = await A.evaluate(() => { const d = __car.docs(); return d.x.g[2]; });
  await sleep(400);
  await shot(A, "a7-reveal-desk"); await shot(B, "b8-reveal-mobil");
  const sc2 = (await st(A)).score;
  check("trefa do okna 0–10 s: body pro oba", r2.hit < 10000 ? sc2.o - sc1.o === 3 && sc2.x - sc1.x > 3 : true, `zásah ${r2.hit} ms, skóre ${JSON.stringify(sc2)}`);

  // 6) kola 3–6: střídavě, vzdání, nápověda, modifikátory
  const mods = await A.evaluate(() => __car.mods(1));
  for (let k = 3; k <= 6; k++) {
    await A.click("#bNext"); await B.click("#bNext");
    const D = k % 2 ? A : B, G = k % 2 ? B : A;
    await waitView(D, new RegExp(`^pick:${k}$`));
    await pick(D, k % 3, 10);
    await waitView(D, new RegExp(`^draw:${k}$`)); await waitView(G, new RegExp(`^guess:${k}$`));
    if (D === A) await drawMouse(A, mods[k - 1] === "jedna" ? SCRIBBLE : HOUSE); else await drawTouch(B, SCRIBBLE);
    if (mods[k - 1]) await shot(D, `mod-${mods[k - 1]}-${D === A ? "desk" : "mobil"}`);
    if (k === 4) { await G.click("#bNap"); await sleep(300); check("nápověda ukáže počet písmen", await G.locator("#pismena i").count() > 0); }
    if (k === 5) { await G.click("#bVzdat"); }
    else { await sleep(1500); await guess(G, await D.evaluate(k => __car.word(k), k)); }
    await waitView(A, new RegExp(`^reveal:${k}$`)); await waitView(B, new RegExp(`^reveal:${k}$`));
  }
  check("modifikátory partie 1 se v kolech objevily", mods.filter(Boolean).length === 3, mods.join(","));

  // 7) konec partie: výsledek, tituly, galerie
  await A.click("#bNext"); await B.click("#bNext");
  await waitView(A, /^partie:6$/); await waitView(B, /^partie:6$/);
  await A.waitForFunction(() => document.querySelectorAll("#galerie .kr svg path").length > 5, null, { timeout: 10000 });
  await sleep(500);
  await shot(A, "a8-partie-desk"); await shot(B, "b9-partie-mobil");
  const gal = await B.locator("#galerie .obraz").count();
  check("galerie partie má 6 kreseb", gal === 6, String(gal));
  const ser = (await st(A)).series;
  check("série započítala partii", ser.x + ser.o + ser.rem === 1, JSON.stringify(ser));

  // 8) odveta: kolo 7 kreslí B (partie začínají střídavě), slova se neopakují
  const used1 = await A.evaluate(() => [1, 2, 3, 4, 5, 6].map(k => __car.word(k)));
  await A.click("#bOdveta"); await B.click("#bOdveta");
  await waitView(B, /^pick:7$/); await waitView(A, /^wait:7$/);
  const offers = await B.locator("#karty .karta .slovo").allInnerTexts();
  check("odveta: nabízená slova nejsou z minulé partie", offers.every(w => !used1.includes(w)), offers.join(", "));
  const mods2 = await A.evaluate(() => __car.mods(2));
  check("odveta: jiný plán modifikátorů než partie 1", mods2.join() !== mods.join(), mods2.join(","));

  // 9) async: A zavře hru, B nakreslí celé kolo, A se vrátí a kresba se přehraje od začátku
  await A.close();
  await pick(B, 2, 10);
  await waitView(B, /^draw:7$/);
  await drawTouch(B, HOUSE); await sleep(400); await drawTouch(B, SUN);
  await B.click("#bDone");
  await waitView(B, /^watch:7$/);
  const A3 = await ctxA.newPage(); watch("A3", A3);
  await A3.goto(link);
  await waitView(A3, /^guess:7$/);
  await A3.waitForFunction(() => document.getElementById("cv") && document.getElementById("cv").width > 0);
  await sleep(150);
  const i0 = await ink(A3); await sleep(2600); const i1 = await ink(A3);
  check("async: kresba se přehrává v původním tempu (na začátku méně než po 2,6 s)", i1 > i0, `${i0} → ${i1}`);
  const w7 = await B.evaluate(() => __car.word(7));
  await guess(A3, w7);
  await waitView(A3, /^reveal:7$/); await waitView(B, /^reveal:7$/);

  // 10) divák: třetí zařízení vidí hru, nemůže hrát
  const bC = await chromium.launch(), C = await (await bC.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); watch("C", C);
  await C.goto(link); await sleep(1800);
  const sc = await st(C);
  check("třetí osoba je divák (bez místa, bez výzvy)", !sc.seat && /^spect/.test(sc.view), JSON.stringify(sc));
  await shot(C, "c1-divak-desk");
  await A3.click("#bNext"); await B.click("#bNext");
  await waitView(A3, /^pick:8$/);
  await pick(A3, 0, 10);
  await waitView(A3, /^draw:8$/);
  await drawMouse(A3, HOUSE);
  await waitView(C, /^spect:8$/);
  await sleep(1500);
  const inkC = await ink(C);
  check("divák vidí kresbu živě", inkC > 50, String(inkC));
  await shot(C, "c2-divak-kolo-desk");

  check("bez chyb v konzoli", !errs.length, errs.slice(0, 5).join(" | "));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await bA.close(); await bB.close(); await bC.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CHYBA", e); process.exit(2); });
