/* Convisto micro-interacties — subtiele hover- en laad-animaties in Framer-stijl,
   brand-veilig (geen glow, knoppen blijven vlak). Zelf-injecterend, idempotent. */
(function () {
  if (document.getElementById('cv-micro')) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = [
    /* pijl-links schuiven verder */
    '[data-arr]{transition:transform .4s cubic-bezier(.16,1,.3,1)}',
    'a:hover [data-arr]{transform:translateX(6px)}',
    /* inhoudskaarten: zachte lift + heldere rand */
    '[data-blogcard],[data-case],[data-svc-card]{transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .35s ease}',
    '[data-blogcard]:hover,[data-case]:hover{transform:translateY(-6px)}',
    /* filter-chips */
    '[data-fchip]{transition:transform .28s cubic-bezier(.16,1,.3,1),background-color .25s,color .25s,box-shadow .25s}',
    '[data-fchip]:hover{transform:translateY(-2px)}',
    /* footer + nav links: subtiele verschuiving */
    'footer a{transition:color .28s,transform .28s cubic-bezier(.16,1,.3,1)}',
    'footer a:hover{transform:translateX(3px)}',
    /* afbeeldingen in kaarten: trage zoom */
    '[data-case] img,[data-blogcard] img{transition:transform .7s cubic-bezier(.16,1,.3,1)}',
    '[data-case]:hover img,[data-blogcard]:hover img{transform:scale(1.05)}',
    /* micro-onderlijn op tekst-links in lopende tekst */
    'main p a{background-image:linear-gradient(currentColor,currentColor);background-size:0% 1px;background-position:0 100%;background-repeat:no-repeat;transition:background-size .35s cubic-bezier(.16,1,.3,1),color .25s}',
    'main p a:hover{background-size:100% 1px}'
  ].join('');
  if (reduce) return;
  var s = document.createElement('style');
  s.id = 'cv-micro';
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  /* Laad-micro-animatie: elementen met [data-pop] poppen zacht in bij intersectie. */
  function initPop() {
    var els = document.querySelectorAll('[data-pop]');
    if (!els.length) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.animate(
          [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }
        );
      });
    }, { threshold: 0.2 });
    els.forEach(function (el) { io.observe(el); });
  }
  if (document.readyState !== 'loading') initPop();
  else document.addEventListener('DOMContentLoaded', initPop);

  /* Woord-stagger: kop-teksten verschijnen woord voor woord bij intersectie.
     Slaat homepage-animatiehooks en gemarkeerde elementen over. */
  function splitStagger() {
    var heads = document.querySelectorAll('h1, h2');
    heads.forEach(function (h) {
      if (h.__st) return;
      if (h.hasAttribute('data-mword') || h.hasAttribute('data-no-stagger') ||
          h.querySelector('[data-hline],[data-mline],[data-qline],[data-mword],[data-demo-line]') ||
          (h.closest && h.closest('[data-no-stagger]'))) { h.__st = true; return; }
      var units = [], ok = true;
      h.childNodes.forEach(function (nd) {
        if (nd.nodeType === 3) {
          nd.textContent.split(/(\s+)/).forEach(function (p) {
            if (p === '') return;
            units.push(/^\s+$/.test(p) ? { sp: p } : { w: p });
          });
        } else if (nd.nodeType === 1) { units.push({ el: nd }); }
        else { ok = false; }
      });
      if (!ok || !units.length) { h.__st = true; return; }
      h.__st = true;
      var frag = document.createDocumentFragment(), spans = [];
      units.forEach(function (u) {
        if (u.sp) { frag.appendChild(document.createTextNode(u.sp)); return; }
        var s = document.createElement('span');
        s.style.display = 'inline-block';
        s.style.willChange = 'transform, opacity';
        if (u.el) s.appendChild(u.el.cloneNode(true)); else s.textContent = u.w;
        frag.appendChild(s); spans.push(s);
      });
      h.innerHTML = ''; h.appendChild(frag);
      if (reduce) return;
      spans.forEach(function (s) { s.style.opacity = '0'; s.style.transform = 'translateY(0.5em)'; });
      h.__spans = spans;
    });
  }
  function observeStagger() {
    if (reduce) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var spans = en.target.__spans || [];
        spans.forEach(function (s, i) {
          s.animate(
            [{ opacity: 0, transform: 'translateY(0.5em)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 460, delay: i * 55, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }
          );
        });
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('h1, h2').forEach(function (h) { if (h.__spans && h.__spans.length && !h.__stObs) { h.__stObs = true; io.observe(h); } });
  }
  function runStagger() { splitStagger(); observeStagger(); }
  // Zo vroeg mogelijk splitsen zodat de volledige tekst niet even flitst:
  // een MutationObserver vangt koppen op het moment dat de DC-runtime ze plaatst.
  runStagger();
  if (typeof MutationObserver !== 'undefined') {
    var mo = new MutationObserver(function () { runStagger(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); runStagger(); }, 3000);
  } else {
    [200, 600, 1400].forEach(function (t) { setTimeout(runStagger, t); });
  }
})();
