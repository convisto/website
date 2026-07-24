#!/usr/bin/env python3
"""Bouwt _site/: schone URLs, absolute asset-paden, herschreven interne links.

Cases en inzichten komen uit markdown in content/ (beheerd via /admin, Decap
CMS) en worden hier statisch in de HTML gezet. De <sc-for>-sjabloonblokken
worden vervangen door echte kaarten, zodat de tekst in de ruwe HTML staat en
zoekmachines ze zien — vroeger stond daar alleen '{{ c.titel }}'.
"""
import os, re, shutil, html, json, hashlib

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
    "Opleidingen.dc.html": "opleidingen",
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
      "fluid.js", "fx.js", "lightrays.js", "undertones.js", "cookie.js", "mm-stars.js"]

# Basis-URL voor canonical, og:image en de sitemap. Staat op het adres dat nu
# echt live is; zet dit om naar https://www.convisto.be zodra dat domein draait.
SITE_URL = "https://convistowebsite.netlify.app"

# --------------------------------------------------------------------------
# SEO per pagina: titel + omschrijving.
#
# In de bron staat op meerdere pagina's dezelfde tekst (Opleidingen erfde die
# van Over ons), en de case-detailpagina's deelden één titel. Google ziet
# dubbele titels als inwisselbaar en kiest er dan zelf één — slecht voor
# indexering. Elke pagina krijgt hier een eigen titel en omschrijving.
#
# Schrijfregel van de eigenaar: em-dashes mogen, komma's niet.
# --------------------------------------------------------------------------

