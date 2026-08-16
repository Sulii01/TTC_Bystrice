# TTC Bystřice — poznámky k webu

Tento soubor shrnuje vše podstatné o webu klubu, aby se v tom šlo kdykoliv později
zorientovat (i po delší pauze nebo s pomocí někoho jiného).

---

## 1. Co web je

Čistě **statický web** (HTML + CSS + JS, žádný server, žádná databáze). Dá se otevřít
přímo dvojklikem na `index.html`, nebo nahrát na libovolný webhosting (stačí prostý
"nahrát soubory" hosting, není potřeba PHP/Node/cokoliv serverového).

Titulek webu (v záložce prohlížeče): **TTC Bystřice**.

---

## 2. Struktura souborů

```
TTC_Bystrice/
├── index.html              hlavní stránka
├── tym-a.html               detail týmu A (Okresní přebor)
├── tym-b.html               detail týmu B (Okresní soutěž 1. třídy)
├── tym-c.html               detail týmu C (Okresní soutěž 4. třídy)
├── tym-d.html               detail týmu D (Okresní soutěž 5. třídy)
├── galerie.html              fotogalerie (tréninky, zápasy)
├── aktualizovat_data.py      skript, který stahuje aktuální data ze STIS
├── zapisky.md                 tento soubor
├── css/
│   └── style.css             veškerý vzhled webu (barvy, velikosti, rozvržení)
├── js/
│   └── main.js                mobilní menu + zvětšování fotek v galerii
└── images/
    ├── Logo.jpg               klubové logo
    ├── Banner.jpg              banner (pozadí úvodní sekce)
    └── galerie/                sem se nahrávají fotky do galerie
```

Žádný soubor nikdy nemažte, pokud si nejste jistí, k čemu slouží — hlavně
`aktualizovat_data.py` je "chytrý" a upravuje ostatní soubory za vás (viz níže).

---

## 3. Vzhled — barvy, velikost textu, logo

Všechno vizuální je v jednom souboru: **`css/style.css`**.

### Barvy
Na začátku souboru (`:root { ... }`) jsou definované barvy jako proměnné — žluto-černé
schéma podle loga a banneru, s červenou jako doplňkovou barvou:

```css
--bg:            #0c0c0b;   /* tmavé pozadí stránky */
--card:          #1b1a17;   /* pozadí karet/boxů */
--yellow:        #f7c600;   /* hlavní žlutá */
--red:           #d9202f;   /* doplňková červená */
--white:         #f5f4ef;   /* text */
```
Změnou těchto hodnot se barva projeví na celém webu najednou.

### Velikost textu
```css
:root{
  ...
  font-size: 19px;   /* základní velikost textu celého webu */
}
```
Většina textů na webu je v jednotce `rem`, takže **tohle jedno číslo přeškáluje téměř
všechen text na webu naráz**. Zvyšte/snižte podle potřeby.

### Velikost loga
```css
.brand img{ height: 82px; }         /* logo v hlavičce (nahoře) */
.footer__brand img{ height: 64px; } /* logo v patičce (dole) */
```

---

## 4. Struktura webu — co je kde

### Hlavní stránka (`index.html`)
1. **Hlavička** — logo, název, menu (Domů / Aktuality / Výsledky / Nejbližší zápas / Týmy / Galerie / Kontakt)
2. **Hero sekce** — banner na pozadí, název klubu
3. **Aktuality** — 3 ukázkové karty, momentálně obecné texty (klidně přepište za reálné novinky)
4. **Výsledky posledních zápasů** — karta pro každý tým (A/B/C/D), doplňuje se automaticky skriptem
5. **Nejbližší zápas** — jedna karta s nejbližším utkáním napříč všemi týmy, doplňuje se automaticky
6. **Naše týmy** — 4 klikací karty vedoucí na detail týmu
7. **Tabulky soutěží** — přehledové odkazy na detail týmů
8. **Fotogalerie** — náhled + odkaz na `galerie.html`
9. **Patička** — kontakt, odkazy, sociální sítě

### Stránka týmu (`tym-a.html`, `tym-b.html`, `tym-c.html`, `tym-d.html`)
- Info o družstvu (organizační pracovník, kontakt, herna, míčky, stoly)
- Odkazy na živá data STIS
- Tabulka soutěže (doplňuje se automaticky skriptem)
- Rozpis utkání (doplňuje se automaticky skriptem)
- Sestava týmu / soupiska (doplňuje se automaticky skriptem)

### Galerie (`galerie.html`)
Mřížka fotek s možností kliknutím zvětšit (tzv. lightbox). Zatím prázdná — čeká na
první fotky.

**Jak přidat fotky:**
1. Nahrajte obrázek do `images/galerie/` (např. `images/galerie/2026-09-zapas-a.jpg`)
2. V `galerie.html` zkopírujte tento blok a upravte cestu a popisek:
   ```html
   <figure class="gallery-item">
     <img src="images/galerie/nazev-souboru.jpg" alt="Popis fotky">
     <figcaption>Trénink — srpen 2026</figcaption>
   </figure>
   ```
3. Pokud přidáváte první fotky vůbec, klidně smažte `<div class="gallery-empty">...</div>`
   (to je jen hláška "zatím žádné fotky").

Stejný princip platí i pro menší náhled galerie přímo na hlavní stránce (`index.html`,
sekce `id="galerie"`).

---

## 5. Reálná data klubu (ověřeno na stis.ping-pong.cz)

TTC Bystřice = Bystřice nad Olší, okres Frýdek-Místek, Moravskoslezský kraj.

