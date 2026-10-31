// Sólo režim (trénink): bez soupeře, bez sítě, bez série. Dvě hry:
//  1) Hádání: přehraje se ukázková kresba v původním tempu, běží stopky, tolerantní porovnání, nápověda, vzdání, odhalení s časem.
//  2) Kreslení s kontrolou: slovo → kresba → Hotovo → zakódování → uložení → načtení → dekódování → přehrání + kontrola shody.
// Nic odsud nevolá Net (mantledb), nezakládá místnost a nepíše do room. Do localStorage jde jen poslední nakreslená kresba
// (klíč car-solo-kresba) a do sessionStorage seznam už ukázaných ukázek.

import * as K from "./kresba.js";
import { porovnej, pismena } from "./shoda.js";
import { OBTIZNOSTI, navrhy } from "./slova.js";
import { UKAZKY } from "./ukazky.js";
import { MODY } from "./hra.js";

const KEY_KRESBA = "car-solo-kresba", KEY_UKAZKY = "car-solo-ukazky";
const OBT = Object.fromEntries(OBTIZNOSTI.map(o => [o.id, o.nazev]));
const LUPA = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="13" r="8" fill="#DCE1FF" stroke="#2F3FE3" stroke-width="3"/><path d="m19 19 8 8" stroke="#2F3FE3" stroke-width="4.5" stroke-linecap="round"/></svg>`;
const TUZKA = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27l2-7L22 5l5 5-15 15z" fill="#FFD23F" stroke="#17161F" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 27l2-7 5 5z" fill="#17161F"/></svg>`;
const attempt = (fn, fb) => { try { return fn(); } catch { return fb; } };
const kB = n => (n / 1024).toFixed(n < 1024 ? 2 : 1).replace(".", ",");
const sameStrokes = (a, b) => a.length === b.length && a.every((s, i) => s.c === b[i].c && s.s === b[i].s && s.p.length === b[i].p.length && s.p.every((v, j) => v === b[i].p[j]));
const visibleCount = (strokes, upTo) => {
  const lim = upTo / K.DT; let n = 0;
  for (const s of strokes) for (let i = 2; i < s.p.length; i += 3) if (s.p[i] <= lim) n++; else break;
  return n;
};

