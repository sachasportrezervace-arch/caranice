// Vygeneruje ikony PWA: node tools/ikony.cjs  (potřebuje Playwright z %APPDATA%/npm/node_modules)
// Motiv: modré pole, žlutý šikmý štítek, přes něj tmavá čmáranice. Vše v bezpečné zóně 80 % (maskable).
const path = require("path"), fs = require("fs");
const { chromium } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#2F3FE3"/>
  <g transform="rotate(-6 256 256)">
    <rect x="102" y="158" width="308" height="196" rx="34" fill="#FFD23F"/>
  </g>
  <path d="M138 268 C 150 196, 200 186, 214 252 C 226 312, 262 338, 288 262 C 304 212, 340 196, 360 236 C 372 262, 366 290, 384 292"
        fill="none" stroke="#17161F" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const OUT = path.join(__dirname, "..", "icons");
const ICONY = [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, size] of ICONY) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:#2F3FE3}svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`);
    await page.screenshot({ path: path.join(OUT, name), omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    const b = fs.readFileSync(path.join(OUT, name));
    console.log(name, b.readUInt32BE(16) + "×" + b.readUInt32BE(20), b.length + " B", "colorType", b[25]);
  }
  await browser.close();
})();
