// Napojení na Hernu (protokol 1, react-apps/HERNA-PROTOKOL.md): hra v iframe, ve 2 prohlížečích.
// A = Chromium desktop 1440×900, B = WebKit iPhone 13. Rodičovská stránka je maketa Herny (lišta 51 px + iframe, zprávy se sbírají).
// Scénář 1: zakladatel (A, seat 0) otevře první, pozvaný (B, seat 1) naskočí sám, celá partie bez výzvy, výsledek a „Jiná hra“.
// Scénář 2: role prohozené (B zakládá jako seat 1, A se posadí jako seat 0 a otevře dřív), partie s jasným vítězem = seat 1.
// Scénář 3: bez #herna se hra chová postaru (výzva, sólo), neplatné parametry také.
// node tests/herna.cjs [URL]   (výchozí http://127.0.0.1:8810/?api=local&limit=30; živě https://sachasportrezervace-arch.github.io/caranice/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const URL0 = process.argv[2] || "http://127.0.0.1:8810/?api=local&limit=30";
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => [...Array(12)].map(() => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)]).join("");
const u = new URL(URL0);
const RODIC = u.origin + u.pathname.replace(/[^/]*$/, "") + "__rodic.html";
const RODIC_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>html,body{height:100%;margin:0;background:#222}#lista{height:51px;background:#111;color:#fff}iframe{border:0;width:100%;height:calc(100% - 51px);display:block}</style>
<div id="lista">Herna</div><iframe id="g" allow="fullscreen"></iframe>
<script>window.__msgs=[];var g=document.getElementById("g");addEventListener("message",function(e){if(e.source!==g.contentWindow)return;var z=e.data;if(z&&typeof z==="object"&&z.herna===1)window.__msgs.push(z);});g.src=new URLSearchParams(location.search).get("src");</script>`;

// hráč = { page (rodič), name, touch }; hra běží ve framu
const frameOf = P => P.page.frames().find(f => f !== P.page.mainFrame());
async function otevri(P, r, seat, names, zaklada) {
  const hash = `#herna=1&m=test000000&r=${r}&seat=${seat}&names=${names.map(encodeURIComponent).join(",")}&zaklada=${zaklada}`;
  await P.page.goto(RODIC + "?src=" + encodeURIComponent(u.origin + u.pathname + u.search + hash));
  await P.page.waitForFunction(() => document.getElementById("g").contentDocument && document.getElementById("g").contentDocument.readyState !== "loading", null, { timeout: 15000 }).catch(() => {});
  await P.page.waitForFunction(() => { const f = document.getElementById("g").contentWindow; return f && f.__car; }, null, { timeout: 15000 });
}
const reload = async P => { await frameOf(P).evaluate(() => { window.__stary = 1; setTimeout(() => location.reload(), 0); }); await frameOf(P).waitForFunction(() => !window.__stary && window.__car, null, { timeout: 15000 }); };
const st = P => frameOf(P).evaluate(() => __car.state());
const view = async P => (await st(P)).view;
const waitView = (P, re, timeout = 25000) => frameOf(P).waitForFunction(re => window.__car && new RegExp(re).test(__car.state().view), re.source || re, { timeout })
  .catch(async e => { console.log("ČEKÁNÍ NA", re, "STAV", JSON.stringify(await st(P).catch(() => ({})))); throw e; });
const msgs = P => P.page.evaluate(() => window.__msgs.slice());
const typs = async P => (await msgs(P)).map(m => m.typ === "stav" ? "stav:" + m.faze : m.typ);
const waitMsg = (P, fn, timeout = 20000) => P.page.waitForFunction(f => window.__msgs.some(new Function("m", "return " + f)), fn, { timeout });
const fits = P => frameOf(P).evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
const shot = (P, name) => P.page.screenshot({ path: path.join(SH, name + ".png") });

const HOUSE = [[[.25, .55], [.25, .85], [.75, .85], [.75, .55], [.25, .55]], [[.2, .57], [.5, .3], [.8, .57]]];
async function kresli(P, shapes) {
  if (!P.touch) {
    const b = await frameOf(P).locator("#cv").boundingBox();
    for (const pts of shapes) {
      await P.page.mouse.move(b.x + pts[0][0] * b.width, b.y + pts[0][1] * b.height);
      await P.page.mouse.down();
      for (const [x, y] of pts.slice(1)) await P.page.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps: 5 });
      await P.page.mouse.up(); await sleep(100);
    }
    return;
  }
  await frameOf(P).evaluate(async shapes => {
    const cv = document.getElementById("cv"), r = cv.getBoundingClientRect(), sl = ms => new Promise(f => setTimeout(f, ms));
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 11, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, button: type === "pointermove" ? -1 : 0, buttons: type === "pointerup" ? 0 : 1 }));
    for (const pts of shapes) {
      ev("pointerdown", ...pts[0]);
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; for (let s = 1; s <= 5; s++) { ev("pointermove", x0 + (x1 - x0) * s / 5, y0 + (y1 - y0) * s / 5); await sl(16); } }
      ev("pointerup", ...pts[pts.length - 1]); await sl(80);
    }
  }, shapes);
}

