/* Convisto — mini-starfield voor het Diensten-mega-menu (rechterpaneel).
   Lichtgewicht 2D-canvas (geen WebGL): stroomt sterren naar de kijker toe,
   mint/jade/bone op ink. Start pas bij de eerste hover op het menu. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = ['#aef6cf', '#5fe6a0', '#eafff2', '#7C5CFF'];

  function setup(canvas) {
    if (canvas.__mmStars) return canvas.__mmStars;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 1, H = 1, stars = [], raf = 0, running = false, dead = false;

    function size() {
      var w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function mk() {
      return { x: (Math.random() - 0.5) * W, y: (Math.random() - 0.5) * H, z: Math.random() * W + 40,
        c: COLORS[(Math.random() * COLORS.length) | 0], s: 0.5 + Math.random() * 1.6 };
    }
    function seed() { stars = []; var n = Math.round(Math.min(180, (W * H) / 900)); for (var i = 0; i < n; i++) stars.push(mk()); }

    function frame() {
      if (dead) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      var cx = W / 2, cy = H * 0.42, speed = W * 0.9;
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.z -= speed * 0.016;
        if (st.z < 1) { stars[i] = mk(); stars[i].z = W; continue; }
        var k = 220 / st.z;
        var px = cx + st.x * k, py = cy + st.y * k;
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        var r = Math.max(0.4, st.s * k * 0.9);
        var a = Math.min(1, (1 - st.z / (W + 40)) * 1.2);
        ctx.beginPath();
        ctx.fillStyle = st.c;
        ctx.globalAlpha = a * 0.9;
        ctx.shadowColor = st.c; ctx.shadowBlur = r * 2.4;
        ctx.arc(px, py, r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }

    var api = {
      start: function () {
        if (running || dead) return;
        size(); if (!stars.length) seed();
        if (reduce) { // één statisch frame
          size(); seed(); frame(); dead = true; if (raf) cancelAnimationFrame(raf);
          return;
        }
        running = true; raf = requestAnimationFrame(frame);
      }
    };
    canvas.__mmStars = api;
    window.addEventListener('resize', function () { if (running) { size(); seed(); } });
    return api;
  }

  function init() {
    var canvases = document.querySelectorAll('canvas[data-mm-stars]');
    if (!canvases.length) return;
    canvases.forEach(function (c) { setup(c); });
    // start bij eerste hover op het mega-menu (of de Diensten-link)
    var started = false;
    document.addEventListener('mouseover', function (e) {
      if (started) return;
      var t = e.target;
      if (t && t.closest && (t.closest('[data-mm]') || t.closest('[data-mm-panel]'))) {
        started = true;
        document.querySelectorAll('canvas[data-mm-stars]').forEach(function (c) {
          var a = c.__mmStars || setup(c); a.start();
        });
      }
    }, { passive: true });
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
