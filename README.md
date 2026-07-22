# Convisto website

**Deze map is de enige bron.** Claude Design wordt niet meer gebruikt — daar
niets meer in bewerken, en er niet meer vanuit publiceren. Doe je dat wel, dan
overschrijf je alles wat hier staat.

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

`_site/` is buildoutput en staat in `.gitignore`.

## Bekende openstaande punten

**Vier assets ontbreken** — `case-favorcool.png`, `case-miconcept.png`,
`og-image.png`, `worldmap.jpg`. De Design-API kapt af op 256 KiB, dus ze zijn
nooit binnengehaald. Ze stonden ook nooit live. Handmatig in `assets/` zetten
en opnieuw bouwen. Zolang dat niet gebeurt is `og:image` stuk en zijn de
case-beelden leeg.

**`/admin` beheert niets.** Het scherm schrijft naar localStorage: alleen de
eigen browser, alleen dat apparaat, weg bij het legen van de cache. Bezoekers
en zoekmachines zien er niets van. Voor een echt CMS is een git-repo met
Decap nodig, plus een buildstap die de content statisch in de pagina's zet.

**Nav verschilt per pagina.** Homepage en `/diensten/` hebben twee nav-logo's
en meer burger-logica; de andere dertien pagina's een uitgeklede variant. Dat
verschil zat al in de bron. Vermoedelijke oorzaak van de mobiele logo-fout;
niet uitgezocht.

**Netlify-database is leeg en nergens mee verbonden.** Nul migraties. Levert
sowieso geen afbeeldingen — dat zijn bestanden, geen databaserijen.
