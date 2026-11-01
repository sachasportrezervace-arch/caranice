// Čáranice – kreslení a hádání pro dva na jednom odkazu.
// Stav hry = meta + dokumenty hráčů x/o + kresby d<k> (viz net.js). Pravidla v hra.js, kresba v kresba.js.

import * as Net from "./net.js";
import * as K from "./kresba.js";
import * as R from "./hra.js";
import { porovnej, pismena } from "./shoda.js";
import { OBTIZNOSTI, MYDVA } from "./slova.js";
import { hlava, postava, AVATARY } from "./postavicky.js";
import { createSolo } from "./solo.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COL = { x: "#FF6B4A", o: "#2BD4A4" };
const Q = new URLSearchParams(location.search);
const LIMIT = Math.max(15, Math.min(R.LIMIT, +Q.get("limit") || R.LIMIT));   // testy zkracují kolo
const BASE = location.origin + location.pathname + (Q.get("api") ? "?api=" + Q.get("api") : "");
const DESK = matchMedia("(min-width: 900px) and (min-height: 560px)");
const s1 = ms => (ms / 1000).toFixed(1).replace(".", ",");
const clampName = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 14);
const sameName = (a, b) => clampName(a).toLowerCase() === clampName(b).toLowerCase();
const OBT = Object.fromEntries(OBTIZNOSTI.map(o => [o.id, o]));

