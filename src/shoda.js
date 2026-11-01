// Tolerantní porovnání tipu se slovem: bez diakritiky, bez velikosti písmen, y = i, drobné překlepy a jiný pád projdou.

export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();
// pro porovnání: tvrdé/měkké i se plete i dospělým
const fold = s => s.replace(/y/g, "i");

// Damerau-Levenshtein (prohození sousedních písmen = 1 chyba)
export function vzdalenost(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}

// kolik překlepů slovo snese: krátká slova přesně, delší 1, dlouhá 2, spojení 3
export const tolerance = len => len <= 3 ? 0 : len <= 6 ? 1 : len <= 10 ? 2 : 3;

// vata v tipu („je to kočka“, „asi pes“) a krátké předložky ve víceslovné odpovědi („u babičky“)
const VATA = new Set("je to ten ta asi jo no nejaky nejaka nejake nejaci takovy takova takove prece prej proste".split(" "));
const bezVaty = t => t.split(" ").filter(x => !VATA.has(x));
const bezMalych = t => t.split(" ").filter(x => x.length > 2);

// pádová koncovka po společném kmeni (hrad/hrach neprojde, kočka/kočku a les/lesy ano)
const KONCOVKA = /^(?:[aeiou]{0,2}m?|ach|ech|ami)$/;

// jedno porovnání bez mezer: přesně, v toleranci, nebo jiná koncovka (kočka/kočku, auto/auta, les/lesy)
function shoda(t, w) {
  if (!t || !w) return "ne";
  if (t === w) return "ano";
  const tol = tolerance(w.length), d = vzdalenost(t, w);
  if (d <= tol) return "ano";
  let cp = 0;
  while (cp < t.length && t[cp] === w[cp]) cp++;
  if (cp >= 3 && cp >= Math.min(t.length, w.length) - 1 && KONCOVKA.test(t.slice(cp)) && KONCOVKA.test(w.slice(cp))) return "ano";
  if (d <= tol + 1 && w.length >= 3) return "skoro";
  if (t.length >= 4 && (w.includes(t) || t.includes(w))) return "skoro";
  return "ne";
}

// "ano" | "skoro" | "ne"
export function porovnej(tip, slovo) {
  const tw = norm(tip), ww = norm(slovo);
  if (!tw || !ww) return "ne";
  const slep = a => fold(a.join(""));
  const t = bezVaty(tw), w = ww.split(" ");
  const tips = [slep(tw.split(" ")), slep(t)];
  // tip ze dvou slov („velký pes“, „pes hafík“): stačí, když sedí jedno z nich
  if (t.length === 2) tips.push(...t.map(x => fold(x)));
  const slova = [slep(w)];
  if (w.length > 1) { const m = bezMalych(ww); if (m.length) slova.push(slep(m)); }
  let best = "ne";
  for (const a of tips) for (const b of slova) {
    const v = shoda(a, b);
    if (v === "ano") return "ano";
    if (v === "skoro") best = "skoro";
  }
  return best;
}

// počet písmen pro nápovědu: po slovech, např. [6] nebo [5, 4]
export const pismena = slovo => String(slovo).trim().split(/\s+/).map(w => [...w].length);