SEO = {
    "Homepage v5.dc.html": (
        "Convisto — AI-agents en automatisering voor Belgische KMO’s",
        "Convisto bouwt AI-agents en geautomatiseerde workflows voor Belgische "
        "KMO’s. Van eerste gesprek tot werkend systeem — met vaste prijs en "
        "meetbaar resultaat."),
    "Dienstenpagina.dc.html": (
        "Diensten — automatisering AI-agents en interne apps | Convisto",
        "Digitale strategie — workflow-automatisering — interne bedrijfsapps — "
        "AI-agents — websites en branding. Ontdek wat Convisto voor jouw KMO bouwt."),
    "Toepassingen.dc.html": (
        "Toepassingen per sector — voorbeelden en tijdwinst | Convisto",
        "Concrete voorbeelden van automatisering en AI per sector — met de "
        "tijdwinst die ze opleveren. Bekijk wat mogelijk is voor jouw type bedrijf."),
    "Over ons.dc.html": (
        "Over Convisto — award-winning systemen voor KMO’s",
        "Ontdek de aanpak en de waarden achter Convisto uit Maasmechelen. "
        "Award-winning systemen — nu beschikbaar voor Belgische KMO’s."),
    "Opleidingen.dc.html": (
        "Opleidingen AI en no-code — praktisch en op maat | Convisto",
        "Praktische opleidingen AI en no-code op maat van jouw sector. Wij leren "
        "je team zelfstandig werken met de systemen — zodat de kennis in huis blijft."),
    "Cases.dc.html": (
        "Cases — echte systemen bij echte KMO’s | Convisto",
        "Bekijk wat automatisering AI-agents en maatwerk apps opleverden bij onze "
        "klanten. Filter op projecttype en zie het resultaat per case."),
    "Inzichten.dc.html": (
        "Inzichten over automatisering en AI voor KMO’s | Convisto",
        "Nuchtere inzichten over automatisering AI-agents en interne apps — met "
        "cijfers en voorbeelden uit de praktijk bij Belgische KMO’s."),
    "Contact.dc.html": (
        "Contact — plan een vrijblijvend gesprek | Convisto",
        "Plan een vrijblijvend kennismakingsgesprek met Convisto. Wij analyseren "
        "jouw situatie en tonen wat mogelijk is — zonder verplichtingen."),
    "Privacybeleid.dc.html": (
        "Privacybeleid — hoe wij met jouw gegevens omgaan | Convisto",
        "Hoe Convisto persoonsgegevens verwerkt volgens de AVG en GDPR. Lees welke "
        "gegevens we verzamelen — waarom — en welke rechten jij hebt."),
    "Algemene voorwaarden.dc.html": (
        "Algemene voorwaarden | Convisto",
        "De algemene voorwaarden van Convisto voor offertes overeenkomsten en "
        "diensten. Lees de afspraken die gelden bij een samenwerking."),
    "inzicht-excel-signalen.dc.html": (
        "5 signalen dat je bedrijf te groot is voor Excel | Convisto",
        "Excel is fantastisch tot het jouw operatie wordt. Dit zijn de vijf signalen "
        "dat jouw KMO toe is aan een echt systeem — en wat de overstap oplevert."),
    "inzicht-kosten-automatisering.dc.html": (
        "Wat kost workflow-automatisering voor een KMO? | Convisto",
        "Zo is de investering in automatisering opgebouwd — van audit tot "
        "terugverdientijd. Met een concrete rekensom voor jouw KMO in 2026."),
    "inzicht-ai-agents-kmo.dc.html": (
        "AI-agents voor KMO’s — wat ze wel en niet kunnen | Convisto",
        "Wat AI-agents in 2026 betrouwbaar kunnen voor jouw bedrijf — en waar je ze "
        "beter niet voor inzet. Zonder hype met voorbeelden uit de praktijk."),
    "inzicht-digitale-audit.dc.html": (
        "Digitale audit — zo bereid je jouw KMO voor | Convisto",
        "Een praktische checklist om je optimaal voor te bereiden op een digitale "
        "audit. Haal het maximum uit de doorlooptijd van twee tot drie weken."),
    "inzicht-maatwerk-vs-standaard.dc.html": (
        "Interne app — maatwerk of standaardsoftware? | Convisto",
        "Standaardsoftware dwingt jouw bedrijf in haar processen — maatwerk volgt "
        "de jouwe. Zo maak je de juiste keuze zonder de klassieke maatwerk-prijskaart."),
}


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
            # YAML vouwt een lange waarde over meerdere regels: de vervolgregels
            # zijn ingesprongen. Zonder dit kwam alleen de eerste regel door en
            # brak de samenvatting middenin een zin af — en hield een waarde
            # tussen aanhalingstekens een losse " over omdat het sluitteken op
            # een volgende regel stond. Onze frontmatter kent geen geneste
            # mappings, dus elke ingesprongen regel die geen lijstitem is hoort
            # bij de waarde erboven.
            while (i < len(regels) and regels[i].strip()
                   and regels[i][:1] in (" ", "\t")
                   and not regels[i].lstrip().startswith("- ")):
                rest += " " + regels[i].strip()
                i += 1
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
    # verouderde casebeelden naar de echte covers uit het CMS, vóór de paden
    # absoluut gemaakt worden
    s = echte_case_beelden(s)
    # relatieve resources absoluut maken (pagina's staan in submappen)
    s = s.replace('src="./', 'src="/').replace('href="./', 'href="/')
    s = re.sub(r'(src|href)="assets/', r'\1="/assets/', s)
    # Ook in JS-strings: pagina-scripts wisselen o.a. het nav-logo bij het
    # scrollen via logo.src = 'assets/…'. Relatief werkt dat alleen vanuit de
    # root; op /diensten/ wordt dat /diensten/assets/… en dus een 404 — het
    # logo verdween zodra je scrollde.
    s = re.sub(r"(['\"])assets/", r"\1/assets/", s)
    for j in JS:
        v = JS_VERSIE.get(j)
        s = s.replace(f'src="{j}"', f'src="/{j}?v={v}"' if v else f'src="/{j}"')
    # oude case-links met querystring naar het cases-overzicht
    s = s.replace("case-detail.dc.html?case=", "/cases/")
    # Pagina-overgang: de wipe testte op '.dc.html'. Na het opschonen van de
    # URLs eindigt geen enkele link daar nog op, waardoor de overgang nooit
    # meer afspeelde. Nu matchen we interne paden (beginnend met één '/'),
    # zodat mailto:, tel:, externe links en #ankers er buiten blijven.
    s = s.replace(
        "if (!href.endsWith('.dc.html') && href.indexOf('.dc.html#') === -1) return;",
        # Interne paden krijgen de wipe. Maar een anker op de huidige pagina
        # (/diensten/#agents vanaf /diensten/) herlaadt niet: location.href
        # zet alleen de hash. De overlay bleef dan liggen als zwart scherm.
        # Zelfde pathname => geen wipe, gewoon laten scrollen.
        "if (!/^\\/(?!\\/)/.test(href)) return; "
        "try { if (new URL(href, location.href).pathname === location.pathname) return; } catch (_e) {}",
    )
    s = mobiel_menu_sluiten(s)
    s = mobiele_cta(s)
    s = taal(s)
    s = toegankelijkheid(s)
    s = contrast(s)
    s = favicons(s)
    s = opleidingen_alleen_footer(s)
    return s


