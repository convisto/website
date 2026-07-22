#!/usr/bin/env python3
"""Bouwt _site/: schone URLs, absolute asset-paden, herschreven interne links.

Cases en inzichten komen uit markdown in content/ (beheerd via /admin, Decap
CMS) en worden hier statisch in de HTML gezet. De <sc-for>-sjabloonblokken
worden vervangen door echte kaarten, zodat de tekst in de ruwe HTML staat en
zoekmachines ze zien — vroeger stond daar alleen '{{ c.titel }}'.
"""
import os, re, shutil, html

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "_site")

# bron -> doelmap ('' = root)
# case-detail.dc.html staat hier bewust niet in: dat bestand is nu een sjabloon
# waaruit per case een /cases/<slug>/ wordt gegenereerd (zie onderaan).
# Admin.dc.html evenmin: /admin is nu Decap CMS. Het oude scherm schreef naar
# localStorage en zou na deze omslag niets meer doen behalve verwarring zaaien.
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
    "inzicht-excel-signalen.dc.html": "inzichten/excel-signalen",
    "inzicht-kosten-automatisering.dc.html": "inzichten/kosten-automatisering",
    "inzicht-ai-agents-kmo.dc.html": "inzichten/ai-agents-kmo",
    "inzicht-digitale-audit.dc.html": "inzichten/digitale-audit",
    "inzicht-maatwerk-vs-standaard.dc.html": "inzichten/maatwerk-vs-standaard",
}
# oude href -> nieuwe URL
LINKS = {src: ("/" + dst + "/" if dst else "/") for src, dst in PAGINAS.items()}
LINKS["case-detail.dc.html"] = "/cases/"
LINKS["Admin.dc.html"] = "/admin/"

JS = ["support.js", "content-store.js", "micro.js", "preloader.js", "starfield.js",
      "fluid.js", "fx.js", "lightrays.js", "undertones.js"]


# --------------------------------------------------------------------------
# content/: frontmatter + markdown lezen (alleen standaardbibliotheek)
# --------------------------------------------------------------------------

def _scalar(s):
    """Eén YAML-waarde: string (evt. gequote), boolean of geheel getal."""
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1]
        return s.replace('\\"', '"').replace("\\\\", "\\") if s else s
    if s in ("true", "True"): return True
    if s in ("false", "False"): return False
    if s in ("", "~", "null"): return ""
    if re.fullmatch(r"-?\d+", s): return int(s)
    return s


def frontmatter(tekst):
    """Splitst een md-bestand in (velden, body). Genoeg YAML voor wat Decap
    schrijft: scalars, blokreeksen (- item), inline lijsten en blokstrings."""
    if not tekst.startswith("---"):
        return {}, tekst
    eind = tekst.index("\n---", 3)
    regels = tekst[3:eind].strip("\n").split("\n")
    body = tekst[eind + 4:].lstrip("\n")
    velden, i = {}, 0
    while i < len(regels):
        r = regels[i]; i += 1
        if not r.strip() or r.lstrip().startswith("#") or ":" not in r:
            continue
        sleutel, rest = r.split(":", 1)
        sleutel, rest = sleutel.strip(), rest.strip()
        if rest in (">", ">-", "|", "|-"):          # blokstring
            lijnen = []
            while i < len(regels) and (not regels[i].strip() or regels[i][:1] in (" ", "\t")):
                lijnen.append(regels[i].strip()); i += 1
            samen = " " if rest.startswith(">") else "\n"
            velden[sleutel] = samen.join(lijnen).strip()
        elif rest == "":                             # blokreeks
            items = []
            while i < len(regels) and regels[i].lstrip().startswith("- "):
                items.append(_scalar(regels[i].lstrip()[2:].strip())); i += 1
            velden[sleutel] = items
        elif rest.startswith("[") and rest.endswith("]"):   # inline lijst
            velden[sleutel] = [_scalar(x.strip()) for x in rest[1:-1].split(",") if x.strip()]
        else:
            velden[sleutel] = _scalar(rest)
    return velden, body


