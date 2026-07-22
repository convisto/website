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
})();
