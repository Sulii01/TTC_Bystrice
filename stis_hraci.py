# -*- coding: utf-8 -*-
"""
Parsování stránky hráče na STIS (/hrac-ID/...) do JSON pro stránku hrac.html.

Stránka hráče na STIS obsahuje vše najednou (cca 1 MB HTML):
  - karty sezón (rok narození, oddíl, celková bilance, družstva) — aktuální + starší,
  - tabulku "Bilance dvouher" po sezónách a družstvech,
  - blok eSTeR (STR, stabilní STR, min/max, nejvyšší STR, nejcennější výhry),
  - data grafu STR v JavaScriptu (var mydata / points_label / seasons),
  - všechny zápasy hráče rozdělené po sezónách (<tbody id="page_2026"> ...).
Statistiku soupeřů si stránka hrac.html spočítá sama ze seznamu zápasů.
"""
import json
import re
from html import unescape as html_unescape


def _text(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html_unescape(s)).strip()


def _num(s, typ=int):
    try:
        return typ(str(s).replace(",", ".").replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _js_var(html, name):
    m = re.search(r"var\s+" + name + r"\s*=\s*(\[.*?\]);", html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _bilance(body, co):
    m = re.search(r"Celková bilance " + co + r":</strong>\s*(?:<a[^>]*>)?\s*([\d]+:[\d]+)", body)
    return m.group(1) if m else None


def _druzstva(body):
    m = re.search(r"Družstva \(kat\., soutěž - bil\. dvouher, čtyřher\):</strong><br\s*/?>(.*?)</div>", body, re.S)
    if not m:
        return []
    out = []
    for item in re.split(r"<br\s*/?>", m.group(1)):
        if not item.strip():
            continue
        nazev = re.search(r'<a href="/druzstvo-[^"]*">(.*?)</a>', item)
        soutez = re.search(r'<a href="/tabulka/[^"]*">(.*?)</a>', item)
        bil = re.findall(r"(\d+:\d+)", re.sub(r"<[^>]+>", "", item))
        out.append({
            "nazev": _text(nazev.group(1)) if nazev else _text(item),
            "kategorie": (re.search(r"\(([^,]+),", _text(item)) or [None, None])[1],
            "soutez": _text(soutez.group(1)) if soutez else None,
            "dvouhry": bil[0] if len(bil) > 0 else None,
            "ctyrhry": bil[1] if len(bil) > 1 else None,
            "neni_na_soupisce": "již není na soupisce" in item,
        })
    return out


def parse_hrac(html):
    if "cardsbox" not in html:
        return None
    data = {}

    m = re.search(r'<div id="cardsbox">\s*<div class="card mb-3">\s*<div class="card-header">\s*(.*?)\s*</div>', html, re.S)
    data["jmeno"] = _text(m.group(1)) if m else None

    # --- karty sezón ---
    sezony = []
    for m in re.finditer(r'<div class="card-header">\s*Sezóna (\d{4}) - (\d{4})\s*</div>\s*<div class="card-body">(.*?)<!--Karty hrace-->', html, re.S):
        body = m.group(3)
        rn = re.search(r"<strong>Rok narození:</strong>\s*(\d{4})", body)
        if rn:
            data["rok_narozeni"] = int(rn.group(1))
        oddil = re.search(r"<strong>Oddíl:</strong>\s*(?:<a[^>]*>)?(.*?)(?:</a>|<br)", body, re.S)
        sezony.append({
            "sezona": f"{m.group(1)}/{m.group(2)}",
            "rok": int(m.group(1)),
            "oddil": _text(oddil.group(1)) if oddil else None,
            "dvouhry": _bilance(body, "dvouher"),
            "ctyrhry": _bilance(body, "čtyřher"),
            "druzstva": _druzstva(body),
        })
    data["sezony"] = sezony

    # --- bilance dvouher po sezónách ---
    bilance = []
    t = re.search(r'<table class="bilance">(.*?)</table>', html, re.S)
    if t:
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", t.group(1), re.S):
            tds = [_text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            if len(tds) != 10 or not tds[0].isdigit():
                continue
            bilance.append({
                "rok": int(tds[0]), "druzstvo": tds[1], "soutez": tds[2],
                "pu": _num(tds[3]), "pz": _num(tds[4]), "vyhry": _num(tds[5]), "prohry": _num(tds[6]),
                "uspesnost": tds[7], "str": _num(tds[8]), "str_zmena": _num(tds[9]),
            })
    data["bilance"] = bilance

    # --- eSTeR (STR) ---
    s = re.search(r"<div class='elostat_detail'>(.*?)</div>\s*</div>\s*</div>", html, re.S)
    ster = {}
    if s:
        b = s.group(1)
        g = lambda rx, typ=int: (lambda mm: _num(mm.group(1), typ) if mm else None)(re.search(rx, b))
        ster["str"] = g(r"<b>STR:\s*(\d+)</b>")
        ster["stabil"] = g(r"STR\(stabil\):\s*([\d,]+)", float)
        mm = re.search(r"STR\(min\)\.\.\.STR\(max\):\s*(\d+)\.\.\.(\d+)", b)
        ster["min"], ster["max"] = (int(mm.group(1)), int(mm.group(2))) if mm else (None, None)
        mm = re.search(r"Nejvyšší dosažené STR:\s*(\d+),\s*([\d.]+)", b)
        ster["nejvyssi"], ster["nejvyssi_datum"] = (int(mm.group(1)), mm.group(2)) if mm else (None, None)
        vyhry = []
        for w in re.finditer(
            r'STR hráče:\s*(\d+), Soupeř: <strong><a href="/hrac-(\d+)[^"]*">(.*?)</a></strong>, STR: <strong>(\d+)</strong>, '
            r"Výsledek:\s*([\d:]+),\s*([\d.]+),\s*Soutěž:\s*([^<]*?)\s*(?=<|$)", b, re.S):
            vyhry.append({
                "str_hrace": int(w.group(1)), "souper_id": w.group(2), "souper": _text(w.group(3)),
                "str_soupere": int(w.group(4)), "vysledek": w.group(5), "datum": w.group(6), "soutez": _text(w.group(7)),
            })
        ster["nejcennejsi_vyhry"] = vyhry
    data["str"] = ster

    # --- graf STR (data přímo ze stránky) ---
    mydata = _js_var(html, "mydata") or []
    labels = _js_var(html, "points_label") or []
    data["graf"] = {
        # [datum, STR, STR(stabil), popisek bodu]
        "body": [[d.get("x"), d.get("el"), d.get("st"), labels[i] if i < len(labels) else ""] for i, d in enumerate(mydata)],
        # konec poslední sezóny STIS uvádí jako text (rok), ne index — doplníme délkou dat
        "sezony": [{"rok": int(x["rok"]), "od": int(x["start"]),
                    "do": x["end"] if isinstance(x["end"], int) else len(mydata)}
                   for x in (_js_var(html, "seasons") or [])],
    }

    # --- všechny zápasy (tabulka tbl_zapasy, po sezónách) ---
    zapasy = []
    z = re.search(r'<table id="tbl_zapasy"(.*?)</table>', html, re.S)
    if z:
        for rok, tbody in re.findall(r'<tbody id="page_(\d{4})"[^>]*>(.*?)</tbody>', z.group(1), re.S):
            for row in re.findall(r"<tr>(.*?)</tr>", tbody, re.S):
                tds = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
                if len(tds) < 5:
                    continue
                dr = re.search(r"<span class='smaller'>(.*?)</span>", tds[0], re.S)
                sp = re.search(r'<a href="/hrac-(\d+)[^"]*">(.*?)</a>', tds[1])
                spd = re.search(r"<span class='smaller'>(.*?)(?:</span>|$)", tds[1], re.S)
                vy = re.search(r'<a href="(/zapis/[^"]*)">([^<]*)</a>', tds[2])
                vy_text = vy.group(2) if vy else _text(tds[2].split("<br")[0])
                info = re.search(r"<span class='smaller'>(.*?)<br>(.*?)</span>", tds[2], re.S)
                strh = re.findall(r"(\d+)->\s*</span>\s*(\d+)", tds[3])
                strs = re.findall(r"(\d+)->\s*</span>\s*(\d+)", tds[4])
                zapasy.append([
                    int(rok),
                    _text(info.group(1)) if info else "",                 # datum
                    _text(dr.group(1)) if dr else "",                     # naše družstvo
                    _text(sp.group(2)) if sp else _text(tds[1].split("<br")[0]),   # soupeř
                    sp.group(1) if sp else "",                            # ID soupeře na STIS
                    _text(spd.group(1)) if spd else "",                   # družstvo soupeře
                    _text(vy_text),                                       # výsledek (sety)
                    vy.group(1) if vy else "",                            # odkaz na zápis
                    _text(info.group(2)) if info else "",                 # soutěž
                    int(strh[0][0]) if strh else None, int(strh[0][1]) if strh else None,   # STR hráče před -> po
                    int(strs[0][0]) if strs else None, int(strs[0][1]) if strs else None,   # STR soupeře před -> po
                ])
    data["zapasy_sloupce"] = ["rok", "datum", "druzstvo", "souper", "souper_id", "souper_druzstvo",
                              "vysledek", "zapis", "soutez", "str_pred", "str_po", "souper_str_pred", "souper_str_po"]
    data["zapasy"] = zapasy
    return data
