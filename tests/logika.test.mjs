// Jednotkové testy pravidel, kódování kresby, slov a porovnání tipů: node tests/logika.test.mjs
import * as K from "../src/kresba.js";
import * as R from "../src/hra.js";
import { SLOVA, navrhy } from "../src/slova.js";
import { porovnej } from "../src/shoda.js";

let pass = 0, fail = 0;
const ok = (name, c, extra = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };

// kódování kresby: přesný návrat, velikost
{
  const r = R.rng("kresba");
  const strokes = [];
  for (let s = 0; s < 30; s++) {
    const p = []; let x = 200 + r() * 400, y = 200 + r() * 600, t = s * 2500;
    for (let i = 0; i < 60; i++) { x += (r() - .5) * 30; y += (r() - .5) * 30; t += 16 + r() * 10; p.push(x, y, t); }
    const rc = K.recorder(); rc.start(p[0], p[1], p[2], s % 6, s % 3);
    for (let i = 3; i < p.length; i += 3) rc.move(p[i], p[i + 1], p[i + 2]);
    rc.end(); strokes.push(rc.strokes[0]);
  }
  const enc = K.encode(strokes), dec = K.decode(enc);
  ok("kresba: dekódování vrací totéž", JSON.stringify(dec) === JSON.stringify(strokes));
  const json = JSON.stringify(strokes).length;
  ok("kresba: 30 tahů se vejde pod 12 kB a je aspoň 3× menší než JSON", enc.length < 12000 && enc.length * 3 < json, `kód ${enc.length} B, JSON ${json} B, bodů ${K.pointCount(strokes)}`);
  ok("kresba: znaky bezpečné pro JSON i URL", /^[A-Za-z0-9_.-]*$/.test(enc));
  ok("kresba: délka v ms sedí", Math.abs(K.duration(dec) - K.duration(strokes)) < 1 && K.duration(dec) > 70000);
  // nejhorší případ: 90 s nepřetržitého čmárání po celé ploše
  const big = K.recorder(); let t = 0;
  for (let s = 0; s < 45; s++) { big.start(r() * 800, r() * 1000, t, 0, 1); for (let i = 0; i < 120; i++) { t += 16; big.move(r() * 800, r() * 1000, t); } big.end(); }
  const e2 = K.encode(big.strokes);
  ok("kresba: i divoké čmárání 90 s se vejde do limitu 64 kB", e2.length + 200 < 65536, `${e2.length} B`);
  ok("kresba: zjednodušení drží rovnou čáru na 2 bodech", K.simplify([0, 0, 0, 5, 5, 1, 10, 10, 2, 20, 20, 3]).length === 6);
}

// kreslíř se střídá, partie začínají střídavě
{
  const seq = Array.from({ length: 12 }, (_, i) => R.drawerOf(i + 1)).join("");
  ok("role: střídání v partii a začátek partie střídavě", seq === "xoxoxo" + "oxoxox", seq);
}

// modifikátory: 3 různé partie se liší, první kolo hry je bez modifikátoru
{
  const plans = [1, 2, 3].map(p => R.modsOfPartie("abc123", p).join(","));
  ok("mody: 3 partie za sebou mají jiný plán", new Set(plans).size === 3, plans.join(" | "));
  ok("mody: první kolo hry bez modifikátoru", R.modsOfPartie("abc123", 1)[0] === "");
  ok("mody: v partii 3 modifikátory", plans.every(p => p.split(",").filter(Boolean).length === 3));
  ok("mody: deterministické", R.modsOfPartie("q", 2).join() === R.modsOfPartie("q", 2).join());
}

// slova: počet, žádná duplicita, v sérii se neopakují
{
  const all = Object.values(SLOVA).flat();
  ok("slova: aspoň 300 ve třech obtížnostech", all.length >= 300 && Object.keys(SLOVA).length === 3, String(all.length));
  ok("slova: bez duplicit napříč obtížnostmi", new Set(all.map(w => w.toLowerCase())).size === all.length);
  const room = "serie42", docs = { x: { h: {}, g: {} }, o: { h: {}, g: {} } };
  const seen = new Set(); let rep = 0;
  for (let k = 1; k <= 60; k++) {
    const ch = R.wordChoices(room, k, docs);
    for (const c of ch) if (seen.has(c.slovo)) rep++;
    const pick = ch[k % 3].slovo;
    for (const c of ch) seen.add(c.slovo);
    docs[R.drawerOf(k)].h[k] = { w: R.skryj(pick, room), o: "lehka", b: 10, bw: 10, t: 1 };
  }
  const drawn = [...R.usedWords(room, docs)];
  ok("slova: 60 kol (10 partií) bez opakování nakresleného slova", drawn.length === 60, String(drawn.length));
  ok("slova: skryj/odkryj s diakritikou", R.odkryj(R.skryj("žluťoučký kůň", "r1"), "r1") === "žluťoučký kůň");
}

// tolerantní porovnání
{
  ok("shoda: diakritika a velikost písmen", porovnej("ZIRAFA", "žirafa") === "ano");
  ok("shoda: jeden překlep", porovnej("zirava", "žirafa") === "ano");
  ok("shoda: krátké slovo přesně", porovnej("ko", "kůň") === "ne" && porovnej("kun", "kůň") === "ano");
  ok("shoda: víceslovné spojení bez mezer", porovnej("karluvmost", "Karlův most") === "ano");
  ok("shoda: jiné slovo neprojde", porovnej("kočka", "žirafa") === "ne");
}

// bodování: trefa okna = body oběma, mimo okno jen hádač, neuhodnuto nic
{
  const room = "b1";
  const mk = (hit, b) => ({ x: { h: { 1: { w: R.skryj("pes", room), o: "lehka", b, bw: 10, t: 1 } }, g: {} }, o: { h: {}, g: { 1: { s: 1, tips: [], hit, end: 1 } } } });
  const a = R.roundResult(1, mk(14200, 10)), b = R.roundResult(1, mk(25000, 10)), c = R.roundResult(1, mk(null, 10));
  ok("body: trefa okna", a.inWin && a.pts.x === 3 && a.pts.o === 5, JSON.stringify(a.pts));
  ok("body: mimo okno jen hádač", !b.inWin && b.pts.x === 0 && b.pts.o === 2, JSON.stringify(b.pts));
  ok("body: neuhodnuto", c.pts.x === 0 && c.pts.o === 0);
  ok("body: nápověda stojí bod, těžké slovo víc", R.guessPoints("lehka", 1) === 1 && R.guessPoints("tezka") === 4);
  ok("dotah: prohra o 4+ body", R.comeback("x", { x: 1, o: 5 }) && !R.comeback("x", { x: 2, o: 5 }));
  const st = R.state(room, mk(14200, 10));
  ok("stav: po dohraném kole je na řadě kolo 2", st.k === 2 && st.score.x === 3 && st.score.o === 5);
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