// ---------- ikonky ----------
const ICON = {
  zpet: `<svg viewBox="0 0 24 24"><path d="M9 6 4 11l5 5M4 11h10a5 5 0 0 1 0 10h-3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  vlajka: `<svg viewBox="0 0 24 24"><path d="M6 21V4m0 1h11l-2 4 2 4H6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plocha: `<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ok: `<svg viewBox="0 0 16 16"><path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ne: `<svg viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  srdce: `<svg class="srdce" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.5S2 12.6 2 7.3A4.3 4.3 0 0 1 10 5a4.3 4.3 0 0 1 8 2.3c0 5.3-8 10.2-8 10.2z" fill="currentColor"/></svg>`,
  dalsi: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 8A6 6 0 1 0 16 12M16 3.5V8h-4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hvezda: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 1.8 2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.3-4 5.8-.7z" fill="currentColor"/></svg>`,
  blesk: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 1.5 4 11.2h5l-1.3 7.3 7.8-10.1h-5z" fill="currentColor"/></svg>`,
  tuzka: `<svg class="pencil" viewBox="0 0 20 20"><path d="M3 17l1.2-4.2L13.5 3.5l3 3-9.3 9.3z" fill="#FFD23F"/><path d="M3 17l1.2-4.2 3 3z" fill="#17161F"/></svg>`,
  mod: {
    jedna: `<svg viewBox="0 0 16 16"><path d="M2 12c3-8 5 2 7-4s3-4 5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    barvy3: `<svg viewBox="0 0 16 16"><circle cx="5" cy="6" r="3" fill="currentColor"/><circle cx="11" cy="6" r="3" fill="currentColor" opacity=".7"/><circle cx="8" cy="11" r="3" fill="currentColor" opacity=".45"/></svg>`,
    zrcadlo: `<svg viewBox="0 0 16 16"><path d="M8 1v14M6 4 2 8l4 4zM10 4l4 4-4 4z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
    poslepu: `<svg viewBox="0 0 16 16"><path d="M1 8c3-4 11-4 14 0M2 3l12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
};

// stopky: výseč = okno sázky (když je vidět), ručička = uběhlý čas
function stopky(sec, bet) {
  const cx = 20, cy = 22, r = 16, a = s => (s / LIMIT) * Math.PI * 2 - Math.PI / 2;
  const pt = s => [cx + r * Math.cos(a(s)), cy + r * Math.sin(a(s))];
  let wedge = "";
  if (bet) {
    const [x1, y1] = pt(bet.b), [x2, y2] = pt(Math.min(LIMIT, bet.b + bet.bw));
    wedge = `<path d="M${cx} ${cy}L${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}z" fill="#FFD23F"/>`;
  }
  const [hx, hy] = pt(Math.min(sec, LIMIT)).map((v, i) => i ? cy + (v - cy) * .85 : cx + (v - cx) * .85);
  return `<svg viewBox="0 0 40 42" aria-hidden="true"><rect x="17" y="1" width="6" height="4" rx="2" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#fff"/>${wedge}
    <path d="M${cx} ${cy}L${hx.toFixed(1)} ${hy.toFixed(1)}" stroke="#17161F" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="2.6" fill="#17161F"/></svg>`;
}

// sázková lišta proti času
function sazkaHTML(o) {
  const pc = s => (Math.max(0, Math.min(LIMIT, s)) / LIMIT * 100).toFixed(2) + "%";
  const ticks = [0, LIMIT / 3, LIMIT * 2 / 3, LIMIT].map(v => `<span>${Math.round(v)}${v === LIMIT ? " s" : ""}</span>`).join("");
  const win = o.bet ? `<div class="okno${o.secret ? " tajne" : ""}" style="left:min(${pc(o.bet.b)}, calc(100% - 24px));width:calc(${pc(o.bet.b + o.bet.bw)} - ${pc(o.bet.b)})"></div>` : "";
  const to = o.hit !== undefined ? pc(o.hit == null ? LIMIT : o.hit / 1000) : "";
  const hit = o.hit !== undefined ? `<div class="zasah${o.hitOk ? " ok" : ""}" style="left:clamp(18px, ${to}, calc(100% - 18px))">${o.hit == null ? ICON.ne : ICON.ok}</div>` : "";
  return `<div class="sazka" id="sazka"><div class="popis"><span>${o.label || ""}</span><span>${o.right || ""}</span></div>
    <div class="drah${o.hitOk ? " trefa" : ""}"${to ? ` style="--to:${to}"` : ""}><div class="ubehlo" id="ubehlo" style="width:0"></div>${win}${o.needle ? `<div class="jehla" id="jehla" style="left:0"></div>` : ""}${hit}${o.slider || ""}</div>
    <div class="osa-s">${ticks}</div></div>`;
}
const okno = bet => `${bet.b}–${bet.b + bet.bw} s`;

// ---------- místnost ----------
let room = null;     // { id, meta, seat, w, docs: {x, o}, draws: {k: {st, fin, strokes}}, dw }
let ui = { key: "", partieSeen: 0, share: true, raf: 0 };
let S = null;        // poslední spočtený stav hry
const seatKey = id => "car-seat-" + id;
const nameOf = seat => room ? (seat === "x" ? room.meta.g.a : room.meta.g.b) || "soupeř" : "";
const avOf = seat => (room && room.meta.g.av && room.meta.g.av[seat]) || (seat === "x" ? "kluk" : "holka");
const mine = () => room && room.w ? room.w.doc() : null;
const docs = () => ({ x: room.seat === "x" && room.w ? room.w.doc() : room.docs.x, o: room.seat === "o" && room.w ? room.w.doc() : room.docs.o });
const seatDoc = () => ({ rdy: 1, h: {}, g: {}, t: Date.now() });
const word = (k, d = docs()) => { const h = d[R.drawerOf(k)] && d[R.drawerOf(k)].h[k]; return h ? R.odkryj(h.w, room.id) : ""; };

function toast(t, ms = 2600) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), ms); }
function setNet(t) { $("net").textContent = t || ""; }

async function createRoom(name, av) {
  const id = Net.randId(10);
  const meta = { app: "caranice", v: 1, sx: Net.device, so: "", g: { a: name, b: "", av: { x: av, o: "" } } };
  await Net.save(Net.metaUrl(id), meta);
  await Net.save(Net.seatUrl(id, "x"), seatDoc());
  Net.store.set(seatKey(id), "x");
  history.replaceState(null, "", location.pathname + location.search + "#r." + id);
  ui.share = true;
  await enterRoom(id, meta);
  decide();
}

async function openFromHash() {
  H = readHerna();
  if (H) { hernaStart(); return hernaOpen(); }
  if (location.hash === "#solo") { solo.menu(); return; }   // trénink: žádná místnost a žádná síť
  const m = /^#r\.([0-9a-z]{6,16})$/.exec(location.hash || "");
  if (!m) { viewSetup(); return; }
  if (!room) panel(`<h2>Otevírám Čáranici…</h2>`, "loading");
  let meta;
  try { meta = await Net.load(Net.metaUrl(m[1])); }
  catch { viewError("Spojení nevyšlo.", "Nedaří se dovolat ke hře. Zkouším to sám znovu.", true); clearTimeout(openFromHash.t); openFromHash.t = setTimeout(openFromHash, 4000); return; }
  if (!meta || meta.app !== "caranice") { viewError("Tahle hra neexistuje.", "Odkaz může být neúplný. Založ novou hru."); return; }
  ui.share = false;
  await enterRoom(m[1], meta);
  decide();
}
// ---------- Herna (protokol 1, react-apps/HERNA-PROTOKOL.md) ----------
// Běží jen s <meta name="herna-protokol"> a #herna=1&r=…: bez nich je všechno jako dřív (výzva, #solo, série).
// Místnost hry = r z adresy (dokument caranice-<r>), kdo je kdo a jak se jmenuje, ručí Herna (seat, names), žádná výzva ani introMine.
let H = null;                        // { r, m, seat, names: [seat0, seat1], zaklada } nebo null
const HP = { r: "", faze: "", poslano: new Set(), joining: false };
function readHerna() {
  if (!document.querySelector('meta[name="herna-protokol"]')) return null;
  const kv = {};
  for (const part of location.hash.slice(1).split("&")) { const i = part.indexOf("="); if (i > 0) kv[part.slice(0, i)] = part.slice(i + 1); }
  if (kv.herna !== "1" || !/^[0-9a-z]{6,16}$/.test(kv.r || "")) return null;
  const dec = t => { try { return decodeURIComponent(t); } catch { return t; } };
  const nm = (kv.names || "").split(",").map(t => String(dec(t)).replace(/\s+/g, " ").trim().slice(0, 16));
  return { r: kv.r, m: kv.m || "", seat: kv.seat === "1" ? 1 : 0, names: [nm[0] || "Hráč 1", nm[1] || "Hráč 2"], zaklada: kv.zaklada === "1" };
}
const doHerny = z => { if (H && window.parent !== window) { try { window.parent.postMessage({ herna: 1, ...z }, "*"); } catch {} } };
function hernaStart() {
  if (HP.r !== H.r) { HP.r = H.r; HP.faze = ""; HP.poslano = new Set(); HP.joining = false; }
  doHerny({ typ: "pripraveno" });
}
// fáze podle obrazovky: čeká se / běží partie / ukázaly se výsledky partie (tam se i hlásí výsledek, jednou na partii)
function hernaSync() {
  if (!H) return;
  const k = ui.key, m = /^(\w+):(\d+)$/.exec(k);
  const faze = m && m[1] === "partie" ? "konec" : m && /^(pick|wait|draw|guess|watch|reveal)$/.test(m[1]) ? "hraje" : "ceka";
  if (faze !== HP.faze) { HP.faze = faze; doHerny({ typ: "stav", faze }); }
  if (faze === "konec" && room && room.seat && S) {
    const p = R.partieOf(+m[2]), key = H.r + ":" + p;
    if (HP.poslano.has(key)) return;
    HP.poslano.add(key);
    const sc = partieScore(p), win = sc.x > sc.o ? "x" : sc.o > sc.x ? "o" : "";
    doHerny({ typ: "vysledek", partie: key, vitez: win ? (win === room.seat ? H.seat : 1 - H.seat) : null });
  }
}
function hernaPanel(key, html, cls = "") { ui.key = key; panel(html, cls); hernaSync(); }
function viewHernaWait() {
  const x = room && room.seat === "x";
  panel(`<div class="dvojice">${postava((room && room.meta.g.av.x) || Net.store.get("car-av") || "kluk", "mysli", COL.x)}</div>
    <h2>${x ? `Čeká se, až se připojí ${esc(H.names[1 - H.seat])}` : "Čeká se, až hra naskočí"}</h2><p>${x ? "Hra naskočí sama." : "Hned to bude."}</p>`);
}
async function hernaOpen() {
  const my = H, id = my.r;
  const again = ms => { clearTimeout(hernaOpen.t); hernaOpen.t = setTimeout(() => { if (H === my) hernaOpen(); }, ms); };
  if (!room) hernaPanel("herna-otevira", my.zaklada ? `<h2>Otevírám Čáranici…</h2>` : `<h2>Čeká se, až hra naskočí</h2><p>Hned to bude.</p>`, "loading");
  let meta;
  try { meta = await Net.load(Net.metaUrl(id)); } catch { again(2000); return; }
  if (H !== my) return;
  if (!meta && my.zaklada) {
    // zakladatel založí dokument rovnou se jmény; začíná jako x (v ostré hře také vždy ten, kdo vyzývá)
    const av = Net.store.get("car-av") || "kluk";
    meta = { app: "caranice", v: 1, sx: Net.device, so: "", g: { a: my.names[my.seat], b: my.names[1 - my.seat], av: { x: av, o: "" } } };
    try { await Net.save(Net.metaUrl(id), meta); await Net.save(Net.seatUrl(id, "x"), seatDoc()); Net.store.set(seatKey(id), "x"); }
    catch { again(2000); return; }
  }
  if (H !== my) return;
  if (!meta) { again(1100); return; }
  if (meta.app !== "caranice") { viewError("Tahle hra neexistuje.", "Zkus ji v Herně vybrat znovu."); return; }
  ui.share = false;
  await enterRoom(id, meta);
  decide();
}
// pozvaný se posadí na volné místo (stejný zápis jako „Přijmout výzvu“, jen bez tlačítka), jméno dává Herna
async function hernaJoin() {
  if (!H || !room || room.seat || room.meta.so || HP.joining) return;
  const my = H, rm = room, name = my.names[my.seat], xav = rm.meta.g.av.x;
  const pref = Net.store.get("car-av") || "holka", av = pref === xav ? (xav === "holka" ? "kluk" : "holka") : pref;
  HP.joining = true;
  try {
    const r = await Net.commitMeta(rm.id, d => d && !d.so && d.sx !== Net.device ? { ...d, so: Net.device, g: { ...d.g, b: name, av: { ...d.g.av, o: av } } } : null);
    if (H !== my || room !== rm) return;
    rm.meta = r.d || rm.meta;
    if (r.ok) { rm.seat = "o"; await Net.save(Net.seatUrl(rm.id, "o"), seatDoc()); rm.docs.o = seatDoc(); attachSeat(); ui.key = ""; }
  } catch { setTimeout(() => { HP.joining = false; hernaJoin(); }, 1500); return; }
  HP.joining = false;
  if (H === my && room === rm) decide();
}
async function enterRoom(id, meta) {
  stopPoll();
  let seat = Net.store.get(seatKey(id));
  if (meta.sx === Net.device) seat = "x"; else if (meta.so === Net.device) seat = "o";
  else if (seat && meta["s" + seat] !== Net.device) seat = null;
  room = { id, meta, seat, w: null, docs: { x: null, o: null }, draws: {}, dw: null };
  try {
    const [x, o] = await Promise.all([Net.load(Net.seatUrl(id, "x")), meta.so ? Net.load(Net.seatUrl(id, "o")) : null]);
    room.docs = { x, o };
  } catch {}
  if (seat) attachSeat();
  startPoll();
}
function attachSeat() {
  const doc = room.docs[room.seat];
  room.w = Net.writer(Net.seatUrl(room.id, room.seat), doc || seatDoc());
  room.w.onNet = setNet;
  if (!doc) room.w.set({}, true);
  Net.store.set(seatKey(room.id), room.seat);
}
async function accept(name, av) {
  if (!name) { $("fName").focus(); toast("Napiš svoje jméno."); return; }
  if (sameName(name, room.meta.g.a)) { toast(`Výzva je od jména ${room.meta.g.a}. Jsi to ty? Klepni na „Jsem ${room.meta.g.a}“.`, 4200); $("bAsX").hidden = false; return; }
  Net.store.set("car-name", name); Net.store.set("car-av", av);
  const b = $("bAccept"); b.disabled = true; b.textContent = "Přijímám…";
  try {
    const r = await Net.commitMeta(room.id, d => d && !d.so ? { ...d, so: Net.device, g: { ...d.g, b: name, av: { ...d.g.av, o: av } } } : null);
    if (!r.ok) { toast("Výzvu už mezitím přijal někdo jiný."); room.meta = r.d || room.meta; decide(); return; }
    room.meta = r.d; room.seat = "o";
    await Net.save(Net.seatUrl(room.id, "o"), seatDoc());
    room.docs.o = seatDoc();
    attachSeat(); decide();
  } catch { b.disabled = false; b.textContent = "Přijmout výzvu"; toast("Spojení nevyšlo, zkus to znovu."); }
}
async function takeSeat(seat) {
  try {
    const r = await Net.commitMeta(room.id, d => d ? { ...d, ["s" + seat]: Net.device } : null);
    room.meta = r.d; room.seat = seat;
    room.docs[seat] = await Net.load(Net.seatUrl(room.id, seat));
    attachSeat(); ui.key = ""; decide();
  } catch { toast("Spojení nevyšlo, zkus to znovu."); }
}

// ---------- polling ----------
let pollT = null, pollSeq = 0, fails = 0, lastMeta = 0;
function stopPoll() { clearTimeout(pollT); pollSeq++; }
function startPoll() { stopPoll(); poll(); }
function pollPlan() {
  if (!room) return null;
  const live = /^(draw|guess|watch|spect)/.test(ui.key);
  return { ms: live ? 450 : 1100, meta: !room.seat || !room.meta.so || Date.now() - lastMeta > 5000 };
}
async function poll() {
  clearTimeout(pollT);
  const plan = pollPlan();
  if (!plan || document.hidden) return;
  const seq = ++pollSeq, id = room.id;
  try {
    const want = [];
    if (plan.meta) want.push(["meta", Net.metaUrl(id)]);
    for (const s of ["x", "o"]) if (s !== room.seat && (s === "x" || room.meta.so)) want.push([s, Net.seatUrl(id, s)]);
    const dk = drawToFetch();
    if (dk) want.push(["d", Net.drawUrl(id, dk)]);
    const got = await Promise.all(want.map(([, u]) => Net.load(u)));
    if (!room || room.id !== id || seq !== pollSeq) return;
    fails = 0; setNet("");
    want.forEach(([n], i) => {
      const v = got[i];
      if (n === "meta") { if (v) room.meta = v; lastMeta = Date.now(); }
      else if (n === "d") { if (v) gotDraw(dk, v); }
      else if (v) room.docs[n] = v;
    });
    decide();
  } catch { fails++; if (fails >= 3) setNet("Spojení vázne, zkouším to znovu…"); }
  if (seq === pollSeq) pollT = setTimeout(poll, fails ? Math.min(5000, plan.ms * 2 ** Math.min(fails, 3)) : plan.ms);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && room) startPoll(); });
addEventListener("online", () => room && startPoll());

// kterou kresbu číst: rozehrané kolo, které nekreslím já (hádač, divák, odhalení bez načtené kresby)
function drawToFetch() {
  if (!S) return 0;
  const k = ui.k || S.k;
  const c = room.draws[k];
  if (c && c.fin && c.done) return 0;
  if (room.seat && R.drawerOf(k) === room.seat && room.dw && room.dw.k === k) return 0;
  const d = docs(), h = d[R.drawerOf(k)] && d[R.drawerOf(k)].h[k];
  return h ? k : 0;
}
function gotDraw(k, v) {
  const c = room.draws[k] || (room.draws[k] = { st: null });
  if (c.st !== v.st) { c.st = v.st; c.strokes = K.decode(v.st); c.dirty = true; }
  c.fin = v.fin || 0;
  if (c.fin && S && S.results[k]) c.done = true;
}
async function loadDraw(k) {
  if (rec && rec.k === k && room.dw && room.dw.k === k) return { strokes: rec.strokes };
  const c = room.draws[k];
  if (c && c.fin) return c;
  try { const v = await Net.load(Net.drawUrl(room.id, k)); if (v) gotDraw(k, v); } catch {}
  return room.draws[k] || { strokes: [] };
}

// ---------- rozhodnutí, co ukázat ----------
function decide() {
  if (!room) return;
  S = R.state(room.id, docs());
  const meta = room.meta;
  if (H && !room.seat && !meta.so) { hernaJoin(); return show("herna-wait", viewHernaWait); }
  if (!room.seat) {
    if (!meta.so) return show("intro", viewIntro);
    return spectate();
  }
  if (H && !meta.so) return show("herna-wait", viewHernaWait);
  if (!meta.so && ui.share && !(mine().h[1] && mine().h[1].t)) return show("share", viewShare);
  let cur = Math.min(mine().rdy || 1, S.k);
  ui.k = cur;
  const res = S.results[cur];
  if (res) {
    if (R.indexInPartie(cur) === R.KOL && ui.partieSeen === cur) return show("partie:" + cur, () => viewPartie(R.partieOf(cur)));
    return show("reveal:" + cur, () => viewReveal(cur));
  }
  const dr = R.drawerOf(cur), d = docs(), h = d[dr] && d[dr].h[cur];
  if (dr === room.seat) {
    if (!h) return show("pick:" + cur, () => viewPick(cur));
    if (!h.fin && Date.now() - h.t < LIMIT * 1000 + 1500) return show("draw:" + cur, () => viewRound(cur, "draw"));
    if (!h.fin) finishDraw(cur);
    return show("watch:" + cur, () => viewRound(cur, "watch"));
  }
  if (!h) return show("wait:" + cur, () => viewWait(cur));
  const g = mine().g[cur];
  if (!g) { setMine({ g: { ...mine().g, [cur]: { s: Date.now(), tips: [] } } }, true); }
  return show("guess:" + cur, () => viewRound(cur, "guess"));
}
function spectate() {
  const k = S.k, d = docs(), h = d[R.drawerOf(k)] && d[R.drawerOf(k)].h[k];
  if (h) { ui.k = k; return show("spect:" + k, () => viewRound(k, "spect")); }
  if (k > 1) { ui.k = k - 1; return show("spectrev:" + (k - 1), () => viewReveal(k - 1, true)); }
  ui.k = k;
  return show("spectwait", () => panel(`<div class="dvojice">${postava(avOf("x"), "mysli", COL.x)}${postava(avOf("o"), "mysli", COL.o)}</div>
    <h2>${esc(nameOf("x"))} a ${esc(nameOf("o"))} se chystají</h2><p>Zatím sleduješ zvenku. Kresba se tu objeví živě.</p>${seatButtons()}`));
}
function show(key, fn) {
  if (ui.key === key) { update(); return; }
  ui.key = key; cancelAnimationFrame(ui.raf);
  $("lupa")?.remove();
  document.body.classList.toggle("odhal", /^(reveal|spectrev)/.test(key));
  fn();
  update();
  hernaSync();
}
function setMine(patch, urgent) { room.w.set(patch, urgent); }

// ---------- hlavička ----------
function renderTop(mode) {
  const top = $("top");
  if (!room || !room.meta.so || mode === "none") { top.hidden = true; return; }
  top.hidden = false;
  const k = ui.k, res = S.results[k];
  const sc = R.partieOf(k) === S.p ? S.score : partieScore(R.partieOf(k));
  const dr = R.drawerOf(k);
  const face = seat => {
    if (res) return res.inWin ? "radost" : res.hit != null ? (seat === res.gs ? "radost" : "au") : (seat === res.gs ? "au" : "sok");
    return /^(draw|guess|watch|spect)/.test(ui.key) ? (seat === dr ? "kresli" : "mysli") : "klid";
  };
  const side = seat => `<div class="hrac ${seat}">${hlava(avOf(seat), face(seat))}<div><div class="jm">${esc(nameOf(seat))}${seat === room.seat ? "" : ""}</div>
    <div class="sk" id="sk-${seat}">${sc[seat]}${res && res.pts[seat] ? `<span class="plus">+${res.pts[seat]}</span>` : ""}</div></div>${!res && seat === dr && /^(draw|guess|watch|spect)/.test(ui.key) ? ICON.tuzka : ""}</div>`;
  top.innerHTML = side("x") + `<div class="mid"><div class="kolo">Kolo ${R.indexInPartie(k)} / ${R.KOL}</div><div class="stopky" id="stopky"></div></div>` + side("o");
}
function partieScore(p) {
  const s = { x: 0, o: 0 };
  for (let i = R.firstOf(p); i < R.firstOf(p) + R.KOL; i++) { const r = S.results[i]; if (r) { s.x += r.pts.x; s.o += r.pts.o; } }
  return s;
}

// ---------- obrazovky mimo kolo ----------
function panel(html, cls = "") {
  renderTop("none");
  $("view").innerHTML = `<div class="panel ${cls}">${html}</div>`;
}
const cornerBtn = () => `<div class="roh"><button class="ik" id="bFull" aria-label="Na celou obrazovku">${ICON.plocha}</button></div>`;
function bindCorner() {
  const b = $("bFull"); if (!b) return;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) { b.parentNode.remove(); return; }
  b.addEventListener("click", () => {
    if (ios || !document.documentElement.requestFullscreen) toast("Na iPhonu: Sdílet → Přidat na plochu. Hra pak běží přes celou obrazovku.", 5000);
    else if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
  });
}
function avatarPicker(sel) {
  return `<div class="avatary" id="avatary">${AVATARY.map(a => `<button class="avatar${a === sel ? " on" : ""}" data-av="${a}" aria-label="${a}">${hlava(a, a === sel ? "radost" : "klid")}</button>`).join("")}</div>`;
}
function bindAvatars(onPick) {
  $("avatary").addEventListener("click", e => {
    const b = e.target.closest("[data-av]"); if (!b) return;
    for (const el of $("avatary").children) { const on = el === b; el.classList.toggle("on", on); el.innerHTML = hlava(el.dataset.av, on ? "radost" : "klid"); }
    onPick(b.dataset.av);
  });
}
const pravidla = `<ol class="pravidla">
  <li><b class="n">1</b><span>Jeden kreslí slovo, druhý hádá. Každá čára se ukazuje živě.</span></li>
  <li><b class="n">2</b><span>Kreslíř si předem vsadí, za kolik vteřin to druhý uhodne.</span></li>
  <li><b class="n">3</b><span>Trefa do okna = body pro oba. Někdy se vyplatí kreslit škaredě.</span></li></ol>`;

function viewSetup() {
  renderTop("none"); ui.key = "setup";
  let av = Net.store.get("car-av") || "kluk";
  $("view").innerHTML = cornerBtn() + `<div class="panel dva setup"><div class="lev"><h1 class="logo"><span>Čáranice</span></h1>${pravidla}</div>
    <div class="prav"><div class="nahled" id="nahled">${postava(av, "radost", COL.x)}</div><div class="forma">
    <div class="pole"><label for="fName">Tvoje jméno</label><input id="fName" maxlength="14" autocomplete="nickname" value="${esc(Net.store.get("car-name") || "")}" placeholder="třeba Mark">
    ${avatarPicker(av)}</div>
    <button class="btn" id="bCreate">Vyzvat soupeře</button><button class="odkazbtn" id="bSolo">Zkusit sám</button></div></div></div>`;
  $("bSolo").addEventListener("click", () => { location.hash = "solo"; });
  bindCorner(); bindAvatars(a => { av = a; $("nahled").innerHTML = postava(a, "radost", COL.x); });
  $("bCreate").addEventListener("click", async () => {
    const name = clampName($("fName").value);
    if (!name) { $("fName").focus(); toast("Napiš svoje jméno, ať soupeř ví, kdo ho vyzývá."); return; }
    Net.store.set("car-name", name); Net.store.set("car-av", av);
    $("bCreate").disabled = true; $("bCreate").textContent = "Zakládám…";
    try { await createRoom(name, av); } catch { $("bCreate").disabled = false; $("bCreate").textContent = "Vyzvat soupeře"; toast("Spojení nevyšlo, zkus to znovu."); }
  });
}
const linkFor = () => BASE + "#r." + room.id;
function viewShare() {
  renderTop("none");
  $("view").innerHTML = cornerBtn() + `<div class="panel dva share"><div class="lev"><h1 class="logo"><span>Čáranice</span></h1>${pravidla}</div>
    <div class="prav"><div class="kop"><div class="dvojice">${postava(avOf("x"), "radost", COL.x)}</div>
    <h2>Pošli odkaz soupeři</h2><p>Kdo ho otevře, hraje proti tobě. Další lidé se můžou jen dívat.</p></div>
    <div class="odkaz" id="link">${esc(linkFor())}</div>
    <div class="akce">${navigator.share ? `<button class="btn" id="bShare">Poslat odkaz</button>` : ""}<button class="btn ${navigator.share ? "alt" : ""}" id="bCopy">Zkopírovat</button></div>
    <p class="male">Nemusíte být online zároveň. Můžeš rovnou nakreslit první obrázek a soupeři se přehraje ve stejném tempu.</p>
    <button class="odkazbtn" id="bStart">Nakreslit první obrázek</button></div></div>`;
  bindCorner();
  $("bShare")?.addEventListener("click", () => navigator.share({ title: "Čáranice", text: `${nameOf("x")} tě vyzývá na Čáranici`, url: linkFor() }).catch(() => {}));
  $("bCopy").addEventListener("click", () => navigator.clipboard.writeText(linkFor()).then(() => toast("Odkaz je zkopírovaný."), () => toast("Zkopíruj odkaz ručně.")));
  $("bStart").addEventListener("click", () => { ui.share = false; ui.key = ""; decide(); });
}
function viewIntro() {
  const g = room.meta.g;
  let av = Net.store.get("car-av") || (g.av.x === "holka" ? "kluk" : "holka");
  const pre = Net.store.get("car-name") || "";
  panel(`<div class="lev"><h1 class="logo"><span>Čáranice</span></h1>${pravidla}</div>
    <div class="prav"><div class="kop"><div class="dvojice">${postava(g.av.x, "radost", COL.x)}</div><h2>${esc(g.a)} tě vyzývá na Čáranici</h2></div><div class="forma">
    <div class="pole"><label for="fName">Tvoje jméno</label><input id="fName" maxlength="14" autocomplete="nickname" value="${esc(sameName(pre, g.a) ? "" : pre)}" placeholder="třeba Radka">${avatarPicker(av)}</div>
    <button class="btn" id="bAccept">Přijmout výzvu</button><button class="odkazbtn" id="bAsX" hidden>Jsem ${esc(g.a)}</button></div></div>`, "dva intro");
  bindAvatars(a => av = a);
  $("bAccept").addEventListener("click", () => accept(clampName($("fName").value), av));
  $("bAsX").addEventListener("click", () => takeSeat("x"));
}
const seatButtons = () => `<p class="male">Hraješ na jiném zařízení? <button class="odkazbtn" data-seat="x">Jsem ${esc(nameOf("x"))}</button> <button class="odkazbtn" data-seat="o">Jsem ${esc(nameOf("o"))}</button></p>`;
document.addEventListener("click", e => { const b = e.target.closest("[data-seat]"); if (b && room && !room.seat) takeSeat(b.dataset.seat); });
function viewError(t, text, retry) {
  room = null; stopPoll(); ui.key = "error";
  panel(`<h2>${esc(t)}</h2><p>${esc(text)}</p>${retry || H ? "" : `<button class="btn" id="bNew">Založit novou hru</button>`}`);
  hernaSync();
  $("bNew")?.addEventListener("click", () => { history.replaceState(null, "", location.pathname + location.search); viewSetup(); });
}
function viewWait(k) {
  const dr = R.drawerOf(k);
  renderTop();
  $("view").innerHTML = `<div class="panel"><div class="dvojice">${postava(avOf(dr), "mysli", COL[dr])}</div>
    <h2>${esc(nameOf(dr))} vybírá slovo a sází</h2><p>Až začne kreslit, uvidíš každou čáru. Hodiny ti poběží od první chvíle, kdy kresbu uvidíš.</p></div>`;
}

// ---------- výběr slova a sázka ----------
function viewPick(k) {
  renderTop();
  const mod = R.modOf(room.id, k), opp = R.other(room.seat), help = R.comeback(room.seat, S.score);
  const bw = help ? R.OKNO_DOTAH : R.OKNO;
  const ch = R.wordChoices(room.id, k, docs());
  let pick = null, b = Math.min(20, LIMIT - bw);
  // My dva: otázky v náhodném pořadí, šipkou další; poslední použitá otázka v místnosti jde na konec
  const used = new Set(Object.values(docs()).flatMap(d => Object.values((d && d.h) || {}).map(x => x && x.q)).filter(Boolean));
  const otazky = [...MYDVA.filter(q => !used.has(q)).sort(() => Math.random() - .5), ...MYDVA.filter(q => used.has(q))];
  let qi = 0;
  const mods = mod ? `<div class="modinfo">${ICON.mod[mod]}<div><b>${R.MODY[mod].nazev}</b>${R.MODY[mod].popis}</div></div>` : "";
  $("view").innerHTML = `<div class="vyber"><h2>Co nakreslíš?</h2>${mods}
    <div class="karty" id="karty">${ch.map((c, i) => `<button class="karta" data-i="${i}"><span class="slovo">${esc(c.slovo)}</span><small>${OBT[c.obt].nazev}<br>+${R.guessPoints(c.obt)} za uhodnutí</small></button>`).join("")}
      <div class="karta mydva" data-i="v"><div class="md-hlava">${ICON.srdce}<b>My dva</b><small>+${R.guessPoints("stredni")} za uhodnutí</small></div>
        <div class="md-otazka"><span id="otazka">${esc(otazky[0])}</span><button type="button" class="md-jina" id="bOtazka" aria-label="Jiná otázka">${ICON.dalsi}</button></div>
        <input id="fVlastni" maxlength="24" placeholder="Tvoje odpověď, ${esc(nameOf(opp))} ji neuvidí" enterkeyhint="go" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Odpověď, kterou nakreslíš"></div></div>
    ${sazkaHTML({ bet: { b, bw }, label: `Vsaď si: ${esc(nameOf(opp))} to uhodne za`, right: `<b id="betTxt">${okno({ b, bw })}</b>`, slider: `<input type="range" id="fBet" min="0" max="${LIMIT - bw}" step="5" value="${b}" aria-label="Začátek okna sázky">` })}
    <div class="betinfo"><span id="betHint">${betHint(b)}</span><span>Trefa okna: <b>+${R.BONUS_OKNO} oběma</b></span></div>
    ${help ? `<div class="pomoc">Prohráváš o ${R.DOTAH}+ body: tvoje okno je širší (${bw} s)</div>` : ""}
    <button class="btn" id="bGo" disabled>Kreslit!</button></div>`;
  const karty = $("karty"), fv = $("fVlastni"), go = $("bGo"), md = karty.querySelector(".mydva");
  const mark = el => { for (const c of karty.children) c.classList.toggle("on", c === el); };
  const vlastni = () => { pick = { slovo: clampWord(fv.value), obt: "stredni", vl: 1, q: otazky[qi % otazky.length] }; go.disabled = !pick.slovo; };
  karty.addEventListener("click", e => {
    const c = e.target.closest(".karta"); if (!c) return;
    mark(c);
    if (c.dataset.i === "v") { vlastni(); if (!e.target.closest("#bOtazka") && e.target !== fv) fv.focus(); }
    else { pick = { ...ch[+c.dataset.i] }; go.disabled = !pick.slovo; }
  });
  $("bOtazka").addEventListener("click", () => { qi++; $("otazka").textContent = otazky[qi % otazky.length]; vlastni(); });
  fv.addEventListener("input", () => { mark(md); vlastni(); });
  // klávesnice na mobilu: karta zůstane vidět a Enter rovnou začne kreslit
  fv.addEventListener("focus", () => { mark(md); vlastni(); setTimeout(() => md.scrollIntoView({ block: "center", behavior: "smooth" }), 350); });
  fv.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (!go.disabled) { fv.blur(); go.click(); } } });
  const okn = karty.parentNode.querySelector(".okno");
  $("fBet").addEventListener("input", e => {
    b = +e.target.value;
    okn.style.left = (b / LIMIT * 100) + "%";
    $("betTxt").textContent = okno({ b, bw });
    $("betHint").textContent = betHint(b);
  });
  go.addEventListener("click", () => {
    if (!pick || !pick.slovo) return;
    if (pick.vl && R.usedWords(room.id, docs()).has(pick.slovo)) { toast("Tohle slovo už v sérii bylo. Vymysli jiné."); return; }
    const h = { w: R.skryj(pick.slovo, room.id), o: pick.obt, b, bw, m: mod, t: Date.now(), ...(pick.vl ? { vl: 1, q: pick.q } : {}) };
    startDrawWriter(k, "");
    setMine({ h: { ...mine().h, [k]: h } }, true);
    decide();
  });
}
const clampWord = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 24);
// co sázka znamená: rychlá poznávačka, nebo schválně pomalá kresba
const betHint = b => b < 10 ? "Pozná to hned" : b < 25 ? "Chvilku to potrvá" : b < 45 ? "Bude to dřina" : "Schválně škaredě";

// ---------- kolo: kreslení, hádání, sledování ----------
let rec = null, act = null;   // záznam tahů kreslíře, aktivní ukazatel
function startDrawWriter(k, st) {
  room.dw = Net.writer(Net.drawUrl(room.id, k), { k, st, fin: 0 }, 400);
  room.dw.k = k; room.dw.onNet = setNet;
  room.dw.set({}, true);
}
async function ensureRecorder(k) {
  if (rec && rec.k === k) return;
  rec = K.recorder(); rec.k = k;
  if (!room.dw || room.dw.k !== k) {
    let v = null;
    try { v = await Net.load(Net.drawUrl(room.id, k)); } catch {}
    for (const s of K.decode(v && v.st)) rec.strokes.push(s);
    startDrawWriter(k, v ? v.st : "");
  } else for (const s of K.decode(room.dw.doc().st)) rec.strokes.push(s);
  rdirty = true;
}
function finishDraw(k) {
  const d = mine(), h = d.h[k];
  if (!h || h.fin) return;
  if (act !== null) { rec && rec.end(); act = null; }
  const fin = Math.max(1, Math.min(LIMIT * 1000, Date.now() - h.t));
  if (room.dw && room.dw.k === k) room.dw.set({ st: rec && rec.k === k ? K.encode(rec.strokes) : room.dw.doc().st, fin }, true);
  setMine({ h: { ...d.h, [k]: { ...h, fin } } }, true);
}

let rdirty = true, lastVis = -1;
function viewRound(k, mode) {
  renderTop();
  const dr = R.drawerOf(k), gs = R.other(dr), d = docs(), h = d[dr].h[k];
  const mod = h.m || "", bet = { b: h.b, bw: h.bw || R.OKNO };
  const pal = mod === "barvy3" ? R.triBarvy(room.id, k) : K.BARVY.map((_, i) => i);
  const wd = word(k, d), me = room.seat;
  const desk = DESK.matches;
  const help = mode === "guess" && R.comeback(me, S.score);
  // štítek (u My dva otázka místo popisku, hádač ji vidí jako nápovědu)
  const q = h.q ? `<small class="q">${ICON.srdce}${esc(h.q)}?</small>` : "";
  let stitek;
  if (mode === "draw") stitek = `<div class="stitek${q ? " mydva" : ""}"><div>${q || `<small>Kreslíš</small>`}<div class="slovo">${esc(wd)}</div></div><div class="vpravo"><button class="btn-hotovo" id="bDone">Hotovo</button></div></div>`;
  else if (mode === "watch") stitek = `<div class="stitek${q ? " mydva" : ""}"><div>${q || `<small>Hádá ${esc(nameOf(gs))}</small>`}<div class="slovo">${esc(wd)}</div></div></div>`;
  else if (mode === "spect") stitek = `<div class="stitek${q ? " mydva" : ""}"><div>${q || `<small>${esc(nameOf(dr))} kreslí, ${esc(nameOf(gs))} hádá</small>`}<div class="slovo">${esc(wd)}</div></div></div>`;
  else stitek = `<div class="stitek${q ? " mydva" : ""}"><div>${q || `<small>Hádej, co kreslí ${esc(nameOf(dr))}</small>`}<div class="pismena" id="pismena"></div></div>
    <div class="vpravo">${help ? `<span class="pomoc">První písmeno zdarma</span>` : `<button class="btn-line" id="bNap">Kolik písmen?</button>`}</div></div>`;
  const modChip = mod ? `<div class="mod">${ICON.mod[mod]}${R.MODY[mod].nazev}</div>` : "";
  const platno = `<div class="plocha" id="plocha"><div class="platno" id="platno"><canvas id="cv"></canvas>${mod === "zrcadlo" ? `<div class="osa"></div>` : ""}${modChip}${mode === "draw" && !desk ? `<div class="tipy nad" id="tipy"></div>` : ""}
    ${mode === "draw" && mod === "poslepu" ? `<div class="slepe">Kreslíš poslepu.<br>Kresbu uvidíš na konci kola.</div><div class="kurzor" id="kurzor" hidden></div>` : ""}<div class="prazdne" id="prazdne" hidden></div></div></div>`;
  const secret = mode === "guess";
  const bar = sazkaHTML({ bet, secret, needle: true, label: secret ? `Sázka je tajná, hodiny běží` : mode === "draw" ? "Tvoje sázka" : `Sázka: ${esc(nameOf(dr))}`,
    right: secret ? `<b>?</b>` : `<b>${okno(bet)}</b>` });
  let tools = "";
  if (mode === "draw") tools = `<div class="nastroje"><div class="barvy" id="barvy">${pal.map(i => `<button class="barva${i === pal[0] ? " on" : ""}" data-c="${i}" style="background:${K.BARVY[i]}" aria-label="Barva"></button>`).join("")}</div>
    <button class="ik tl" id="bTl" aria-label="Tloušťka čáry"><b></b></button><button class="ik" id="bUndo" aria-label="Zpět">${ICON.zpet}</button></div>`;
  const hadat = mode === "guess" ? `<form class="hadat" id="hadat" autocomplete="off"><input id="fTip" enterkeyhint="send" placeholder="Tvůj tip" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Tvůj tip"><button class="btn sm" type="submit">Tipnout</button><button class="ik" type="button" id="bVzdat" aria-label="Vzdát kolo">${ICON.vlajka}</button></form>` : "";
  const tipy = `<div class="tipy" id="tipy"></div>`;
  const side = seat => {
    const isDr = seat === dr;
    const bub = isDr ? (mode === "guess" ? `<div class="bublina">Sázku neprozradím.</div>` : `<div class="bublina">Sázka: <span class="disp">${okno(bet)}</span></div>`)
      : `<div class="bublina" id="bubTipy">…</div>`;
    const under = `<div class="cedule">${esc(nameOf(seat))} ${isDr ? "kreslí" : "hádá"}</div>`;
    return `<aside class="${seat === "x" ? "strana-l" : "strana-p"}">${bub}${postava(avOf(seat), isDr ? "kresli" : "mysli", COL[seat])}${under}</aside>`;
  };
  $("view").innerHTML = `<div class="round">${desk ? side("x") : ""}<div class="stred">${stitek}${platno}${bar}${tools}${desk ? hadat : (mode === "draw" ? "" : tipy) + hadat}</div>${desk ? side("o") : ""}</div>`;
  rdirty = true; lastVis = -1;
  fitCanvas();
  if (mode === "draw") bindDraw(k, h, pal);
  if (mode === "guess") bindGuess(k, help);
  if (mode === "guess" || mode === "spect" || mode === "watch") fetchNow(k);
  loop(k, mode, h, mod);
}
async function fetchNow(k) { if (!room.draws[k]) { await loadDraw(k); rdirty = true; } }

function fitCanvas() {
  const pl = $("plocha"), pt = $("platno"), cv = $("cv");
  if (!pl || !cv) return;
  const r = pl.getBoundingClientRect();
  const w = Math.floor(Math.min(r.width, r.height * 0.8)), hh = Math.floor(w * 1.25);
  pt.style.width = w + "px"; pt.style.height = hh + "px";
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
  rdirty = true;
}
addEventListener("resize", () => { fitCanvas(); });
// iOS Safari ignoruje zákaz zoomu ve viewportu: dvouprstý zoom stránky zastaví až gesture* události
for (const t of ["gesturestart", "gesturechange"]) document.addEventListener(t, e => e.preventDefault(), { passive: false });
if (window.visualViewport) visualViewport.addEventListener("resize", () => {
  document.documentElement.style.setProperty("--vh", visualViewport.height + "px"); scrollTo(0, 0); fitCanvas();
});
DESK.addEventListener("change", () => { if (room && /^(draw|guess|watch|spect)/.test(ui.key)) { const key = ui.key; ui.key = ""; show(key, () => viewRound(...roundArgs(key))); } });
const roundArgs = key => { const [m, k] = key.split(":"); return [+k, m]; };

// vykreslovací smyčka: plátno, hodiny, ručička sázky
// Hádač nevidí kresbu přesně v čase hodin, ale přes přehrávací hlavu `ph`: co dorazí se zpožděním sítě
// (živá hra), dožene zrychleně místo skoku, takže čáry se pořád táhnou jako pod rukou kreslíře.
function loop(k, mode, h, mod) {
  const cv = $("cv"); if (!cv) return;
  const pt = K.painter(cv), ctx = pt.ctx;
  const nodes = { st: $("stopky"), j: $("jehla"), u: $("ubehlo"), ok: document.querySelector("#sazka .okno"), pr: $("prazdne") };
  const bet = { b: h.b, bw: h.bw || R.OKNO };
  let ph = -1, prev = performance.now(), lastTenth = -1, lastHead = "", winState = "";
  ui.painter = pt;
  const tick = now => {
    if (!ui.key.endsWith(":" + k) || !cv.isConnected) { if (ui.painter === pt) ui.painter = null; return; }
    const dt = Math.min(100, now - prev); prev = now;
    const g = (docs()[R.other(R.drawerOf(k))] || { g: {} }).g[k];
    let el;
    if (mode === "draw") el = Date.now() - h.t;
    else if (mode === "guess") el = Date.now() - (mine().g[k] ? mine().g[k].s : Date.now());
    else el = g && g.s ? Date.now() - g.s : (h.fin || Date.now() - h.t);
    if (g && g.end) el = g.hit != null ? g.hit : LIMIT * 1000;
    el = Math.max(0, Math.min(LIMIT * 1000, el));
    // časovač vypršel
    if (mode === "draw" && el >= LIMIT * 1000) { finishDraw(k); decide(); }
    if (mode === "guess" && el >= LIMIT * 1000 && !mine().g[k].end) endGuess(k, null);
    // plátno
    let strokes, upTo = Infinity, live = null;
    if (rec && rec.k === k && R.drawerOf(k) === room.seat) { strokes = rec.strokes; if (rec.drawing) live = strokes[strokes.length - 1]; }
    else {
      const c = room.draws[k]; strokes = c ? c.strokes || [] : [];
      if (c && c.dirty) { c.dirty = false; rdirty = true; }
      if (mode === "guess") {
        if (ph < 0) ph = el;   // návrat k rozehranému kolu (reload) nezačíná přehrávat od nuly
        const was = ph;
        if (el - ph > 250) {
          // dohánění: prázdnou chvíli přeskočí, rozkreslenou čáru přehraje 3× rychleji
          if (!K.head(strokes, ph)) { const ns = nextStart(strokes, ph); ph = ns == null ? el : Math.max(ph, Math.min(ns, el)); }
          ph += dt * 3;
        } else ph = el;
        if (!(c && c.fin)) ph = Math.min(ph, Math.max(K.duration(strokes), was));
        upTo = ph = Math.min(ph, el);
      }
    }
    const hd = upTo === Infinity ? null : K.head(strokes, upTo);
    const vis = upTo === Infinity ? -2 : visibleCount(strokes, upTo);
    const hk = hd ? `${hd.x | 0},${hd.y | 0}` : "";
    if (rdirty || vis !== lastVis || hk !== lastHead) {
      rdirty = false; lastVis = vis; lastHead = hk;
      if (mode === "draw" && mod === "poslepu") { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
      else pt.draw(strokes, upTo, { mirror: mod === "zrcadlo", live });
      if (hd) penTip(ctx, hd, cv.width / K.W, mod === "zrcadlo");
      if (nodes.pr) {
        const empty = !strokes.length || (upTo !== Infinity && vis === 0);
        nodes.pr.hidden = !(empty && mode !== "draw");
        nodes.pr.textContent = mode === "guess" ? `Kresba se ještě nezačala` : mode === "watch" ? "Plátno zůstalo prázdné" : "Plátno je zatím prázdné";
      }
    }
    // hodiny a lišta: jen když se posune o desetinu vteřiny (innerHTML každý snímek brzdil kreslení na mobilu)
    const sec = el / 1000, tenth = Math.floor(el / 100);
    if (tenth !== lastTenth) {
      lastTenth = tenth;
      if (nodes.st) nodes.st.innerHTML = stopky(sec, mode === "guess" ? null : bet) + `<b>${Math.floor(sec)}</b>`;
      const pc = Math.min(100, sec / LIMIT * 100) + "%";
      if (nodes.j) nodes.j.style.left = pc;
      if (nodes.u) nodes.u.style.width = pc;
      // napětí sázky (vidí ji kreslíř a divák): okno se blíží, ručička je v okně, okno propadlo
      if (mode !== "guess" && nodes.ok) {
        const ws = sec >= bet.b + bet.bw ? "pryc" : sec >= bet.b ? "ted" : sec >= bet.b - 4 ? "blizko" : "";
        if (ws !== winState) {
          winState = ws;
          nodes.ok.classList.remove("pryc", "ted", "blizko"); if (ws) nodes.ok.classList.add(ws);
          if (nodes.st) nodes.st.classList.toggle("ted", ws === "ted");
          if (ws === "ted" && navigator.vibrate) navigator.vibrate(25);
        }
      }
    }
    ui.raf = requestAnimationFrame(tick);
  };
  ui.raf = requestAnimationFrame(tick);
}
// hrot pera: barevná tečka s bílým lemem tam, kde právě jede čára
function penTip(ctx, hd, scale, mirror) {
  const r = Math.max(7, K.TLOUSTKY[hd.s] / 2 + 4) * scale;
  for (const x of mirror ? [hd.x, K.W - hd.x] : [hd.x]) {
    ctx.beginPath(); ctx.arc(x * scale, hd.y * scale, r + 3 * scale, 0, Math.PI * 2); ctx.fillStyle = "rgba(23,22,31,.18)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x * scale, hd.y * scale, r, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.beginPath(); ctx.arc(x * scale, hd.y * scale, r - 3 * scale, 0, Math.PI * 2); ctx.fillStyle = K.BARVY[hd.c] || K.BARVY[0]; ctx.fill();
  }
}
function nextStart(strokes, ms) {
  for (const s of strokes) if (s.p.length && s.p[2] * K.DT > ms) return s.p[2] * K.DT;
  return null;
}
function visibleCount(strokes, upTo) {
  const lim = upTo / K.DT; let n = 0;
  for (const s of strokes) for (let i = 2; i < s.p.length; i += 3) if (s.p[i] <= lim) n++; else break;
  return n;
}

// kreslíř: ukazatel → záznam → zápis kresby
function bindDraw(k, h, pal) {
  ensureRecorder(k);
  let col = pal[0], size = 1;
  const cv = $("cv"), kurzor = $("kurzor"), mod = h.m;
  // rozměr plátna se čte jednou na tah, ne na každý bod (getBoundingClientRect na pohyb vynucoval layout)
  let box = null;
  const pos = e => { const r = box || cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * K.W, (e.clientY - r.top) / r.height * K.H]; };
  // zakódování celé kresby je drahé: při tahu nejvýš co 180 ms (zapisovač stejně posílá co 400 ms), po zvednutí hned
  let pushT = 0;
  const push = () => { clearTimeout(pushT); pushT = 0; if (room.dw && room.dw.k === k) room.dw.set({ st: K.encode(rec.strokes) }); };
  const pushSoon = () => { if (!pushT) pushT = setTimeout(push, 180); };
  const showCur = (e, on) => { if (!kurzor) return; kurzor.hidden = !on; if (on) { const r = cv.getBoundingClientRect(); kurzor.style.left = (e.clientX - r.left) + "px"; kurzor.style.top = (e.clientY - r.top) + "px"; } };
  cv.addEventListener("pointerdown", e => {
    if (act !== null || !rec || e.button > 0) return;
    if (mod === "jedna" && rec.strokes.length) { toast("Jedna čára! Šipkou zpět ji smažeš a začneš znovu."); return; }
    e.preventDefault();
    act = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch {}
    box = cv.getBoundingClientRect();
    const [x, y] = pos(e); rec.start(x, y, Date.now() - h.t, col, size); rdirty = true; pushSoon(); showCur(e, true);
  });
  cv.addEventListener("pointermove", e => {
    if (e.pointerId !== act) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    let ch = false;
    for (const ev of evs.length ? evs : [e]) { const [x, y] = pos(ev); ch = rec.move(x, y, Date.now() - h.t) || ch; }
    if (ch) { rdirty = true; pushSoon(); }
    showCur(e, true);
  });
  const up = e => { if (e.pointerId !== act) return; act = null; box = null; rec.end(); rdirty = true; push(); showCur(e, false); room.dw.kick(true); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  // iOS: dotyk na plátně nikdy neposouvá ani nezvětšuje stránku (pojistka k touch-action: none)
  for (const t of ["touchstart", "touchmove"]) cv.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  $("barvy").addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    col = +b.dataset.c; for (const el of $("barvy").children) el.classList.toggle("on", el === b);
  });
  const tl = $("bTl"), tlPaint = () => { tl.firstChild.style.height = [4, 8, 14][size] + "px"; };
  tlPaint();
  tl.addEventListener("click", () => { size = (size + 1) % 3; tlPaint(); });
  $("bUndo").addEventListener("click", () => { if (act !== null) return; rec.undo(); ui.painter && ui.painter.reset(); rdirty = true; push(); });
  $("bDone").addEventListener("click", () => {
    if (!rec.strokes.length) { toast("Nejdřív něco nakresli."); return; }
    finishDraw(k); decide();
  });
}

