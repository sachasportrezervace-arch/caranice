// Česká sada slov pro Čáranici: tři obtížnosti, podstatná jména a krátká spojení, která jde nakreslit.
// Lehká = jedna věc, kterou nakreslí každý; střední = potřebuje detail nebo kontext; těžká = děj, pocit, místo nebo spojení.
// Slova odděluje čárka, aby šla zapsat i víceslovná spojení.

const LEHKA = `
pes, kočka, ryba, pták, kůň, kráva, prase, ovce, koza, slepice, kachna, myš, had, žába, šnek, včela, motýl, pavouk,
želva, zajíc, medvěd, liška, vlk, lev, slon, žirafa, zebra, opice, tučňák, sova, velryba, žralok, krokodýl, veverka, ježek,
dům, strom, květina, slunce, měsíc, hvězda, mrak, déšť, duha, sníh, hora, řeka, moře, ostrov, sopka,
auto, kolo, vlak, letadlo, loď, raketa, autobus, traktor, tramvaj, vrtulník,
jablko, hruška, banán, třešně, jahoda, meloun, citron, mrkev, okurka, rajče, houba, hrnek, talíř, lžíce, vidlička,
pizza, dort, zmrzlina, chleba, sýr, vejce, párek, bonbon, lízátko,
stůl, židle, postel, lampa, okno, dveře, klíč, hodiny, telefon, kniha, tužka, nůžky, deštník, brýle, čepice,
bota, ponožka, tričko, kalhoty, šála, rukavice, kabelka, batoh, prsten, koruna,
balon, míč, kostka, panenka, drak, robot, sněhulák, duch, srdce, kytara, buben
`;

const STREDNI = `
maják, mlýn, hrad, kostel, stan, iglú, kašna, most, semafor, plot, žebřík, komín, studna, houpačka, skluzavka,
klobouk, kravata, knoflík, zip, zrcadlo, hřeben, kartáček, mýdlo, ručník, vana, sprcha, pračka, lednice, mikrovlnka,
vysavač, žehlička, konvice, toustovač, mixér, televize, počítač, sluchátka, mikrofon, fotoaparát, dalekohled, lupa,
kompas, mapa, poklad, pirát, rytíř, princezna, čaroděj, víla, mořská panna, kovboj, astronaut, kuchař, hasič, policista,
zubař, doktor, učitelka, pekař, zahradník, rybář, malíř,
kaktus, palma, tulipán, slunečnice, kopretina, vánoční stromek, dýně, kukuřice, hrozny, ananas, kokos, avokádo,
pavučina, hnízdo, mraveniště, úl, paroží, peří, tlapka, ocas, zobák, ploutev, krunýř,
plachetnice, ponorka, horkovzdušný balon, koloběžka, skateboard, kolečkové brusle, lyže, sáně, kočárek,
fotbal, tenis, bowling, šipky, šachy, trampolína, bazén,
hamburger, hranolky, špagety, palačinka, sushi, popcorn, kobliha, perník, rohlík, preclík
`;

const TEZKA = `
sněhová koule, polibek, rande, svatba, narozeniny, dovolená, piknik, táborák, ohňostroj, karneval,
selfie, budík, ranní káva, únava, zívání, kýchnutí, škytavka, chrápání, noční můra,
láska, žárlivost, štěstí, strach, překvapení, stesk,
zácpa na dálnici, výtah, fronta v obchodě, nákupní košík, pokladna, dálkové ovládání, nabíječka, heslo k wifi,
houpací síť, stan v dešti, spacák, bludiště,
černá díra, zatmění slunce, výbuch sopky, tornádo, zemětřesení, povodeň, blesk, polární záře,
tajný agent, superhrdina, upír, mumie, kostlivec, vlkodlak, jednorožec, mimozemšťan,
lezení po skále, skok do vody, jízda na koni, rybaření, potápění, surfování, bruslení,
kocovina, dieta, posilovna, jóga, maraton,
pražský orloj, Karlův most, Sněžka, Eiffelova věž, pyramidy, socha svobody,
první rande, ztracené klíče, rozbitý telefon, vybitá baterie, spálená večeře,
lenochod, chobotnice, plameňák, klokan, pštros, delfín, netopýr, chameleon, mravenečník, hroch,
sněžný pes, robotický vysavač, ponožka v pračce, pavouk ve vaně, kočka na klávesnici
`;

const rozloz = t => [...new Set(t.split(",").map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean))];

export const SLOVA = { lehka: rozloz(LEHKA), stredni: rozloz(STREDNI), tezka: rozloz(TEZKA) };
export const OBTIZNOSTI = [
  { id: "lehka", nazev: "Lehké", bonus: 0 },
  { id: "stredni", nazev: "Střední", bonus: 1 },
  { id: "tezka", nazev: "Těžké", bonus: 2 },
];

// tři návrhy na kolo, jeden z každé obtížnosti, bez slov, která už v partii padla
export function navrhy(rand, pouzita = new Set()) {
  return OBTIZNOSTI.map(o => {
    const volna = SLOVA[o.id].filter(w => !pouzita.has(w));
    const zdroj = volna.length ? volna : SLOVA[o.id];
    return { slovo: zdroj[Math.floor(rand() * zdroj.length)], obt: o.id };
  });
}
