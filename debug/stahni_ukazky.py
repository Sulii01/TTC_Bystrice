# Dočasný průzkum struktury zápisu o utkání na STIS (spouští GitHub Actions).
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import aktualizovat_data as a
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ukazky"); os.makedirs(OUT, exist_ok=True)
op = a.make_opener()
for name, path in [
    ("zapis_c1.html", "/zapis/svaz-420802/rocnik-2026/soutez-6726/utkani-672666"),
    ("zapis_a.html", "/zapis/svaz-420802/rocnik-2026/soutez-6722/utkani-674687"),
    ("zapis_b_remiza.html", "/zapis/svaz-420802/rocnik-2026/soutez-6723/utkani-672278"),
]:
    html = a.fetch(op, path)
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(f"<!-- URL: {path} -->\n" + html)
    print(name, len(html))