// hádač: tipy, nápověda, vzdání
function bindGuess(k, help) {
  const w = word(k), f = $("hadat"), inp = $("fTip");
  paintLetters(k, help);
  f.addEventListener("submit", e => {
    e.preventDefault();
    const t = inp.value.trim(); if (!t) return;
    inp.value = "";
    const g = mine().g[k]; if (!g || g.end) return;
    const ms = Math.min(LIMIT * 1000, Date.now() - g.s);
    const v = porovnej(t, w);
    if (v === "ano") { endGuess(k, ms, t); return; }
    if (v === "skoro") toast("Skoro! Zkus to přesněji.");
    setMine({ g: { ...mine().g, [k]: { ...g, tips: [...g.tips, [t.slice(0, 24), ms, v === "skoro" ? 1 : 0]].slice(-30) } } });
    update();
    if (!DESK.matches) inp.focus();
  });
  $("bNap")?.addEventListener("click", () => {
    const g = mine().g[k]; if (!g || g.end) return;
    setMine({ g: { ...mine().g, [k]: { ...g, nap: 1 } } }, true);
    paintLetters(k, help);
  });
  $("bVzdat").addEventListener("click", () => {
    if (!confirm("Vzdát tohle kolo? Body nikdo nedostane.")) return;
    endGuess(k, null);
  });
}
function paintLetters(k, help) {
  const el = $("pismena"); if (!el) return;
  const g = mine().g[k] || {}, w = word(k);
  if (!g.nap && !help) { el.innerHTML = ""; return; }
  const first = help ? [...w][0] : "";
  el.innerHTML = pismena(w).map((n, wi) => Array.from({ length: n }, (_, i) => wi === 0 && i === 0 && first ? `<i class="l">${esc(first.toUpperCase())}</i>` : "<i></i>").join("")).join(`<i class="mezera"></i>`);
  const b = $("bNap"); if (b) { b.textContent = `${[...w.replace(/\s/g, "")].length} písmen · −1 bod`; b.disabled = true; }
}
function endGuess(k, ms, t) {
  const g = mine().g[k]; if (!g || g.end) return;
  const tips = t ? [...g.tips, [t.slice(0, 24), ms, 2]] : g.tips;
  setMine({ g: { ...mine().g, [k]: { ...g, tips, hit: ms, end: 1 } } }, true);
  if (ms != null && navigator.vibrate) navigator.vibrate(60);
  decide();
}

