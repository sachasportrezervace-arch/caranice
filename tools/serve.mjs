// Lokální statický server pro vývoj a testy: node tools/serve.mjs [port]  (výchozí 8810)
// /api/<ns>/<klíč> je náhrada mantledb.sh v paměti (GET 404/JSON, POST uloží, limit 64 KB jako ostře), zapne se ?api=local.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = +process.argv[2] || 8810;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
const DB = new Map();
http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.startsWith("/api/")) {
    if (req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      if (body.length > 65536) { res.writeHead(413).end("too large"); return; }
      DB.set(p, body); res.writeHead(200, { "Content-Type": "application/json" }).end("{}"); return;
    }
    if (!DB.has(p)) { res.writeHead(404).end("{}"); return; }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(DB.get(p)); return;
  }
  if (p.endsWith("/")) p += "index.html";
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
  try { const b = await readFile(f); res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }).end(b); }
  catch { res.writeHead(404).end("404"); }
}).listen(PORT, "127.0.0.1", () => console.log("serve http://127.0.0.1:" + PORT + "/"));
