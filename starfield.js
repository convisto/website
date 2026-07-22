/* Convisto "Starfield Close" — dense streaming star tunnel (mint/jade/bone) as an
   immersive hero background. Uses global THREE (r0.143) + examples/js postprocessing,
   loaded as classic scripts in <helmet>. Mounts on canvas[data-hero-fx].
   Faithful to the provided spec's geometry/shaders/motion; the triple-composer
   corner-flame composite is condensed to one bloom pass over a dark tunnel bg. */
(function () {
  var CONFIG = {
    bgColor: '#070a16',
    colorA: '#aef6cf', colorB: '#5fe6a0', colorC: '#eafff2',
    pointSize: 50, brightness: 1.85,
    drift: 2.35, twinkle: 1, spin: 0.03,
    repelRadius: 5, repelStrength: 0.35,
    scrollPush: 8, scrollDrift: 6, scrollSpin: 0.1, parallax: 0.6,
    count: 4200, depth: 30
  };

  function hexToVec3(THREE, hex) {
    var n = parseInt(hex.slice(1), 16);
    return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  var VERT = [
    'uniform float uTime; uniform float uSize; uniform float uDrift; uniform float uDepth; uniform float uTwinkle;',
    'uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;',
    'uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC;',
    'attribute float aScale; attribute float aPhase; attribute float aPalette; attribute float aBright;',
    'varying vec3 vColor; varying float vTwinkle;',
    'void main() {',
    '  vec3 pos = position;',
    '  pos.z = mod(pos.z + uDrift + (uDepth * 0.5), uDepth) - (uDepth * 0.5);',
    '  float tw = sin(uTime * 1.6 + aPhase * 6.2831);',
    '  vTwinkle = (1.0 - uTwinkle) + uTwinkle * (0.55 + 0.45 * tw);',
    '  vec4 modelPosition = modelMatrix * vec4(pos, 1.0);',
    '  vec3 toParticle = modelPosition.xyz - uCursor;',
    '  float dist = length(toParticle);',
    '  float falloff = smoothstep(uRepelRadius, 0.0, dist);',
    '  modelPosition.xyz += normalize(toParticle + vec3(0.0001)) * falloff * uRepelStrength * uActivity;',
    '  vec4 viewPosition = viewMatrix * modelPosition;',
    '  gl_Position = projectionMatrix * viewPosition;',
    '  gl_PointSize = uSize * aScale;',
    '  gl_PointSize *= (1.0 / -viewPosition.z);',
    '  vec3 base = aPalette < 0.5 ? uColorA : (aPalette < 1.5 ? uColorB : uColorC);',
    '  vColor = base * aBright;',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform float uOpacity; uniform float uBrightness;',
    'varying vec3 vColor; varying float vTwinkle;',
    'void main() {',
    '  vec2 uv = gl_PointCoord - 0.5;',
    '  float d = length(uv);',
    '  if (d > 0.5) discard;',
    '  float strength = pow(1.0 - d * 2.0, 4.0);',
    '  vec3 color = mix(vec3(0.0), vColor, strength);',
    '  gl_FragColor = vec4(color * uBrightness, strength * uOpacity * vTwinkle);',
    '}'
  ].join('\n');

  function boot(tries) {
    var THREE = window.THREE;
    if (!THREE || !THREE.EffectComposer || !THREE.UnrealBloomPass || !THREE.RenderPass) {
      if ((tries || 0) > 80) return;
      return setTimeout(function () { boot((tries || 0) + 1); }, 60);
    }
    var canvas = document.querySelector('canvas[data-hero-fx]');
    var pageMode = false;
    if (!canvas) {
      pageMode = true;
      canvas = document.createElement('canvas');
      canvas.setAttribute('data-hero-fx', '');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;z-index:-1;pointer-events:none;opacity:0;-webkit-mask-image:linear-gradient(180deg,#000 0%,#000 22%,rgba(0,0,0,0.4) 40%,transparent 60%);mask-image:linear-gradient(180deg,#000 0%,#000 22%,rgba(0,0,0,0.4) 40%,transparent 60%)';
      (document.body || document.documentElement).appendChild(canvas);
      var scrim = document.createElement('div');
      scrim.setAttribute('data-stargate-scrim', '');
      scrim.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0;background:radial-gradient(120% 90% at 50% 50%, rgba(4,6,14,0.32) 0%, rgba(4,6,14,0.66) 58%, rgba(4,6,14,0.9) 100%)';
      (document.body || document.documentElement).appendChild(scrim);
      canvas.__scrim = scrim;
    }
    if (canvas.__starfield) return;
    canvas.__starfield = true;
    var pageVis = 0;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var renderer = new (THREE.WebGL1Renderer || THREE.WebGLRenderer)({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.bgColor);
    scene.fog = new THREE.Fog(new THREE.Color(CONFIG.bgColor).getHex(), 0, 15);

    var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 80);
    camera.position.set(0, 0, 5);
    scene.add(camera);

    var count = CONFIG.count, depth = CONFIG.depth;
    var positions = new Float32Array(count * 3);
    var scales = new Float32Array(count);
    var phases = new Float32Array(count);
    var palette = new Float32Array(count);
    var bright = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      var i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 24;
      positions[i3 + 1] = (Math.random() - 0.5) * 16;
      positions[i3 + 2] = (Math.random() - 0.5) * 30;
      palette[i] = Math.floor(Math.random() * 3);
      bright[i] = 0.7 + Math.random() * 0.6;
      scales[i] = 0.5 + Math.pow(Math.random(), 1.4) * 2.5;
      phases[i] = Math.random();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geo.setAttribute('aPalette', new THREE.Float32BufferAttribute(palette, 1));
    geo.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1));

    var uniforms = {
      uTime: { value: 0 }, uSize: { value: CONFIG.pointSize }, uOpacity: { value: 0 },
      uDrift: { value: 0 }, uDepth: { value: depth }, uTwinkle: { value: CONFIG.twinkle },
      uCursor: { value: new THREE.Vector3() }, uRepelRadius: { value: CONFIG.repelRadius },
      uRepelStrength: { value: CONFIG.repelStrength }, uActivity: { value: 0 },
      uColorA: { value: hexToVec3(THREE, CONFIG.colorA) },
      uColorB: { value: hexToVec3(THREE, CONFIG.colorB) },
      uColorC: { value: hexToVec3(THREE, CONFIG.colorC) },
      uBrightness: { value: CONFIG.brightness }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    var group = new THREE.Group();
    group.add(points);
    scene.add(group);

    var composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    var bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.55, 0);
    composer.addPass(bloom);
    if (THREE.GammaCorrectionShader) composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));

    // Pointer
    var POINTER = { ndc: new THREE.Vector2(), world: new THREE.Vector3(), target: new THREE.Vector3(), activity: 0, active: false, lastMove: 0 };
    var mouseSmooth = { x: 0, y: 0 }, ndcRaw = { x: 0, y: 0 };
    function onMove(e) {
      ndcRaw.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndcRaw.y = -((e.clientY / window.innerHeight) * 2 - 1);
      POINTER.active = true; POINTER.lastMove = performance.now();
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', function () { POINTER.active = false; });

    var _ray = new THREE.Vector3(), _dir = new THREE.Vector3();
    function updatePointer() {
      var target = POINTER.target.set(0, 0, 0);
      if (POINTER.active) {
        _ray.set(ndcRaw.x, ndcRaw.y, 0.5).unproject(camera);
        _dir.copy(_ray).sub(camera.position).normalize();
        if (Math.abs(_dir.z) > 1e-4) {
          var t = -camera.position.z / _dir.z;
          if (t > 0 && isFinite(t)) target.copy(camera.position).add(_dir.multiplyScalar(t));
        }
      }
      POINTER.world.lerp(target, 0.12);
      var idle = (performance.now() - POINTER.lastMove) / 1000;
      var want = (POINTER.active && idle < 3) ? 1 : 0;
      POINTER.activity += (want - POINTER.activity) * 0.06;
      uniforms.uCursor.value.copy(POINTER.world);
      uniforms.uActivity.value = POINTER.activity;
    }

    // Scroll (double-damped), clamped to ~first viewport (hero region)
    var scrollTarget = 0, scrollSmooth = 0, scrollCurrent = 0;
    function onScroll() {
      var max = window.innerHeight * 1.2;
      scrollTarget = Math.max(0, Math.min(1, (window.scrollY || 0) / max));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var appearStart = performance.now(), t0 = performance.now() / 1000, raf = 0, dead = false;

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setSize(w, h);
      onScroll();
    }
    window.addEventListener('resize', resize);

    function pageOpacity() {
      var st = window.scrollY || document.documentElement.scrollTop || 0;
      var vh = window.innerHeight;
      return Math.max(0, 1 - st / (vh * 0.7));
    }
    function frame() {
      if (dead) return;
      scrollSmooth += (scrollTarget - scrollSmooth) * 0.10;
      scrollCurrent += (scrollSmooth - scrollCurrent) * 0.06;
      mouseSmooth.x += (ndcRaw.x - mouseSmooth.x) * 0.06;
      mouseSmooth.y += (ndcRaw.y - mouseSmooth.y) * 0.06;
      updatePointer();

      var scroll = scrollCurrent, m = mouseSmooth;
      var t = performance.now() / 1000;
      var dt = Math.min(0.05, t - t0); t0 = t;
      uniforms.uTime.value = t;
      uniforms.uDrift.value += dt * (CONFIG.drift + scroll * CONFIG.scrollDrift);
      camera.position.set(m.x * CONFIG.parallax, m.y * CONFIG.parallax, 5 - scroll * CONFIG.scrollPush);
      camera.lookAt(m.x * CONFIG.parallax, m.y * CONFIG.parallax, -10);
      var elapsed = performance.now() - appearStart;
      var fade = Math.max(0, Math.min(1, (elapsed - 300) / 1400));
      uniforms.uOpacity.value = fade * 2;
      group.rotation.z += dt * (CONFIG.spin + scroll * CONFIG.scrollSpin);

      if (pageMode) {
        pageVis += (pageOpacity() - pageVis) * 0.12;
        canvas.style.opacity = pageVis.toFixed(3);
        if (canvas.__scrim) canvas.__scrim.style.opacity = (pageVis * 0.92).toFixed(3);
      }

      composer.render();
      raf = requestAnimationFrame(frame);
    }
    if (reduce) {
      uniforms.uOpacity.value = 2; uniforms.uDrift.value = 0;
      if (pageMode) { pageVis = pageOpacity(); canvas.style.opacity = pageVis.toFixed(3); if (canvas.__scrim) canvas.__scrim.style.opacity = (pageVis * 0.92).toFixed(3); }
      composer.render();
    } else {
      raf = requestAnimationFrame(frame);
    }

    canvas.__starfieldDestroy = function () {
      dead = true; if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      try { renderer.dispose(); geo.dispose(); mat.dispose(); } catch (e) {}
    };
  }

  boot(0);
})();