// průběžné aktualizace bez překreslení obrazovky
function update() {
  if (!room || !S) return;
  const pm = /^partie:(\d+)$/.exec(ui.key);
  if (pm) { paintFavs(R.partieOf(+pm[1])); return; }
  const m = /^(guess|watch|spect|draw):(\d+)$/.exec(ui.key);
  if (!m) return;
  const k = +m[2], gs = R.other(R.drawerOf(k)), g = (docs()[gs] || { g: {} }).g[k];
  const tips = g ? g.tips || [] : [];
  const chips = tips.slice(-6).reverse().map(([t, , v]) => `<span class="tip${v === 1 ? " skoro" : v === 2 ? " ok" : ""}">${esc(t)}</span>`).join("");
  const el = $("tipy");
  if (el) el.innerHTML = chips || (m[1] === "draw" ? "" : `<span class="napis">${m[1] === "guess" ? "Piš tipy, kolikrát chceš. Za špatné se nic nestrhává." : g ? "Zatím žádný tip." : "Kresbu ještě nevidí."}</span>`);
  const bub = $("bubTipy");
  if (bub) bub.innerHTML = tips.length ? tips.slice(-3).map(([t, , v]) => v === 2 ? esc(t) : v === 1 ? `${esc(t)}?` : `<s>${esc(t)}</s>`).join(" ") : g ? "Čekám na nápad." : "Ještě nevidím.";
}

