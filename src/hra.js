// Pravidla Čáranice: čistá logika bez DOM, stejný výsledek na obou zařízeních (stav = meta + dokumenty x a o).
//
// Kolo k (1, 2, 3, … přes celou místnost), partie má KOL kol, kreslíř se střídá a partie začínají střídavě.
// Kreslíř vybere slovo a vsadí okno (např. 20–30 s), za kolik ho hádač uhodne. Hádač dostane body za uhodnutí,
// když čas zásahu padne do okna, dostanou bonus oba. Kdo v partii prohrává o DOTAH a víc, dostane pomoc:
// jako kreslíř širší okno, jako hádač zdarma první písmeno.

import { navrhy, OBTIZNOSTI } from "./slova.js";

export const KOL = 6;            // kol v partii (každý kreslí 3×)
export const LIMIT = 90;         // s na kreslení i na hádání
export const OKNO = 10, OKNO_DOTAH = 15, DOTAH = 4;
export const BONUS_OKNO = 3;
export const MODY = {
  jedna: { nazev: "Jedna čára", popis: "Prst se nesmí zvednout. Jeden tah a hotovo." },
  barvy3: { nazev: "Jen 3 barvy", popis: "Paleta se scvrkla na tři barvy." },
  zrcadlo: { nazev: "Zrcadlově", popis: "Každá čára se nakreslí i zrcadlově." },
  poslepu: { nazev: "Poslepu", popis: "Svoji kresbu neuvidíš, dokud kolo neskončí." },
};

export const other = s => s === "x" ? "o" : "x";
export const partieOf = k => Math.ceil(k / KOL);
export const indexInPartie = k => k - (partieOf(k) - 1) * KOL;
export const firstOf = p => (p - 1) * KOL + 1;
export const drawerOf = k => (indexInPartie(k) + partieOf(k)) % 2 === 0 ? "x" : "o";

// deterministická náhoda z textu (stejná na obou stranách)
export function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// modifikátory partie: 3 kola ze 6 dostanou modifikátor, pořadí i výběr se mění partii od partie.
// První kolo první partie je vždy bez modifikátoru, ať se hra nejdřív naučí.
export function modsOfPartie(room, p) {
  const r = rng(room + ":mody:" + p);
  const four = shuffle(Object.keys(MODY), r).slice(0, 3);
  let plan = shuffle(["", "", "", ...four], r);
  if (p === 1 && plan[0]) { const i = plan.indexOf(""); [plan[0], plan[i]] = [plan[i], plan[0]]; }
  return plan;
}
export const modOf = (room, k) => modsOfPartie(room, partieOf(k))[indexInPartie(k) - 1];

// tři barvy pro mód „jen 3 barvy“ (vždy aspoň jedna tmavá na obrys)
export function triBarvy(room, k) {
  const r = rng(room + ":barvy:" + k);
  return [0, ...shuffle([1, 2, 3, 4, 5], r).slice(0, 2)];
}

// slovo v dokumentu není čitelné na první pohled (hádač si ho nevyčte z odpovědi serveru)
const key = room => [...("car" + room)].map(c => c.charCodeAt(0));
export function skryj(word, room) {
  const k = key(room), b = [...new TextEncoder().encode(word)].map((c, i) => c ^ k[i % k.length]);
  return btoa(String.fromCharCode(...b));
}
export function odkryj(s, room) {
  if (!s) return "";
  try {
    const k = key(room), b = [...atob(s)].map((c, i) => c.charCodeAt(0) ^ k[i % k.length]);
    return new TextDecoder().decode(new Uint8Array(b));
  } catch { return ""; }
}

// použitá slova v celé místnosti: v sérii se nic neopakuje
export function usedWords(room, docs) {
  const s = new Set();
  for (const d of [docs.x, docs.o]) for (const h of Object.values((d && d.h) || {})) if (h && h.w) s.add(odkryj(h.w, room));
  return s;
}
export function wordChoices(room, k, docs) {
  return navrhy(rng(room + ":slova:" + k), usedWords(room, docs));
}

// body hádače za uhodnutí podle obtížnosti, nápověda stojí bod (nejméně 1)
export function guessPoints(obt, nap) {
  const o = OBTIZNOSTI.find(x => x.id === obt);
  return Math.max(1, 2 + (o ? o.bonus : 1) - (nap ? 1 : 0));
}

