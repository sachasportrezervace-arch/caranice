// Tolerantní porovnání tipu se slovem: bez diakritiky, bez velikosti písmen, drobné překlepy projdou.

export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();

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

// kolik překlepů slovo snese: krátká slova přesně, delší 1, dlouhá 2
export const tolerance = len => len <= 3 ? 0 : len <= 7 ? 1 : 2;

// "ano" | "skoro" | "ne"
export function porovnej(tip, slovo) {
  const t = norm(tip), w = norm(slovo);
  if (!t) return "ne";
  const ts = t.replace(/ /g, ""), ws = w.replace(/ /g, "");
  if (ts === ws) return "ano";
  const tol = tolerance(ws.length), d = vzdalenost(ts, ws);
  if (d <= tol) return "ano";
  if (d <= tol + 1 && ws.length >= 3) return "skoro";
  if (ts.length >= 4 && (ws.includes(ts) || ts.includes(ws))) return "skoro";
  return "ne";
}

// počet písmen pro nápovědu: po slovech, např. [6] nebo [5, 4]
export const pismena = slovo => String(slovo).trim().split(/\s+/).map(w => [...w].length);