// ---------- odhalení ----------
async function viewReveal(k, spect) {
  renderTop();
  const r = S.results[k], d = docs(), h = d[r.dr].h[k], w = word(k, d), bet = { b: h.b, bw: h.bw || R.OKNO };
  const verdikt = r.inWin ? "Trefa!" : r.hit != null ? "Uhodnuto" : "Neuhodnuto";
  const detail = r.hit != null ? `${esc(nameOf(r.gs))}: ${s1(r.hit)} s · sázka ${okno(bet)}` : `Sázka byla ${okno(bet)}`;
  const last = R.indexInPartie(k) === R.KOL;
  const faces = { [r.dr]: r.inWin ? "radost" : r.hit != null ? "au" : "sok", [r.gs]: r.hit != null ? "radost" : "au" };
  // napětí: ručička nejdřív doběhne k času zásahu a teprve pak padne verdikt (jen při prvním zobrazení kola)
  const sweep = ui.swept !== room.id + ":" + k; ui.swept = room.id + ":" + k;
  $("view").innerHTML = `<div class="odhaleni${sweep ? " sweep" : ""}">
    <div class="verdikt">${verdikt}</div>
    <div class="stitek${h.q ? " mydva" : ""}"><div>${h.q ? `<small class="q">${ICON.srdce}${esc(h.q)}?</small>` : `<small>${r.hit != null ? "Slovo" : "Bylo to"}</small>`}<div class="slovo">${esc(w)}</div></div></div>
    <div class="scena">${postava(avOf("x"), faces.x, "#fff")}<div class="mini" id="mini"></div>${postava(avOf("o"), faces.o, "#fff")}</div>
    ${sazkaHTML({ bet, hit: r.hit, hitOk: r.inWin, needle: sweep, label: detail, right: r.inWin ? `<b class="bonus">+${R.BONUS_OKNO} oběma</b>` : "" })}
    ${spect ? seatButtons() : `<button class="btn" id="bNext">${last ? "Výsledek partie" : R.drawerOf(k + 1) === room.seat ? "Teď kreslíš ty" : `Teď kreslí ${esc(nameOf(R.drawerOf(k + 1)))}`}</button>`}</div>`;
  $("bNext")?.addEventListener("click", () => {
    if (last) { ui.partieSeen = k; ui.key = ""; decide(); return; }
    setMine({ rdy: k + 1 }, true); decide();
  });
  const c = await loadDraw(k);
  const mini = $("mini");
  if (mini && ui.key.endsWith(":" + k)) mini.innerHTML = K.toSVG(c.strokes || [], { mirror: h.m === "zrcadlo" });
}

