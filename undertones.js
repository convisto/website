/* Convisto "Undertones" — trage, korrelige mesh-gradient met zachte kleur-ondertonen
   (ink + gedempt violet/indigo/mint) op near-black. Self-contained WebGL1.
   window.ConvistoUndertones(canvas, opts) → { destroy }. */
window.ConvistoUndertones = function (canvas, opts) {
  opts = opts || {};
  var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
        || canvas.getContext('experimental-webgl');
  if (!gl) return { destroy: function () {} };

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 u_res; uniform float u_time; uniform float u_speed;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/u_res;',
    ' vec2 p=uv; p.x*=u_res.x/u_res.y;',
    ' float t=u_time*u_speed;',
    ' vec2 q=vec2(fbm(p*1.4+t),fbm(p*1.4+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p*1.4+2.6*q+vec2(1.7,9.2)+0.15*t),fbm(p*1.4+2.6*q+vec2(8.3,2.8)));',
    ' float f=fbm(p*1.4+2.4*r);',
    ' vec3 ink=vec3(0.031,0.055,0.078);',
    ' vec3 indigo=vec3(0.09,0.11,0.28);',
    ' vec3 violet=vec3(0.34,0.24,0.60);',
    ' vec3 mint=vec3(0.11,0.42,0.35);',
    ' vec3 col=ink;',
    ' col=mix(col,indigo,smoothstep(0.15,0.9,f));',
    ' col=mix(col,violet,smoothstep(0.32,0.98,r.x*0.85+q.y*0.45));',
    ' col=mix(col,mint,smoothstep(0.5,1.05,q.x)*0.45);',
    ' float g=hash(gl_FragCoord.xy+fract(u_time*0.7)*137.0);',
    ' col+=(g-0.5)*0.05;',
    ' float vig=length((uv-0.5)*vec2(1.05,1.15));',
    ' col*=1.0-0.42*vig*vig;',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var prog = gl.createProgram();
  var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return { destroy: function () {} };
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uSpeed = gl.getUniformLocation(prog, 'u_speed');
  gl.uniform1f(uSpeed, opts.speed != null ? opts.speed : 0.05);

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  resize();

  var start = performance.now(), raf = 0, dead = false;
  function frame(now) {
    if (dead) return;
    resize();
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return { destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); } };
};