// výsledek jednoho kola; null, dokud hádač neskončil
export function roundResult(k, docs) {
  const dr = drawerOf(k), gs = other(dr);
  const h = docs[dr] && docs[dr].h && docs[dr].h[k];
  const g = docs[gs] && docs[gs].g && docs[gs].g[k];
  if (!h || !g || !g.end) return null;
  const hit = g.hit == null ? null : g.hit;
  const sec = hit == null ? null : hit / 1000;
  const inWin = sec != null && sec >= h.b && sec < h.b + (h.bw || OKNO);
  const gp = sec != null ? guessPoints(h.o, g.nap) : 0;
  return { k, dr, gs, hit, inWin, pts: { [gs]: gp + (inWin ? BONUS_OKNO : 0), [dr]: inWin ? BONUS_OKNO : 0 } };
}

// stav místnosti: aktuální kolo, skóre partie, série
export function state(room, docs) {
  let k = 1;
  const results = {};
  while (true) { const r = roundResult(k, docs); if (!r) break; results[k] = r; k++; }
  const p = partieOf(k);
  // partie je dohraná, když jsou dohraná všechna její kola; pak se čeká na odvetu (rdy obou ≥ první kolo další partie)
  const score = pp => {
    const s = { x: 0, o: 0 };
    for (let i = firstOf(pp); i < firstOf(pp) + KOL; i++) if (results[i]) { s.x += results[i].pts.x; s.o += results[i].pts.o; }
    return s;
  };
  const series = { x: 0, o: 0, rem: 0, hist: [] };
  for (let pp = 1; pp < p; pp++) {
    const s = score(pp), w = s.x > s.o ? "x" : s.o > s.x ? "o" : "";
    if (w) series[w]++; else series.rem++;
    series.hist.push(w);
  }
  return { k, p, i: indexInPartie(k), results, score: score(p), prevScore: p > 1 ? score(p - 1) : null, series, drawer: drawerOf(k) };
}

// pomoc pro toho, kdo v partii prohrává o DOTAH a víc
export function comeback(seat, score) { return score[other(seat)] - score[seat] >= DOTAH; }

// tituly za dohranou partii p (každý hráč nejvýš dva, nejlepší první)
export function titles(p, results, docs) {
  const out = { x: [], o: [] };
  const rs = [];
  for (let i = firstOf(p); i < firstOf(p) + KOL; i++) if (results[i]) rs.push(results[i]);
  for (const seat of ["x", "o"]) {
    const asDr = rs.filter(r => r.dr === seat), asGs = rs.filter(r => r.gs === seat);
    const wins = asDr.filter(r => r.inWin);
    const late = wins.filter(r => { const h = docs[seat].h[r.k]; return h && h.b >= 30; });
    const hits = asGs.filter(r => r.hit != null);
    const fast = hits.filter(r => r.hit < 8000);
    if (late.length) out[seat].push({ id: "skareda", nazev: "Mistr škaredé čáry", popis: "Pozdní okno trefené schválně pomalou kresbou." });
    if (wins.length >= 2) out[seat].push({ id: "jasnovidec", nazev: "Jasnovidec", popis: `${wins.length}× trefená sázka.` });
    if (fast.length) out[seat].push({ id: "blesk", nazev: "Blesk", popis: `Uhodnuto za ${(Math.min(...fast.map(r => r.hit)) / 1000).toFixed(1).replace(".", ",")} s.` });
    if (asGs.length && hits.length === asGs.length) out[seat].push({ id: "detektiv", nazev: "Detektiv", popis: "Uhodnuto všechno." });
    if (!out[seat].length && asGs.length && !hits.length) out[seat].push({ id: "abstrakt", nazev: "Galerie moderny", popis: "Nic neuhodnuto. Umění se nevysvětluje." });
    out[seat] = out[seat].slice(0, 2);
  }
  return out;
}

// titul za sérii podle výher v řadě
export function seriesTitle(hist, seat) {
  let run = 0;
  for (let i = hist.length - 1; i >= 0 && hist[i] === seat; i--) run++;
  return run >= 3 ? "Nepřemožitelný štětec" : run === 2 ? "Na vlně" : "";
}
