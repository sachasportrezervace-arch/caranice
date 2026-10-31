# Deník – Čáranice

PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

## 31. 10. 2026 – napojení na Hernu (protokol 1)

- `index.html`: `<meta name="herna-protokol" content="1">`. `src/main.js`: s `#herna=1&r=…&seat&names&zaklada` hra přeskočí výzvu i setup. Zakladatel (`zaklada=1`) založí dokument `caranice-<r>` rovnou se jmény z `names` a sedne si jako x, pozvaný (`zaklada=0`) čeká („Čeká se, až hra naskočí“), pak se sám posadí jako o (stejný zápis jako „Přijmout výzvu“, bez `introMine`). Jména se čtou ze surového hashe (čárka ve jménu přežije), max. 16 znaků. Adresa se nepřepisuje na `#r.`.
- Skryté: sdílení odkazu, Vyzvat soupeře, Zkusit sám, pole jména, přijetí výzvy, věta o odkazu v galerii. Přibylo „Jiná hra“ vedle „Odveta“ (pošle `jina-hra`).
- Zprávy rodiči: `pripraveno`; `stav` ceka (čeká se / zakladatel před příchodem soupeře), hraje (kola), konec (obrazovka výsledku partie); `vysledek` jednou na partii z obrazovky výsledku (`partie` = `<r>:<číslo partie>`, `vitez` = sedadlo v Herně podle vlastního místa, remíza `null`). Bez `#herna` nebo s neplatným `r` je všechno jako dřív (výzva, `#solo`, série, `#r.<id>` a pojistka zakladatele).
- Test `tests/herna.cjs` (maketa Herny jako rodič, lišta 48 px, Chromium 1440×900 + WebKit iPhone 13): zakladatel první / pozvaný první, reload obou, celá partie bez výzvy, jména s čárkou a diakritikou, výsledek od obou hráčů přesně jednou, role prohozené (zakladatel seat 1, jasný vítěz = seat 1), `jina-hra`, iPhone bez posunu stránky, kontrola bez Herny.
- Testy lokálně (server 8810): `logika.test.mjs` 26 PASS exit 0; `herna.cjs` 26 PASS exit 0; `solo.cjs` 88 PASS exit 0; `duel.cjs` 26 PASS exit 0. Živě po nasazení commitu 157bd12: `node tests/herna.cjs https://sachasportrezervace-arch.github.io/caranice/` 26 PASS exit 0.
- NEOVĚŘENO: běh uvnitř skutečné Herny (jen maketa rodiče, vlastní, ne `herna/tests/maketa`); losování začínajícího se nemění (v Čáranicích kreslí první vždy zakladatel, jako v ostré hře).

## 31. 10. 2026 – sólo režim (trénink) pro test

- Úvod: odkaz „Zkusit sám“ pod „Vyzvat soupeře“, nebo přímo `#solo`. Nic se neposílá (žádný dotaz na mantledb, žádná místnost, žádná série), `#r.<id>` funguje jako dřív. Kód `src/solo.js`, ukázky `src/ukazky.js` (generuje `node tools/ukazky.mjs`), úpravy `src/main.js` (tlačítko, `#solo`, háček `__car.solo`) a CSS v `index.html`.
- Hádání: 8 zaznamenaných kreseb (dům, kočka, slunce, ryba, strom, jablko, zrcadlový motýl, maják), přehrávají se v původním tempu, stopky, tolerantní tip (`porovnej`), nápověda, vzdání, odhalení s časem a oknem „kresba trvala“. V sezení se neopakují (sessionStorage).
- Kreslení: slovo ze `slova.js`, stejné plátno a nástroje, módy se losují (první kresba bez). Hotovo → zakódování → localStorage `car-solo-kresba` → načtení → dekódování → přehrání; kontrola ukazuje velikost v kB a shodu, neshoda ukáže chybu.
- Test odhalil únik odpovědi: u slova „kočka“ prozrazovalo odpověď jméno postavy „Kočka kreslí“. Ukázky teď mají pod postavou „Ukázková kresba“ a kočičí postava u slova kočka nekreslí; test hlídá, že se žádné slovo ukázky neobjeví v textu obrazovky.
- Testy (lokálně, server `node tools/serve.mjs 8810`): `node tests/logika.test.mjs` 26 PASS exit 0; `node tests/solo.cjs` 88 PASS exit 0 (Chromium 1440×900 i WebKit iPhone 13: nic na mantledb ani `/api/`, konzole čistá, iPhone bez scrollu); `node tests/duel.cjs` 26 PASS exit 0. Dva dřívější běhy duelu měly 1 FAIL na časování „přenos do 4 s“ (4,8 s a 5,0 s) při 100% zátěži CPU od ostatních sessions; stejný běh na nezměněném HEAD dopadl hůř (10,8 s), takže jde o zátěž, ne o regresi.
- Živě: https://sachasportrezervace-arch.github.io/caranice/#solo , `node tests/solo.cjs "https://sachasportrezervace-arch.github.io/caranice/"` 88 PASS exit 0 (commit 818e2d0 nasazen). První živý běh po commitu c046f45 měl 2 FAIL, oba chyba testu (zrcadlová ukázka vyšla jako první a pod zátěží se plátno překreslilo později než 150 ms), test je opraven.
- NEOVĚŘENO: skutečný iPhone v ruce (jen WebKit emulace s touch pointer událostmi), landscape, 1280×720 a 1920×1080, design-eye na sólo obrazovky nebyl pouštěn (jen vlastní kontrola snímků v `tests/shots/solo-*`), Safari bez localStorage (anonymní režim) jen ošetřeno try/catch a hlášeno v kontrole, ne testem.

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
