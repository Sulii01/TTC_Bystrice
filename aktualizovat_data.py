#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aktualizace dat webu TTC Bystřice ze STIS (stis.ping-pong.cz)
==============================================================

Co dělá:
  Stáhne z STIS aktuální tabulku, rozpis/výsledky utkání a soupisku pro
  všechna 4 družstva (A/B/C/D) a doplní je do tym-a.html .. tym-d.html.
  Na hlavní stránce (index.html) doplní pro KAŽDÝ tým zvlášť: "Výsledky
  posledních zápasů" (poslední odehraný zápas), "Nejbližší zápasy" (nejbližší
  budoucí utkání) a "Tabulky soutěží" (průběžná tabulka dané soutěže).

  Pokud STIS pro danou soutěž ještě nemá zveřejněná žádná data (typicky před
  začátkem sezóny), příslušná stránka se PONECHÁ BEZE ZMĚNY (zůstane pěkné
  "zatím není k dispozici" hlášení) — nic se nerozbije.

Jak spustit:
  python aktualizovat_data.py

  (Potřebuje jen běžný Python 3, žádné další knihovny se neinstalují.)

Jak upravit na příští sezónu:
  Až STIS otevře nový ročník, změňte ROCNIK a ID soutěží/družstev v sekci
  TEAMS níže (ID najdete v adrese, když si na stis.ping-pong.cz otevřete
  stránku vašeho družstva, např. .../soutez-6722/... a .../druzstvo-66623).

Jak to funguje uvnitř:
  Skript v HTML souborech hledá dvojice značek jako
    <!-- DATA:TABULKA:START -->  ...  <!-- DATA:TABULKA:END -->
  a nahrazuje POUZE obsah mezi nimi. Zbytek stránky (vzhled, texty, odkazy)
  zůstává tak, jak je — skript se ho vůbec nedotkne.
