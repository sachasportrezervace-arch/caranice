// Postavičky hráčů: plochý vektor, velké plochy, bez obrysů. Hlava 100×100, obličej sdílený, výraz se mění.
// Výrazy nese obočí a pusa: klid, mysli (přemýšlí), radost, au (zklamání), sok (šok), kresli (zamračené soustředění).

const SKIN = "#F7C59F", SKIN_LO = "#E9A983", INK = "#1B1A22";

const HEADS = {
  kluk: {
    jmeno: "Kluk",
    back: `<path d="M22 50c0-22 13-34 28-34s28 12 28 34z" fill="#3A2417"/>`,
    face: `<circle cx="21" cy="60" r="7" fill="${SKIN_LO}"/><circle cx="79" cy="60" r="7" fill="${SKIN_LO}"/>
      <ellipse cx="50" cy="60" rx="29" ry="30" fill="${SKIN}"/>`,
    front: `<path d="M21 52c2-20 15-31 30-31 14 0 27 9 29 27-8-6-16-9-23-9 1 3 0 6-3 8-2-5-7-8-13-8-6 7-13 11-20 13z" fill="#3A2417"/>
      <path d="M48 21c-2-8 3-13 10-14-3 4-2 8 1 11z" fill="#3A2417"/>`,
  },
  holka: {
    jmeno: "Holka",
    back: `<circle cx="24" cy="26" r="13" fill="#7B2E1E"/><circle cx="76" cy="26" r="13" fill="#7B2E1E"/>
      <path d="M19 58c0-25 14-38 31-38s31 13 31 38v8H19z" fill="#7B2E1E"/>`,
    face: `<ellipse cx="50" cy="61" rx="28" ry="29" fill="${SKIN}"/>`,
    front: `<path d="M22 56c1-20 13-32 28-32s27 12 28 32c-10-3-19-9-25-17-5 9-17 15-31 17z" fill="#7B2E1E"/>
      <rect x="15" y="22" width="9" height="6" rx="3" fill="#FFD23F" transform="rotate(-30 19 25)"/>
      <rect x="76" y="22" width="9" height="6" rx="3" fill="#FFD23F" transform="rotate(30 80 25)"/>`,
  },
  kocka: {
    jmeno: "Kočka",
    back: `<path d="M20 44 24 12l22 18zM80 44 76 12 54 30z" fill="#F08A2C"/><path d="M26 34 28 20l10 9zM74 34l-2-14-10 9z" fill="#FFC9A8"/>`,
    face: `<ellipse cx="50" cy="58" rx="32" ry="30" fill="#F08A2C"/>
      <path d="M50 28c-4 0-6 6-5 12 2-4 3-6 5-6s3 2 5 6c1-6-1-12-5-12z" fill="#D46E17"/>
      <ellipse cx="50" cy="73" rx="16" ry="11" fill="#FFF1E2"/>`,
    front: `<path d="M47 66h6l-3 3.5z" fill="#E2577A"/>
      <path d="M30 70h-14M30 74l-13 4M70 70h14M70 74l13 4" stroke="#FFF1E2" stroke-width="2" stroke-linecap="round"/>`,
    mouthY: 76,
  },
  pes: {
    jmeno: "Pes",
    back: ``,
    face: `<ellipse cx="50" cy="58" rx="29" ry="31" fill="#C98A55"/>
      <ellipse cx="62" cy="48" rx="10" ry="12" fill="#F2D2AE"/>
      <ellipse cx="50" cy="75" rx="15" ry="11" fill="#F2D2AE"/>`,
    front: `<path d="M23 34c-12 4-14 26-6 38 6-4 10-14 10-24z" fill="#6E4227"/><path d="M77 34c12 4 14 26 6 38-6-4-10-14-10-24z" fill="#6E4227"/>
      <ellipse cx="50" cy="68" rx="6" ry="4.5" fill="${INK}"/>`,
    mouthY: 78,
  },
};
export const AVATARY = Object.keys(HEADS);
export const jmenoAvataru = a => (HEADS[a] || HEADS.kluk).jmeno;

function eyes(v) {
  const L = 39, R = 61, Y = 57;
  const dot = (x, y, rx = 3.6, ry = 4.6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/><circle cx="${x + 1.2}" cy="${y - 1.6}" r="1.3" fill="#fff"/>`;
  switch (v) {
    case "radost": return `<path d="M${L - 5} ${Y + 1}q5-7 10 0M${R - 5} ${Y + 1}q5-7 10 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
    case "mysli": return dot(L + 2, Y - 2, 3.2, 4.2) + dot(R + 2, Y - 2, 3.2, 4.2) +
      `<path d="M${R - 5} ${Y - 10}q5-4 10-1" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    case "sok": return `<circle cx="${L}" cy="${Y}" r="6.5" fill="#fff"/><circle cx="${R}" cy="${Y}" r="6.5" fill="#fff"/>` + dot(L, Y, 2.8, 3.2) + dot(R, Y, 2.8, 3.2);
    case "au": return dot(L, Y + 1, 3.2, 3.8) + dot(R, Y + 1, 3.2, 3.8) +
      `<path d="M${L - 6} ${Y - 9}l9 3M${R + 6} ${Y - 9}l-9 3" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    case "kresli": return dot(L, Y + 1, 3.4, 3.4) + dot(R, Y + 1, 3.4, 3.4) +
      `<path d="M${L - 6} ${Y - 8}l10 3M${R + 6} ${Y - 8}l-10 3" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: return dot(L, Y) + dot(R, Y);
  }
}
function mouth(v, y) {
  switch (v) {
    case "radost": return `<path d="M40 ${y - 3}q10 14 20 0z" fill="#8C2B36"/><path d="M44 ${y + 3}q6 4 12 0q-6-3-12 0z" fill="#FF7D8A"/>`;
    case "mysli": return `<path d="M44 ${y + 1}q6-3 12 1" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
    case "sok": return `<ellipse cx="50" cy="${y + 1}" rx="5" ry="6.5" fill="#8C2B36"/>`;
    case "au": return `<path d="M42 ${y + 3}q8-7 16 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case "kresli": return `<path d="M45 ${y}h10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: return `<path d="M44 ${y - 1}q6 5 12 0" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
  }
}

// SVG hlavy; výraz mění oči, obočí a pusu
export function hlava(avatar, vyraz = "klid", extra = "") {
  const h = HEADS[avatar] || HEADS.kluk, my = h.mouthY || 72;
  const sweat = vyraz === "au" ? `<path d="M80 40c3 5 4 8 1 10-3 1-5-2-4-5z" fill="#7FD3FF"/>` : "";
  return `<svg viewBox="0 0 100 100" class="hlava v-${vyraz}" aria-hidden="true" ${extra}>${h.back}${h.face}${eyes(vyraz)}${h.front}${mouth(vyraz, my)}${sweat}</svg>`;
}

// tělo pro velký desktopový portrét (tričko v barvě hráče)
export function postava(avatar, vyraz, barva) {
  return `<svg viewBox="0 0 120 150" class="postava v-${vyraz}" aria-hidden="true">
    <path d="M14 150c0-34 20-52 46-52s46 18 46 52z" fill="${barva}"/>
    <path d="M48 98h24l-4 10H52z" fill="${SKIN_LO}"/>
    <g transform="translate(10 4)">${hlava(avatar, vyraz).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
  </svg>`;
}
