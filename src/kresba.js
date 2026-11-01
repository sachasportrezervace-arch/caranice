// Kresba: záznam tahů s časem, zjednodušení, kompaktní kódování a vykreslení v libovolném čase (přehrávání).
//
// Logické plátno 800×1000 (4:5), body se ukládají v mřížce 400×500 (1 jednotka = 2 logické px) a čas po 20 ms.
// Tah = { c: index barvy, s: index tloušťky, p: [x, y, t, x, y, t, …] }, t je od začátku kreslení.
// Kód tahu: znak barvy, znak tloušťky a pak delta (x, y, t) jako zigzag varint v 64znakové abecedě (5 bitů + pokračování).
// Malý pohyb = 1 znak na souřadnici, typická kresba se 30 tahy tak má 3–8 kB místo ~40 kB v JSONu.

export const W = 800, H = 1000, GX = 400, GY = 500, DT = 20;
export const BARVY = ["#17161F", "#E8402F", "#FFB81F", "#2E9E5B", "#2F6BFF", "#8A5A36"];
export const TLOUSTKY = [7, 15, 30];

const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const IDX = Object.fromEntries([...ABC].map((c, i) => [c, i]));
const zz = n => n >= 0 ? n * 2 : -n * 2 - 1;
const unzz = n => n & 1 ? -(n + 1) / 2 : n / 2;

function putVar(out, n) {
  let v = zz(n);
  while (v >= 32) { out.push(ABC[32 + (v & 31)]); v = Math.floor(v / 32); }
  out.push(ABC[v]);
}
export function encodeStroke(st) {
  const out = [ABC[st.c], ABC[st.s]];
  let px = 0, py = 0, pt = 0;
  for (let i = 0; i < st.p.length; i += 3) {
    putVar(out, st.p[i] - px); putVar(out, st.p[i + 1] - py); putVar(out, st.p[i + 2] - pt);
    px = st.p[i]; py = st.p[i + 1]; pt = st.p[i + 2];
  }
  return out.join("");
}
export function decodeStroke(s) {
  const st = { c: IDX[s[0]] || 0, s: IDX[s[1]] || 0, p: [] };
  let i = 2, acc = [0, 0, 0], j = 0;
  while (i < s.length) {
    let v = 0, mul = 1, d;
    do { d = IDX[s[i++]]; if (d === undefined) return st; v += (d & 31) * mul; mul *= 32; } while (d >= 32 && i < s.length);
    acc[j] += unzz(v); st.p.push(acc[j]); j = (j + 1) % 3;
  }
  if (st.p.length % 3) st.p.length -= st.p.length % 3;
  return st;
}
export const encode = strokes => strokes.map(encodeStroke).join(".");
export const decode = s => s ? s.split(".").filter(Boolean).map(decodeStroke) : [];

