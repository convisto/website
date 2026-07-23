/* Convisto — AVG/cookie-consent. Zelf-injecterend, rechtsonder, merkstijl (vlak, violet accent).
   Bewaart de keuze in localStorage ('cv-consent'). window.cvOpenConsent() heropent de instellingen. */
(function () {
  // support.js rendert de <x-dc>-template client-side en injecteert de helmet-
  // scripts opnieuw in <head>. Dit bestand draait daardoor twee keer: één keer
  // bij het parsen van de body, één keer na de her-injectie. Elke run had een
  // eigen 'el' en bouwde een eigen banner — vandaar twee popups. Een globale
  // vlag laat alleen de eerste run door.
  if (window.__cvConsentActief) return;
  window.__cvConsentActief = true;

  var KEY = 'cv-consent';
  function stored() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el = null;

  function build(existing) {
    if (el || document.querySelector('[data-cv-consent]')) return;
    var a = existing || { analytics: true, marketing: false };
    var wrap = document.createElement('div');
    wrap.setAttribute('data-cv-consent', '');
    wrap.style.cssText = 'position:fixed;right:clamp(14px,2.5vw,26px);bottom:clamp(14px,2.5vw,26px);z-index:2147483000;width:min(380px,calc(100vw - 28px));font-family:\'Sora\',system-ui,sans-serif;color:#FFFFFF;background:rgba(13,22,28,0.86);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 0 0 1px rgba(255,255,255,0.12),0 24px 60px -20px rgba(0,0,0,0.7);border-radius:16px;padding:22px 22px 20px;transform:translateY(' + (reduce ? '0' : '18px') + ');opacity:' + (reduce ? '1' : '0') + ';transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s ease';

    var toggle = function (id, label, desc, on, locked) {
      return '<label style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid rgba(255,255,255,0.08);cursor:' + (locked ? 'default' : 'pointer') + '">'
        + '<input type="checkbox" data-c="' + id + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + ' style="margin-top:2px;width:16px;height:16px;accent-color:#7C5CFF;flex:none;cursor:inherit">'
        + '<span><span style="display:block;font-size:13px;font-weight:500;color:#FFFFFF">' + label + '</span>'
        + '<span style="display:block;margin-top:3px;font-size:12px;font-weight:350;line-height:1.5;color:rgba(255,255,255,0.55)">' + desc + '</span></span></label>';
    };

    var btn = function (attr, txt, primary) {
      return '<button type="button" ' + attr + ' style="flex:1 1 auto;padding:12px 16px;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;'
        + (primary
          ? 'background:rgba(124,92,255,0.22);color:#FFFFFF;box-shadow:0 0 0 1px rgba(124,92,255,0.5);'
          : 'background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.8);box-shadow:0 0 0 1px rgba(255,255,255,0.14);')
        + 'transition:background-color .2s ease,box-shadow .2s ease,color .2s ease">' + txt + '</button>';
    };

    wrap.innerHTML =
      '<div style="display:inline-flex;align-items:center;gap:9px;font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B7A9FF"><span style="width:6px;height:6px;border-radius:99px;background:#7C5CFF"></span>Cookies</div>'
      + '<p style="margin:12px 0 0;font-size:13.5px;line-height:1.6;font-weight:350;color:rgba(255,255,255,0.72)">We gebruiken cookies om de site te laten werken en het gebruik te analyseren. Ga je akkoord, of stel je jouw voorkeuren zelf in? Meer in ons <a href="Privacybeleid.dc.html" style="color:#FFFFFF;text-decoration:underline;text-underline-offset:2px">privacybeleid</a>.</p>'
      + '<div data-c-settings style="display:none;margin-top:14px">'
        + toggle('necessary', 'Noodzakelijk', 'Nodig om de site te laten werken. Altijd actief.', true, true)
        + toggle('analytics', 'Analytisch', 'Anoniem meten hoe de site gebruikt wordt.', a.analytics, false)
        + toggle('marketing', 'Marketing', 'Voor relevante advertenties en remarketing.', a.marketing, false)
      + '</div>'
      + '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">'
        + btn('data-c-accept', 'Alles accepteren', true)
        + btn('data-c-reject', 'Weigeren', false)
      + '</div>'
      + '<div style="margin-top:10px;text-align:center"><button type="button" data-c-toggle style="background:none;border:none;color:rgba(255,255,255,0.5);font-family:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:2px">Instellingen wijzigen</button>'
        + '<button type="button" data-c-save style="display:none;background:none;border:none;color:#B7A9FF;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:2px">Mijn voorkeuren bewaren</button></div>';

    document.body.appendChild(wrap);
    el = wrap;
    requestAnimationFrame(function () { wrap.style.transform = 'translateY(0)'; wrap.style.opacity = '1'; });

    function close() {
      if (reduce) { wrap.remove(); el = null; return; }
      wrap.style.transform = 'translateY(18px)'; wrap.style.opacity = '0';
      setTimeout(function () { wrap.remove(); el = null; }, 500);
    }
    function commit(v) { v.ts = new Date().toISOString(); save(v); close(); }

    wrap.querySelector('[data-c-accept]').onclick = function () { commit({ necessary: true, analytics: true, marketing: true }); };
    wrap.querySelector('[data-c-reject]').onclick = function () { commit({ necessary: true, analytics: false, marketing: false }); };
    var settings = wrap.querySelector('[data-c-settings]');
    var toggleBtn = wrap.querySelector('[data-c-toggle]');
    var saveBtn = wrap.querySelector('[data-c-save]');
    toggleBtn.onclick = function () { settings.style.display = 'block'; toggleBtn.style.display = 'none'; saveBtn.style.display = 'inline'; };
    saveBtn.onclick = function () {
      commit({
        necessary: true,
        analytics: wrap.querySelector('[data-c="analytics"]').checked,
        marketing: wrap.querySelector('[data-c="marketing"]').checked
      });
    };
  }

  window.cvOpenConsent = function () { if (!el) build(stored() || undefined); };

  function init() { if (!stored()) build(); }
  if (document.readyState !== 'loading') setTimeout(init, 600);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
})();
