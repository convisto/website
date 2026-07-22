# Convisto website

## Waar wat thuishoort

**Claude Design bezit het ontwerp van de pagina's** (project
`4794fb3d-0165-41c8-9a87-c8dd8a9af409`). Daar ontwerp je verder; daarna haal je
de gewijzigde `.dc.html`-bestanden hierheen en committeer je ze. Deze repo is
wat Netlify bouwt.

**Het CMS bezit de cases en inzichten** (`content/`, beheerd op `/admin`). Die
komen nooit uit Claude Design — anders overschrijft een ophaalronde wat je via
`/admin` hebt gepubliceerd.

Ophalen doe je met de DesignSync-tool (`get_file` per pad). Let op: die is
onbetrouwbaar in subagents — 7 van de 8 pogingen kregen hem niet geladen. Doe
het vanuit de hoofdsessie.

**Wat je in Claude Design niet terugvindt, is geen fout.** De schone URLs,
absolute paden, de wipe-guard, het mobiele menu en alle toegankelijkheids- en
typografiecorrecties worden door `build.py` aangebracht. Ze staan bewust niet in
de bronbestanden, juist zodat een ophaalronde ze niet meer kan wissen — dat is
eerder wél gebeurd.

**De Design-API kapt af op 256 KiB.** Grote afbeeldingen komen er niet door;
die zet je via `/admin` of handmatig in `assets/`.

## Publiceren

```bash
python3 build.py                      # bouwt _site/
```

Daarna deployen naar Netlify (site `convistowebsite`,
id `826c94ca-2769-4cff-9099-3488b58ccca3`). Handmatig kan via
app.netlify.com → Deploys → map `_site` erheen slepen.

## Wat build.py doet

Zet de bronbestanden om naar een publiceerbare site:

- `Homepage v5.dc.html` wordt `/index.html`; de rest krijgt schone URLs
  (`/diensten/`, `/over-ons/`, `/inzichten/<slug>/`)
- interne links herschreven naar die nieuwe paden
- relatieve asset- en scriptpaden absoluut gemaakt — nodig omdat pagina's nu
  in submappen staan
- de pagina-overgang (wipe) test op interne paden in plaats van op de
  `.dc.html`-extensie, die na het opschonen nergens meer voorkwam
- `_redirects`, `robots.txt` en `sitemap.xml` uit `publish/` erbij
- **cases en inzichten uit `content/` worden statisch in de HTML gezet** —
  de `<sc-for>`-blokken op `/cases/`, `/inzichten/` en de homepage worden
  vervangen door echte kaarten, en per case komt er een `/cases/<slug>/`
  uit het sjabloon `case-detail.dc.html`. Voordien stond in de ruwe HTML
  `{{ c.titel }}` en zag Google niets
- `admin/` gaat mee naar `_site/admin/`
- **toegankelijkheid en typografie** worden per pagina toegevoegd: `lang="nl-BE"`,
  een `prefers-reduced-motion`-blok, tapdoelen van 24px (WCAG 2.5.8), regellengte
  en `:active`-feedback. Zie `taal()` en `toegankelijkheid()`. Deze stonden eerst
  in de bronbestanden en verdwenen toen die uit Claude Design werden opgehaald —
  vandaar dat ze nu bij elke build opnieuw worden aangebracht.

`_site/` is buildoutput en staat in `.gitignore`.

Voeg je een nieuw JS-bestand toe aan een pagina, zet het dan ook in de lijst
`JS` bovenaan `build.py`. Die lijst bepaalt zowel wat er gekopieerd wordt als
welke `src=` absoluut wordt gemaakt; staat het er niet in, dan werkt het script
op `/` maar geeft het een 404 op `/diensten/`.

## Content beheren

De eigenaar bewerkt cases en inzichten op **`/admin`** (Decap CMS). Bewaren
commit markdown naar `content/` in deze repo; Netlify bouwt daarna opnieuw.

- `content/cases/<slug>.md` — frontmatter (client, titel, samenvatting, type,
  categorieen, tags, afbeelding, opHome, volgorde) + de casetekst als markdown.
  `##` wordt een tussentitel, `###` een subtitel, de rest gewone alinea's.
- `content/inzichten/<slug>.md` — alleen frontmatter; de kaart op `/inzichten/`
  linkt naar de bestaande artikelpagina `/inzichten/<slug>/`.

`build.py` leest die bestanden met een eigen frontmatter-parser — geen
pip-pakketten, want Netlify bouwt in een kale omgeving.

### Nog te doen: inloggen aanzetten

`/admin` toont nu een knop "Login with GitHub" die pas werkt na één handmatige
stap in Netlify:

1. Maak op GitHub een OAuth App (Settings → Developer settings → OAuth Apps).
   Homepage-URL: de site-URL. Authorization callback URL:
   `https://api.netlify.com/auth/done`.
2. Zet Client ID en Client Secret in Netlify: Site configuration → Access &
   security → OAuth → Install provider → GitHub.

Zonder die stap kan niemand inloggen. Wie inlogt heeft schrijfrechten nodig op
`convisto/website`.

## Bekende openstaande punten

**Vier assets ontbreken** — `case-favorcool.png`, `case-miconcept.png`,
`og-image.png`, `worldmap.jpg`. De Design-API kapt af op 256 KiB, dus ze zijn
nooit binnengehaald. Ze stonden ook nooit live. Handmatig in `assets/` zetten
en opnieuw bouwen. Zolang dat niet gebeurt is `og:image` stuk en zijn de
case-beelden leeg.

**De tekst van een inzicht-artikel staat niet in het CMS.** `content/inzichten/`
bestuurt alleen de kaart op `/inzichten/` (titel, categorie, samenvatting,
beeld). Het artikel zelf blijft een handgemaakte `inzicht-*.dc.html`. Wie de
tekst van een artikel wil wijzigen, doet dat nog altijd in dat bestand.

**Het oude admin-scherm is uit de build.** `Admin.dc.html` schreef naar
localStorage — alleen de eigen browser, weg bij het legen van de cache — en
las niets meer nu de pagina's statisch gebouwd worden. Het bestand staat er
nog, maar wordt niet meer gepubliceerd; `/admin` is nu Decap.

**`content-store.js` wordt nog geladen maar rendert niets meer.** De pagina's
zijn statisch; de defaults in dat bestand komen nergens meer op het scherm. Het
script blijft mee omdat verschillende pagina-scripts `window.CVStore` aanroepen.
Bij twijfel: `content/` is de bron, niet `content-store.js`.

**Nav verschilt per pagina.** Homepage en `/diensten/` hebben twee nav-logo's
en meer burger-logica; de andere dertien pagina's een uitgeklede variant. Dat
verschil zat al in de bron. Vermoedelijke oorzaak van de mobiele logo-fout;
niet uitgezocht.

**`Design & Motion Spec.dc.html` is niet mee opgehaald.** Dat bestand staat niet
in `PAGINAS` en wordt dus niet gepubliceerd; de lokale versie kan afwijken van
die in Claude Design. Wil je het gelijktrekken, haal het dan apart op.

**Netlify-database is leeg en nergens mee verbonden.** Nul migraties. Levert
sowieso geen afbeeldingen — dat zijn bestanden, geen databaserijen.