def md_blokken(md):
    """Markdown -> de blokvorm die case-detail verwacht: titel/subtitel/tekst."""
    uit = []
    for stuk in re.split(r"\n\s*\n", (md or "").strip()):
        stuk = stuk.strip()
        if not stuk:
            continue
        if stuk.startswith("### "):
            uit.append({"value": stuk[4:].strip(), "isTitle": False, "isSub": True, "isText": False})
        elif stuk.startswith("## "):
            uit.append({"value": stuk[3:].strip(), "isTitle": True, "isSub": False, "isText": False})
        elif stuk.startswith("# "):
            uit.append({"value": stuk[2:].strip(), "isTitle": True, "isSub": False, "isText": False})
        else:
            tekst = " ".join(l.strip() for l in stuk.split("\n"))
            uit.append({"value": tekst, "isTitle": False, "isSub": False, "isText": True})
    return uit


def pad_asset(p):
    """assets/x.png en /assets/x.png worden allebei /assets/x.png."""
    p = (p or "").strip()
    return "/" + p.lstrip("/") if p else ""


def lees_map(map_naam):
    items = []
    d = os.path.join(ROOT, "content", map_naam)
    if not os.path.isdir(d):
        return items
    for naam in sorted(os.listdir(d)):
        if not naam.endswith(".md"):
            continue
        velden, body = frontmatter(open(os.path.join(d, naam), encoding="utf-8").read())
        velden["slug"] = naam[:-3]
        velden["body"] = body
        items.append(velden)
    items.sort(key=lambda x: (x.get("volgorde", 999), x["slug"]))
    return items


def cases_data():
    """Vorm waarin de sjablonen de case verwachten (zie visCases in de bron)."""
    uit = []
    for c in lees_map("cases"):
        img = pad_asset(c.get("afbeelding", ""))
        logo = pad_asset(c.get("logo", ""))
        cats = c.get("categorieen") or []
        uit.append({
            "slug": c["slug"], "client": c.get("client", ""), "titel": c.get("titel", ""),
            # 'categorieen' is de enige bron. Vroeger stonden 'type' en 'tags'
            # er los naast, met dezelfde informatie in andere bewoording — in
            # het CMS leverde dat drie velden op die elkaar overlapten.
            "tekst": c.get("samenvatting", ""), "typeLabel": " · ".join(cats),
            "cats": cats, "tags": cats,
            "img": img, "hasImg": bool(img), "geenImg": not img,
            "logo": logo, "hasLogo": bool(logo), "geenLogo": not logo,
            "opHome": bool(c.get("opHome")),
            "href": "/cases/%s/" % c["slug"],
            "blocks": md_blokken(c.get("body", "")),
        })
    for c in uit:
        c["geenBlocks"] = not c["blocks"]
    return uit


def inzichten_data():
    uit = []
    for p in lees_map("inzichten"):
        if not p.get("gepubliceerd", True):
            continue
        img = pad_asset(p.get("afbeelding", ""))
        uit.append({
            "slug": p["slug"], "titel": p.get("titel", ""), "categorie": p.get("categorie", ""),
            "excerpt": p.get("excerpt", ""), "datum": p.get("datum", ""),
            "leestijd": p.get("leestijd", ""), "url": "/inzichten/%s/" % p["slug"],
            "img": img, "hasImg": bool(img), "geenImg": not img,
        })
    return uit


# --------------------------------------------------------------------------
# Mini-sjabloonmotor: rendert dezelfde <sc-for>/<sc-if>/{{ }} als de dc-runtime,
# maar dan tijdens de build. Zo blijft de opmaak exact die van de bron — er
# wordt geen HTML nagetypt.
# --------------------------------------------------------------------------

TOKEN = re.compile(r"\{\{\s*([A-Za-z_][\w.]*)\s*\}\}")


def _waarde(ctx, pad):
    cur = ctx
    for deel in pad.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(deel)
    return cur


def _esc(v):
    if v is None or v is False:
        return ""
    if v is True:
        return "true"
    return html.escape(str(v), quote=True)


def _blok(s, tag, start):
    """Geeft (binnen_start, binnen_eind, eind) van het element op index start."""
    open_eind = s.index(">", start)
    diepte, i = 1, open_eind + 1
    while True:
        volgend_open = s.find("<" + tag, i)
        volgend_dicht = s.find("</" + tag + ">", i)
        if volgend_dicht == -1:
            raise ValueError("geen sluittag voor <%s>" % tag)
        if volgend_open != -1 and volgend_open < volgend_dicht:
            diepte += 1
            i = volgend_open + len(tag) + 1
        else:
            diepte -= 1
            i = volgend_dicht + len(tag) + 3
            if diepte == 0:
                return open_eind + 1, volgend_dicht, i


