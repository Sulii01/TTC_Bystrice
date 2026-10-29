# -*- coding: utf-8 -*-
"""
Parsování zápisu o utkání na STIS (/zapis/.../utkani-ID) do JSON pro stránku zapas.html.

Zápis má tři tabulky:
  table.zapis_H            hlavička (soutěž, kolo, kategorie, družstva, místo, čas, rozhodčí,
                           celkový výsledek v bodech / sadách / míčcích, vítěz)
  table.zapis              jednotlivé hry (čtyřhry i dvouhry, výsledky setů, sady, průběžné body)
  table.zapis.statistika   bilance jednotlivých hráčů v utkání
"""
import re
from html import unescape as html_unescape


def _text(s):
    s = re.sub(r"<br\s*/?>", " ", s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html_unescape(s)).strip()


def _int(s):
    try:
        return int(str(s).strip())
    except (TypeError, ValueError):
        return None


def _hraci(cell):
    # [{"id": "43941", "jmeno": "Telecký Jaroslav"}, ...] (čtyřhra = 2 hráči)
    return [{"id": i, "jmeno": _text(n)}
            for i, n in re.findall(r'<a data-id="(\d+)"[^>]*>(.*?)</a>', cell, re.S)]


def _druzstvo(cell):
    m = re.search(r'<a href="/druzstvo-(\d+)/[^"]*">(.*?)</a>', cell, re.S)
    return {"id": m.group(1), "nazev": _text(m.group(2))} if m else {"id": None, "nazev": _text(cell)}


def parse_zapis(html):
    hm = re.search(r'<table class="zapis_H">(.*?)</table>', html, re.S)
    if not hm:
        return None
    h = hm.group(1)
    rows = re.findall(r"<tr>(.*?)</tr>", h, re.S)
    cells = [re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S) for r in rows]
    data = {}

    def najdi(label):
        # buňka bezprostředně za buňkou s daným popiskem
        for row in cells:
            for i, c in enumerate(row):
                if _text(c).startswith(label) and i + 1 < len(row):
                    return row[i + 1]
        return ""

    m = re.search(r"Název soutěže:\s*<b>\s*(?:<a[^>]*>)?(.*?)(?:</a>)?</b>", h, re.S)
    data["soutez"] = _text(m.group(1)) if m else ""
    m = re.search(r"Kolo:\s*<b>\s*(.*?)</b>", h, re.S)
    data["kolo"] = _text(m.group(1)) if m else ""
    m = re.search(r"Kategorie:\s*<b>\s*(.*?)</b>", h, re.S)
    data["kategorie"] = _text(m.group(1)) if m else ""
    data["domaci"] = _druzstvo(najdi("POŘÁDAJÍCÍ"))
    data["hoste"] = _druzstvo(najdi("HOSTUJÍCÍ"))
    data["misto"] = _text(najdi("Hráno v místnosti"))
    data["datum"] = _text(najdi("Datum dle rozpisu"))
    data["zacatek"] = _text(najdi("Začátek"))
    data["konec"] = _text(najdi("Konec"))
    data["vrchni_rozhodci"] = _text(najdi("Vrchní"))
    data["rozhodci"] = [t for t in (_text(row[i + 1]) for row in cells for i, c in enumerate(row)
                                    if _text(c) == "Rozhodčí:" and i + 1 < len(row)) if t]
    data["online"] = "online" in h

    # řádek s čísly celkového výsledku: body : , sady : , míčky : , vítěz
    for row in cells:
        t = [_text(c) for c in row]
        if len(t) >= 9 and t[1] == ":" and t[4] == ":" and t[7] == ":":
            data["body"] = [_int(t[0]), _int(t[2])]
            data["sady"] = [_int(t[3]), _int(t[5])]
            data["micky"] = [_int(t[6]), _int(t[8])]
            data["vitez"] = _druzstvo(row[9]) if len(row) > 9 else None
            break

    # jednotlivé hry
    hry = []
    zm = re.search(r'<table class="zapis">(.*?)</table>', html, re.S)
    if zm:
        for r in re.findall(r"<tr>(.*?)</tr>", zm.group(1), re.S):
            tds = re.findall(r"<td[^>]*>(.*?)</td\s*>", r, re.S)
            if len(tds) < 14 or not re.match(r"\s*\d+\.", _text(tds[0])):
                continue
            sety = [_int(_text(x)) for x in tds[5:10]]
            hry.append({
                "c": _int(_text(tds[0]).rstrip(".")),
                "domaci": _hraci(tds[1]),
                "hoste": _hraci(tds[3]),
                "sety": [s for s in sety if s is not None],      # kladné = set domácích, záporné = hostů
                "sady": [_int(_text(tds[10])), _int(_text(tds[11]))],
                "stav": [_int(_text(tds[12])), _int(_text(tds[13]))],   # průběžné body utkání
            })
    data["hry"] = hry

    # statistika jednotlivých hráčů
    stat = {"domaci": [], "hoste": []}
    sm = re.search(r'<table class="zapis statistika">(.*?)</table>', html, re.S)
    if sm:
        for r in re.findall(r"<tr>(.*?)</tr>", sm.group(1), re.S):
            tds = re.findall(r"<td([^>]*)>(.*?)</td>", r, re.S)
            if len(tds) != 6:
                continue
            for strana, (a, b, c) in (("domaci", tds[0:3]), ("hoste", tds[3:6])):
                pid = re.search(r'data-id="(\d+)"', a[0])
                stat[strana].append({"id": pid.group(1) if pid else None, "jmeno": _text(a[1]),
                                     "vyhry": _int(_text(b[1])), "prohry": _int(_text(c[1]))})
    data["statistika"] = stat
    return data