// ---------- konec partie: výsledek, tituly, galerie, odveta ----------
async function viewPartie(p) {
  renderTop("none");
  const sc = partieScore(p), win = sc.x > sc.o ? "x" : sc.o > sc.x ? "o" : "";
  const tit = R.titles(p, S.results, docs());
  const ser = S.series;   // dohrané partie (tahle už je v sérii, protože S.k je za ní)
  const st = R.seriesTitle(ser.hist, win);
  const head = win ? `Vyhrává ${esc(nameOf(win))}` : "Remíza";
  const side = seat => `<div class="strana">${postava(avOf(seat), !win ? "klid" : seat === win ? "radost" : "au", COL[seat])}<div class="sk">${sc[seat]}</div></div>`;
  const titles = ["x", "o"].flatMap(s => tit[s].map(t => `<div class="titul ${s}"><b>${t.nazev}</b><span>${esc(nameOf(s))} · ${t.popis}</span></div>`)).join("");
  const ks = Array.from({ length: R.KOL }, (_, i) => R.firstOf(p) + i);
  $("view").innerHTML = `<div class="konec"><h2>${head}</h2>
    <div class="vysledek">${side("x")}<div class="dvoj">:</div>${side("o")}</div>
    ${st ? `<div class="pomoc">${esc(nameOf(win))}: ${st}</div>` : ""}
    <div class="tituly">${titles}</div>
    <div class="serie">Série <b>${ser.x} : ${ser.o}</b>${ser.rem ? ` · remízy ${ser.rem}` : ""}</div>
    <div class="akce"><button class="btn" id="bOdveta">Odveta</button>${H ? `<button class="btn alt" id="bJina">Jiná hra</button>` : ""}</div>
    <h2 class="gal">Galerie partie</h2>
    ${room.seat ? `<p class="male galtip">Klepni na obrázek, přehraje se. Srdíčkem vyber ten nejhezčí.</p>` : ""}
    <div class="galerie" id="galerie">${ks.map((k, i) => galItem(k, i, null)).join("")}</div>
    ${H ? "" : `<p class="male">Galerie zůstává uložená v odkazu hry.</p>`}</div>`;
  $("bJina")?.addEventListener("click", () => doHerny({ typ: "jina-hra" }));
  $("bOdveta").addEventListener("click", () => { setMine({ rdy: R.firstOf(p + 1) }, true); ui.partieSeen = 0; decide(); });
  const gal = $("galerie");
  gal.addEventListener("click", e => {
    const it = e.target.closest("[data-gal]"); if (!it) return;
    const k = +it.dataset.gal;
    if (e.target.closest(".fav")) {
      if (!room.seat) return;
      const fav = { ...(mine().fav || {}) };
      if (fav[p] === k) delete fav[p]; else fav[p] = k;
      setMine({ fav }, true); paintFavs(p);
      return;
    }
    lupa(k);
  });
  ui.gal = {};
  for (const [i, k] of ks.entries()) {
    const c = await loadDraw(k);
    ui.gal[k] = c.strokes || [];
    const el = document.querySelector(`[data-gal="${k}"]`);
    if (el) el.outerHTML = galItem(k, i, ui.gal[k]);
  }
  paintFavs(p);
}
// karta galerie: polaroid na pásce, nálepka za trefu sázky a za nejrychlejší uhodnutí partie
function galItem(k, i, strokes) {
  const r = S.results[k], d = docs(), dr = R.drawerOf(k), h = d[dr].h[k] || {};
  const rot = [-2.5, 2, -1.2, 2.4, -1.8, 1.2][i % 6], tape = [-6, 4, -3, 7, -5, 3][i % 6];
  const p = R.partieOf(k), hits = [];
  for (let j = R.firstOf(p); j < R.firstOf(p) + R.KOL; j++) { const x = S.results[j]; if (x && x.hit != null) hits.push(x.hit); }
  const fastest = r && r.hit != null && r.hit === Math.min(...hits);
  const nalepka = r && r.inWin ? `<span class="nalepka hv" title="Trefa sázky">${ICON.hvezda}</span>` : fastest ? `<span class="nalepka bl" title="Nejrychlejší">${ICON.blesk}</span>` : "";
  return `<div class="obraz${h.q ? " mydva" : ""}" data-gal="${k}" role="button" tabindex="0" aria-label="Přehrát kresbu ${esc(word(k, d))}" style="--rot:${rot}deg;--tape:${tape}deg;--c:${COL[dr]}">
    <i class="paska"></i>${nalepka}<div class="kr">${strokes ? K.toSVG(strokes, { mirror: h.m === "zrcadlo" }) : ""}</div>
    <div class="pod"><div class="slr"><b>${esc(word(k, d))}</b><span class="srdce-x" hidden>${ICON.srdce}</span><span class="srdce-o" hidden>${ICON.srdce}</span></div><div class="radek"><span class="kdo">${esc(nameOf(dr))} · ${r && r.hit != null ? s1(r.hit) + " s" : "neuhodnuto"}</span>${room.seat ? `<button class="fav" aria-label="Nejhezčí kresba">${ICON.srdce}</button>` : ""}</div></div></div>`;
}
// srdíčka: každý hráč smí v partii jedno; obě srdíčka na jedné kresbě = shoda
function paintFavs(p) {
  const d = docs();
  for (const el of document.querySelectorAll("#galerie [data-gal]")) {
    const k = +el.dataset.gal, fx = d.x && d.x.fav && d.x.fav[p] === k, fo = d.o && d.o.fav && d.o.fav[p] === k;
    el.querySelector(".srdce-x").hidden = !fx; el.querySelector(".srdce-o").hidden = !fo;
    el.classList.toggle("shoda", !!(fx && fo));
    const b = el.querySelector(".fav"); if (b) b.classList.toggle("on", room.seat === "x" ? !!fx : !!fo);
  }
}
// lupa: kresba se přehraje v původním tempu (dlouhá zrychleně, nejvýš 7 s), klepnutím zavřít
function lupa(k) {
  const strokes = (ui.gal && ui.gal[k]) || [], d = docs(), dr = R.drawerOf(k), h = d[dr].h[k] || {}, r = S.results[k];
  $("lupa")?.remove();
  const el = document.createElement("div");
  el.id = "lupa"; el.className = "lupa";
  el.innerHTML = `<div class="lupa-ram" style="--c:${COL[dr]}"><div class="lupa-platno"><canvas id="cvLupa"></canvas></div>
    <div class="lupa-pod">${h.q ? `<small class="q">${ICON.srdce}${esc(h.q)}?</small>` : ""}<b>${esc(word(k, d))}</b><span>Kreslí ${esc(nameOf(dr))} · ${r && r.hit != null ? `uhodnuto za ${s1(r.hit)} s` : "neuhodnuto"}</span></div></div>`;
  document.body.appendChild(el);
  // offsetWidth, ne getBoundingClientRect: rámeček právě naskakuje ze scale(0)
  const cv = $("cvLupa"), box = cv.parentNode, dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(box.offsetWidth * dpr); cv.height = Math.round(box.offsetHeight * dpr);
  const pt = K.painter(cv), dur = K.duration(strokes), speed = Math.max(1, dur / 7000), t0 = performance.now();
  const frame = now => {
    if (!el.isConnected) return;
    const t = (now - t0) * speed;
    pt.draw(strokes, t >= dur ? Infinity : t, { mirror: h.m === "zrcadlo" });
    const hd = t < dur ? K.head(strokes, t) : null;
    if (hd) penTip(pt.ctx, hd, cv.width / K.W, h.m === "zrcadlo");
    if (t < dur + 50) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const zavri = () => el.remove();
  el.addEventListener("click", zavri);
  addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { zavri(); removeEventListener("keydown", esc1); } });
}