# --------------------------------------------------------------------------
# Toegankelijkheid en typografie.
#
# Deze correcties stonden eerst in de bronbestanden zelf. Claude Design kent
# ze niet: haal je daar een pagina op, dan komt hij zonder terug en verdwijnen
# ze stilzwijgend — de pagina ziet er verder normaal uit. Daarom worden ze nu
# bij elke build opnieuw aangebracht, ongeacht waar het bestand vandaan komt.
# --------------------------------------------------------------------------

def taal(s):
    """Zonder lang= raadt de screenreader de taal, en leest Nederlands
    als Engels voor. Ook nodig voor correcte afbreking."""
    return s.replace("<html>", '<html lang="nl-BE">', 1)


# --------------------------------------------------------------------------
# SEO: titel, omschrijving en canonical per pagina.
# --------------------------------------------------------------------------

def _zet_meta(s, attr, naam, waarde):
    """Vervangt de content= van één meta-tag. Laat de tag ongemoeid als hij
    niet bestaat — niet elke pagina heeft elke variant."""
    patroon = r'(<meta %s="%s" content=")[^"]*(")' % (attr, re.escape(naam))
    return re.sub(patroon, lambda m: m.group(1) + waarde + m.group(2), s, count=1)


def seo(s, titel, omschrijving, url_pad):
    """Zet titel en omschrijving door in <title>, meta description, Open Graph
    en Twitter. Voegt een canonical toe zodat dezelfde pagina onder meerdere
    URL's niet als duplicaat telt."""
    if titel:
        t, o = _esc(titel), _esc(omschrijving)
        s = re.sub(r"<title>.*?</title>", "<title>%s</title>" % t, s, count=1, flags=re.S)
        s = _zet_meta(s, "name", "description", o)
        s = _zet_meta(s, "property", "og:title", t)
        s = _zet_meta(s, "property", "og:description", o)
        s = _zet_meta(s, "name", "twitter:title", t)
        s = _zet_meta(s, "name", "twitter:description", o)

    if "rel=\"canonical\"" not in s:
        canon = '<link rel="canonical" href="%s%s">' % (SITE_URL, url_pad)
        s = s.replace("<!--/seo-->", canon + "\n<!--/seo-->", 1)

    # De bron verwijst naar www.convisto.be — een domein dat nog niet draait.
    # Daardoor bleven deelvoorbeelden leeg en wees de JSON-LD naar een ander
    # adres dan de canonical. Alles naar SITE_URL halen; één constante omzetten
    # verhuist straks de hele site naar het echte domein.
    s = s.replace("https://www.convisto.be", SITE_URL)
    return s


# --------------------------------------------------------------------------
# Favicons. De bron declareert alleen een SVG-icoon. iOS gebruikt dat niet en
# Android valt terug op een letter, dus op mobiel was er geen icoon te zien.
# Hier komen de PNG-varianten bij — maar alleen als het bestand echt bestaat,
# zodat er geen 404's ontstaan zolang ze nog niet aangeleverd zijn.
# --------------------------------------------------------------------------