"""

import re
import json
import os
import sys
from urllib.request import Request, build_opener, HTTPCookieProcessor
from http.cookiejar import CookieJar
from html import unescape as html_unescape

BASE = "https://stis.ping-pong.cz"
SVAZ = "420802"
ROCNIK = "2026"            # soutěžní ročník — při nové sezóně změňte
NAS_ODDIL = "420802047"    # ID oddílu TTC Bystřice na STIS

TEAMS = [
    {"letter": "A", "nazev": "TTC Bystřice",   "soutez": "6722", "druzstvo": "66623", "file": "tym-a.html"},
    {"letter": "B", "nazev": "TTC Bystřice B", "soutez": "6723", "druzstvo": "66625", "file": "tym-b.html"},
    {"letter": "C", "nazev": "TTC Bystřice C", "soutez": "6726", "druzstvo": "66628", "file": "tym-c.html"},
    {"letter": "D", "nazev": "TTC Bystřice D", "soutez": "6727", "druzstvo": "66629", "file": "tym-d.html"},
]

ROOT = os.path.dirname(os.path.abspath(__file__))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


# ---------------------------------------------------------------------------
# Stahování ze STIS
# ---------------------------------------------------------------------------

def make_opener():
    return build_opener(HTTPCookieProcessor(CookieJar()))


def fetch_raw(opener, path):
    req = Request(BASE + path, headers={"User-Agent": UA})
    with opener.open(req, timeout=25) as resp:
        return resp.read()


def decode_mixed(raw):
    """STIS bohužel míchá kódování: statické části stránky posílá jako
    Windows-1250, ale data z databáze (jména, výsledky) jako UTF-8 ve stejné
    odpovědi. Tahle funkce prochází bajty a tam, kde najde platnou UTF-8
    sekvenci, ji použije, jinak dekóduje po jednom bajtu jako Windows-1250."""
    out = []
    i, n = 0, len(raw)
    while i < n:
        b = raw[i]
        if b < 0x80:
            out.append(chr(b))
            i += 1
            continue
        matched = False
        for length in (4, 3, 2):
            if i + length <= n:
                try:
                    out.append(raw[i:i + length].decode("utf-8"))
                except UnicodeDecodeError:
                    continue
                i += length
                matched = True
                break
        if not matched:
            out.append(bytes([b]).decode("cp1250", errors="replace"))
            i += 1
    return "".join(out)


def fetch(opener, path):
    """STIS bez ověřené session vrací jen prázdnou 'gate' stránku (pár set bajtů).
    Ověření session se dělá přidáním '?nuser=1' k dotazu — server na to odpoví
    rovnou skutečným obsahem a od té chvíle je session platná pro celou session
    (i pro jiné stránky). Když se stub objeví, dotaz zopakujeme s '?nuser=1'."""
    raw = fetch_raw(opener, path)
    if len(raw) < 2000:
        sep = "&" if "?" in path else "?"
        raw = fetch_raw(opener, path + sep + "nuser=1")
    return decode_mixed(raw)




# ---------------------------------------------------------------------------
# Parsování tabulky soutěže (embedovaná JSON data ve stránce /tabulka/...)
# ---------------------------------------------------------------------------

def parse_tabulka(html, nas_oddil):
    m = re.search(r'var initTabData\s*=\s*"(.*?)";', html, re.S)
    if not m:
        return None
    try:
        # STIS posílá data jako JSON text, ještě jednou zabalený jako JSON řetězec
        # (tzn. dvojitě zakódované) — proto se dekóduje json.loads dvakrát za sebou.
        inner_json_text = json.loads('"' + m.group(1) + '"')
        data = json.loads(inner_json_text)
    except json.JSONDecodeError:
        return None
    tables = data.get("tables") or []
    if not tables or not tables[0].get("data"):
        return None
    rows = []
    for i, r in enumerate(tables[0]["data"], start=1):
        rows.append({
            "poradi": i,
            "nazev": r.get("nazev", ""),
            "je_nas": str(r.get("id_oddil")) == nas_oddil,
            "zapasy": r.get("pocet", 0),
            "v": r.get("vyhry", 0),
            "r": r.get("remizy", 0),
            "p": r.get("prohry", 0),
            "skore": f'{r.get("vyhrbody", 0)}:{r.get("prohrbody", 0)}',
            "body": r.get("body", 0),
        })
    return rows


# ---------------------------------------------------------------------------
# Parsování rozpisu a výsledků utkání (/los-vse/...)
# ---------------------------------------------------------------------------

TD_RE = re.compile(r'<td[^>]*class="([^"]*)"[^>]*>|<td[^>]*>', re.S)


def _cell_text(cell_html):
    # vezme čitelný text buňky (řeší i <a>Text</a> uvnitř)
    text = re.sub(r"<[^>]+>", " ", cell_html)
    text = html_unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_vysledek(cell_html):
    # buňka s výsledkem obsahuje atribut poznamka="<b>..." s detailem zápasu,
    # který má uvnitř svoje vlastní "<" a ">" — obecné odstranění tagů by ho
    # nesprávně vysypalo do viditelného textu, proto se cílí přímo na
    # 'class="vysledek">SKÓRE<' (jednoznačný text bezprostředně před viditelným skóre).
    m = re.search(r'class="vysledek">([^<]*)<', cell_html)
    if m:
        return html_unescape(m.group(1)).strip()
    return _cell_text(cell_html)


def parse_los(html):
    if "Žádná utkání!" in html:
        return []
    tbody_m = re.search(r'<table class="table los.*?<tbody>(.*?)</tbody>', html, re.S)
    if not tbody_m:
        return []
    rows_html = re.findall(r"<tr>(.*?)</tr>", tbody_m.group(1), re.S)
    matches = []
    for row_html in rows_html:
        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", row_html, re.S)
        if len(cells) < 4:
            continue
        kolo = _cell_text(cells[0]).rstrip(".").strip()
        datum = _cell_text(cells[1])
        domaci = _cell_text(cells[2])
        hoste = _cell_text(cells[3])
        vysledek = _extract_vysledek(cells[4]) if len(cells) > 4 else ""
        if not (kolo or datum or domaci or hoste):
            continue
        matches.append({
            "kolo": kolo, "datum": datum, "domaci": domaci,
            "hoste": hoste, "vysledek": vysledek,
        })
    return matches


# ---------------------------------------------------------------------------
# Parsování soupisky družstva (/soupisky/...)
# ---------------------------------------------------------------------------

def parse_soupiska(html, id_druzstvo):
    # oddílové soupisky jsou jedna společná tabulka pro celou soutěž,
    # rozdělená hlavičkovými řádky <tr><th ... value="ID">Název</th></tr>
    pattern = re.compile(
        r'<tr>\s*<th colspan="7" class="head-dru" value="(\d+)">.*?</th>\s*</tr>(.*?)(?=<tr>\s*<th colspan="7"|$)',
        re.S,
    )
    for team_id, block in pattern.findall(html):
        if team_id != str(id_druzstvo):
            continue
        players = []
        for row_html in re.findall(r"<tr[^>]*class=\"[^\"]*c-dru[^\"]*\">(.*?)</tr>", block, re.S):
            cells = re.split(r"<td>", row_html)
            cells = [c for c in cells if c.strip()]
            texts = [_cell_text(c) for c in cells]
            texts = [t for t in texts if t != ""]
            if len(texts) < 4:
                continue
            poradi, jmeno, rocnik_nar, umisteni = texts[0], texts[1], texts[2], texts[3]
            str_rating = texts[4] if len(texts) > 4 else ""
            players.append({
                "poradi": poradi.rstrip("."),
                "jmeno": jmeno,
                "zebricek": f"{umisteni} (STR {str_rating})" if str_rating else umisteni,
            })
        return players
    return None


# ---------------------------------------------------------------------------
# Generování HTML fragmentů
# ---------------------------------------------------------------------------

def render_tabulka(rows):
    body = ['<div class="table-wrap">', '  <table class="tabulka">', "    <thead>",
            "      <tr><th>#</th><th>Družstvo</th><th>Zápasy</th><th>V</th><th>R</th>"
            "<th>P</th><th>Skóre</th><th>Body</th></tr>", "    </thead>", "    <tbody>"]
    for r in rows:
        cls = ' class="tabulka--nas"' if r["je_nas"] else ""
        body.append(
            f'      <tr{cls}><td>{r["poradi"]}</td><td>{r["nazev"]}</td><td>{r["zapasy"]}</td>'
            f'<td>{r["v"]}</td><td>{r["r"]}</td><td>{r["p"]}</td><td>{r["skore"]}</td><td>{r["body"]}</td></tr>'
        )
    body += ["    </tbody>", "  </table>", "</div>"]
    return "\n    ".join(body)


def render_rozpis(matches):
    body = ['<div class="table-wrap">', '  <table class="tabulka">', "    <thead>",
            "      <tr><th>Kolo</th><th>Datum</th><th>Domácí</th><th>Hosté</th><th>Výsledek</th></tr>",
            "    </thead>", "    <tbody>"]
    for m in matches:
        vysl = m["vysledek"] or "—"
        body.append(
            f'      <tr><td>{m["kolo"]}</td><td>{m["datum"]}</td><td>{m["domaci"]}</td>'
            f'<td>{m["hoste"]}</td><td>{vysl}</td></tr>'
        )
    body += ["    </tbody>", "  </table>", "</div>"]
    return "\n    ".join(body)


def render_soupiska(players):
    if not players:
        return (
            '<p style="margin:0">Družstvo zatím <strong style="color:var(--yellow)">nemá schválenou soupisku</strong> '
            "pro tuto sezónu.</p>"
            '<div class="table-wrap" style="margin-top:18px"><table class="roster-table">'
            "<thead><tr><th>#</th><th>Jméno hráče</th><th>Žebříček</th></tr></thead>"
            '<tbody><tr><td colspan="3" style="text-align:center;color:var(--grey)">'
            "Soupiska zatím nebyla schválena</td></tr></tbody></table></div>"
        )
    rows = "".join(
        f'<tr><td>{p["poradi"]}</td><td>{p["jmeno"]}</td><td>{p["zebricek"]}</td></tr>'
        for p in players
    )
    return (
        '<p style="margin:0">Aktuální soupiska družstva pro tuto sezónu:</p>'
        f'<div class="table-wrap" style="margin-top:18px"><table class="roster-table">'
        "<thead><tr><th>#</th><th>Jméno hráče</th><th>Žebříček</th></tr></thead>"
        f"<tbody>{rows}</tbody></table></div>"
    )


def render_vysledek_karta(last_match, team_letter):
    if not last_match or not last_match.get("vysledek"):
        return ('<div class="result-card__empty">Zatím žádný odehraný zápas v této sezóně.</div>')
    return (
        f'<div class="result-card__score">{last_match["vysledek"]}</div>'
        f'<div class="result-card__meta">{last_match["domaci"]} – {last_match["hoste"]}'
        f' · {last_match["datum"]}</div>'
    )


def render_nejblizsi(next_match):
    if not next_match:
        return '<div class="match-card__empty">Momentálně není naplánován žádný nadcházející zápas.</div>'
    return (
        '<div class="match-card__teams">'
        f'<span class="match-card__team">{next_match["domaci"]}</span>'
        '<span class="match-card__vs">VS</span>'
        f'<span class="match-card__team">{next_match["hoste"]}</span>'
        "</div>"
        f'<div class="match-card__meta">Kolo {next_match["kolo"]} · {next_match["datum"]}</div>'
    )


# ---------------------------------------------------------------------------
# Náhrada obsahu mezi značkami v HTML souborech
# ---------------------------------------------------------------------------

def replace_marker(html, marker, new_inner):
    pattern = re.compile(
        r"(<!--\s*DATA:" + re.escape(marker) + r":START\s*-->)(.*?)(<!--\s*DATA:" + re.escape(marker) + r":END\s*-->)",
        re.S,
    )
    if not pattern.search(html):
        print(f"  [!] značka DATA:{marker} nenalezena, přeskočeno")
        return html, False
    return pattern.sub(lambda m: m.group(1) + "\n      " + new_inner + "\n      " + m.group(3), html), True


def load(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def save(path, content):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Hlavní běh
# ---------------------------------------------------------------------------

def main():
    opener = make_opener()
    print("Připojuji se na STIS...")

    all_last_matches = {}
    upcoming_by_letter = {}
    all_tables = {}
    teams_with_los_data = set()

    for team in TEAMS:
        letter, soutez, druzstvo, fname = team["letter"], team["soutez"], team["druzstvo"], team["file"]
        print(f"\nTým {letter} — soutěž {soutez}, družstvo {druzstvo}")
        path = os.path.join(ROOT, fname)
        if not os.path.exists(path):
            print(f"  [!] soubor {fname} nenalezen, přeskočeno")
            continue
        html = load(path)
        changed = False

        # tabulka
        tab_html = fetch(opener, f"/tabulka/svaz-{SVAZ}/rocnik-{ROCNIK}/soutez-{soutez}")
        rows = parse_tabulka(tab_html, NAS_ODDIL)
        if rows:
            all_tables[letter] = rows
            html, ok = replace_marker(html, "TABULKA", render_tabulka(rows))
            changed = changed or ok
            print(f"  tabulka: {len(rows)} družstev (aktualizováno)")
        else:
            print("  tabulka: STIS ji pro tuto soutěž zatím nemá — ponechávám beze změny")

        # rozpis a výsledky
        los_html = fetch(opener, f"/los-vse/svaz-{SVAZ}/rocnik-{ROCNIK}/soutez-{soutez}/druzstvo-{druzstvo}")
        matches = parse_los(los_html)
        if matches:
            teams_with_los_data.add(letter)
            html, ok = replace_marker(html, "ROZPIS", render_rozpis(matches))
            changed = changed or ok
            print(f"  rozpis: {len(matches)} utkání (aktualizováno)")

            played = [m for m in matches if m["vysledek"]]
            if played:
                all_last_matches[letter] = played[-1]
            future = [m for m in matches if not m["vysledek"]]
            if future:
                upcoming_by_letter[letter] = future[0]
        else:
            print("  rozpis: STIS pro tuto soutěž zatím nemá utkání — ponechávám beze změny")

        # soupiska
        soup_html = fetch(opener, f"/soupisky/svaz-{SVAZ}/rocnik-{ROCNIK}/soutez-{soutez}")
        players = parse_soupiska(soup_html, druzstvo)
        if players:
            html, ok = replace_marker(html, "SOUPISKA", render_soupiska(players))
            changed = changed or ok
            print(f"  soupiska: {len(players)} hráčů (aktualizováno)")
        else:
            print("  soupiska: zatím neschválená — ponechávám beze změny")

        if changed:
            save(path, html)
            print(f"  -> uloženo do {fname}")

    # index.html — výsledky posledních zápasů, nejbližší zápasy, tabulky soutěží
    index_path = os.path.join(ROOT, "index.html")
    if os.path.exists(index_path):
        print("\nindex.html")
        html = load(index_path)
        any_change = False
        for team in TEAMS:
            letter = team["letter"]

            if letter in all_tables:
                html, ok = replace_marker(html, f"TABULKA:{letter}", render_tabulka(all_tables[letter]))
                any_change = any_change or ok

            if letter not in teams_with_los_data:
                # STIS pro tento tým zatím nemá vůbec žádné rozlosování — nechat
                # stránku beze změny, ať tam zůstane hezčí popisný placeholder.
                continue
            last = all_last_matches.get(letter)
            html, ok = replace_marker(html, f"VYSLEDKY:{letter}", render_vysledek_karta(last, letter))
            any_change = any_change or ok

            next_match = upcoming_by_letter.get(letter)
            html, ok = replace_marker(html, f"NEJBLIZSI:{letter}", render_nejblizsi(next_match))
            any_change = any_change or ok

        if any_change:
            save(index_path, html)
            print("  -> uloženo do index.html")

    print("\nHotovo.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover
        print(f"\nChyba: {exc}")
        sys.exit(1)
