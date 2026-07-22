// lightrays.js — Convisto · licht-stralen shader (geport van het LightRays Framer-component, zonder ogl)
const VERT = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}';
const FRAG = `precision highp float;
uniform float iTime;uniform vec2 iResolution;uniform vec2 rayPos;uniform vec2 rayDir;uniform vec3 raysColor;
uniform float raysSpeed;uniform float lightSpread;uniform float rayLength;uniform float fadeDistance;
uniform vec2 mousePos;uniform float mouseInfluence;uniform float noiseAmount;uniform float distortion;
varying vec2 vUv;
float noise(vec2 st){return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);}
float rayStrength(vec2 raySource,vec2 rayRefDirection,vec2 coord,float seedA,float seedB,float speed){
  vec2 sourceToCoord=coord-raySource;
  vec2 dirNorm=normalize(sourceToCoord);
  float cosAngle=dot(dirNorm,rayRefDirection);
  float distortedAngle=cosAngle+distortion*sin(iTime*0.6+length(sourceToCoord)*0.004)*0.2;
  float spreadFactor=pow(max(distortedAngle,0.0),1.0/max(lightSpread,0.001));
  float dist=length(sourceToCoord);
  float maxDistance=iResolution.x*rayLength;
  float lengthFalloff=clamp((maxDistance-dist)/maxDistance,0.0,1.0);
  float fadeFalloff=clamp((iResolution.x*fadeDistance-dist)/(iResolution.x*fadeDistance),0.5,1.0);
  float baseStrength=clamp((0.45+0.15*sin(distortedAngle*seedA+iTime*speed))+(0.3+0.2*cos(-distortedAngle*seedB+iTime*speed)),0.0,1.0);
  return baseStrength*lengthFalloff*fadeFalloff*spreadFactor;
}
void main(){
  vec2 coord=vec2(gl_FragCoord.x,iResolution.y-gl_FragCoord.y);
  vec2 finalRayDir=rayDir;
  if(mouseInfluence>0.0){
    vec2 mouseScreenPos=mousePos*iResolution.xy;
    vec2 mouseDirection=normalize(mouseScreenPos-rayPos);
    finalRayDir=normalize(mix(rayDir,mouseDirection,mouseInfluence));
  }
  float r1=rayStrength(rayPos,finalRayDir,coord,36.2214,21.11349,1.5*raysSpeed);
  float r2=rayStrength(rayPos,finalRayDir,coord,22.3991,18.0234,1.1*raysSpeed);
  vec3 col=vec3(1.0)*(r1*0.5+r2*0.4);
  if(noiseAmount>0.0){
    float n=noise(coord*0.01+iTime*0.1);
    col*=(1.0-noiseAmount+noiseAmount*n);
  }
  col*=raysColor;
  gl_FragColor=vec4(col,(col.r+col.g+col.b)/3.0);
}`;

export function createLightRays(canvas, opts = {}){
  let gl = null;
  try { gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
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
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const u = n => gl.getUniformLocation(pr, n);
  const U = { t: u('iTime'), res: u('iResolution'), pos: u('rayPos'), dir: u('rayDir'), col: u('raysColor'), spd: u('raysSpeed'), spr: u('lightSpread'), len: u('rayLength'), fade: u('fadeDistance'), m: u('mousePos'), mi: u('mouseInfluence'), noi: u('noiseAmount'), dis: u('distortion') };
  const hex = opts.color || '#9D86FF';
  const col = [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
  let mx = 0.5, my = 0.5, sx = 0.5, sy = 0.5;
  function resize(){
    const dpr = Math.min(opts.dpr == null ? 1.25 : opts.dpr, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (Math.abs(canvas.width - w) > 4 || Math.abs(canvas.height - h) > 4){ canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  function frame(t){
    resize();
    sx += (mx - sx) * 0.08; sy += (my - sy) * 0.08;
    const w = canvas.width, h = canvas.height;
    // framebuffer expliciet wissen: voorkomt blend-accumulatie/flikkering per frame
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.t, t);
    gl.uniform2f(U.res, w, h);
    gl.uniform2f(U.pos, 0.5 * w, -0.2 * h);
    gl.uniform2f(U.dir, 0, 1);
    gl.uniform3f(U.col, col[0], col[1], col[2]);
    gl.uniform1f(U.spd, opts.speed == null ? 0.9 : opts.speed);
    gl.uniform1f(U.spr, opts.spread == null ? 0.9 : opts.spread);
    gl.uniform1f(U.len, opts.length == null ? 1.6 : opts.length);
    gl.uniform1f(U.fade, opts.fade == null ? 1.0 : opts.fade);
    gl.uniform2f(U.m, sx, sy);
    gl.uniform1f(U.mi, opts.mouseInfluence == null ? 0.08 : opts.mouseInfluence);
    gl.uniform1f(U.noi, opts.noise == null ? 0.06 : opts.noise);
    gl.uniform1f(U.dis, opts.distortion == null ? 0.04 : opts.distortion);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return {
    frame, resize,
    setMouse(x, y){ mx = x; my = y; },
    renderOnce(){ resize(); frame(opts.stillTime == null ? 8 : opts.stillTime); },
    destroy(){ const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); }
  };
}