export function createSolo(H) {
  const { $, esc, ICON, stopky, sazkaHTML, toast, hlava, postava, AVATARY, jmenoAvataru, COL, DESK, LIMIT, ui, s1, fitCanvas, goSetup, store } = H;

  const hooks = { fault: false, mod: undefined };   // testovací háčky: simulace chyby při načtení, vynucený modifikátor
  const Z = { uh: 0, kr: 0, cur: null, raf: 0, render: null, last: null, usedWords: new Set(),
    used: attempt(() => JSON.parse(sessionStorage.getItem(KEY_UKAZKY)) || [], []).filter(i => Number.isInteger(i) && i >= 0 && i < UKAZKY.length) };
  const saveUsed = () => attempt(() => sessionStorage.setItem(KEY_UKAZKY, JSON.stringify(Z.used)));
  const me = () => ({ name: store.get("car-name") || "Ty", av: store.get("car-av") || "kluk" });

  function enter(view, render) {
    cancelAnimationFrame(Z.raf);
    ui.key = "solo:" + view; Z.render = render;
    document.body.classList.remove("odhal");
  }
  function top(caption, count, face) {
    const t = $("top"), p = me();
    t.hidden = false;
    t.innerHTML = `<div class="hrac x">${hlava(p.av, face)}<div><div class="jm">${caption}</div><div class="sk">${count}</div></div></div>
      <div class="mid"><div class="kolo trenink">Trénink</div><div class="stopky" id="stopky"></div></div>
      <div class="hrac o"><button class="solo-konec" id="bZpet">Zpět</button></div>`;
    $("bZpet").addEventListener("click", menu);
  }
  const modChip = mod => mod ? `<div class="mod">${ICON.mod[mod]}${MODY[mod].nazev}</div>` : "";
  const tick = (sec, bar) => {
    const st = $("stopky"); if (st) st.innerHTML = stopky(sec, null) + `<b>${Math.floor(sec)}</b>`;
    const pc = Math.min(100, bar) + "%";
    const j = $("jehla"); if (j) j.style.left = pc;
    const u = $("ubehlo"); if (u) u.style.width = pc;
  };
  const stopSolo = () => { cancelAnimationFrame(Z.raf); Z.cur = null; Z.render = null; };
  const toSetup = () => { stopSolo(); goSetup(); };

  // ---------- nabídka ----------
  function menu() {
    stopSolo(); enter("menu", menu);
    $("top").hidden = true;
    $("view").innerHTML = `<div class="panel dva solo"><div class="lev"><h1 class="logo"><span>Čáranice</span></h1>
      <p class="trenink-text"><b>Trénink.</b> Hraješ sám a jen v tomhle okně. Nic se neposílá po síti, nezakládá se místnost a nic se nepočítá do série.</p></div>
      <div class="prav"><div class="forma">
        <button class="volba" id="bHadat">${LUPA}<span><b>Hádat kresbu</b><small>Ukázková kresba se přehraje v původním tempu a ty proti ní stopuješ čas.</small></span></button>
        <button class="volba" id="bKreslit">${TUZKA}<span><b>Nakreslit slovo</b><small>Kresba se zakóduje, uloží, načte a přehraje. Hra ukáže velikost kódu a jestli sedí.</small></span></button>
        <button class="odkazbtn" id="bUvod">Zpět na úvod</button></div></div></div>`;
    $("bHadat").addEventListener("click", startGuess);
    $("bKreslit").addEventListener("click", startDraw);
    $("bUvod").addEventListener("click", toSetup);
  }

  // ---------- 1) hádání ----------
  function nextUkazka() {
    const ids = UKAZKY.map((_, i) => i);
    let free = ids.filter(i => !Z.used.includes(i));
    if (!free.length) { const last = Z.used[Z.used.length - 1]; Z.used = []; free = ids.filter(i => i !== last); }
    const i = free[Math.floor(Math.random() * free.length)];
    Z.used.push(i); saveUsed();
    return i;
  }
  function startGuess() {
    const i = nextUkazka(), u = UKAZKY[i], strokes = K.decode(u.kod), p = me();
    const dav = AVATARY.filter(a => a !== p.av)[i % (AVATARY.length - 1)];
    Z.cur = { mode: "guess", i, u, strokes, dur: K.duration(strokes), t0: Date.now(), nap: false, tips: [], end: null, dav };
    viewGuess();
  }
  function viewGuess() {
    const g = Z.cur, u = g.u, mod = u.mod, desk = DESK.matches, p = me();
    enter("guess", viewGuess);
    top("Uhodnuto", Z.uh, "mysli");
    const stitek = `<div class="stitek"><div><small>Hádej, co se kreslí · ukázka ${Z.used.length} z ${UKAZKY.length}</small><div class="pismena" id="pismena"></div></div><div class="vpravo"><button class="btn-line" id="bNap">Kolik písmen?</button></div></div>`;
    const platno = `<div class="plocha" id="plocha"><div class="platno" id="platno"><canvas id="cv"></canvas>${mod === "zrcadlo" ? `<div class="osa"></div>` : ""}${modChip(mod)}<div class="prazdne" id="prazdne" hidden>Kresba se ještě nezačala</div></div></div>`;
    const bar = sazkaHTML({ needle: true, label: "Hodiny běží", right: `<b>limit ${LIMIT} s</b>` });
    const hadat = `<form class="hadat" id="hadat" autocomplete="off"><input id="fTip" enterkeyhint="send" placeholder="Tvůj tip" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Tvůj tip"><button class="btn sm" type="submit">Tipnout</button><button class="ik" type="button" id="bVzdat" aria-label="Vzdát kolo">${ICON.vlajka}</button></form>`;
    const tipy = `<div class="tipy" id="tipy"></div>`;
    const sideL = `<aside class="strana-l"><div class="bublina" id="bubTipy">…</div>${postava(p.av, "mysli", COL.x)}<div class="cedule">${esc(p.name)} hádá</div></aside>`;
    const sideR = `<aside class="strana-p"><div class="bublina">Ukázka ${Z.used.length} z ${UKAZKY.length}</div>${postava(g.dav, "kresli", COL.o)}<div class="cedule">${esc(jmenoAvataru(g.dav))} kreslí</div></aside>`;
    $("view").innerHTML = `<div class="round">${desk ? sideL : ""}<div class="stred">${stitek}${platno}${bar}${desk ? "" : tipy}${hadat}</div>${desk ? sideR : ""}</div>`;
    fitCanvas();
    letters(); renderTips();
    const f = $("hadat"), inp = $("fTip");
    f.addEventListener("submit", e => {
      e.preventDefault();
      const t = inp.value.trim(); if (!t || g.end) return;
      inp.value = "";
      const ms = Math.min(LIMIT * 1000, Date.now() - g.t0), v = porovnej(t, u.slovo);
      if (v === "ano") { g.tips.push([t.slice(0, 24), ms, 2]); finishGuess("hit", ms); return; }
      if (v === "skoro") toast("Skoro! Zkus to přesněji.");
      g.tips.push([t.slice(0, 24), ms, v === "skoro" ? 1 : 0]);
      renderTips();
      if (!DESK.matches) inp.focus();
    });
    $("bNap").addEventListener("click", () => { g.nap = true; letters(); });
    $("bVzdat").addEventListener("click", () => { if (!g.end) finishGuess("vzdal", Date.now() - g.t0); });
    // smyčka: plátno do času, stopky, lišta
    const cv = $("cv"), ctx = cv.getContext("2d");
    let lastVis = -1, lastW = 0;
    const frame = () => {
      if (Z.cur !== g || ui.key !== "solo:guess" || !$("cv")) return;
      const el = Math.min(LIMIT * 1000, Date.now() - g.t0);
      const vis = visibleCount(g.strokes, el);
      if (vis !== lastVis || cv.width !== lastW) {
        lastVis = vis; lastW = cv.width;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
        K.paint(ctx, g.strokes, el, { scale: cv.width / K.W, mirror: mod === "zrcadlo" });
        const pr = $("prazdne"); if (pr) pr.hidden = vis > 0;
      }
      tick(el / 1000, el / (LIMIT * 10));
      if (el >= LIMIT * 1000) { finishGuess("cas", LIMIT * 1000); return; }
      Z.raf = requestAnimationFrame(frame);
    };
    Z.raf = requestAnimationFrame(frame);
  }
  function letters() {
    const el = $("pismena"), g = Z.cur; if (!el) return;
    if (!g.nap) { el.innerHTML = ""; return; }
    const w = g.u.slovo;
    el.innerHTML = pismena(w).map(n => Array.from({ length: n }, () => "<i></i>").join("")).join(`<i class="mezera"></i>`);
    const b = $("bNap"); if (b) { b.textContent = `${[...w.replace(/\s/g, "")].length} písmen`; b.disabled = true; }
  }
  function renderTips() {
    const g = Z.cur;
    const chips = g.tips.slice(-6).reverse().map(([t, , v]) => `<span class="tip${v === 1 ? " skoro" : v === 2 ? " ok" : ""}">${esc(t)}</span>`).join("");
    const el = $("tipy"); if (el) el.innerHTML = chips || `<span class="napis">Piš tipy, kolikrát chceš. Za špatné se nic nestrhává.</span>`;
    const bub = $("bubTipy");
    if (bub) bub.innerHTML = g.tips.length ? g.tips.slice(-3).map(([t, , v]) => v === 2 ? esc(t) : v === 1 ? `${esc(t)}?` : `<s>${esc(t)}</s>`).join(" ") : "Čekám na nápad.";
  }
  function finishGuess(kind, ms) {
    const g = Z.cur; if (g.end) return;
    g.end = { kind, ms };
    if (kind === "hit") { Z.uh++; if (navigator.vibrate) navigator.vibrate(60); }
    viewReveal();
  }
  function viewReveal() {
    const g = Z.cur, u = g.u, e = g.end, p = me(), hit = e.kind === "hit";
    enter("reveal", viewReveal);
    top("Uhodnuto", Z.uh, hit ? "radost" : "au");
    const verdikt = hit ? "Uhodnuto!" : e.kind === "vzdal" ? "Vzdáno" : "Čas vypršel";
    const label = hit ? `Uhodnuto za ${s1(e.ms)} s` : e.kind === "vzdal" ? `Vzdáno po ${s1(e.ms)} s` : `Limit ${LIMIT} s vypršel`;
    const last = Z.used.length >= UKAZKY.length;
    const before = hit && e.ms < g.dur - 300;
    $("view").innerHTML = `<div class="odhaleni">
      <div class="verdikt">${verdikt}</div>
      <div class="stitek"><div><small>${hit ? "Slovo" : "Bylo to"}</small><div class="slovo">${esc(u.slovo)}</div></div></div>
      <div class="scena">${postava(p.av, hit ? "radost" : "au", COL.x)}<div class="mini" id="mini">${K.toSVG(g.strokes, { mirror: u.mod === "zrcadlo" })}</div>${postava(g.dav, hit ? "au" : "radost", COL.o)}</div>
      ${sazkaHTML({ bet: { b: 0, bw: Math.min(LIMIT, g.dur / 1000) }, hit: hit ? e.ms : undefined, hitOk: false, label, right: `Kresba trvala <b>${s1(g.dur)} s</b>` })}
      ${before ? `<div class="pomoc">Uhodnuto ještě před koncem kresby</div>` : ""}
      ${last ? `<div class="pomoc">To byly všechny ukázky, další kolo začne znovu</div>` : ""}
      <button class="btn" id="bDalsi">${last ? "Znovu od začátku" : "Další kresba"}</button>
      <button class="odkazbtn" id="bVyzvat">Vyzvat soupeře</button></div>`;
    $("bDalsi").addEventListener("click", startGuess);
    $("bVyzvat").addEventListener("click", toSetup);
  }

  // ---------- 2) kreslení s kontrolou uložení ----------
  function startDraw() {
    const pick = (() => { const ch = navrhy(Math.random, Z.usedWords); return ch[Math.floor(Math.random() * ch.length)]; })();
    Z.usedWords.add(pick.slovo);
    const keys = Object.keys(MODY);
    let mod = hooks.mod !== undefined ? hooks.mod : (Z.kr > 0 && Math.random() < .5 ? keys[Math.floor(Math.random() * keys.length)] : "");
    let pal = K.BARVY.map((_, i) => i);
    if (mod === "barvy3") { const rest = pal.slice(1).sort(() => Math.random() - .5).slice(0, 2); pal = [0, ...rest]; }
    Z.cur = { mode: "draw", slovo: pick.slovo, obt: pick.obt, mod, pal, rec: K.recorder(), t0: 0, act: null, col: pal[0], size: 1, dirty: true };
    viewDraw();
  }
  function viewDraw() {
    const g = Z.cur, mod = g.mod, desk = DESK.matches, p = me();
    enter("draw", viewDraw);
    top("Nakresleno", Z.kr, "kresli");
    const stitek = `<div class="stitek"><div><small>Kreslíš · ${OBT[g.obt]}</small><div class="slovo">${esc(g.slovo)}</div></div><div class="vpravo"><button class="btn-hotovo" id="bDone">Hotovo</button></div></div>`;
    const platno = `<div class="plocha" id="plocha"><div class="platno" id="platno"><canvas id="cv"></canvas>${mod === "zrcadlo" ? `<div class="osa"></div>` : ""}${modChip(mod)}
      ${mod === "poslepu" ? `<div class="slepe">Kreslíš poslepu.<br>Kresbu uvidíš po Hotovo.</div><div class="kurzor" id="kurzor" hidden></div>` : `<div class="prazdne" id="prazdne"${g.t0 ? " hidden" : ""}>Začni kreslit.<br>Čas běží od prvního dotyku.</div>`}</div></div>`;
    const bar = sazkaHTML({ needle: true, label: "Čas na kresbu", right: `<b>limit ${LIMIT} s</b>` });
    const tools = `<div class="nastroje"><div class="barvy" id="barvy">${g.pal.map(i => `<button class="barva${i === g.col ? " on" : ""}" data-c="${i}" style="background:${K.BARVY[i]}" aria-label="Barva"></button>`).join("")}</div>
      <button class="ik tl" id="bTl" aria-label="Tloušťka čáry"><b></b></button><button class="ik" id="bUndo" aria-label="Zpět">${ICON.zpet}</button></div>`;
    const dr = AVATARY.filter(a => a !== p.av)[0];
    const sideL = `<aside class="strana-l"><div class="bublina">${mod ? esc(MODY[mod].nazev) : "Volná kresba"}</div>${postava(p.av, "kresli", COL.x)}<div class="cedule">${esc(p.name)} kreslí</div></aside>`;
    const sideR = `<aside class="strana-p"><div class="bublina">${mod ? esc(MODY[mod].popis) : "Po Hotovo se kresba zakóduje, uloží a znovu načte."}</div>${postava(dr, "mysli", COL.o)}<div class="cedule">Kontrola</div></aside>`;
    $("view").innerHTML = `<div class="round">${desk ? sideL : ""}<div class="stred">${stitek}${platno}${bar}${tools}</div>${desk ? sideR : ""}</div>`;
    fitCanvas();
    bindDraw();
    const cv = $("cv"), ctx = cv.getContext("2d"); let lastW = 0;
    const frame = () => {
      if (Z.cur !== g || ui.key !== "solo:draw" || !$("cv")) return;
      const el = g.t0 ? Math.min(LIMIT * 1000, Date.now() - g.t0) : 0;
      if (g.dirty || cv.width !== lastW) {
        g.dirty = false; lastW = cv.width;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
        if (mod !== "poslepu") K.paint(ctx, g.rec.strokes, Infinity, { scale: cv.width / K.W, mirror: mod === "zrcadlo" });
      }
      tick(el / 1000, el / (LIMIT * 10));
      if (g.t0 && el >= LIMIT * 1000) { finishDraw(true); return; }
      Z.raf = requestAnimationFrame(frame);
    };
    Z.raf = requestAnimationFrame(frame);
  }
  function bindDraw() {
    const g = Z.cur, rec = g.rec, cv = $("cv"), kurzor = $("kurzor"), mod = g.mod;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * K.W, (e.clientY - r.top) / r.height * K.H]; };
    const showCur = (e, on) => { if (!kurzor) return; kurzor.hidden = !on; if (on) { const r = cv.getBoundingClientRect(); kurzor.style.left = (e.clientX - r.left) + "px"; kurzor.style.top = (e.clientY - r.top) + "px"; } };
    cv.addEventListener("pointerdown", e => {
      if (g.act !== null || e.button > 0) return;
      if (mod === "jedna" && rec.strokes.length) { toast("Jedna čára! Šipkou zpět ji smažeš a začneš znovu."); return; }
      e.preventDefault();
      if (!g.t0) { g.t0 = Date.now(); const pr = $("prazdne"); if (pr) pr.hidden = true; }
      g.act = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch {}
      const [x, y] = pos(e); rec.start(x, y, Date.now() - g.t0, g.col, g.size); g.dirty = true; showCur(e, true);
    });
    cv.addEventListener("pointermove", e => {
      if (e.pointerId !== g.act) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) { const [x, y] = pos(ev); if (rec.move(x, y, Date.now() - g.t0)) g.dirty = true; }
      showCur(e, true);
    });
    const up = e => { if (e.pointerId !== g.act) return; g.act = null; rec.end(); g.dirty = true; showCur(e, false); };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    $("barvy").addEventListener("click", e => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      g.col = +b.dataset.c; for (const el of $("barvy").children) el.classList.toggle("on", el === b);
    });
    const tl = $("bTl"), tlPaint = () => { tl.firstChild.style.height = [4, 8, 14][g.size] + "px"; };
    tlPaint();
    tl.addEventListener("click", () => { g.size = (g.size + 1) % 3; tlPaint(); });
    $("bUndo").addEventListener("click", () => { if (g.act !== null) return; rec.undo(); g.dirty = true; });
    $("bDone").addEventListener("click", () => finishDraw(false));
  }

  // zakódovat → uložit → načíst → dekódovat → porovnat
  function checkSave(g) {
    const orig = g.rec.strokes, kod = K.encode(orig);
    const r = { kod, bytes: kod.length, tahu: orig.length, bodu: K.pointCount(orig), dur: K.duration(orig), saved: false, loaded: false, same: false, err: "" };
    try { localStorage.setItem(KEY_KRESBA, JSON.stringify({ slovo: g.slovo, mod: g.mod, kod, t: Date.now() })); r.saved = true; } catch {}
    let back = kod;   // bez úložiště se ověří aspoň kódování v paměti
    if (r.saved) { try { back = JSON.parse(localStorage.getItem(KEY_KRESBA)).kod; r.loaded = typeof back === "string"; } catch { r.loaded = false; back = ""; } }
    if (hooks.fault) back = back.slice(0, -3);
    r.strokes = K.decode(back);
    r.same = r.loaded || !r.saved ? sameStrokes(orig, r.strokes) : false;
    if (!r.same) r.err = r.saved && !r.loaded
      ? "Uloženou kresbu se nepodařilo načíst zpět."
      : `Po načtení se kresba liší od nakreslené: ${r.strokes.length} z ${orig.length} tahů, ${K.pointCount(r.strokes)} z ${r.bodu} bodů.`;
    return r;
  }
  function finishDraw(auto) {
    const g = Z.cur; if (!g || g.mode !== "draw") return;
    if (g.act !== null) { g.rec.end(); g.act = null; }
    if (!g.rec.strokes.length) { if (!auto) toast("Nejdřív něco nakresli."); return; }
    g.res = checkSave(g);
    Z.last = { slovo: g.slovo, mod: g.mod, bytes: g.res.bytes, tahu: g.res.tahu, bodu: g.res.bodu, saved: g.res.saved, same: g.res.same, err: g.res.err };
    Z.kr++;
    viewPlay();
  }
  function kontroly(r) {
    const k = (ok, t, s) => `<div class="kontrola ${ok ? "ok" : "ne"}">${ok ? ICON.ok : ICON.ne}<span><b>${t}</b>${s ? `<small>${s}</small>` : ""}</span></div>`;
    return `<div class="kontroly" id="kontroly">${k(true, `Kód ${kB(r.bytes)} kB`, `${r.tahu} tahů · ${r.bodu} bodů · ${s1(r.dur)} s`)}
      ${k(r.saved, r.saved ? "Uloženo" : "Neuloženo", r.saved ? "v úložišti prohlížeče" : "úložiště prohlížeče nejde použít")}
      ${k(r.same, r.same ? "Shoduje se" : "Neshoduje se", r.same ? "načtená kresba je stejná" : "načtená kresba je jiná")}</div>
      ${r.err ? `<div class="chyba" id="chyba">${esc(r.err)}</div>` : ""}`;
  }
  function viewPlay() {
    const g = Z.cur, r = g.res, mod = g.mod, desk = DESK.matches, p = me(), t0 = Date.now();
    enter("play", viewPlay);
    top("Nakresleno", Z.kr, r.same ? "radost" : "au");
    const stitek = `<div class="stitek"><div><small>Přehrání z uloženého kódu</small><div class="slovo">${esc(g.slovo)}</div></div><div class="vpravo"><button class="btn-line" id="bZnovu">Znovu</button></div></div>`;
    const platno = `<div class="plocha" id="plocha"><div class="platno" id="platno"><canvas id="cv"></canvas>${mod === "zrcadlo" ? `<div class="osa"></div>` : ""}${modChip(mod)}</div></div>`;
    const bar = `<div class="sazka" id="sazka"><div class="popis"><span>Přehrávám v původním tempu</span><span><b id="pT">0,0 s</b></span></div><div class="drah"><div class="ubehlo" id="ubehlo" style="width:0"></div><div class="jehla" id="jehla" style="left:0"></div></div></div>`;
    const akce = `<button class="btn" id="bDalsi">Nakreslit další</button><button class="odkazbtn" id="bVyzvat">Vyzvat soupeře</button>`;
    const dr = AVATARY.filter(a => a !== p.av)[0];
    const sideL = `<aside class="strana-l"><div class="bublina">${r.same ? "Kresba přežila uložení beze změny." : "Po uložení se kresba změnila."}</div>${postava(p.av, r.same ? "radost" : "au", COL.x)}<div class="cedule">${esc(p.name)}</div></aside>`;
    const sideR = `<aside class="strana-p">${kontroly(r)}${postava(dr, r.same ? "radost" : "sok", COL.o)}<div class="cedule">Kontrola</div></aside>`;
    $("view").innerHTML = `<div class="round">${desk ? sideL : ""}<div class="stred">${stitek}${platno}${bar}${desk ? "" : kontroly(r)}${akce}</div>${desk ? sideR : ""}</div>`;
    fitCanvas();
    const cv = $("cv"), ctx = cv.getContext("2d");
    let start = t0, lastW = 0, lastVis = -1;
    $("bZnovu").addEventListener("click", () => { start = Date.now(); lastVis = -1; });
    $("bDalsi").addEventListener("click", startDraw);
    $("bVyzvat").addEventListener("click", toSetup);
    const dur = Math.max(r.dur, 1);
    const frame = () => {
      if (Z.cur !== g || ui.key !== "solo:play" || !$("cv")) return;
      const el = Math.min(dur, Date.now() - start);
      const vis = visibleCount(r.strokes, el);
      if (vis !== lastVis || cv.width !== lastW) {
        lastVis = vis; lastW = cv.width;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
        K.paint(ctx, r.strokes, el, { scale: cv.width / K.W, mirror: mod === "zrcadlo" });
      }
      const pt = $("pT"); if (pt) pt.textContent = `${s1(el)} / ${s1(dur)} s`;
      tick(el / 1000, el / dur * 100);
      Z.raf = requestAnimationFrame(frame);
    };
    Z.raf = requestAnimationFrame(frame);
  }

  DESK.addEventListener("change", () => { if (/^solo:(guess|draw|play|reveal)$/.test(ui.key) && Z.render) Z.render(); });

  return {
    menu,
    hooks,
    test: {
      word: () => Z.cur ? (Z.cur.u ? Z.cur.u.slovo : Z.cur.slovo) : "",
      info: () => ({ view: ui.key, mod: Z.cur ? (Z.cur.u ? Z.cur.u.mod : Z.cur.mod) : "", used: Z.used.length, total: UKAZKY.length, uh: Z.uh, kr: Z.kr, last: Z.last }),
    },
  };
}