def render(tpl, ctx):
    uit, i = [], 0
    while True:
        a, b = tpl.find("<sc-for", i), tpl.find("<sc-if", i)
        kandidaten = [x for x in (a, b) if x != -1]
        if not kandidaten:
            uit.append(TOKEN.sub(lambda m: _esc(_waarde(ctx, m.group(1))), tpl[i:]))
            break
        j = min(kandidaten)
        uit.append(TOKEN.sub(lambda m: _esc(_waarde(ctx, m.group(1))), tpl[i:j]))
        tag = "sc-for" if j == a else "sc-if"
        s0, s1, eind = _blok(tpl, tag, j)
        kop, binnen = tpl[j:s0], tpl[s0:s1]
        expr = re.search(r'(?:list|value)="\{\{\s*([\w.]+)\s*\}\}"', kop).group(1)
        if tag == "sc-for":
            naam = re.search(r'as="(\w+)"', kop).group(1)
            for item in (_waarde(ctx, expr) or []):
                kind = dict(ctx); kind[naam] = item
                uit.append(render(binnen, kind))
        elif _waarde(ctx, expr):
            uit.append(render(binnen, ctx))
        i = eind
    return "".join(uit)


def vervang_scfor(s, lijstnaam, ctx, per_item=None):
    """Vervangt het <sc-for list="{{ lijstnaam }}">-blok door de gerenderde
    kaarten. Het sc-for zelf verdwijnt, anders rendert de dc-runtime in de
    browser er alsnog overheen."""
    merk = '<sc-for list="{{ %s }}"' % lijstnaam
    j = s.find(merk)
    if j == -1:
        print("  ! sc-for %s niet gevonden" % lijstnaam)
        return s
    s0, s1, eind = _blok(s, "sc-for", j)
    kop = s[j:s0]
    naam = re.search(r'as="(\w+)"', kop).group(1)
    stukken = []
    for item in (_waarde(ctx, lijstnaam) or []):
        kind = dict(ctx); kind[naam] = item
        kaart = render(s[s0:s1], kind)
        if per_item:
            kaart = per_item(kaart, item)
        stukken.append(kaart)
    return s[:j] + "".join(stukken) + s[eind:]


def merk_cats(kaart, c):
    """Attribuut waarop het filterscript op /cases/ kan filteren."""
    return kaart.replace(
        "data-reveal-off",
        'data-reveal-off data-case-cats="%s"' % html.escape("|".join(c["cats"]), quote=True),
        1,
    )


# De chips op /cases/ filterden via de dc-runtime, die nu niets meer rendert.
# Zelfde gedrag, maar dan over de statische kaarten.
FILTER_OUD = "    this.st(this.q('[data-leeg]'), { display: this.visCases().length === 0 ? 'block' : 'none' });"
FILTER_NIEUW = """    let zichtbaar = 0;
    this.qa('[data-case-cats]').forEach(kaart => {
      const cats = (kaart.getAttribute('data-case-cats') || '').split('|');
      const aan = f === 'alle' || cats.indexOf(f) >= 0;
      this.st(kaart, { display: aan ? 'block' : 'none' });
      if (aan) zichtbaar++;
    });
    this.st(this.q('[data-leeg]'), { display: zichtbaar === 0 ? 'block' : 'none' });"""


# --------------------------------------------------------------------------
# Bouwen
# --------------------------------------------------------------------------

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

# assets en js naar de root van _site
shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(OUT, "assets"))
for j in JS:
    p = os.path.join(ROOT, j)
    if os.path.exists(p):
        shutil.copy2(p, OUT)

# Decap CMS
if os.path.isdir(os.path.join(ROOT, "admin")):
    shutil.copytree(os.path.join(ROOT, "admin"), os.path.join(OUT, "admin"))


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
    # oude case-links met querystring naar het cases-overzicht
    s = s.replace("case-detail.dc.html?case=", "/cases/")
    # Pagina-overgang: de wipe testte op '.dc.html'. Na het opschonen van de
    # URLs eindigt geen enkele link daar nog op, waardoor de overgang nooit
    # meer afspeelde. Nu matchen we interne paden (beginnend met één '/'),
    # zodat mailto:, tel:, externe links en #ankers er buiten blijven.
    s = s.replace(
        "if (!href.endsWith('.dc.html') && href.indexOf('.dc.html#') === -1) return;",
        "if (!/^\\/(?!\\/)/.test(href)) return;",
    )
    s = mobiel_menu_sluiten(s)
    s = mobiele_cta(s)
    s = mega_menu_shader(s)
    return s