- **Oddíl STIS:** 420802047, svaz 420802 (OSST Frýdek-Místek), ročník 2026 (sezóna 2026/2027)
- **Herna:** ZŠ Bystřice
- **Klubový web:** ttc-bystrice.cz
- **Klubový e-mail:** ttc.bystrice@seznam.cz, telefon +420 773 168 698
- **Organizační pracovník klubu:** Tomáš Bruk

| Tým | Soutěž | STIS soutěž | STIS družstvo | Organizační pracovník (STIS) |
|---|---|---|---|---|
| A | Okresní přebor | soutez-6722 | druzstvo-66623 | Radek Šedivý |
| B | Okresní soutěž 1. třídy | soutez-6723 | druzstvo-66625 | Tomáš Bruk |
| C | Okresní soutěž 4. třídy | soutez-6726 | druzstvo-66628 | Marek Blahoňovský |
| D | Okresní soutěž 5. třídy | soutez-6727 | druzstvo-66629 | Robert Ebr |

> Pozn.: STIS eviduje u každého družstva svého vlastního "organizačního pracovníka"
> (kontaktní osobu STK pro danou soutěž) — to je jiná role než celkový organizační
> pracovník klubu (Tomáš Bruk), který je uvedený v patičce webu.

K srpnu 2026 STIS pro sezónu 2026/2027 ještě neměl zveřejněné rozlosování ani tabulky
(sezóna ještě nezačala) — proto web na těchto místech ukazuje poctivé "zatím není
k dispozici" hlášky s odkazem na živý STIS, místo vymyšlených dat.

---

## 6. Automatická aktualizace dat — `aktualizovat_data.py`

Web sám o sobě nic ze STIS netahá (je to statický web bez serveru). Místo ručního
přepisování HTML slouží tento skript.

### Jak spustit
Potřeba je jen běžný Python 3 (žádné další knihovny se neinstalují):
```
python aktualizovat_data.py
```
Spouští se z hlavní složky webu (tam, kde je i `index.html`).

### Co dělá
Stáhne ze STIS pro všechny 4 týmy:
- **tabulku soutěže** → doplní do `tym-X.html`
- **rozpis a výsledky utkání** → doplní do `tym-X.html`
- **soupisku družstva** → doplní do `tym-X.html`

A na `index.html` doplní:
- **výsledek posledního odehraného zápasu** pro každý tým
- **nejbližší nadcházející zápas** napříč všemi týmy

### Jak to dělá bezpečně
Skript v HTML souborech hledá dvojice značek:
```html
<!-- DATA:TABULKA:START -->
...
<!-- DATA:TABULKA:END -->
```
a přepisuje **pouze obsah mezi nimi**. Zbytek stránky (vzhled, texty, odkazy) se nikdy
nedotkne. Pokud STIS pro danou soutěž ještě nemá žádná data (typicky před začátkem
sezóny), skript danou sekci **vůbec nezmění** — nechá tam pěkné "zatím není k dispozici"
hlášení.

### Na příští sezónu
Až STIS otevře nový ročník (obvykle na podzim), je potřeba v hlavičce skriptu upravit:
```python
ROCNIK = "2026"   # <- změnit na nové číslo ročníku

TEAMS = [
    {"letter": "A", ..., "soutez": "6722", "druzstvo": "66623", ...},
    ...
]
```
Nová čísla `soutez` a `druzstvo` najdete v adrese, když si na stis.ping-pong.cz otevřete
stránku vašeho družstva (např. `.../soutez-6722/druzstvo-66623`).

---

## 7. Co je v tuto chvíli jen "placeholder" (čeká na doplnění)

- **Aktuality** na hlavní stránce — 3 obecné texty, klidně je přepište za reálné novinky
  (každá aktualita je jeden blok `<article class="news-card">` v `index.html`)
- **Fotogalerie** — zatím prázdná, čeká na první fotky (viz bod 4 výše)
- **Tabulky, rozpisy, soupisky** — doplní se automaticky spuštěním
  `aktualizovat_data.py`, jakmile STIS zveřejní data pro sezónu 2026/2027

---

## 8. Drobné technické poznámky ke STIS (pro budoucí ladění)

Pro případ, že by bylo potřeba skript `aktualizovat_data.py` v budoucnu opravovat nebo
rozšiřovat (např. STIS změní strukturu stránek):

1. **STIS vyžaduje "session handshake"** — první požadavek na stránku vrátí jen
   prázdnou "gate" stránku (pár set bajtů). Přidáním `?nuser=1` k adrese server vrátí
   skutečný obsah a od té chvíle je session platná i pro ostatní stránky.
2. **STIS míchá kódování** — část stránky (statické texty) je Windows-1250, ale data
   z databáze (jména, výsledky) jsou UTF-8, v jedné a téže odpovědi. Skript to řeší
   funkcí `decode_mixed()`, která bajty dekóduje po částech podle toho, co dává smysl.
3. **Tabulka soutěže** je na stránce STIS schovaná jako JSON v `<script>` tagu
   (`var initTabData = "..."`), zakódovaný dvakrát za sebou — proto `json.loads()`
   volané dvakrát.
4. **Rozpis/výsledky** jsou naopak normální HTML tabulka, jen buňka s výsledkem
   obsahuje schovaný atribut s detailem zápasu, který je potřeba parsovat opatrně.

---

*Tento soubor si klidně upravujte a doplňujte — je jen pro vaši (a moji budoucí)
orientaci ve webu, žádná část webu se podle něj automaticky negeneruje.*