FAVICONS = [
    ("assets/favicon.ico", '<link rel="icon" href="/assets/favicon.ico" sizes="32x32">'),
    ("assets/apple-touch-icon.png",
     '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">'),
    ("assets/icon-192.png",
     '<link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192.png">'),
    ("assets/icon-512.png",
     '<link rel="icon" type="image/png" sizes="512x512" href="/assets/icon-512.png">'),
]


def favicons(s):
    regels = [tag for pad, tag in FAVICONS if os.path.exists(os.path.join(ROOT, pad))]
    # Kleurt de browserbalk op Android en de statusbalk in een PWA.
    regels.append('<meta name="theme-color" content="#081014">')
    anker = '<link rel="icon" type="image/svg+xml" href="/assets/convisto-mark-paper.svg">'
    if anker in s:
        return s.replace(anker, anker + "\n" + "\n".join(regels), 1)
    return s.replace("</helmet>", "\n".join(regels) + "\n</helmet>", 1)


# --------------------------------------------------------------------------
# Opleidingen hoort alleen in de footer — niet in de header-nav en niet in het
# mobiele menu. De footerlink heeft geen data-attribuut en blijft dus staan.
# --------------------------------------------------------------------------

def opleidingen_alleen_footer(s):
    return re.sub(
        r'<a\s+href="/opleidingen/"[^>]*\bdata-(?:menu|nav)-a\b[^>]*>Opleidingen</a>',
        "", s)


# --------------------------------------------------------------------------
# Footer gelijktrekken. De casedetailpagina's hadden een uitgeklede footer met
# vijf losse links; alle andere vijftien pagina's de uitgebreide met vier
# kolommen. We kopiëren hem niet naar deze file maar lezen hem uit een pagina
# die hem al heeft — zo blijft er één versie en gaat een herontwerp in Claude
# Design vanzelf mee.
# --------------------------------------------------------------------------

FOOTER_RE = r'<footer data-screen-label="Footer".*?</footer>'


def _uitgebreide_footer():
    for bron in ("Cases.dc.html", "Inzichten.dc.html", "Contact.dc.html"):
        p = os.path.join(ROOT, bron)
        if not os.path.exists(p):
            continue
        m = re.search(FOOTER_RE, open(p, encoding="utf-8").read(), re.S)
        if m and "data-foot-grid" in m.group(0):
            return m.group(0)
    return None


FOOTER = _uitgebreide_footer()


def zelfde_footer(s):
    if not FOOTER or "data-foot-grid" in s:
        return s
    return re.sub(FOOTER_RE, lambda m: FOOTER, s, count=1, flags=re.S)


# --------------------------------------------------------------------------
# De case-afbeelding stond in een kolom van 820px met ronde hoeken, waardoor
# hij smaller was dan de rest van de pagina. Nu over de volle breedte, zonder
# radius en randlijn — die horen niet bij een doorlopende band.
# --------------------------------------------------------------------------

BEELD_OUD = ('<div data-reveal style="max-width:820px;margin:clamp(44px,5.5vw,72px) auto 0;'
             'padding:0 clamp(20px,4vw,44px)"><span style="display:block;position:relative;'
             'aspect-ratio:16/7;border-radius:22px;overflow:hidden;background:#0C151B;'
             'box-shadow:0 0 0 1px rgba(255,255,255,0.1)">')
BEELD_NIEUW = ('<div data-reveal style="margin:clamp(44px,5.5vw,72px) 0 0">'
               '<span style="display:block;position:relative;aspect-ratio:21/9;'
               'overflow:hidden;background:#0C151B">')


def beeld_volle_breedte(s):
    return s.replace(BEELD_OUD, BEELD_NIEUW, 1)


