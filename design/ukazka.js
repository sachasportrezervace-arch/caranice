// Ukázková kresba pro statické návrhy: žirafa čmáraná prstem (logické plátno 800×1000)
export const UKAZKA = [
  ["#1B1A22", 14, "M300 900 L310 640 Q300 560 360 540 L520 520 Q600 520 610 600 L600 900"],
  ["#1B1A22", 14, "M360 540 L330 260 Q320 200 360 190"],
  ["#1B1A22", 14, "M420 530 L400 270 Q395 230 420 215"],
  ["#1B1A22", 14, "M360 190 Q300 140 330 110 Q380 80 450 120 Q480 160 420 215"],
  ["#1B1A22", 14, "M350 115 L340 70 M390 100 L395 60"],
  ["#F5A623", 30, "M340 620 Q420 600 520 610 M330 720 Q440 700 560 720 M340 820 Q430 800 580 820"],
  ["#F5A623", 30, "M350 420 Q380 410 400 420 M345 330 Q370 320 395 330"],
  ["#1B1A22", 8, "M395 150 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0"],
  ["#1B1A22", 14, "M600 600 Q680 640 690 720"],
  ["#2E9E5B", 14, "M80 930 Q400 900 740 935"],
];
export const ukazkaSVG = (cls = "") => `<svg viewBox="0 0 800 1000" class="${cls}" preserveAspectRatio="xMidYMid meet">${UKAZKA.map(([c, w, d]) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>`;