// Ramer–Douglas–Peucker na bodech tahu (čas bodů zůstává, vypadnou jen body na skoro rovné čáře)
export function simplify(p, eps = 0.75) {
  const n = p.length / 3;
  if (n <= 2) return p.slice();
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = p[a * 3], ay = p[a * 3 + 1], bx = p[b * 3], by = p[b * 3 + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      // uzavřený tah (začátek = konec): vzdálenost od bodu místo od přímky
      const d = len ? Math.abs(dy * p[i * 3] - dx * p[i * 3 + 1] + bx * ay - by * ax) / len : Math.hypot(p[i * 3] - ax, p[i * 3 + 1] - ay);
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  return out;
}

// záznam tahů: přidá bod jen při pohybu aspoň o 1,5 jednotky mřížky, po zvednutí prstu tah zjednoduší
export function recorder() {
  const strokes = [];
  let cur = null;
  return {
    strokes,
    get drawing() { return !!cur; },
    start(x, y, t, c, s) {
      cur = { c, s, p: [q(x, GX), q(y, GY), Math.round(t / DT)] };
      strokes.push(cur);
    },
    move(x, y, t) {
      if (!cur) return false;
      const gx = q(x, GX), gy = q(y, GY), n = cur.p.length;
      if (Math.hypot(gx - cur.p[n - 3], gy - cur.p[n - 2]) < 1.5) return false;
      cur.p.push(gx, gy, Math.max(cur.p[n - 1], Math.round(t / DT)));
      return true;
    },
    end() { if (!cur) return; cur.p = simplify(cur.p); cur = null; },
    undo() { cur = null; return strokes.pop(); },
    clear() { cur = null; strokes.length = 0; },
  };
}
// logická souřadnice 0..W/H na mřížku
const q = (v, g) => Math.max(0, Math.min(g, Math.round(v / 2)));

// délka kresby v ms (čas posledního bodu)
export function duration(strokes) {
  let t = 0;
  for (const st of strokes) if (st.p.length) t = Math.max(t, st.p[st.p.length - 1]);
  return t * DT;
}
export const pointCount = strokes => strokes.reduce((a, st) => a + st.p.length / 3, 0);

// viditelné body tahu v čase lim (jednotky DT): celé body a dopočtený bod mezi posledním a dalším,
// takže dlouhá rovná čára (po zjednodušení dva body) se při přehrávání táhne, ne objeví naráz
function visiblePts(p, lim) {
  const all = p.length / 3;
  let n = 0;
  while (n < all && p[n * 3 + 2] <= lim) n++;
  const xs = [], ys = [];
  for (let i = 0; i < n; i++) { xs.push(p[i * 3]); ys.push(p[i * 3 + 1]); }
  if (n && n < all) {
    const t0 = p[n * 3 - 1], t1 = p[n * 3 + 2], f = t1 > t0 ? (lim - t0) / (t1 - t0) : 0;
    if (f > 0) { xs.push(p[n * 3 - 3] + (p[n * 3] - p[n * 3 - 3]) * f); ys.push(p[n * 3 - 2] + (p[n * 3 + 1] - p[n * 3 - 2]) * f); }
  }
  return [xs, ys];
}
const lastT = st => st.p.length ? st.p[st.p.length - 1] : 0;

// vykreslí tahy do času upTo (ms; Infinity = celé). mirror = zrcadlová kopie podle svislé osy.
export function paint(ctx, strokes, upTo = Infinity, opt = {}) {
  const { scale = 1, mirror = false, palette = BARVY } = opt;
  const lim = upTo / DT;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const st of strokes) {
    const p = st.p;
    if (!p.length || p[2] > lim) continue;
    const [xs, ys] = visiblePts(p, lim), n = xs.length;
    ctx.strokeStyle = ctx.fillStyle = palette[st.c] || palette[0];
    ctx.lineWidth = TLOUSTKY[st.s] * scale;
    for (const m of mirror ? [false, true] : [false]) {
      const X = i => (m ? GX - xs[i] : xs[i]) * 2 * scale, Y = i => ys[i] * 2 * scale;
      if (n === 1) { ctx.beginPath(); ctx.arc(X(0), Y(0), ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(X(0), Y(0));
      for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
      ctx.lineTo(X(n - 1), Y(n - 1));
      ctx.stroke();
    }
  }
}

// hrot pera při přehrávání: kde se právě kreslí (tah začal a ještě nedoběhl), jinak null
export function head(strokes, upTo) {
  const lim = upTo / DT;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const st = strokes[i], p = st.p;
    if (!p.length || p[2] > lim) continue;
    if (lastT(st) <= lim) return null;
    const [xs, ys] = visiblePts(p, lim);
    return { x: xs[xs.length - 1] * 2, y: ys[ys.length - 1] * 2, c: st.c, s: st.s };
  }
  return null;
}

// Malíř s vrstvou: hotové tahy leží v bitmapě a každý snímek se kreslí jen ten rozpracovaný.
// Na mobilu to drží 60 fps i u kresby se stovkou tahů. reset() po zpět/smazání (pole tahů se mění na místě).
export function painter(cv) {
  const ctx = cv.getContext("2d");
  const base = document.createElement("canvas"), bctx = base.getContext("2d");
  let arr = null, n = 0, key = "";
  return {
    ctx,
    reset() { arr = null; },
    draw(strokes, upTo = Infinity, opt = {}) {
      const { mirror = false, palette = BARVY, live = null } = opt;
      const scale = cv.width / W, lim = upTo / DT;
      const k = cv.width + "x" + cv.height + (mirror ? "m" : "") + palette.join();
      if (k !== key || arr !== strokes || n > strokes.length) {
        key = k; arr = strokes; n = 0;
        base.width = cv.width; base.height = cv.height;
      }
      let done = n;
      while (done < strokes.length && strokes[done] !== live && strokes[done].p.length && lastT(strokes[done]) <= lim) done++;
      if (done > n) { paint(bctx, strokes.slice(n, done), Infinity, { scale, mirror, palette }); n = done; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (n) ctx.drawImage(base, 0, 0);
      if (done < strokes.length) paint(ctx, strokes.slice(done), upTo, { scale, mirror, palette });
    },
  };
}

// SVG verze pro galerii a miniatury (ostrá v každé velikosti)
export function toSVG(strokes, opt = {}) {
  const { mirror = false, palette = BARVY, cls = "" } = opt;
  const paths = [];
  for (const st of strokes) {
    const p = st.p, n = p.length / 3;
    if (!n) continue;
    const col = palette[st.c] || palette[0], w = TLOUSTKY[st.s];
    for (const m of mirror ? [false, true] : [false]) {
      const X = i => (m ? GX - p[i * 3] : p[i * 3]) * 2, Y = i => p[i * 3 + 1] * 2;
      if (n === 1) { paths.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${w / 2}" fill="${col}"/>`); continue; }
      let d = `M${X(0)} ${Y(0)}`;
      for (let i = 1; i < n - 1; i++) d += `Q${X(i)} ${Y(i)} ${(X(i) + X(i + 1)) / 2} ${(Y(i) + Y(i + 1)) / 2}`;
      d += `L${X(n - 1)} ${Y(n - 1)}`;
      paths.push(`<path d="${d}" stroke="${col}" stroke-width="${w}"/>`);
    }
  }
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.join("")}</svg>`;
}
