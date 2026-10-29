# Dočasný průzkum struktury stránek hráčů na STIS (spouští GitHub Actions).
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import aktualizovat_data as a

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ukazky")
os.makedirs(OUT, exist_ok=True)
op = a.make_opener()
seen = set()

def save(name, path):
    if path in seen:
        return ""
    seen.add(path)
    try:
        html = a.fetch(op, path)
    except Exception as e:
        html = f"ERROR {e}"
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(f"<!-- URL: {path} -->\n" + html)
    print(name, path, len(html))
    return html

soup = save("soupiska.html", f"/soupisky/svaz-{a.SVAZ}/rocnik-{a.ROCNIK}/soutez-6722")
hrefs = sorted(set(re.findall(r'href="([^"#]+)"', soup)))
with open(os.path.join(OUT, "soupiska_odkazy.txt"), "w") as f:
    f.write("\n".join(hrefs))
hraci = [h for h in hrefs if re.search(r"hrac|player|osob", h, re.I)]
print("odkazy na hrace:", hraci[:5])
for i, h in enumerate(hraci[:2]):
    path = h if h.startswith("/") else "/" + h.split("ping-pong.cz/", 1)[-1]
    page = save(f"hrac{i}.html", path)
    sub = sorted(set(re.findall(r'(?:href|src|url)\s*[=:]\s*["\']([^"\']+)["\']', page)))
    with open(os.path.join(OUT, f"hrac{i}_odkazy.txt"), "w") as f:
        f.write("\n".join(sub))
    # podstránky hráče (zápasy, statistiky, sezóny) a případná ajax/json data
    n = 0
    for s in sub:
        if re.search(r"\.(css|js|png|jpg|svg|ico)(\?|$)", s) or s.startswith(("http://", "https://")) and "ping-pong.cz" not in s:
            continue
        if re.search(r"hrac|ajax|json|zapas|statist|sezon|rating|str", s, re.I) and n < 12:
            p = s if s.startswith("/") else "/" + s.split("ping-pong.cz/", 1)[-1]
            save(f"hrac{i}_sub{n}.html", p)
            n += 1
