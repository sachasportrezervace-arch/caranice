// Čáranice – sdílená místnost na mantledb.sh (bez účtu, CORS), vzor z Ovocného souboje.
//
// Dokumenty pod …/caranice-<id>/ (limit 64 KB na dokument, ověřeno 31. 10.):
//   hra   meta: jména, avatary, zařízení na místech x/o. Zapisuje se čti-ověř-zapiš jen při založení a přijetí.
//   x, o  stav hráče, každý má jediného zapisovatele: h = moje kola jako kreslíř (slovo, sázka), g = moje kola jako hádač
//         (start, tipy, zásah), rdy = kolo, na které jsem připraven.
//   d<k>  kresba kola k, zapisuje jen kreslíř toho kola. Každá kresba má vlastní dokument, takže galerie celé série
//         se nikdy nemusí vejít do jednoho limitu.

export const API = (typeof window !== "undefined" && window.CAR_API) || "https://mantledb.sh/v2/";
const APP = "caranice";
export const metaUrl = id => `${API}${APP}-${id}/hra`;
export const seatUrl = (id, seat) => `${API}${APP}-${id}/${seat}`;
export const drawUrl = (id, k) => `${API}${APP}-${id}/d${k}`;

async function req(url, opt = {}) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 8000);
  try { return await fetch(url, { ...opt, cache: "no-store", signal: ac.signal }); } finally { clearTimeout(timer); }
}
export async function load(url) {
  const r = await req(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("load " + r.status);
  return r.json();
}
export async function save(url, d) {
  const r = await req(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, u: Date.now() }) });
  if (!r.ok) throw new Error("save " + r.status);
}

const attempt = (fn, fb) => { try { return fn(); } catch { return fb; } };
export const store = {
  get: k => attempt(() => localStorage.getItem(k), null),
  set: (k, v) => attempt(() => localStorage.setItem(k, v)),
};
export const randId = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => (b % 36).toString(36)).join("");
export const device = store.get("car-dev") || randId(16);
store.set("car-dev", device);

// čti, ověř, zapiš; ok(doc) vrací nový dokument nebo null, když se zápis už nehodí
export async function commitMeta(id, ok) {
  const d = await load(metaUrl(id));
  const next = ok(d);
  if (!next) return { d, ok: false };
  const out = { ...next, v: (d ? d.v : 0) + 1 };
  await save(metaUrl(id), out);
  return { d: out, ok: true };
}

// dokument s jediným zapisovatelem: zápisy sloučené, nejvýš jeden na cestě, mezi nimi aspoň `gap` ms
export function writer(url, initial, gap = 350) {
  let doc = { ...initial }, dirty = false, flying = false, last = 0, timer = null, fails = 0;
  const w = {
    doc: () => doc,
    set(patch, urgent) { doc = { ...doc, ...patch }; dirty = true; w.kick(urgent); },
    gap,
    kick(urgent) {
      if (flying || !dirty) return;
      const wait = urgent ? 0 : Math.max(0, last + w.gap - Date.now());
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (flying || !dirty) return;
        flying = true; dirty = false; last = Date.now();
        const snap = doc;
        try { await save(url, snap); fails = 0; w.onNet && w.onNet(""); }
        catch { dirty = true; fails++; if (fails >= 2 && w.onNet) w.onNet("Spojení vázne, zkouším to znovu…"); }
        flying = false;
        if (dirty) setTimeout(() => w.kick(), fails ? Math.min(4000, 400 * 2 ** fails) : 0);
      }, wait);
    },
    pending: () => dirty || flying,
    stop() { clearTimeout(timer); dirty = false; },
  };
  return w;
}
