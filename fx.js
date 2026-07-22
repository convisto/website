// fx.js — Convisto prototype · lichte WebGL-helpers (geen dependencies)
// createFlowField(canvas, opts) → traag, organisch shader-veld (hero + cta-bookend)
// createDistort(canvas, img)   → hover-distortion op case-beelden
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

function program(gl, frag){
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, VERT); gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, frag); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.warn('[fx]', gl.getShaderInfoLog(fs)); return null; }
  const pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return pr;
}

const FLOW = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uAmp;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.55; }
  return v;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uT * 0.05;
  vec2 q = vec2(fbm(uv * 1.3 + t * 0.9), fbm(uv * 1.3 - t * 0.6 + 3.7));
  vec2 r = vec2(fbm(uv * 1.7 + q * 1.3 + uM * 0.25 + vec2(t * 0.5, -t * 0.3)),
                fbm(uv * 1.7 + q * 1.2 + vec2(-t * 0.4, t * 0.2) + 8.2));
  float f = fbm(uv * 1.5 + r * 1.6);
  vec3 ink    = vec3(0.043, 0.039, 0.094);
  vec3 indigo = vec3(0.105, 0.088, 0.315);
  vec3 violet = vec3(0.486, 0.361, 1.0);
  vec3 col = mix(ink, indigo, smoothstep(0.18, 0.92, f));
  col = mix(col, violet, uAmp * 0.52 * smoothstep(0.52, 1.05, f * 0.72 + r.y * 0.45));
  col = mix(col, ink, smoothstep(0.15, 1.05, length(uv * vec2(0.82, 1.18))) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createFlowField(canvas, opts = {}){
  let gl = null;
  try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const pr = program(gl, FLOW);
  if (!pr) return null;
  const u = n => gl.getUniformLocation(pr, n);
  const uRes = u('uRes'), uT = u('uT'), uM = u('uM'), uAmp = u('uAmp');
  let mx = 0, my = 0, tx = 0, ty = 0, speed = opts.speed == null ? 1 : opts.speed;
  function resize(){
    const s = Math.min(opts.dpr == null ? 1 : opts.dpr, window.devicePixelRatio || 1) * (opts.scale == null ? 0.5 : opts.scale);
    const w = Math.max(2, Math.round(canvas.clientWidth * s));
    const h = Math.max(2, Math.round(canvas.clientHeight * s));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  function frame(t){
    resize();
    mx += (tx - mx) * 0.035; my += (ty - my) * 0.035;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, t * speed);
    gl.uniform2f(uM, mx, my);
    gl.uniform1f(uAmp, opts.amp == null ? 1 : opts.amp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return {
    frame, resize,
    setMouse(x, y){ tx = x; ty = y; },
    setSpeed(v){ speed = v; },
    renderOnce(){ resize(); frame(opts.stillTime == null ? 26 : opts.stillTime); },
    destroy(){ const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); }
  };
}

const DIST = `precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uImg; uniform vec2 uM; uniform float uS;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float ca = uRes.x / uRes.y, ia = uImg.x / uImg.y;
  vec2 s = vec2(1.0);
  if (ca > ia) s.y = ia / ca; else s.x = ca / ia;
  vec2 iuv = (uv - 0.5) * s + 0.5;
  vec2 muv = (uM - 0.5) * s + 0.5;
  vec2 d = iuv - muv;
  float l = max(length(d), 0.0001);
  float k = uS * 0.11 * exp(-l * l * 9.0);
  vec2 off = (d / l) * k;
  float zoom = 1.0 - uS * 0.05;
  iuv = (iuv - 0.5) * zoom + 0.5;
  vec3 col;
  col.r = texture2D(uTex, iuv - off * 1.25).r;
  col.g = texture2D(uTex, iuv - off).g;
  col.b = texture2D(uTex, iuv - off * 0.75).b;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createDistort(canvas, img, opts = {}){
  let gl = null;
  try { gl = canvas.getContext('webgl', { antialias: false, alpha: false }); } catch (e) { gl = null; }
  if (!gl) return null;
  const pr = program(gl, DIST);
  if (!pr) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); } catch (e) { return null; }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = n => gl.getUniformLocation(pr, n);
  const uRes = u('uRes'), uImg = u('uImg'), uM = u('uM'), uS = u('uS');
  function resize(){
    const s = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(canvas.clientWidth * s));
    const h = Math.max(2, Math.round(canvas.clientHeight * s));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  function frame(mxu, myu, s){
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uImg, img.naturalWidth || 4, img.naturalHeight || 3);
    gl.uniform2f(uM, mxu, myu);
    gl.uniform1f(uS, s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { frame, resize, destroy(){ const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } };
}
