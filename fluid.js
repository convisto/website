/* Convisto fluid — Pavel Dobryakov's WebGL fluid simulation (MIT), tuned for an
   immersive, brand-aligned ink background (Convisto violet → mint on near-black ink).
   Exposes window.ConvistoFluid(canvas, opts) → controller { setHue, burst, destroy }.
   opts.hue = initial base hue (0..1). Call ctl.setHue(h) to transition the ink palette. */
window.ConvistoFluid = function (canvas, opts) {
    opts = opts || {};
    canvas.width = canvas.clientWidth || 1;
    canvas.height = canvas.clientHeight || 1;

    let baseHue = opts.hue != null ? opts.hue : 0.69; // violet
    let targetHue = baseHue;
    let hueSpread = opts.spread != null ? opts.spread : 0.07;
    const ORBIT_ON = opts.orbit !== false;
    const BURST_ON = opts.burst !== false;

    let config = {
        SIM_RESOLUTION: 160,
        DYE_RESOLUTION: 512,
        DENSITY_DISSIPATION: 0.94,
        VELOCITY_DISSIPATION: 0.94,
        PRESSURE_DISSIPATION: 0.8,
        PRESSURE_ITERATIONS: 20,
        CURL: 15,
        SPLAT_RADIUS: 0.15,
        SHADING: true,
        COLORFUL: true,
        PAUSED: false,
        BACK_COLOR: { r: 8, g: 16, b: 20 },
        TRANSPARENT: false,
        BLOOM: false,
        BLOOM_ITERATIONS: 8,
        BLOOM_RESOLUTION: 256,
        BLOOM_INTENSITY: 0.8,
        BLOOM_THRESHOLD: 0.8,
        BLOOM_SOFT_KNEE: 0.7
    };

    function pointerPrototype() {
        this.id = -1; this.x = 0; this.y = 0; this.dx = 0; this.dy = 0;
        this.down = false; this.moved = false; this.color = [30, 0, 300];
    }

    let pointers = [];
    let splatStack = [];
    let bloomFramebuffers = [];
    pointers.push(new pointerPrototype());

    const ctx = getWebGLContext(canvas);
    if (!ctx.gl) return { setHue: function () {}, burst: function () {}, destroy: function () {} };
    const gl = ctx.gl, ext = ctx.ext;

    if (isMobile()) config.SHADING = false;
    if (!ext.supportLinearFiltering) { config.SHADING = false; config.BLOOM = false; }

    function getWebGLContext(canvas) {
        const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
        let gl = canvas.getContext('webgl2', params);
        const isWebGL2 = !!gl;
        if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
        if (!gl) return { gl: null };
        let halfFloat, supportLinearFiltering;
        if (isWebGL2) {
            gl.getExtension('EXT_color_buffer_float');
            supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
        } else {
            halfFloat = gl.getExtension('OES_texture_half_float');
            supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
        }
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);
        let formatRGBA, formatRG, formatR;
        if (isWebGL2) {
            formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
            formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
            formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
        } else {
            formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
            formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
            formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        }
        return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } };
    }

    function getSupportedFormat(gl, internalFormat, format, type) {
        if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
            switch (internalFormat) {
                case gl.R16F: return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
                case gl.RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
                default: return null;
            }
        }
        return { internalFormat, format };
    }

    function supportRenderTextureFormat(gl, internalFormat, format, type) {
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
        let fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE;
    }

    function isMobile() { return /Mobi|Android/i.test(navigator.userAgent); }

    class GLProgram {
        constructor(vertexShader, fragmentShader) {
            this.uniforms = {};
            this.program = gl.createProgram();
            gl.attachShader(this.program, vertexShader);
            gl.attachShader(this.program, fragmentShader);
            gl.linkProgram(this.program);
            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw gl.getProgramInfoLog(this.program);
            const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < uniformCount; i++) {
                const uniformName = gl.getActiveUniform(this.program, i).name;
                this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
            }
        }
        bind() { gl.useProgram(this.program); }
    }

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(shader);
        return shader;
    }

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform vec2 texelSize;
        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    const clearShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float; precision mediump sampler2D;
        varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;
        void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
    `);

    const colorShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float; uniform vec4 color;
        void main () { gl_FragColor = color; }
    `);

    const displayShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float; precision highp sampler2D;
        varying vec2 vUv; uniform sampler2D uTexture;
        void main () {
            vec3 C = texture2D(uTexture, vUv).rgb;
            float a = max(C.r, max(C.g, C.b));
            gl_FragColor = vec4(C, a);
        }
    `);

    const displayShadingShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float; precision highp sampler2D;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uTexture; uniform vec2 texelSize;
        void main () {
            vec3 L = texture2D(uTexture, vL).rgb;
            vec3 R = texture2D(uTexture, vR).rgb;
            vec3 T = texture2D(uTexture, vT).rgb;
            vec3 B = texture2D(uTexture, vB).rgb;
            vec3 C = texture2D(uTexture, vUv).rgb;
            float dx = length(R) - length(L);
            float dy = length(T) - length(B);
            vec3 n = normalize(vec3(dx, dy, length(texelSize)));
            vec3 l = vec3(0.0, 0.0, 1.0);
            float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
            C.rgb *= diffuse;
            float a = max(C.r, max(C.g, C.b));
            gl_FragColor = vec4(C, a);
        }
    `);

    const splatShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float; precision highp sampler2D;
        varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;
        uniform vec3 color; uniform vec2 point; uniform float radius;
        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `);

    const advectionManualFilteringShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float; precision highp sampler2D;
        varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;
        uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;
        vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
            vec2 st = uv / tsize - 0.5;
            vec2 iuv = floor(st); vec2 fuv = fract(st);
            vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
            vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
            vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
            vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
            return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
        }
        void main () {
            vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
            gl_FragColor = dissipation * bilerp(uSource, coord, dyeTexelSize);
            gl_FragColor.a = 1.0;
        }
    `);

    const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float; precision highp sampler2D;
        varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;
        uniform vec2 texelSize; uniform float dt; uniform float dissipation;
        void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            gl_FragColor = dissipation * texture2D(uSource, coord);
            gl_FragColor.a = 1.0;
        }
    `);

    const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float; precision mediump sampler2D;
        varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `);

    const curlShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float; precision mediump sampler2D;
        varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `);

    const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float; precision highp sampler2D;
        varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
        uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
        void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C; force.y *= -1.0;
            vec2 vel = texture2D(uVelocity, vUv).xy;
            gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
        }
    `);

    const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float; precision mediump sampler2D;
        varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
        uniform sampler2D uPressure; uniform sampler2D uDivergence;
        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `);

    const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float; precision mediump sampler2D;
        varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;
        uniform sampler2D uPressure; uniform sampler2D uVelocity;
        void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
    `);

    const blit = (() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        return (destination) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        };
    })();

    let simWidth, simHeight, dyeWidth, dyeHeight, density, velocity, divergence, curl, pressure;

    const clearProgram = new GLProgram(baseVertexShader, clearShader);
    const colorProgram = new GLProgram(baseVertexShader, colorShader);
    const displayProgram = new GLProgram(baseVertexShader, displayShader);
    const displayShadingProgram = new GLProgram(baseVertexShader, displayShadingShader);
    const splatProgram = new GLProgram(baseVertexShader, splatShader);
    const advectionProgram = new GLProgram(baseVertexShader, ext.supportLinearFiltering ? advectionShader : advectionManualFilteringShader);
    const divergenceProgram = new GLProgram(baseVertexShader, divergenceShader);
    const curlProgram = new GLProgram(baseVertexShader, curlShader);
    const vorticityProgram = new GLProgram(baseVertexShader, vorticityShader);
    const pressureProgram = new GLProgram(baseVertexShader, pressureShader);
    const gradienSubtractProgram = new GLProgram(baseVertexShader, gradientSubtractShader);

    function initFramebuffers() {
        let simRes = getResolution(config.SIM_RESOLUTION);
        let dyeRes = getResolution(config.DYE_RESOLUTION);
        simWidth = simRes.width; simHeight = simRes.height;
        dyeWidth = dyeRes.width; dyeHeight = dyeRes.height;
        const texType = ext.halfFloatTexType;
        const rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
        const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
        if (density == null) density = createDoubleFBO(dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);
        else density = resizeDoubleFBO(density, dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);
        if (velocity == null) velocity = createDoubleFBO(simWidth, simHeight, rg.internalFormat, rg.format, texType, filtering);
        else velocity = resizeDoubleFBO(velocity, simWidth, simHeight, rg.internalFormat, rg.format, texType, filtering);
        divergence = createFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
        curl = createFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
        pressure = createDoubleFBO(simWidth, simHeight, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    function createFBO(w, h, internalFormat, format, type, param) {
        gl.activeTexture(gl.TEXTURE0);
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
        let fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return {
            texture, fbo, width: w, height: h,
            attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
        };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
        let fbo1 = createFBO(w, h, internalFormat, format, type, param);
        let fbo2 = createFBO(w, h, internalFormat, format, type, param);
        return {
            get read() { return fbo1; }, set read(v) { fbo1 = v; },
            get write() { return fbo2; }, set write(v) { fbo2 = v; },
            swap() { let t = fbo1; fbo1 = fbo2; fbo2 = t; }
        };
    }

    function resizeFBO(target, w, h, internalFormat, format, type, param) {
        let newFBO = createFBO(w, h, internalFormat, format, type, param);
        clearProgram.bind();
        gl.uniform1i(clearProgram.uniforms.uTexture, target.attach(0));
        gl.uniform1f(clearProgram.uniforms.value, 1);
        blit(newFBO.fbo);
        return newFBO;
    }

    function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
        target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
        target.write = createFBO(w, h, internalFormat, format, type, param);
        return target;
    }

    initFramebuffers();
    if (BURST_ON) multipleSplats(9);

    let lastColorChangeTime = Date.now();
    let virtualSeeded = false, orbitAngle = 0, vPrevX = 0, vPrevY = 0;
    let virtualColor = null, lastVColorTime = 0;
    const engineStart = Date.now();
    const ORBIT_RADIUS = 260, ORBIT_SPEED = 0.008, ORBIT_START_DELAY = 700;

    let rafHandle = 0, destroyed = false;
    update();

    function update() {
        if (destroyed) return;
        baseHue += (targetHue - baseHue) * 0.03;
        resizeCanvas();
        driveVirtualPointer();
        input();
        if (!config.PAUSED) step(0.016);
        render(null);
        rafHandle = requestAnimationFrame(update);
    }

    function driveVirtualPointer() {
        if (!ORBIT_ON) return;
        if (Date.now() - engineStart < ORBIT_START_DELAY) return;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const base = Math.min(ORBIT_RADIUS, canvas.width * 0.34, canvas.height * 0.4);
        const r = base * (0.78 + 0.22 * Math.sin(orbitAngle * 0.37));
        orbitAngle += ORBIT_SPEED;
        const x = cx + Math.cos(orbitAngle) * r;
        const y = cy + Math.sin(orbitAngle) * r * 0.72;
        if (!virtualSeeded) { virtualSeeded = true; vPrevX = x; vPrevY = y; return; }
        if (!virtualColor || Date.now() - lastVColorTime > 260) {
            virtualColor = generateColor();
            virtualColor.r *= 1.6; virtualColor.g *= 1.6; virtualColor.b *= 1.6;
            lastVColorTime = Date.now();
        }
        const dx = (x - vPrevX) * 4.5, dy = (y - vPrevY) * 4.5;
        vPrevX = x; vPrevY = y;
        splat(x, y, dx, dy, virtualColor);
    }

    function input() {
        if (splatStack.length > 0) multipleSplats(splatStack.pop());
        for (let i = 0; i < pointers.length; i++) {
            const p = pointers[i];
            if (p.moved) { splat(p.x, p.y, p.dx, p.dy, p.color); p.moved = false; }
        }
        if (!config.COLORFUL) return;
        if (lastColorChangeTime + 240 < Date.now()) {
            lastColorChangeTime = Date.now();
            for (let i = 0; i < pointers.length; i++) pointers[i].color = generateColor();
        }
    }

    function step(dt) {
        gl.disable(gl.BLEND);
        gl.viewport(0, 0, simWidth, simHeight);
        curlProgram.bind();
        gl.uniform2f(curlProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
        blit(curl.fbo);
        vorticityProgram.bind();
        gl.uniform2f(vorticityProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
        gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
        gl.uniform1f(vorticityProgram.uniforms.dt, dt);
        blit(velocity.write.fbo); velocity.swap();
        divergenceProgram.bind();
        gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
        blit(divergence.fbo);
        clearProgram.bind();
        gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
        gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE_DISSIPATION);
        blit(pressure.write.fbo); pressure.swap();
        pressureProgram.bind();
        gl.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
        for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
            gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
            blit(pressure.write.fbo); pressure.swap();
        }
        gradienSubtractProgram.bind();
        gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
        gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
        blit(velocity.write.fbo); velocity.swap();
        advectionProgram.bind();
        gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / simWidth, 1.0 / simHeight);
        if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / simWidth, 1.0 / simHeight);
        let velocityId = velocity.read.attach(0);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
        gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
        blit(velocity.write.fbo); velocity.swap();
        gl.viewport(0, 0, dyeWidth, dyeHeight);
        if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, 1.0 / dyeWidth, 1.0 / dyeHeight);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform1i(advectionProgram.uniforms.uSource, density.read.attach(1));
        gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
        blit(density.write.fbo); density.swap();
    }

    function render(target) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        let width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
        gl.viewport(0, 0, width, height);
        colorProgram.bind();
        let bc = config.BACK_COLOR;
        gl.uniform4f(colorProgram.uniforms.color, bc.r / 255, bc.g / 255, bc.b / 255, 1);
        blit(target);
        if (config.SHADING) {
            let program = displayShadingProgram; program.bind();
            gl.uniform2f(program.uniforms.texelSize, 1.0 / width, 1.0 / height);
            gl.uniform1i(program.uniforms.uTexture, density.read.attach(0));
        } else {
            let program = displayProgram; program.bind();
            gl.uniform1i(program.uniforms.uTexture, density.read.attach(0));
        }
        blit(target);
    }

    function splat(x, y, dx, dy, color) {
        gl.viewport(0, 0, simWidth, simHeight);
        splatProgram.bind();
        gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
        gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
        gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0);
        gl.uniform1f(splatProgram.uniforms.radius, config.SPLAT_RADIUS / 100.0);
        blit(velocity.write.fbo); velocity.swap();
        gl.viewport(0, 0, dyeWidth, dyeHeight);
        gl.uniform1i(splatProgram.uniforms.uTarget, density.read.attach(0));
        gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
        blit(density.write.fbo); density.swap();
    }

    function multipleSplats(amount) {
        for (let i = 0; i < amount; i++) {
            const color = generateColor();
            color.r *= 6.0; color.g *= 6.0; color.b *= 6.0;
            const x = canvas.width * Math.random();
            const y = canvas.height * Math.random();
            const dx = 1000 * (Math.random() - 0.5);
            const dy = 1000 * (Math.random() - 0.5);
            splat(x, y, dx, dy, color);
        }
    }

    function resizeCanvas() {
        let w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width != w || canvas.height != h) {
            canvas.width = w; canvas.height = h;
            initFramebuffers();
        }
    }

    function pointerPos(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    const teardown = [];
    function on(target, type, handler, o) {
        target.addEventListener(type, handler, o);
        teardown.push(() => target.removeEventListener(type, handler, o));
    }

    on(window, 'mousemove', e => {
        const { x, y } = pointerPos(e.clientX, e.clientY);
        const p = pointers[0];
        if (!p.everMoved) { p.everMoved = true; p.x = x; p.y = y; p.down = true; return; }
        p.down = true; p.moved = true;
        p.dx = (x - p.x) * 5.0; p.dy = (y - p.y) * 5.0;
        p.x = x; p.y = y; p.color = generateColor();
    });
    on(window, 'touchmove', e => {
        const touches = e.targetTouches;
        for (let i = 0; i < touches.length; i++) {
            if (i >= pointers.length) pointers.push(new pointerPrototype());
            const p = pointers[i];
            const { x, y } = pointerPos(touches[i].clientX, touches[i].clientY);
            p.down = true; p.moved = p.everMoved === true; p.everMoved = true;
            p.dx = (x - p.x) * 8.0; p.dy = (y - p.y) * 8.0; p.x = x; p.y = y;
        }
    }, { passive: true });
    on(window, 'mouseup', () => { pointers[0].down = false; });

    function generateColor() {
        const h = baseHue + (Math.random() * 2 - 1) * hueSpread;
        let c = HSVtoRGB(((h % 1) + 1) % 1, 0.92, 1.0);
        c.r *= 0.9; c.g *= 0.9; c.b *= 0.9;
        return c;
    }

    function HSVtoRGB(h, s, v) {
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6); f = h * 6 - i;
        p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return { r, g, b };
    }

    function getResolution(resolution) {
        let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
        if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
        let max = Math.round(resolution * aspectRatio);
        let min = Math.round(resolution);
        if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
        return { width: min, height: max };
    }

    return {
        setHue(h) { targetHue = h; },
        setSpread(s) { hueSpread = s; },
        burst(n) { for (let i = 0; i < (n || 6); i++) splatStack.push(8 + parseInt(Math.random() * 8)); },
        destroy() { destroyed = true; if (rafHandle) cancelAnimationFrame(rafHandle); for (const off of teardown) off(); }
    };
};