# --------------------------------------------------------------------------
# De dienstenpagina en content-store.js verwijzen nog naar assets/case-<slug>.png
# uit het oorspronkelijke ontwerp. Die bestanden zijn er nooit geweest: ze
# vielen buiten de 256 KiB-limiet van de Design-API. Op /diensten/ leverde dat
# een casekaart van ruim 500px hoog op zonder beeld. De echte covers staan
# intussen in het CMS, dus die zetten we ervoor in de plaats.
# --------------------------------------------------------------------------

def _case_beeld_map():
    m = {}
    for c in CASES:
        if c["img"]:
            m["assets/case-%s.png" % c["slug"]] = c["img"].lstrip("/")
    return m


def echte_case_beelden(s):
    for oud, nieuw in CASE_BEELDEN.items():
        s = s.replace(oud, nieuw)
    return s


# --------------------------------------------------------------------------
# Contrast. Kleine labels — footerkoppen, kickers, stapnummers — stonden op
# witte tekst met 35 tot 40 procent dekking. Op #081014 is dat 3.2 tot 3.8:1
# terwijl WCAG AA 4.5:1 vraagt voor tekst onder 24px. Deze correctie stond
# eerder in de bronbestanden en verdween bij het ophalen uit Claude Design;
# daarom nu hier.
#
# We raken alleen 'color:' aan. De negatieve lookbehind houdt background-color
# en border-color buiten schot, zodat randen en vlakken hun subtiliteit houden.
# --------------------------------------------------------------------------

MIN_ALPHA = 0.48


def contrast(s):
    def op(m):
        a = float(m.group(1))
        return m.group(0) if a >= MIN_ALPHA else "color:rgba(255,255,255,%s)" % MIN_ALPHA
    return re.sub(r"(?<![-a-zA-Z])color:rgba\(255,\s*255,\s*255,\s*([\d.]+)\)", op, s)


A11Y_CSS = """
/* Reduced motion — statische fallback. De JS-check in de pagina-scripts dekt
   maar enkele selectors; CSS-animaties en scroll-behavior liepen door. */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:1ms !important;animation-iteration-count:1 !important;animation-delay:0ms !important;transition-duration:1ms !important;transition-delay:0ms !important}
  html{scroll-behavior:auto !important}
}
/* WCAG 2.5.8 — tapdoelen van minstens 24px in footer- en menukolommen. */
@media (max-width:860px){
  footer a,[data-menu-a]{display:inline-flex;align-items:center;min-height:24px}
}
/* Typografie. Inline styles winnen hiervan, dus bewuste waarden in het
   ontwerp blijven ongemoeid; dit vangt alleen op wat nergens geregeld is. */
main p{max-width:70ch}
h1,h2,h3,h4{text-wrap:balance}
button,[data-nav-cta],[data-menu-a],main a[href*="cal.com"]{
  -webkit-tap-highlight-color:transparent;
  transition-property:transform,background-color,box-shadow,color !important;
  transition-duration:.12s,.2s,.2s,.2s !important;
  transition-timing-function:cubic-bezier(.65,0,.35,1) !important;
}
button:active,[data-nav-cta]:active,[data-menu-a]:active,main a[href*="cal.com"]:active{transform:scale(.985)}
"""


def toegankelijkheid(s):
    # Achteraan in de eerste <style> zetten: zo verliezen deze regels het van
    # latere, specifiekere regels uit het ontwerp zelf, maar winnen ze van de
    # basisstijl. Ontbreekt er een <style>, dan valt er niets aan te vullen.
    if "</style>" not in s:
        return s
    return s.replace("</style>", A11Y_CSS + "</style>", 1)


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
# Het rechtervak van het mega-menu toonde een case-afbeelding die niet
# bestaat. Dat wordt nu in de bron zelf opgelost: een <canvas data-mm-stars>
# met mm-stars.js, een canvas-relatieve starfield die pas bij de eerste
# hover start. De fluid-injectie die hier stond is daarmee overbodig.
# --------------------------------------------------------------------------

