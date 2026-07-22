#!/usr/bin/env python3
"""Bouwt _site/: schone URLs, absolute asset-paden, herschreven interne links."""
import os, re, shutil, html

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "_site")

# bron -> doelmap ('' = root)
PAGINAS = {
    "Homepage v5.dc.html": "",
    "Dienstenpagina.dc.html": "diensten",
    "Toepassingen.dc.html": "toepassingen",
    "Over ons.dc.html": "over-ons",
    "Cases.dc.html": "cases",
    "Inzichten.dc.html": "inzichten",
    "Contact.dc.html": "contact",
    "Privacybeleid.dc.html": "privacybeleid",
    "Algemene voorwaarden.dc.html": "algemene-voorwaarden",
    "case-detail.dc.html": "case",
    "Admin.dc.html": "admin",
    "inzicht-excel-signalen.dc.html": "inzichten/excel-signalen",
    "inzicht-kosten-automatisering.dc.html": "inzichten/kosten-automatisering",
    "inzicht-ai-agents-kmo.dc.html": "inzichten/ai-agents-kmo",
    "inzicht-digitale-audit.dc.html": "inzichten/digitale-audit",
    "inzicht-maatwerk-vs-standaard.dc.html": "inzichten/maatwerk-vs-standaard",
}
# oude href -> nieuwe URL
LINKS = {src: ("/" + dst + "/" if dst else "/") for src, dst in PAGINAS.items()}

JS = ["support.js", "content-store.js", "micro.js", "preloader.js", "starfield.js",
      "fluid.js", "fx.js", "lightrays.js", "undertones.js"]

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

# assets en js naar de root van _site
shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(OUT, "assets"))
for j in JS:
    p = os.path.join(ROOT, j)
    if os.path.exists(p):
        shutil.copy2(p, OUT)

def herschrijf(s):
    # interne paginalinks
    for oud, nieuw in LINKS.items():
        for variant in (oud, oud.replace(" ", "%20")):
            s = s.replace(f'href="{variant}"', f'href="{nieuw}"')
            s = s.replace(f'href="{variant}#', f'href="{nieuw}#')
    # relatieve resources absoluut maken (pagina's staan in submappen)
    s = s.replace('src="./', 'src="/').replace('href="./', 'href="/')
    s = re.sub(r'(src|href)="assets/', r'\1="/assets/', s)
    for j in JS:
        s = s.replace(f'src="{j}"', f'src="/{j}"')
    # case-detail querystring
    s = s.replace("case-detail.dc.html?case=", "/case/?case=")
    # Pagina-overgang: de wipe testte op '.dc.html'. Na het opschonen van de
    # URLs eindigt geen enkele link daar nog op, waardoor de overgang nooit
    # meer afspeelde. Nu matchen we interne paden (beginnend met één '/'),
    # zodat mailto:, tel:, externe links en #ankers er buiten blijven.
    s = s.replace(
        "if (!href.endsWith('.dc.html') && href.indexOf('.dc.html#') === -1) return;",
        "if (!/^\\/(?!\\/)/.test(href)) return;",
    )
    return s

geschreven = []
for src, dst in PAGINAS.items():
    p = os.path.join(ROOT, src)
    if not os.path.exists(p):
        print("ONTBREEKT:", src); continue
    s = herschrijf(open(p, encoding="utf-8").read())
    d = os.path.join(OUT, dst) if dst else OUT
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(s)
    geschreven.append((src, "/" + dst + "/" if dst else "/", len(s)))

# publicatiebestanden
for f in ("_redirects", "robots.txt", "sitemap.xml"):
    p = os.path.join(ROOT, "publish", f)
    if os.path.exists(p):
        shutil.copy2(p, OUT)

print(f"{len(geschreven)} pagina's:")
for src, url, n in geschreven:
    print(f"  {url:<38} {n:>7} B   ← {src}")