# --------------------------------------------------------------------------
# Mobiel menu: sloot zonder animatie.
# closeMenu zette transform en visibility:hidden in dezelfde tik. Het element
# verdween daardoor op slag en de uitgaande transitie was nooit te zien —
# openen animeerde wel, sluiten niet. Nu wacht visibility tot de transform af is.
# --------------------------------------------------------------------------

SLUIT_OUD = "this.st(this.q('[data-menu]'), { transform: 'translateY(-102%)', visibility: 'hidden' });"
SLUIT_NIEUW = (
    "this.st(this.q('[data-menu]'), { transform: 'translateY(-102%)' }); "
    "(function (el, self) { clearTimeout(self._mHide); "
    "self._mHide = setTimeout(function () { "
    "if (el && !self._menuOpen) el.style.visibility = 'hidden'; }, 380); "
    "})(this.q('[data-menu]'), this);"
)
OPEN_OUD = "this.st(this.q('[data-menu]'), { transform: 'translateY(0)', visibility: 'visible' });"
OPEN_NIEUW = "clearTimeout(this._mHide); " + OPEN_OUD


def mobiel_menu_sluiten(s):
    return s.replace(SLUIT_OUD, SLUIT_NIEUW).replace(OPEN_OUD, OPEN_NIEUW)


# --------------------------------------------------------------------------
# De CTA in het mobiele menu was een smalle pil met nowrap: op een klein
# scherm stond die als los blokje links uitgelijnd. Wordt nu een volwaardige
# knop over de volle breedte, in de vlakke huisstijl (geen glow, radius 0).
# --------------------------------------------------------------------------

CTA_CSS = """
/* Mobiele menu-CTA: volle breedte i.p.v. een smalle, links uitgelijnde pil. */
@media (max-width:860px){
  [data-menu] a[href*="cal.com"]{
    display:flex !important;
    width:100%;
    justify-content:center;
    white-space:normal !important;
    padding:18px 24px !important;
    font-size:15.5px !important;
    box-shadow:0 0 0 1px rgba(255,255,255,0.16);
    transition:background-color .2s ease,box-shadow .2s ease;
  }
  [data-menu] a[href*="cal.com"]:active{transform:scale(.985)}
  [data-menu] > div:last-child{width:100%}
}
"""


def mobiele_cta(s):
    if "[data-menu] a[href*=" in s or "</style>" not in s:
        return s
    return s.replace("</style>", CTA_CSS + "</style>", 1)


# --------------------------------------------------------------------------
# Mega-menu: het rechtervak toonde een case-afbeelding die niet bestaat
# (case-favorcool.png ontbreekt, zie README). Vervangen door de violette
# fluid-shader die de site elders al gebruikt.
# --------------------------------------------------------------------------

MM_IMG = ('<img loading="lazy" decoding="async" src="/assets/case-favorcool.png" alt="" '
          'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.8">')

MM_CANVAS = ('<canvas data-fluid-mm aria-hidden="true" '
             'style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>')

# Eigen initialisatie in plaats van de component-JS: setupFluid bestaat maar op
# 4 van de 16 pagina's, en het menu zit overal. Start pas bij de eerste hover,
# zodat er geen WebGL-context draait voor een vak dat niemand opent.
MM_SCRIPT = """<script src="/fluid.js"></script>
<script>
(function () {
  var cv = document.querySelector('[data-fluid-mm]');
  if (!cv) return;
  var ctl = null, dood = false;
  function start() {
    if (ctl || dood || !window.ConvistoFluid) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { dood = true; return; }
    // fluid.js leest clientWidth/Height bij het starten; die zijn hier al
    // correct omdat het paneel wel gelayout is, alleen doorzichtig.
    if (!cv.clientWidth || !cv.clientHeight) return;
    ctl = window.ConvistoFluid(cv, { hue: 0.69, spread: 0.07, orbit: false, burst: false });
  }
  // [data-mm-panel] is geen kind van [data-mm] maar een broer, en mouseenter
  // bubbelt niet. Daarom luisteren we op beide elementen apart, plus een
  // mouseover op de nav als vangnet — die bubbelt wel.
  var knop = document.querySelector('[data-mm]');
  var paneel = cv.closest('[data-mm-panel]');
  if (knop) knop.addEventListener('mouseenter', start, { passive: true });
  if (paneel) paneel.addEventListener('mouseenter', start, { passive: true });
  var nav = document.querySelector('[data-nav]') || document.querySelector('nav');
  if (nav) nav.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (t && t.closest && (t.closest('[data-mm]') || t.closest('[data-mm-panel]'))) start();
  }, { passive: true });
})();
</script>"""


