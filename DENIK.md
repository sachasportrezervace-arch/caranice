# Deník – Čáranice

PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

## 31. 10. 2026 – NASAZENO

- Živě: https://sachasportrezervace-arch.github.io/caranice/ (repo `sachasportrezervace-arch/caranice`, Pages z `main`).
- Design-eye kolo 2: **ANO, profi indie hra** (kolo 1 NE → opraveny kolize ovládání, rod „(a)“, popisky ≥14 px na desktopu, plakátové rozvržení setupu, galerie v řadě).
- `node tests/logika.test.mjs` 26 PASS exit 0; `node tests/duel.cjs` lokálně 26 PASS exit 0; živě `node tests/duel.cjs "https://sachasportrezervace-arch.github.io/caranice/?limit=30"` 26 PASS exit 0 (ostrá mantledb, přenos kresby 2,3 s).
- NEOVĚŘENO: skutečný iPhone v ruce (jen WebKit emulace s touch pointer událostmi), landscape, desktop 1280×720/1920×1080.
- Zbývá (neblokuje): výběr slova na desktopu je úzký sloupec; galerie na mobilu pod ohybem; šedé neaktivní „Kreslit!“; vlajka Vzdát bez popisku; odznaky titulů v nestejné šířce.

## 31. 10. 2026 – předávka (session účtu P, kontext plný)

**Hotovo a ověřeno**
- Směr vybral design-eye: **A „Plakát“** (modré pole, žlutý šikmý štítek se slovem, sázková lišta), z B převzaty stopky s výsečí sázky, barva = hráč (Mark korálová `#FF6B4A`, soupeř tyrkys `#2BD4A4`), diagonální rozdělení pole jen na odhalení.
- Hra: `index.html` + `src/main.js` (obrazovky), `src/hra.js` (pravidla, čistá logika), `src/kresba.js` (záznam, RDP zjednodušení, varint kód, vykreslení s časem), `src/net.js` (mantledb: `hra`, `x`, `o`, kresba `d<k>` každé kolo zvlášť, limit 64 KB/dokument).
- Pravidla: 6 kol v partii, kreslíř se střídá, partie začínají střídavě. Kreslíř vybere ze 3 slov (lehké/střední/těžké) nebo vlastní slovo (třeba jméno soupeře) a vsadí okno 10 s (dotah při prohře o 4+: 15 s). Uhodnutí 2–4 body, nápověda −1, trefa okna +3 oběma. Modifikátory 3 z 6 kol (jedna čára, 3 barvy, zrcadlově, poslepu), plán se mění partie od partie. Tituly za partii, série, galerie 6 kreseb, odveta. Slova se v místnosti nikdy neopakují.
- Živý přenos: kreslíř zapisuje `d<k>` co 400 ms, hádač čte co 450 ms a přehrává podle času tahů → živě i async (časovač hádače běží od jeho prvního pohledu).
- `node tests/logika.test.mjs` → 26 PASS, exit 0. `node tests/duel.cjs` (server `node tools/serve.mjs 8810`, URL `?api=local&limit=30`) → 23 PASS, exit 0: Chromium 1440×900 + WebKit iPhone 13, pojistka introMine, kreslení prstem (pointer touch), živý přenos ~1,4 s, tipy živě u kreslíře, trefa = body oběma, nápověda, vzdání, konec partie + galerie, odveta (jiná slova i modifikátory), async přehrávání, divák. Snímky `tests/shots/`.

**Zbývá (první krok nahoře)**
1. Ikony `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` (180) – manifest a index na ně už odkazují, soubory chybí.
2. Design-eye na rendery z `tests/shots/` (desktop + iPhone) → verdikt „profi indie hra“, max 3 kola oprav. Známé slabiny: na desktopu malá hlavička, na partii velká galerie odsouvá obsah, popisky na odhalení.
3. README, nové veřejné repo `sachasportrezervace-arch/caranice`, Pages z `main`, push (`git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`), živý test `node tests/duel.cjs "https://sachasportrezervace-arch.github.io/caranice/?limit=30"` (ostrá mantledb).
4. Zpráva nadřazené session: URL, co je nového, výsledky testů, NEOVĚŘENO (skutečný iPhone v ruce).

**Stav:** git v `caranice/` (lokální, bez remote), server 8810 může běžet – PID v `$TEMP/caranice-8810.pid`.