// jedno kolo k: D kreslí, G hádá (trefí, nebo se vzdá), pak oba odkliknou odhalení
async function kolo(k, D, G, vzdat) {
  await waitView(D, new RegExp(`^pick:${k}$`));
  const f = frameOf(D);
  await f.waitForSelector("#karty");
  await f.locator('#karty [data-i="0"]').click();
  await f.click("#bGo");
  await waitView(D, new RegExp(`^draw:${k}$`)); await waitView(G, new RegExp(`^guess:${k}$`));
  await kresli(D, HOUSE);
  await sleep(1200);
  const g = frameOf(G);
  if (vzdat) await g.click("#bVzdat");
  else { const w = await f.evaluate(k => __car.word(k), k); await g.fill("#fTip", w); await g.press("#fTip", "Enter"); }
  await waitView(D, new RegExp(`^reveal:${k}$`)); await waitView(G, new RegExp(`^reveal:${k}$`));
  await sleep(250);
  await frameOf(D).click("#bNext"); await frameOf(G).click("#bNext");
}
// celá partie p (kola 6p-5…6p); kdo kreslí, určuje pravidlo hry: lichá kola x, sudá o (v partii 1; v další se střídá)
async function partie(p, X, O, vzdatO) {
  for (let i = 0; i < 6; i++) {
    const k = (p - 1) * 6 + 1 + i;
    const drawerX = (i + 1 + p) % 2 === 0;   // zrcadlí R.drawerOf
    await kolo(k, drawerX ? X : O, drawerX ? O : X, vzdatO && drawerX);
  }
}
const summary = P => frameOf(P).evaluate(() => [...document.querySelectorAll(".vysledek .sk")].map(e => +e.textContent));

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  const errs = [];
  const mk = async (ctx, name, touch) => {
    const page = await ctx.newPage();
    await page.route("**/__rodic.html*", route => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: RODIC_HTML }));
    page.on("pageerror", e => errs.push(name + ": " + e.message));
    page.on("console", m => m.type() === "error" && !/404/.test(m.text()) && errs.push(name + " console: " + m.text().slice(0, 200)));
    page.on("dialog", d => d.accept());
    return { page, name, touch };
  };
  const NAMES = ["Mark", "Ráďa, Žofie"];

  // ---------- scénář 1: zakladatel A (seat 0) první, pozvaný B (seat 1) naskočí sám ----------
  const r1 = rid();
  const A = await mk(ctxA, "A", false), B = await mk(ctxB, "B", true);
  await otevri(A, r1, 0, NAMES, 1);
  await waitView(A, /^herna-wait$/);
  const txtA = await frameOf(A).evaluate(() => document.body.innerText);
  check("zakladatel čeká na pozvaného (ne na výzvě a ne na sdílení odkazu)", /Čeká se, až se připojí Ráďa, Žofie/.test(txtA) && !(await frameOf(A).locator("#link, #bCreate, #bSolo, #bAccept, #fName").count()), txtA.replace(/\s+/g, " ").slice(0, 80));
  const hA = await frameOf(A).evaluate(() => location.hash);
  check("adresa hry zůstává #herna=…, nepřepíše se na #r.", hA.startsWith("#herna=1") && !/#r\./.test(hA), hA);
  await shot(A, "herna-a1-ceka-desk");
  check("A: zpráva pripraveno, pak stav ceka", JSON.stringify((await typs(A)).slice(0, 2)) === JSON.stringify(["pripraveno", "stav:ceka"]), (await typs(A)).join(","));

  await otevri(B, r1, 1, NAMES, 0);
  await waitView(B, /^wait:1$/); await waitView(A, /^pick:1$/);
  check("pozvaný se posadil sám, bez výzvy a bez zadání jména (A vybírá slovo, B čeká)", true);
  const bUi = await frameOf(B).locator("#link, #bCreate, #bSolo, #bAccept, #fName, #bFull").count(), aUi = await frameOf(A).locator("#link, #bCreate, #bSolo, #bAccept, #fName, #bFull").count();
  check("v Herně není sdílení, Vyzvat soupeře, Zkusit sám, pole jména ani přijetí výzvy", bUi === 0 && aUi === 0);
  const sA = await st(A), sB = await st(B);
  check("A hraje za x (seat 0), B za o (seat 1)", sA.seat === "x" && sB.seat === "o", JSON.stringify([sA.seat, sB.seat]));
  const jm = P => frameOf(P).evaluate(() => [...document.querySelectorAll("#top .jm")].map(e => e.textContent));
  await waitView(B, /^wait:1$/);
  const jA = await jm(A), jB = await jm(B);
  check("jména z Herny včetně čárky a diakritiky na obou stranách (x = seat 0, o = seat 1)", JSON.stringify(jA) === JSON.stringify(NAMES) && JSON.stringify(jB) === JSON.stringify(NAMES), JSON.stringify([jA, jB]));
  await waitMsg(A, "m.typ==='stav'&&m.faze==='hraje'"); await waitMsg(B, "m.typ==='stav'&&m.faze==='hraje'");
  const tB = await typs(B);
  check("B: pripraveno, ceka, hraje v tomto pořadí", tB.indexOf("pripraveno") === 0 && tB.indexOf("stav:ceka") < tB.indexOf("stav:hraje") && tB.includes("stav:hraje"), tB.join(","));
  await shot(B, "herna-b1-wait-mobil"); await shot(A, "herna-a2-pick-desk");
  const fB1 = await fits(B), fA1 = await fits(A);
  check("iPhone v Herně (iframe o 51 px nižší): čekání bez posunu", fB1.sh <= fB1.ih + 1 && fB1.sw <= fB1.iw + 1, JSON.stringify(fB1));
  check("desktop v Herně: výběr slova bez posunu", fA1.sh <= fA1.ih + 1, JSON.stringify(fA1));

  // reload zakladatele i pozvaného: sedí na svých místech, dokument se nezakládá znovu
  await reload(A); await waitView(A, /^pick:1$/);
  await reload(B); await waitView(B, /^wait:1$/);
  const sA2 = await st(A), sB2 = await st(B);
  check("reload obou: stejná místa, stejné jméno, hra pokračuje", sA2.seat === "x" && sB2.seat === "o" && JSON.stringify(await jm(A)) === JSON.stringify(NAMES), JSON.stringify([sA2.view, sB2.view]));

  // celá partie 1
  await partie(1, A, B, false);
  await waitView(A, /^partie:6$/); await waitView(B, /^partie:6$/);
  await frameOf(A).waitForFunction(() => document.querySelectorAll("#galerie .kr svg path").length > 5, null, { timeout: 10000 });
  await shot(A, "herna-a3-partie-desk"); await shot(B, "herna-b2-partie-mobil");
  const fB2 = await fits(B);
  check("iPhone: výsledek partie s tlačítkem Jiná hra bez posunu stránky", fB2.sh <= fB2.ih + 1, JSON.stringify(fB2));
  const [sx, so] = await summary(A);
  const exp = sx > so ? 0 : so > sx ? 1 : null;
  await waitMsg(A, "m.typ==='vysledek'"); await waitMsg(B, "m.typ==='vysledek'");
  const mA = (await msgs(A)).filter(m => m.typ === "vysledek"), mB = (await msgs(B)).filter(m => m.typ === "vysledek");
  check("oba hráči pošlou přesně jeden výsledek, stejná partie, stejný vítěz (sedadlo v Herně)",
    mA.length === 1 && mB.length === 1 && mA[0].partie === `${r1}:1` && mB[0].partie === mA[0].partie && mA[0].vitez === exp && mB[0].vitez === exp, JSON.stringify({ sx, so, exp, mA, mB }));
  check("fáze: ceka → hraje → konec", (await typs(A)).join(",").includes("stav:hraje,stav:konec") && (await typs(B)).includes("stav:konec"), (await typs(A)).join(","));
  const bb = await frameOf(B).evaluate(() => ["bOdveta", "bJina"].map(id => document.getElementById(id).getBoundingClientRect().bottom).concat(innerHeight));
  check("iPhone v Herně: Odveta i Jiná hra celé nad spodní hranou rámu", bb[0] <= bb[2] && bb[1] <= bb[2], JSON.stringify(bb));
  check("Odveta i Jiná hra jsou vidět, Jiná hra pošle jina-hra jen tomu, kdo klikl", await frameOf(B).locator("#bOdveta").isVisible() && await frameOf(B).locator("#bJina").isVisible());
  await frameOf(B).click("#bJina");
  await waitMsg(B, "m.typ==='jina-hra'");
  check("B: jina-hra odešlo, A nic takového neposlal", (await typs(B)).includes("jina-hra") && !(await typs(A)).includes("jina-hra"));
  await frameOf(A).click("#bOdveta"); await frameOf(B).click("#bOdveta");
  await waitView(B, /^pick:7$/); await waitView(A, /^wait:7$/);
  const t3 = await typs(A);
  check("odveta: znovu fáze hraje po konci a výsledek další partie ponese jiný klíč", t3[t3.length - 1] === "stav:hraje", t3.slice(-3).join(","));
  await A.page.close(); await B.page.close();

  // ---------- scénář 2: role prohozené, pozvaný (A, seat 0) otevře první, zakladatel je seat 1 (B) ----------
  const r2 = rid();
  const A2 = await mk(ctxA, "A2", false), B2 = await mk(ctxB, "B2", true);
  await otevri(A2, r2, 0, NAMES, 0);
  await sleep(1500);
  const w2 = await view(A2);
  check("pozvaný před zakladatelem: čeká na naskočení hry", w2 === "herna-otevira" && /Čeká se, až hra naskočí/.test(await frameOf(A2).evaluate(() => document.body.innerText)), w2);
  check("A2: stav ceka bez předčasného hraje", (await typs(A2)).join(",") === "pripraveno,stav:ceka", (await typs(A2)).join(","));
  await otevri(B2, r2, 1, NAMES, 1);
  await waitView(B2, /^pick:1$/); await waitView(A2, /^wait:1$/);
  const jB2 = await jm(B2), jA2 = await jm(A2);
  check("zakladatel seat 1 je x se svým jménem (druhé z names), pozvaný seat 0 je o", JSON.stringify(jB2) === JSON.stringify([NAMES[1], NAMES[0]]) && JSON.stringify(jA2) === JSON.stringify([NAMES[1], NAMES[0]]), JSON.stringify([jB2, jA2]));
  // jasný vítěz: o (A2) se vždy vzdá, x (B2) vždy uhodne
  await partie(1, B2, A2, true);
  await waitView(A2, /^partie:6$/); await waitView(B2, /^partie:6$/);
  await waitMsg(A2, "m.typ==='vysledek'"); await waitMsg(B2, "m.typ==='vysledek'");
  const [x2, o2] = await summary(B2);
  const vA = (await msgs(A2)).filter(m => m.typ === "vysledek"), vB = (await msgs(B2)).filter(m => m.typ === "vysledek");
  check("vítěz x = seat 1 (zakladatel B): oba hlásí vitez 1", x2 > o2 && vA.length === 1 && vB.length === 1 && vA[0].vitez === 1 && vB[0].vitez === 1 && vA[0].partie === `${r2}:1`, JSON.stringify({ x2, o2, vA, vB }));
  await shot(B2, "herna-b3-partie-vitez-mobil");

  // ---------- scénář 3: bez Herny postaru ----------
  const P = await mk(ctxA, "P", false);
  await P.page.goto(URL0);
  await P.page.waitForSelector("#bCreate");
  check("bez #herna: úvod s Vyzvat soupeře a Zkusit sám, žádné herna", await P.page.locator("#bSolo").isVisible() && (await P.page.evaluate(() => __car.herna())) === null);
  await P.page.goto(URL0 + "#herna=1&r=nope&seat=0&names=A,B&zaklada=1");
  await P.page.reload(); await P.page.waitForSelector("#bCreate");
  check("neplatné parametry (r mimo [0-9a-z]{6,16}): hra jede postaru", await P.page.locator("#bSolo").isVisible() && (await P.page.evaluate(() => __car.herna())) === null);
  await P.page.goto(URL0 + "#solo"); await P.page.reload();
  await P.page.waitForFunction(() => window.__car && __car.state().view === "solo:menu", null, { timeout: 10000 });
  check("#solo dál otevře sólo režim", (await P.page.evaluate(() => __car.herna())) === null);
  const meta = await P.page.evaluate(async () => { const t = await (await fetch(location.pathname)).text(); return /<meta name="herna-protokol" content="1">/.test(t); });
  check('index.html má <meta name="herna-protokol" content="1">', meta);

  check("bez chyb v konzoli", !errs.length, errs.slice(0, 5).join(" | "));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CHYBA", e); process.exit(2); });
