/* Convisto preloader — toont het convisto-merkteken dat zich met wit vult
   terwijl de pagina laadt. Vol = geladen → overlay vervaagt. */
(function () {
  if (window.__cvPreload) return;
  window.__cvPreload = true;
  try { if (sessionStorage.getItem('cv_visited') === '1') return; sessionStorage.setItem('cv_visited', '1'); } catch (e) {}

  var MARK = 'assets/convisto-mark-paper.svg';
  var maskCss = 'url(' + MARK + ') center / contain no-repeat';

  function build() {
    if (document.querySelector('[data-cv-preload]')) return true;
    var body = document.body || document.documentElement;
    if (!body) return false;
    var o = document.createElement('div');
    o.setAttribute('data-cv-preload', '');
    o.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#081014;display:flex;align-items:center;justify-content:center;transition:opacity .55s ease;opacity:1';
    o.innerHTML =
      '<div style="position:relative;width:88px;height:98px">' +
        '<div style="position:absolute;inset:0;background:rgba(241,239,250,0.13);-webkit-mask:' + maskCss + ';mask:' + maskCss + '"></div>' +
        '<div style="position:absolute;inset:0;overflow:hidden;-webkit-mask:' + maskCss + ';mask:' + maskCss + '">' +
          '<div data-cv-fill style="position:absolute;left:0;right:0;bottom:0;height:0%;background:#F1EFFA;transition:height .28s cubic-bezier(.4,0,.2,1)"></div>' +
        '</div>' +
      '</div>';
    body.appendChild(o);
    return true;
  }

  if (!build()) {
    document.addEventListener('DOMContentLoaded', build);
    var tries = 0, poll = setInterval(function () { if (build() || ++tries > 40) clearInterval(poll); }, 50);
  }

  var p = 0, done = false;
  function set(v) { var f = document.querySelector('[data-cv-fill]'); if (f) f.style.height = v + '%'; }

  var iv = setInterval(function () {
    if (done) return;
    p += Math.max(0.6, (86 - p) * 0.05);
    if (p > 90) p = 90;
    set(p);
  }, 85);

  function finish() {
    if (done) return;
    done = true;
    clearInterval(iv);
    set(100);
    setTimeout(function () {
      var o = document.querySelector('[data-cv-preload]');
      if (!o) return;
      o.style.opacity = '0';
      o.style.pointerEvents = 'none';
      setTimeout(function () { if (o && o.parentNode) o.parentNode.removeChild(o); }, 600);
    }, 300);
  }

  if (document.readyState === 'complete') setTimeout(finish, 450);
  else window.addEventListener('load', function () { setTimeout(finish, 350); });
  setTimeout(finish, 6000); // veiligheidsnet
})();
