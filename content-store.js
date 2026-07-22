/* Convisto content-store — gedeelde prototype-datalaag voor cases & blog.
   Geladen door Admin + de publieke pagina's. Bewaart in localStorage;
   valt terug op de defaults hieronder wanneer nog niets is opgeslagen. */
(function () {
  var CASE_KEY = 'cv_store_cases_v1';
  var BLOG_KEY = 'cv_store_blog_v1';

  var CASE_TYPES = {
    workflows: 'Workflows & AI-audit',
    app: 'Maatwerk app',
    agents: 'AI Agents',
    website: 'Websites & branding'
  };

  var defaultCases = [
    {
      id: 'favorcool', client: 'FavorCool', type: 'workflows',
      tags: ['AI-audit', 'Workflows'],
      titel: 'Van overvolle mailbox naar een volledig geautomatiseerde operatie.',
      tekst: 'FavorCool verwerkte dagelijks tientallen e-mails manueel. Na een grondige audit worden inkomende mails automatisch geclassificeerd en omgezet in taken. Het team focust op uitvoering.',
      img: 'assets/case-favorcool.png', logo: '', opHome: true, verborgen: false, cats: ['AI audit','Workflow automatisering','AI Agents'],
      blocks: [
        { type: 'title', value: 'Het probleem' },
        { type: 'text', value: 'Elke ochtend begon hetzelfde: een mailbox vol offerteaanvragen, leveranciersmails en klantvragen. Alles werd manueel gelezen, gesorteerd en overgetypt in aparte lijstjes. Naarmate het bedrijf groeide, groeide ook de achterstand — en het risico dat een aanvraag tussen de mazen viel.' },
        { type: 'subtitle', value: 'Waar de tijd verloren ging' },
        { type: 'text', value: 'Uit de audit bleek dat het team dagelijks meer dan twee uur besteedde aan puur classificeren en doorsturen. Niet aan uitvoering, niet aan klanten — aan administratie die een machine perfect aankan.' },
        { type: 'title', value: 'Onze aanpak' },
        { type: 'text', value: 'We startten met een grondige audit: een gerichte vragenlijst en gesprekken op de werkvloer. Daaruit volgde een heldere roadmap. Inkomende mails worden nu automatisch geclassificeerd op type en urgentie, en meteen omgezet in taken in het juiste dossier.' },
        { type: 'subtitle', value: 'Stap voor stap uitgerold' },
        { type: 'text', value: 'We bouwden in korte sprints en toonden elke week een werkende versie. Zo testte het team mee vanaf dag één en bleef de drempel laag — geen big bang, wel meteen resultaat.' },
        { type: 'title', value: 'Het resultaat' },
        { type: 'text', value: 'De mailbox is geen bottleneck meer. Aanvragen belanden automatisch op de juiste plek, het team focust op uitvoering en niets valt nog tussen de mazen. Wat vroeger uren kostte, gebeurt nu in de achtergrond.' }
      ]
    },
    {
      id: 'miconcept', client: 'MI-Concept', type: 'app',
      tags: ['Maatwerk app', 'Real-time'],
      titel: 'Van chaos aan de balie naar een gestroomlijnde bezoekersstroom.',
      tekst: 'MI-Concept ontving dagelijks klanten in meerdere vestigingen zonder digitaal systeem. Wij bouwden een op maat ticketingsysteem, automatisch doorgestuurd naar Odoo, met real-time cijfers per vestiging.',
      img: 'assets/case-miconcept.png', logo: '', opHome: true, verborgen: false, cats: ['Interne app'],
      blocks: [
        { type: 'title', value: 'Het probleem' },
        { type: 'text', value: 'MI-Concept ontving dagelijks klanten in meerdere vestigingen, maar zonder digitaal systeem. Wachtrijen, geen zicht op drukte en cijfers die pas achteraf — en versnipperd — bekend waren.' },
        { type: 'title', value: 'Onze aanpak' },
        { type: 'text', value: 'We bouwden een ticketingsysteem op maat dat bezoekers vlot door de balie loodst en automatisch doorstroomt naar Odoo. Elke vestiging heeft nu een eigen real-time dashboard.' },
        { type: 'title', value: 'Het resultaat' },
        { type: 'text', value: 'De balie loopt gestroomlijnd, de bezoekersstroom is voorspelbaar en het management stuurt bij op live cijfers per vestiging in plaats van op onderbuikgevoel.' }
      ]
    },
    {
      id: 'itsready', client: "It's Ready", type: 'website',
      tags: ['Website', 'Branding'],
      titel: 'Een merk en site die het niveau van het werk eindelijk tonen.',
      tekst: 'Volledige visuele identiteit en website, met formulieren die rechtstreeks in de opvolging stromen. "Voor echt alles vindt hij een oplossing." — Sebastian Mathieu',
      img: '', logo: '', opHome: false, verborgen: false, cats: ['Webdesign','Branding'],
      blocks: [
        { type: 'title', value: 'De uitdaging' },
        { type: 'text', value: 'Het werk was top, maar merk en website toonden dat niet. Er was nood aan een identiteit die het niveau van het vakmanschap weerspiegelde — en aan een site die leads meteen in de opvolging brengt.' },
        { type: 'title', value: 'Wat we bouwden' },
        { type: 'text', value: 'Een volledige visuele identiteit en een website met formulieren die rechtstreeks in de opvolging stromen. Geen losse mailtjes meer, wel één heldere flow.' },
        { type: 'subtitle', value: 'In de woorden van de klant' },
        { type: 'text', value: '“Voor echt alles vindt hij een oplossing.” — Sebastian Mathieu' }
      ]
    }
  ];

  var defaultBlog = [
    {
      id: 'excel-signalen', categorie: 'Strategie',
      titel: '5 signalen dat jouw bedrijf te groot is geworden voor Excel',
      excerpt: '5 concrete signalen dat jouw KMO te groot is geworden voor Excel — en wat de overstap naar een echt systeem oplevert.',
      datum: '2 juni 2026', leestijd: '5 min', img: 'assets/blog-excel.jpg',
      url: 'inzicht-excel-signalen.dc.html', gepubliceerd: true
    },
    {
      id: 'kosten-automatisering', categorie: 'Workflow automatisering',
      titel: 'Wat kost workflow-automatisering voor een KMO in 2026?',
      excerpt: 'Zo is de investering opgebouwd, van audit tot terugverdientijd — zonder verrassingen achteraf.',
      datum: '26 mei 2026', leestijd: '6 min', img: 'assets/blog-kosten.jpg',
      url: 'inzicht-kosten-automatisering.dc.html', gepubliceerd: true
    },
    {
      id: 'ai-agents-kmo', categorie: 'AI Agents',
      titel: "AI-agents voor KMO's: wat ze wel en niet kunnen in 2026",
      excerpt: 'Wat AI-agents in 2026 wel en niet betrouwbaar kunnen voor jouw KMO — zonder hype, met voorbeelden uit de praktijk.',
      datum: '19 mei 2026', leestijd: '6 min', img: 'assets/blog-agents.jpg',
      url: 'inzicht-ai-agents-kmo.dc.html', gepubliceerd: true
    },
    {
      id: 'digitale-audit', categorie: 'AI audit',
      titel: 'Digitale audit: zo bereid je jouw KMO voor (checklist)',
      excerpt: 'Praktische checklist om je optimaal voor te bereiden en het maximum uit de doorlooptijd te halen.',
      datum: '12 mei 2026', leestijd: '5 min', img: 'assets/blog-audit.jpg',
      url: 'inzicht-digitale-audit.dc.html', gepubliceerd: true
    },
    {
      id: 'maatwerk-vs-standaard', categorie: 'Interne apps',
      titel: 'Interne bedrijfsapp laten bouwen: maatwerk of standaardsoftware?',
      excerpt: 'Zo maak je de juiste keuze tussen maatwerk en standaardsoftware — zonder de klassieke prijskaart.',
      datum: '5 mei 2026', leestijd: '6 min', img: 'assets/blog-app.jpg',
      url: 'inzicht-maatwerk-vs-standaard.dc.html', gepubliceerd: true
    }
  ];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return clone(fallback);
      return parsed;
    } catch (e) { return clone(fallback); }
  }

  function write(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('cv-store-change')); } catch (e) {}
  }

  function slug(s) {
    return (s || 'case').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || ('item-' + Date.now());
  }

  window.CVStore = {
    CASE_TYPES: CASE_TYPES,
    caseTypeLabel: function (t) { return CASE_TYPES[t] || t; },

    /* ---- cases ---- */
    cases: function () { var arr = read(CASE_KEY, defaultCases); var M = { workflows: ['AI audit','Workflow automatisering'], app: ['Interne app'], agents: ['AI Agents'], website: ['Webdesign','Branding'] }; arr.forEach(function(c){ if (!c.cats || !c.cats.length) c.cats = (M[c.type] || []).slice(); }); return arr; },
    saveCases: function (arr) { write(CASE_KEY, arr); },
    homeCases: function () { return this.cases().filter(function (c) { return c.opHome && !c.verborgen; }); },
    publicCases: function () { return this.cases().filter(function (c) { return !c.verborgen; }); },
    caseById: function (id) { var all = this.cases(), i; for (i = 0; i < all.length; i++) { if (all[i].id === id) return all[i]; } return null; },
    newCaseId: function (client) {
      var base = slug(client), all = this.cases(), id = base, n = 2;
      while (all.some(function (c) { return c.id === id; })) { id = base + '-' + n; n++; }
      return id;
    },

    /* ---- blog ---- */
    blog: function () { return read(BLOG_KEY, defaultBlog); },
    saveBlog: function (arr) { write(BLOG_KEY, arr); },
    publicBlog: function () { return this.blog().filter(function (p) { return p.gepubliceerd; }); },
    newBlogId: function (titel) {
      var base = slug(titel), all = this.blog(), id = base, n = 2;
      while (all.some(function (p) { return p.id === id; })) { id = base + '-' + n; n++; }
      return id;
    },

    /* ---- reset ---- */
    resetCases: function () { write(CASE_KEY, clone(defaultCases)); },
    resetBlog: function () { write(BLOG_KEY, clone(defaultBlog)); },
    defaults: function () { return { cases: clone(defaultCases), blog: clone(defaultBlog) }; }
  };
})();
