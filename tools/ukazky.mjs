// Generátor ukázkových kreseb pro sólo režim: node tools/ukazky.mjs  →  src/ukazky.js
//
// Každá kresba je ručně zadaný obrys (body na logickém plátně 800×1000), který se "nakreslí prstem":
// po úsecích se vzorkuje s proměnnou rychlostí (rozjezd a dojezd), jemným chvěním ruky, přesahem u uzavřených tvarů,
// nepřesnými rohy a pauzami mezi tahy. Body jdou přes K.recorder() přesně tak, jako když kreslí hráč, takže výsledek
// má stejný tvar dat i stejnou velikost kódu jako skutečná kresba (včetně zjednodušení tahu).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as K from "../src/kresba.js";

const rnd = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const jit = (r, a) => (r() - .5) * 2 * a;

// ---------- tvary ----------
// L = lomená čára s ostrými rohy, C = hladká křivka, O = uzavřená hladká křivka (s přesahem), D = tečka
const L = (c, s, pts, o = {}) => ({ k: "L", c, s, pts, ...o });
const C = (c, s, pts, o = {}) => ({ k: "C", c, s, pts, ...o });
const O = (c, s, pts, o = {}) => ({ k: "O", c, s, pts, ...o });
const D = (c, s, x, y, o = {}) => ({ k: "D", c, s, pts: [[x, y]], ...o });
const E = (r, cx, cy, rx, ry, rot = r() * 6.28, n = 9) => Array.from({ length: n }, (_, i) => {
  const a = rot + i * 2 * Math.PI / n, k = 1 + jit(r, .05);
  return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
});

// Catmull-Rom přes body (otevřená nebo uzavřená), over = přesah uzavřené křivky v segmentech
function spline(pts, closed, over = 0) {
  const n = pts.length, P = i => closed ? pts[(i % n + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n + over : n - 1, out = [];
  for (let seg = 0; seg < Math.ceil(segs); seg++) for (let j = 0; j < 14; j++) {
    const t = j / 14; if (seg + t > segs) break;
    const [p0, p1, p2, p3] = [P(seg - 1), P(seg), P(seg + 1), P(seg + 2)];
    out.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t * t + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t * t * t)));
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
function densify(sp, r) {
  let pts = sp.pts.map(([x, y]) => [x + jit(r, sp.k === "L" ? 4 : 2), y + jit(r, sp.k === "L" ? 4 : 2)]);
  if (sp.k === "L") return pts;
  if (sp.k === "C") return spline(pts, false);
  return spline(pts, true, .35 + r() * .25);
}

// kreslení jednoho tahu do záznamníku, vrací čas konce
function trace(rec, sp, t, r, vscale) {
  if (sp.k === "D") {
    const [x, y] = sp.pts[0];
    rec.start(x + jit(r, 2), y + jit(r, 2), t, sp.c, sp.s); rec.end();
    return t + 50;
  }
  // hustá lomená čára → délky
  const raw = densify(sp, r), poly = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const [ax, ay] = poly[poly.length - 1], [bx, by] = raw[i], d = Math.hypot(bx - ax, by - ay), m = Math.ceil(d / 5);
    for (let j = 1; j <= m; j++) poly.push([ax + (bx - ax) * j / m, ay + (by - ay) * j / m]);
  }
  const cum = [0]; for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const Ltot = cum[cum.length - 1];
  const A1 = (1.6 + r() * 1.8) * Math.min(1, Ltot / 220), l1 = 70 + r() * 70, p1 = r() * 6.28;
  const A2 = (.6 + r() * .9) * Math.min(1, Ltot / 220), l2 = 20 + r() * 14, p2 = r() * 6.28;
  let idx = 0;
  const at = s => {
    while (idx < cum.length - 2 && cum[idx + 1] < s) idx++;
    const f = Math.max(0, Math.min(1, (s - cum[idx]) / ((cum[idx + 1] - cum[idx]) || 1)));
    const [ax, ay] = poly[idx], [bx, by] = poly[idx + 1], dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1;
    const edge = Math.min(1, s / 25, (Ltot - s) / 25);
    const w = (A1 * Math.sin(s / l1 * 6.28 + p1) + A2 * Math.sin(s / l2 * 6.28 + p2)) * Math.max(.2, edge);
    return [ax + dx * f - dy / dl * w, ay + dy * f + dx / dl * w];
  };
  const vmax = (sp.v || 1) * vscale * (.85 + r() * .3), ramp = Math.min(110, Ltot * .35);
  const [x0, y0] = at(0);
  rec.start(x0, y0, t, sp.c, sp.s);
  let s = 0, tt = t;
  while (s < Ltot) {
    const dt = 13 + r() * 8, e = Math.min(s, Ltot - s) / ramp;
    const ease = .28 + .72 * Math.min(1, e), noise = 1 + .28 * Math.sin(tt / 170 + p1) + .12 * Math.sin(tt / 53 + p2);
    s = Math.min(Ltot, s + vmax * ease * noise * dt); tt += dt;
    const [x, y] = at(s); rec.move(x, y, tt);
  }
  rec.end();
  return tt;
}