def mega_menu_shader(s):
    if MM_IMG not in s:
        return s
    s = s.replace(MM_IMG, MM_CANVAS)
    if "data-fluid-mm" in s and "/fluid.js" not in s:
        s = s.replace("</body>", MM_SCRIPT + "\n</body>", 1)
    elif "data-fluid-mm" in s:
        s = s.replace("</body>", MM_SCRIPT.split("</script>", 1)[1] + "\n</body>", 1)
    return s


CASES = cases_data()
INZICHTEN = inzichten_data()

geschreven = []
for src, dst in PAGINAS.items():
    p = os.path.join(ROOT, src)
    if not os.path.exists(p):
        print("ONTBREEKT:", src); continue
    s = open(p, encoding="utf-8").read()

    # content statisch inbakken (vóór het herschrijven van paden)
    if src == "Cases.dc.html":
        s = vervang_scfor(s, "cases", {"cases": CASES}, per_item=merk_cats)
        s = s.replace(FILTER_OUD, FILTER_NIEUW)
    elif src == "Inzichten.dc.html":
        s = vervang_scfor(s, "blog", {"blog": INZICHTEN})
    elif src == "Homepage v5.dc.html":
        home = [c for c in CASES if c["opHome"]]
        s = vervang_scfor(s, "homeCases", {"homeCases": home})

    s = herschrijf(s)
    d = os.path.join(OUT, dst) if dst else OUT
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(s)
    geschreven.append((src, "/" + dst + "/" if dst else "/", len(s)))

# /cases/<slug>/ uit het case-detail-sjabloon
SJABLOON = os.path.join(ROOT, "case-detail.dc.html")
if os.path.exists(SJABLOON):
    basis = open(SJABLOON, encoding="utf-8").read()
    for c in CASES:
        s = render(basis, c)
        # per case een eigen titel en omschrijving, anders krijgen alle
        # detailpagina's dezelfde en zijn ze voor Google niet te onderscheiden
        kop = _esc("%s — %s" % (c["client"], c["titel"]))
        oms = _esc(c["tekst"])
        s = s.replace("<title>Convisto — Case</title>", "<title>%s | Convisto</title>" % kop)
        s = re.sub(r'(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"',
                   lambda m: m.group(1) + oms + '"', s)
        s = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"',
                   lambda m: m.group(1) + kop + '"', s)
        s = herschrijf(s)
        d = os.path.join(OUT, "cases", c["slug"])
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(s)
        geschreven.append(("case-detail.dc.html", "/cases/%s/" % c["slug"], len(s)))

# publicatiebestanden
for f in ("_redirects", "robots.txt", "sitemap.xml"):
    p = os.path.join(ROOT, "publish", f)
    if not os.path.exists(p):
        continue
    inhoud = open(p, encoding="utf-8").read()
    if f == "sitemap.xml":
        # casepagina's komen uit content/, dus die horen hier automatisch bij
        extra = "".join(
            "  <url>\n    <loc>https://convistowebsite.netlify.app/cases/%s/</loc>\n"
            "    <priority>0.6</priority>\n  </url>\n" % c["slug"] for c in CASES)
        inhoud = inhoud.replace("</urlset>", extra + "</urlset>")
    open(os.path.join(OUT, f), "w", encoding="utf-8").write(inhoud)

print(f"{len(CASES)} cases, {len(INZICHTEN)} inzichten uit content/")
print(f"{len(geschreven)} pagina's:")
for src, url, n in geschreven:
    print(f"  {url:<38} {n:>7} B   ← {src}")
