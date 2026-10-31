# Čáranice

Hra pro dva na kreslení a hádání slov, běží v prohlížeči bez instalace a bez účtu.
Živě: https://sachasportrezervace-arch.github.io/caranice/

**Twist:** kreslíř si vybere slovo a **vsadí okno**, za kolik vteřin ho druhý uhodne. Trefí-li se uhodnutí do okna, dostanou body oba.

## Jak se hraje

Založ místnost, v adrese se objeví odkaz `#r.<id>` a pošli ho dál. Kdo ho otevře jako druhý, je soupeř, každý další je divák (vidí kresbu živě). Partie má 6 kol, kreslíř se střídá, slova se nikdy neopakují (tři návrhy lehké/střední/těžké, nebo vlastní slovo).

- Uhodnutí: 2, 3 nebo 4 body podle obtížnosti slova.
- Nápověda (počet písmen): −1 bod, uhodnutí vyjde vždy aspoň na 1 bod.
- Trefa okna: +3 oběma.
- Dotah: kdo prohrává o 4 a více bodů, má jako kreslíř širší okno (15 s místo 10 s) a jako hádač první písmeno zdarma.
- Modifikátory (3 kola ze 6, první kolo první partie bez): jedna čára, jen 3 barvy, zrcadlově, poslepu.

## Trénink sám (sólo)

Na úvodu „Zkusit sám“ nebo přímo adresa `#solo`. Běží jen v prohlížeči: žádný požadavek na mantledb, žádná místnost, žádná série. Dvě hry:

- **Hádat kresbu**: 8 ukázkových kreseb (`src/ukazky.js`, generuje je `node tools/ukazky.mjs` přes `K.recorder()` z ručních obrysů). Přehrávají se v původním tempu, běží stopky, tip se porovnává tolerantně (bez diakritiky, drobné překlepy), je nápověda i vzdání a odhalení s časem. Ukázky se v jednom sezení neopakují, jedna je zrcadlová.
- **Nakreslit slovo**: slovo ze `slova.js`, stejné plátno a nástroje jako ve hře, modifikátory se losují. Po „Hotovo“ se kresba zakóduje, uloží do localStorage (`car-solo-kresba`), načte, dekóduje a přehraje; hra ukáže velikost kódu v kB a jestli se načtená kresba shoduje s nakreslenou, jinak ukáže chybu.

Kód je v `src/solo.js`, ze hry pro dva se nic nemění (`#r.<id>` funguje jako dřív).

## Synchronizace

Bez vlastního serveru, přes [mantledb.sh](https://mantledb.sh). Pod `caranice-<id>/` leží dokumenty (limit 64 KB, každý má jediného zapisovatele):

- `hra` – jména, avatary, zařízení na místech x/o,
- `x`, `o` – stav hráče (jeho kola jako kreslíře a hádače),
- `d<k>` – kresba kola k, tahy kódované varintem, zhruba 3–8 kB.

## Struktura

- `index.html`, `manifest.webmanifest`, `icons/`, `fonts/`
- `src/main.js` obrazovky, `src/hra.js` pravidla (čistá logika), `src/kresba.js` záznam, kódování a přehrávání
- `src/net.js` mantledb, `src/slova.js` slova, `src/shoda.js` porovnání tipu, `src/postavicky.js` avatary
- `src/solo.js` sólo trénink, `src/ukazky.js` ukázkové kresby (generované)
- `tools/serve.mjs` lokální server, `tools/ikony.cjs` generátor ikon, `tools/ukazky.mjs` generátor ukázek, `tests/`

## Lokálně a testy

```
node tools/serve.mjs 8810
```

Otevři `http://127.0.0.1:8810/?api=local`. Parametr `?api=local` zapne náhradu mantledb v paměti serveru (limit 64 KB platí stejně).

```
node tests/logika.test.mjs
node tests/duel.cjs
node tests/solo.cjs [URL]
```

`solo.cjs` bere volitelně adresu (třeba živou na Pages), výchozí je `http://127.0.0.1:8810/?api=local`.

`duel.cjs` je souboj dvou prohlížečů v Playwrightu (Chromium a WebKit), potřebuje běžící server.

## Herna

Hra umí protokol Herny (`<meta name="herna-protokol" content="1">`, definice `react-apps/HERNA-PROTOKOL.md`). Otevřená s `#herna=1&m=…&r=…&seat=0|1&names=A,B&zaklada=0|1` přeskočí výzvu i setup: zakladatel (`zaklada=1`) založí dokument `caranice-<r>` se jmény z Herny, pozvaný se k němu posadí sám. Sdílení odkazu, „Vyzvat soupeře“ a „Zkusit sám“ jsou skryté, na konci partie přibyde „Jiná hra“. Rodiči se posílá `pripraveno`, `stav` (`ceka`/`hraje`/`konec`), `vysledek` (`partie` = `<r>:<číslo partie>`, `vitez` = sedadlo v Herně, `null` = remíza) a `jina-hra`. Bez `#herna` je všechno jako dřív. Test: `node tests/herna.cjs [URL]` (maketa Herny, Chromium desktop + WebKit iPhone 13).