CASES = cases_data()
INZICHTEN = inzichten_data()
CASE_BEELDEN = _case_beeld_map()

# --------------------------------------------------------------------------
# content-store.js bijwerken met de echte cases.
#
# Dit bestand stamt uit de tijd vóór het CMS en bevatte nog drie cases met oude
# titels en beelden die niet bestaan. De dienstenpagina vult haar casekaart
# client-side hieruit, dus daar stond de oude tekst en bleef het beeld leeg —
# ook al klopte de rest van de site allang.
#
# We schrijven de lijst nu uit content/ en zetten de localStorage-terugval uit:
# die sleutel werd gevuld door het oude adminscherm dat niet meer meegaat in de
# build, en zou bij wie dat ooit gebruikt heeft nóg oudere data tonen.
# --------------------------------------------------------------------------

def _store_cases_js():
    uit = []
    for c in CASES:
        uit.append({
            "id": c["slug"], "client": c["client"], "type": "",
            "tags": c["cats"], "cats": c["cats"],
            "titel": c["titel"], "tekst": c["tekst"],
            "img": c["img"], "logo": c["logo"],
            "opHome": c["opHome"], "verborgen": False,
        })
    return "var defaultCases = " + json.dumps(uit, ensure_ascii=False, indent=2) + ";"


_cs = os.path.join(OUT, "content-store.js")
if os.path.exists(_cs) and CASES:
    _t = open(_cs, encoding="utf-8").read()
    _i = _t.find("var defaultCases = [")
    if _i != -1:
        # tot de bijpassende sluithaak zoeken; de tekst bevat zelf ook haken
        _d, _j = 0, _t.index("[", _i)
        for _k in range(_j, len(_t)):
            if _t[_k] == "[":
                _d += 1
            elif _t[_k] == "]":
                _d -= 1
                if _d == 0:
                    _eind = _t.index(";", _k) + 1
                    break
        _t = _t[:_i] + _store_cases_js() + _t[_eind:]
    # cases komen uit de build, niet uit de browseropslag
    _t = _t.replace("read(CASE_KEY, defaultCases)", "defaultCases")
    open(_cs, "w", encoding="utf-8").write(echte_case_beelden(_t))

# --------------------------------------------------------------------------
# Cachebreker per scriptbestand.
#
# netlify.toml bewaart /*.js een week. De bestandsnamen liggen vast, dus een
# terugkerende bezoeker hield tot zeven dagen de oude versie — dat gebeurde met
# de cookiebanner en opnieuw met de caselijst hierboven. Door de inhoud te
# hashen verandert de URL zodra het bestand verandert: nieuwe inhoud komt
# meteen door, ongewijzigde bestanden blijven gewoon gecachet.
# --------------------------------------------------------------------------

JS_VERSIE = {}
for _j in JS:
    _p = os.path.join(OUT, _j)
    if os.path.exists(_p):
        JS_VERSIE[_j] = hashlib.sha1(open(_p, "rb").read()).hexdigest()[:8]

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

    url = "/" + dst + "/" if dst else "/"
    titel, oms = SEO.get(src, (None, None))
    s = seo(s, titel, oms, url)

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
        # Op de titel matchen we met een regex in plaats van op een letterlijke
        # string: de bron schreef "Convisto, Case" met een komma terwijl hier een
        # em-dash stond, waardoor de vervanging stil faalde en alle zes de
        # casepagina's dezelfde titel hielden.
        # Bij sommige cases is de titel gelijk aan de klantnaam; dan zou de kop
        # gaan stotteren ("Seculyn — Seculyn").
        if c["titel"] and c["titel"].strip().lower() != c["client"].strip().lower():
            kop = "%s — %s" % (c["client"], c["titel"])
        else:
            kop = c["client"]
        s = seo(s, "%s | Convisto" % kop, c["tekst"], "/cases/%s/" % c["slug"])
        s = zelfde_footer(s)
        s = beeld_volle_breedte(s)
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