// ---------- kresby ----------
const KRESBY = [
  { slovo: "dům", obt: "lehka", mod: "", seed: 11, build: r => [
    L(3, 1, [[90, 835], [720, 832]], { pause: 300 }),
    L(0, 1, [[210, 520], [206, 822], [598, 826], [594, 524], [214, 518]]),
    L(1, 1, [[160, 545], [402, 330], [648, 545]]),
    L(0, 1, [[530, 442], [530, 365], [590, 365], [590, 494]]),
    L(5, 1, [[330, 824], [332, 660], [432, 658], [430, 826]]),
    D(0, 2, 410, 745),
    L(4, 1, [[470, 590], [550, 592], [548, 675], [468, 672], [470, 590]]),
    L(4, 0, [[510, 592], [509, 674]]), L(4, 0, [[468, 632], [550, 633]]),
    C(0, 0, [[560, 340], [540, 300], [575, 265], [548, 225], [580, 190]], { pause: 500 }),
  ] },
  { slovo: "kočka", obt: "lehka", mod: "", seed: 23, build: r => [
    O(0, 1, E(r, 400, 360, 165, 135, Math.PI)),
    L(0, 1, [[255, 296], [240, 160], [350, 232]]), L(0, 1, [[450, 232], [560, 160], [545, 296]]),
    D(0, 2, 335, 350), D(0, 2, 465, 350),
    L(1, 0, [[385, 405], [415, 405], [400, 425], [385, 405]]),
    C(0, 0, [[400, 425], [392, 455], [365, 462]]), C(0, 0, [[400, 425], [410, 455], [438, 460]]),
    L(0, 0, [[300, 420], [180, 395]]), L(0, 0, [[300, 435], [170, 440]]), L(0, 0, [[300, 450], [185, 488]]),
    L(0, 0, [[500, 420], [620, 395]]), L(0, 0, [[500, 435], [630, 440]]), L(0, 0, [[500, 450], [615, 488]]),
    L(5, 0, [[400, 235], [400, 285]]), L(5, 0, [[365, 245], [372, 285]]), L(5, 0, [[435, 245], [428, 285]]),
    C(0, 1, [[270, 470], [245, 560], [225, 700], [235, 820], [300, 870], [500, 870], [565, 820], [575, 700], [555, 560], [530, 470]], { pause: 450 }),
    C(0, 0, [[400, 640], [398, 760], [400, 865]]),
    C(5, 1, [[560, 850], [650, 850], [720, 780], [715, 680], [670, 640]]),
  ] },
  { slovo: "slunce", obt: "lehka", mod: "", seed: 37, build: r => {
    const out = [O(2, 1, E(r, 400, 450, 140, 140, -Math.PI / 2, 8)), D(0, 2, 355, 415), D(0, 2, 445, 415), C(1, 1, [[330, 480], [365, 525], [435, 525], [470, 480]])];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 - Math.PI / 2 + jit(r, .05), r1 = 185 + jit(r, 8), r2 = (i % 2 ? 255 : 285) + jit(r, 12);
      out.push(L(2, 1, [[400 + Math.cos(a) * r1, 450 + Math.sin(a) * r1], [400 + Math.cos(a) * r2, 450 + Math.sin(a) * r2]], { pause: 160 }));
    }
    out.push(C(3, 1, [[60, 870], [250, 820], [420, 840], [600, 810], [740, 840]], { pause: 420 }));
    return out;
  } },
  { slovo: "ryba", obt: "lehka", mod: "", seed: 41, build: r => [
    O(4, 1, [[185, 500], [255, 425], [375, 375], [500, 395], [585, 465], [605, 500], [585, 540], [500, 615], [380, 640], [255, 580]]),
    L(4, 1, [[605, 500], [735, 405], [705, 500], [740, 610], [608, 505]]),
    D(0, 2, 270, 470), O(0, 0, E(r, 270, 470, 24, 24)),
    C(1, 0, [[188, 505], [215, 522], [240, 518]]),
    C(1, 1, [[400, 378], [430, 305], [500, 318], [510, 392]]),
    C(1, 1, [[430, 628], [405, 700], [475, 700], [505, 612]]),
    C(2, 0, [[380, 470], [400, 495], [380, 525]]), C(2, 0, [[430, 460], [452, 495], [430, 530]]), C(2, 0, [[480, 470], [500, 495], [480, 525]]),
    O(4, 0, E(r, 120, 380, 22, 22), { pause: 500 }), O(4, 0, E(r, 95, 300, 15, 15)), O(4, 0, E(r, 140, 230, 28, 28)),
  ] },
  { slovo: "strom", obt: "lehka", mod: "", seed: 53, build: r => [
    L(5, 1, [[345, 890], [362, 600]]), L(5, 1, [[455, 892], [438, 600]]),
    O(3, 1, [[290, 610], [190, 560], [165, 450], [215, 350], [300, 320], [330, 230], [430, 190], [520, 230], [560, 320], [650, 350], [690, 450], [640, 560], [540, 610], [420, 590]]),
    D(1, 2, 300, 430), D(1, 2, 470, 400), D(1, 2, 560, 500), D(1, 2, 390, 520),
    O(5, 0, E(r, 400, 740, 14, 22)),
    C(3, 1, [[100, 895], [300, 885], [500, 895], [700, 888]], { pause: 400 }),
    L(3, 0, [[160, 885], [150, 850]]), L(3, 0, [[190, 888], [195, 855]]), L(3, 0, [[620, 890], [612, 858]]), L(3, 0, [[650, 890], [662, 860]]),
  ] },
  { slovo: "jablko", obt: "lehka", mod: "", seed: 67, build: r => [
    O(1, 1, [[400, 385], [320, 340], [235, 365], [185, 460], [190, 600], [255, 725], [340, 785], [400, 765], [462, 785], [545, 725], [610, 600], [615, 460], [565, 365], [480, 340]]),
    C(5, 2, [[400, 390], [395, 320], [418, 245]]),
    O(3, 1, [[430, 285], [490, 225], [565, 215], [585, 250], [540, 300], [470, 315]]),
    C(3, 0, [[440, 295], [505, 262], [560, 235]]),
    C(2, 1, [[260, 470], [248, 540], [262, 600]]),
    C(0, 0, [[250, 850], [400, 875], [560, 850]], { pause: 500 }),
  ] },
  // zrcadlová ukázka: nakreslí se jen levá půlka, hra ji zrcadlově doplní
  { slovo: "motýl", obt: "lehka", mod: "zrcadlo", seed: 79, build: r => [
    L(0, 2, [[400, 390], [400, 700]]), D(0, 2, 400, 358),
    C(0, 0, [[396, 345], [360, 285], [320, 255]]), D(0, 1, 318, 252),
    O(4, 1, [[395, 470], [330, 385], [225, 290], [130, 300], [100, 395], [165, 490], [290, 525], [395, 525]]),
    O(1, 1, [[395, 545], [300, 555], [200, 610], [190, 715], [270, 765], [345, 690], [395, 625]]),
    O(2, 1, E(r, 185, 395, 38, 38)), O(3, 1, E(r, 265, 675, 30, 30)),
    C(4, 0, [[395, 480], [300, 420], [200, 350]]),
  ] },
  { slovo: "maják", obt: "stredni", mod: "", seed: 97, build: r => [
    L(5, 1, [[170, 885], [260, 815], [345, 795], [460, 797], [545, 820], [640, 885], [172, 886]]),
    L(0, 1, [[340, 805], [365, 430], [435, 430], [462, 805]]),
    L(1, 2, [[362, 522], [438, 520]]), L(1, 2, [[352, 682], [448, 680]]),
    L(5, 0, [[385, 805], [385, 760], [415, 760], [415, 805]]),
    L(0, 1, [[352, 430], [352, 355], [448, 355], [448, 430]]), L(2, 2, [[375, 392], [425, 392]]),
    L(1, 1, [[335, 358], [400, 280], [466, 358], [335, 358]]), D(0, 2, 400, 255),
    L(2, 1, [[455, 392], [700, 330]], { pause: 450 }), L(2, 1, [[455, 392], [715, 395]]), L(2, 1, [[455, 392], [690, 460]]),
    L(2, 1, [[345, 392], [100, 330]]), L(2, 1, [[345, 392], [85, 395]]), L(2, 1, [[345, 392], [110, 460]]),
    C(4, 1, [[60, 925], [110, 895], [170, 925], [230, 895], [290, 925]], { pause: 400 }), C(4, 1, [[510, 930], [570, 900], [630, 930], [690, 900], [750, 930]]),
    C(4, 0, [[150, 965], [200, 943], [250, 965], [300, 943]]), C(4, 0, [[480, 968], [530, 946], [580, 968], [630, 946]]),
  ] },
];