// ---------- start ----------
const solo = createSolo({ $, esc, ICON, stopky, sazkaHTML, toast, hlava, postava, AVATARY, COL, DESK, LIMIT, ui, s1, fitCanvas,
  store: Net.store, goSetup: () => { history.replaceState(null, "", location.pathname + location.search); room = null; S = null; viewSetup(); } });
addEventListener("hashchange", () => { stopPoll(); room = null; S = null; ui.key = ""; openFromHash(); });
openFromHash();

// testovací háčky (čtení stavu, žádné zkratky do hry)
window.__car = {
  state: () => ({ view: ui.key, seat: room && room.seat, k: S && S.k, rdy: room && room.w ? mine().rdy : 0, score: S && S.score, series: S && S.series, so: room && room.meta.so }),
  word: k => room ? word(k || (S && S.k)) : "",
  docs: () => room ? docs() : null,
  pending: () => !!(room && ((room.w && room.w.pending()) || (room.dw && room.dw.pending()))),
  drawSize: k => room && room.draws[k] ? (room.draws[k].st || "").length : room && room.dw && room.dw.k === k ? room.dw.doc().st.length : 0,
  mods: p => R.modsOfPartie(room.id, p),
  solo: { hooks: solo.hooks, ...solo.test },
  herna: () => H ? { ...H, faze: HP.faze, poslano: [...HP.poslano] } : null,
};
