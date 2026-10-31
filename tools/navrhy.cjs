// Render statických návrhů: node tools/navrhy.cjs  -> design/shots/<a|b>-<stav>-<mobil|desk>.png
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const OUT = path.join(__dirname, "../design/shots"); require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const wk = await webkit.launch(), cr = await chromium.launch();
  for (const d of ["a", "b"]) for (const s of ["draw", "guess", "reveal"]) {
    const m = await (await wk.newContext({ ...devices["iPhone 13"] })).newPage();
    await m.goto(`http://127.0.0.1:8827/design/${d}.html?s=${s}`); await m.waitForTimeout(1200);
    await m.screenshot({ path: path.join(OUT, `${d}-${s}-mobil.png`) });
    if (s !== "reveal") {
      const p = await (await cr.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
      await p.goto(`http://127.0.0.1:8827/design/${d}.html?s=${s}`); await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(OUT, `${d}-${s}-desk.png`) });
    }
  }
  await wk.close(); await cr.close(); console.log("ok");
})();