// ---------- výroba ----------
const VSCALE = +process.env.VSCALE || .5;   // px/ms, přibližně rychlost prstu při klidném kreslení
const out = [];
for (const kr of KRESBY) {
  const r = rnd(kr.seed), rec = K.recorder();
  let t = 500 + Math.round(r() * 400);
  for (const sp of kr.build(r)) {
    t = trace(rec, sp, t, r, VSCALE);
    t += sp.pause || (180 + Math.round(r() * 330) + (r() < .12 ? 500 : 0));
  }
  const kod = K.encode(rec.strokes), back = K.decode(kod);
  if (JSON.stringify(back) !== JSON.stringify(rec.strokes)) throw new Error("kód " + kr.slovo + " se nevrací beze změny");
  out.push({ slovo: kr.slovo, obt: kr.obt, mod: kr.mod, kod });
  console.log(`${kr.slovo.padEnd(8)} ${kr.obt.padEnd(7)} ${kr.mod.padEnd(8)} tahů ${String(rec.strokes.length).padStart(2)}  bodů ${String(K.pointCount(rec.strokes)).padStart(4)}  ${(K.duration(rec.strokes) / 1000).toFixed(1).padStart(5)} s  ${(kod.length / 1024).toFixed(1)} kB`);
}
const body = `// Ukázkové kresby pro sólo režim (Hádání). VYGENEROVÁNO skriptem tools/ukazky.mjs, ručně neupravovat.\n// Každá je zaznamenaná přes K.recorder() jako kresba prstem: tahy, tloušťky, barvy a čas po 20 ms (kód viz kresba.js).\n// mod "zrcadlo" = kód má jen levou půlku, hra ji při přehrání zrcadlově doplní.\n` +
  `export const UKAZKY = [\n${out.map(u => `  { slovo: ${JSON.stringify(u.slovo)}, obt: ${JSON.stringify(u.obt)}, mod: ${JSON.stringify(u.mod)}, kod: ${JSON.stringify(u.kod)} },`).join("\n")}\n];\n`;
writeFileSync(fileURLToPath(new URL("../src/ukazky.js", import.meta.url)), body);
console.log("zapsáno src/ukazky.js", (body.length / 1024).toFixed(1), "kB");
