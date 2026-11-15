/* ==========================================================================
   rgdevstudio · campo de partículas
   WebGL 1 escrito a mano, sin librerías (~6 KB comprimido): un programa, dos
   buffers y un único drawArrays(GL_POINTS) por fotograma.

   Cómo funciona
   - Cada forma se muestrea UNA vez desde los <symbol> SVG del HTML (o desde un
     texto con Lora) y se guarda en un único VBO, una detrás de otra.
   - El morph se hace en el vertex shader: aA y aB apuntan (con un desplazamiento
     en el VBO) a la forma de origen y a la de destino, y uT es el progreso, ligado
     al scroll. Cambiar de escena no sube nada a la GPU: solo mueve dos punteros.
   - El guion de escenas sale de las posiciones reales de cada sección (ver
     buildHolds) y de RG.config.scenes en js/main.js.
   Todo lo ajustable del render está en CONFIG; los colores, en variables CSS.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    count: { desktop: 18000, desktopHigh: 24000, mobile: 5200, mobileLow: 3600, software: 2500 },
    software: { dpr: 1, fpsDivider: 2 },   // GPU por software (VMs, Lighthouse/PageSpeed): menos coste por fotograma
    pointSize: { desktop: 2.2, mobile: 2.9 },   // diámetro del núcleo de cada punto, px CSS
    halo: 2.6,               // el punto dibuja núcleo × halo (el resto es brillo suave)
    haloAlpha: 0.2,          // intensidad del brillo
    glow: 0.45,              // 0 = mezcla normal, 1 = aditiva pura (solo afecta al brillo)
    alpha: 0.95,
    colorWeights: [0.55, 0.3, 0.15],   // reparto entre los tres tonos de cada paleta
    dprMax: 2,
    sampleRes: { desktop: 360, mobile: 260 },   // resolución a la que se rasteriza cada forma
    edgeRatio: 0.4,          // parte de los puntos que se van al contorno (lo hace legible)
    fit: 0.94,               // cuánto llena la forma su hueco
    intro: { dur: 2.4, spread: 1.3 },
    morph: { scatter: 0.07, stagger: 0.4 },      // dispersión (× lado corto de la pantalla) y escalonado
    breathe: { amp: 1.2, cloud: 7, speed: 0.55 },
    cursor: { radius: 120, force: 34, stiffness: 0.08, damping: 0.78, trailEvery: 26, trailLife: 1.5, ripple: 0.5 },
    tilt: { amp: 18, range: 22, smooth: 0.08 },
    drift: { amp: 9, speed: 0.06 },
    burst: { dur: 1.3, amp: 48 },
    cloudDensity: 0.4,       // parte de las partículas visibles en la nube de Sobre mí / FAQ
    fps: { limitMs: 24, window: 2000, factor: 0.78, maxDrops: 2, grace: 3500 }
  };

  var root = document.documentElement;
  var RG = window.RG || { config: { scenes: { works: [[0, .22], [.36, .58], [.72, 1]], process: [[0, .16], [.25, .41], [.5, .66], [.75, 1]], morph: .55, cloudAlpha: .34, cloudCursor: .35 } }, pins: {} };
  var SC = RG.config.scenes;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mm = function (q) { return window.matchMedia(q).matches; };
  var reduced = mm('(prefers-reduced-motion: reduce)');
  var finePointer = mm('(hover: hover) and (pointer: fine)');
  var mobile = !finePointer || window.innerWidth < 768;
  var gsap = window.gsap;

  function fail() { root.classList.remove('gl-on'); root.classList.add('no-gl'); }

  /* ------------------------------------------------------------------ *
   * Contexto
   * ------------------------------------------------------------------ */
  var canvas = document.createElement('canvas');
  canvas.className = 'pfield';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = null;
  try { gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false }); } catch (e) { gl = null; }
  if (!gl) return fail();

  var software = false;
  try {
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    var ren = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    software = /swiftshader|llvmpipe|software|basic render/i.test(String(ren));
  } catch (e) { /* sin info */ }

  var mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  var N = mobile ? (mem <= 3 || cores <= 4 ? CONFIG.count.mobileLow : CONFIG.count.mobile)
    : (mem >= 8 && cores >= 8 ? CONFIG.count.desktopHigh : CONFIG.count.desktop);
  if (software) N = Math.min(N, CONFIG.count.software);
  var forced = /[?&]particulas=(\d+)/.exec(location.search);   // para pruebas: ?particulas=18000
  if (forced) N = Math.max(500, Math.min(40000, +forced[1]));
  var drawN = N;

  /* ------------------------------------------------------------------ *
   * Shaders
   * ------------------------------------------------------------------ */
  var VS = [
    'precision highp float;',
    'attribute vec2 aA; attribute vec2 aB; attribute vec4 aS;',
    'uniform vec2 uRes; uniform float uDpr, uSize;',
    'uniform vec4 uRA, uRB;',
    'uniform float uT, uTime, uScatter, uStagger, uIntro, uSpread;',
    'uniform vec2 uMouse; uniform float uMouseF, uRadius, uRipple;',
    'uniform vec3 uTrail[8];',
    'uniform vec2 uShift; uniform vec3 uBreath; uniform vec4 uBurst;',
    'uniform vec3 uCA0, uCA1, uCA2, uCB0, uCB1, uCB2; uniform vec2 uW;',
    'uniform vec4 uMix; uniform float uFade, uAlpha;',
    'varying vec3 vC; varying float vA;',
    'float eio(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) * .5; }',
    'void main(){',
    '  vec2 pa = uRA.xy + aA * uRA.zw;',
    '  vec2 pb = uRB.xy + aB * uRB.zw;',
    // cada partícula sale con un pequeño retraso: mezcla de azar y posición horizontal
    '  float d = (aS.x * .65 + clamp(aA.x * .5 + .5, 0., 1.) * .35) * uStagger;',
    '  float t = clamp((uT - d) / (1. - uStagger), 0., 1.);',
    '  float e = eio(t);',
    '  vec2 p = mix(pa, pb, e);',
    // a mitad de camino se deshacen un poco (y se recomponen al llegar)
    '  float sc = sin(3.14159 * t);',
    '  float an = aS.y * 6.28318;',
    '  p += vec2(cos(an), sin(an)) * uScatter * sc * (.35 + aS.z);',
    // intro: llegan desordenadas desde fuera de la forma
    '  vec2 from = (vec2(fract(aS.x * 13.73 + aS.w * 7.31), fract(aS.y * 9.17 + aS.z * 3.71)) * uSpread - (uSpread - 1.) * .5) * uRes;',
    '  float ti = clamp((uIntro - aS.z * .45) / .55, 0., 1.);',
    '  p = mix(from, p, 1. - pow(1. - ti, 4.));',
    // respiración: nunca hay una pantalla quieta
    '  float bA = mix(uBreath.x, uBreath.y, e);',
    '  p += vec2(sin(uTime * uBreath.z + aS.x * 41.), cos(uTime * uBreath.z * .83 + aS.y * 37.)) * bA * (.5 + aS.z);',
    // inclinación del móvil / deriva, con un poco de profundidad
    '  p += uShift * (.35 + aS.z * .9);',
    // estallido contenido (contacto)
    '  if (uBurst.z > 0.) { vec2 bd = p - uBurst.xy; float k = sin(3.14159 * min(uBurst.w * 1.6, 1.)) * (1. - uBurst.w); p += bd * inversesqrt(dot(bd, bd) + 1.) * uBurst.z * k * (.4 + aS.z); }',
    // cursor: se apartan como agua; las ondas del rastro hacen de muelle al volver
    '  float R2 = uRadius * uRadius;',
    '  vec2 dm = p - uMouse; float r2 = dot(dm, dm);',
    '  p += dm * inversesqrt(r2 + 1.) * uMouseF * exp(-r2 / R2);',
    '  for (int i = 0; i < 8; i++) {',
    '    vec3 tr = uTrail[i];',
    '    if (tr.z < 0.) continue;',
    '    vec2 dt = p - tr.xy; float q = dot(dt, dt);',
    '    p += dt * inversesqrt(q + 1.) * exp(-q / (R2 * .6)) * exp(-tr.z * 2.6) * cos(tr.z * 7.) * uRipple;',
    '  }',
    '  gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);',
    '  gl_PointSize = uSize * (.55 + aS.z * .9) * (1. + sc * .3) * uDpr;',
    '  vec3 a; vec3 b;',
    '  if (aS.w < uW.x) { a = uCA0; b = uCB0; } else if (aS.w < uW.y) { a = uCA1; b = uCB1; } else { a = uCA2; b = uCB2; }',
    '  vC = mix(a, b, e);',
    '  float dens = mix(uMix.z, uMix.w, e);',
    '  vA = mix(uMix.x, uMix.y, e) * uFade * uAlpha * (.55 + aS.z * .45) * step(aS.x, dens);',
    '  if (vA < .004) gl_Position = vec4(2., 2., 2., 1.);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vC; varying float vA;',
    'uniform float uCore, uHaloA, uGlow;',
    'void main(){',
    '  float r = length(gl_PointCoord * 2. - 1.);',
    '  if (r > 1.) discard;',
    '  float core = 1. - smoothstep(uCore * .55, uCore, r);',
    '  float h = 1. - r; h = h * h * uHaloA;',
    '  float ac = core * vA, ah = (1. - core) * h * vA;',
    // núcleo con mezcla normal; el halo, en parte aditivo: brillo suave, nunca neón
    '  gl_FragColor = vec4(vC * (ac + ah), ac + ah * (1. - uGlow));',
    '}'
  ].join('\n');

  // El enlace del programa no bloquea si el navegador compila en paralelo (KHR_parallel_shader_compile)
  var prog, par = gl.getExtension('KHR_parallel_shader_compile');
  try {
    var vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, VS); gl.compileShader(vs);
    gl.shaderSource(fs, FS); gl.compileShader(fs);
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  } catch (e) { return fail(); }
  (function waitLink() {
    if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) return setTimeout(waitLink, 16);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.warn('particulas:', gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
      return fail();
    }
    setTimeout(init, 0);
  })();

  function init() {
  gl.useProgram(prog);

  var U = {};
  ['uRes', 'uDpr', 'uSize', 'uRA', 'uRB', 'uT', 'uTime', 'uScatter', 'uStagger', 'uIntro', 'uSpread', 'uMouse', 'uMouseF', 'uRadius', 'uRipple',
    'uTrail', 'uShift', 'uBreath', 'uBurst', 'uCA0', 'uCA1', 'uCA2', 'uCB0', 'uCB1', 'uCB2', 'uW', 'uMix', 'uFade', 'uAlpha', 'uCore', 'uHaloA', 'uGlow']
    .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  var A = { a: gl.getAttribLocation(prog, 'aA'), b: gl.getAttribLocation(prog, 'aB'), s: gl.getAttribLocation(prog, 'aS') };

  /* ------------------------------------------------------------------ *
   * Formas
   * ------------------------------------------------------------------ */
  var SHAPES = ['rg', 'cloud', 'web-argila', 'web-cafe', 'web-moda', 'landing', 'tienda', 'shield', 'bubble', 'doc', 'browser', 'rocket', 'n08', 'n999', 'bag'];
  var TEXTS = {
    n08: [['0,8', '400 {F}px Lora, Georgia, serif']],
    n999: [['99,9', '400 {F}px Lora, Georgia, serif'], [' %', 'italic 400 {F}px Newsreader, Georgia, serif']]
  };
  var shapeIx = {}, shapeAR = {}, ready = {};
  SHAPES.forEach(function (k, i) { shapeIx[k] = i; });

  var posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, SHAPES.length * N * 8, gl.STATIC_DRAW);

  var seeds = new Float32Array(N * 4);
  for (var i = 0; i < N * 4; i++) seeds[i] = Math.random();
  var seedBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(A.s);
  gl.vertexAttribPointer(A.s, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(A.a);
  gl.enableVertexAttribArray(A.b);

  var RES = mobile ? CONFIG.sampleRes.mobile : CONFIG.sampleRes.desktop;
  var cv = document.createElement('canvas');
  var cx = cv.getContext('2d', { willReadFrequently: true });

  // Toma N puntos de lo pintado en el canvas: parte del contorno y parte del relleno
  function fromPixels(unit, ox, oy) {
    var w = cv.width, h = cv.height, data = cx.getImageData(0, 0, w, h).data;
    var fill = new Int32Array(w * h), edge = new Int32Array(w * h), nf = 0, ne = 0, x, y, k;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      k = y * w + x;
      if (data[k * 4 + 3] < 110) continue;
      fill[nf++] = k;
      if (data[(k - 1) * 4 + 3] < 110 || data[(k + 1) * 4 + 3] < 110 || data[(k - w) * 4 + 3] < 110 || data[(k + w) * 4 + 3] < 110) edge[ne++] = k;
    }
    if (!nf) return null;
    var out = new Float32Array(N * 2), er = ne ? CONFIG.edgeRatio : 0;
    for (var i = 0; i < N; i++) {
      k = Math.random() < er ? edge[(Math.random() * ne) | 0] : fill[(Math.random() * nf) | 0];
      out[i * 2] = ((k % w) + Math.random() - ox) / unit;
      out[i * 2 + 1] = (((k / w) | 0) + Math.random() - oy) / unit;
    }
    return out;
  }

  function sampleSymbol(name) {
    var sym = document.getElementById('s-' + name);
    if (!sym) return null;
    var vb = sym.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    var vw = vb[2], vh = vb[3], sc = RES / Math.max(vw, vh), pad = 4;
    cv.width = Math.ceil(vw * sc) + pad * 2; cv.height = Math.ceil(vh * sc) + pad * 2;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    cx.setTransform(sc, 0, 0, sc, pad, pad);
    cx.fillStyle = cx.strokeStyle = '#000'; cx.lineCap = cx.lineJoin = 'round';
    $$('path', sym).forEach(function (p) {
      var cl = p.getAttribute('class') || '';
      if (mobile && / d\b/.test(' ' + cl) && !/\bf\b/.test(cl)) return;   // en móvil, formas más simples
      var path = new Path2D(p.getAttribute('d'));
      if (/\bf\b/.test(cl)) cx.fill(path, p.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero');
      else { cx.lineWidth = /\bk\b/.test(cl) ? 3.8 : 2.6; cx.stroke(path); }
    });
    shapeAR[name] = vw / vh;
    return fromPixels(vh * sc, pad + vw * sc / 2, pad + vh * sc / 2);
  }

  function sampleText(name) {
    var parts = TEXTS[name], F = Math.round(RES * 0.5), w = 0;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    parts.forEach(function (p) { cx.font = p[1].replace('{F}', F); w += cx.measureText(p[0]).width; });
    var h = Math.ceil(F * 1.05), pad = 6;
    cv.width = Math.ceil(w) + pad * 2; cv.height = h + pad * 2;
    cx.clearRect(0, 0, cv.width, cv.height); cx.fillStyle = '#000'; cx.textBaseline = 'alphabetic';
    var x = pad;
    parts.forEach(function (p) { cx.font = p[1].replace('{F}', F); cx.fillText(p[0], x, pad + F * 0.86); x += cx.measureText(p[0]).width; });
    shapeAR[name] = cv.width / cv.height;
    return fromPixels(cv.height, cv.width / 2, cv.height / 2);
  }

  function sampleCloud() {
    var out = new Float32Array(N * 2);
    for (var i = 0; i < N * 2; i++) out[i] = Math.random() - 0.5;
    shapeAR.cloud = 1;
    return out;
  }

  function sample(name) {
    var pts = name === 'cloud' ? sampleCloud() : TEXTS[name] ? sampleText(name) : sampleSymbol(name);
    if (!pts) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, shapeIx[name] * N * 8, pts);
    ready[name] = true;
    pair = null;   // vuelve a apuntar los atributos
  }

  // El resto de formas se muestrean en trozos pequeños cuando el navegador está libre (no sube el TBT)
  var queue = SHAPES.filter(function (k) { return k !== 'rg' && k !== 'cloud'; });
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(function () { fn({ timeRemaining: function () { return 8; } }); }, 32); };
  var fontsOK = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('400 100px Lora'), document.fonts.load('italic 400 100px Newsreader')]).catch(function () {}) : Promise.resolve();
  var fontsDone = false;
  fontsOK.then(function () { fontsDone = true; });
  function pump(dl) {
    // Al menos una forma por llamada (aunque el navegador vaya justo y el aviso llegue por timeout)
    var first = true;
    while (queue.length && (first || (dl && dl.timeRemaining() > 6))) {
      if (TEXTS[queue[0]] && !fontsDone) { queue.push(queue.shift()); if (queue.every(function (k) { return TEXTS[k]; })) break; continue; }
      sample(queue.shift());
      first = false;
    }
    if (queue.length) idle(pump, { timeout: 400 });
    else { buildHolds(); requestRender(); }
  }

  /* ------------------------------------------------------------------ *
   * Paletas (desde las variables CSS)
   * ------------------------------------------------------------------ */
  var css = getComputedStyle(root);
  function hex(v) {
    v = String(v).trim().replace('#', '');
    if (v.length === 3) v = v.replace(/(.)/g, '$1$1');
    var n = parseInt(v, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  var PAL = {};
  ['base', 'argila', 'cafe', 'moda'].forEach(function (k) {
    PAL[k] = [1, 2, 3].map(function (j) { return hex(css.getPropertyValue('--p-' + k + '-' + j) || '#F0561D'); });
  });
  var W0 = CONFIG.colorWeights;

  /* ------------------------------------------------------------------ *
   * Guion: tramos de scroll en los que cada forma está quieta
   * ------------------------------------------------------------------ */
  var holds = [];
  function docY(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function visible(el) { return el && el.offsetParent !== null; }

  function buildHolds() {
    var vh = window.innerHeight, H = [], pins = RG.pins || {};
    var maxY = Math.max(0, document.documentElement.scrollHeight - vh);
    var wide = root.classList.contains('is-wide');
    function add(shape, el, s, e, o) {
      o = o || {};
      H.push({ shape: shape, el: el, s: s, e: e, pal: o.pal || 'base', alpha: o.alpha == null ? 1 : o.alpha,
        dens: o.dens || 1, cursor: o.cursor == null ? 1 : o.cursor, breathe: o.breathe || CONFIG.breathe.amp, burstAt: o.burstAt });
    }
    // 1 · Hero: el RG
    add('rg', $('.hero-slot'), -1e9, vh * 0.12);

    // 2 · Trabajos: un navegador por proyecto, con su paleta
    var vis = $$('.project-visual'), pals = ['argila', 'cafe', 'moda'];
    vis.forEach(function (v, k) {
      if (pins.works) { var a = pins.works.start, L = pins.works.end - a; add('web-' + pals[k], v, a + L * SC.works[k][0], a + L * SC.works[k][1], { pal: pals[k] }); }
      else { var y = docY(v); add('web-' + pals[k], v, y - vh * 0.7, y - vh * 0.18, { pal: pals[k] }); }
    });

    // 3 · Servicios: página alargada, móvil con productos, escudo
    var svc = $$('.service'), svcShapes = ['landing', 'tienda', 'shield'], svcSlots = $$('.svc-slot');
    svc.forEach(function (c, k) {
      if (wide) { var y = docY(c); add(svcShapes[k], $('.services-slot'), y - vh * 0.62, y + c.offsetHeight * 0.6 - vh * 0.62); }
      else { var ys = docY(svcSlots[k]); add(svcShapes[k], svcSlots[k], ys - vh * 0.68, ys - vh * 0.16); }
    });

    // 4 · Proceso: bocadillo, documento, navegador, cohete
    var steps = $$('.step'), stShapes = ['bubble', 'doc', 'browser', 'rocket'];
    steps.forEach(function (st, k) {
      if (pins.process) { var a = pins.process.start, L = pins.process.end - a; add(stShapes[k], $('.process-slot'), a + L * SC.process[k][0], a + L * SC.process[k][1]); }
      else if (wide) { var y = docY(st); add(stShapes[k], $('.process-slot'), y - vh * 0.62, y + st.offsetHeight - vh * 0.5); }
      else { var sl = $('.step-slot', st), ys = docY(sl); add(stShapes[k], sl, ys - vh * 0.7, ys - vh * 0.2); }
    });

    // 5 · Ventajas: «0,8» y después «99,9 %»
    var ps = $('.perks-slot'), yp = docY(ps);
    add('n08', ps, yp - vh * 0.72, yp - vh * 0.42);
    add('n999', ps, yp - vh * 0.3, yp - vh * 0.02);

    // 6 · Sobre mí y FAQ: nube tranquila, muy suave
    var about = $('.about'), faq = $('.faq');
    add('cloud', null, docY(about) - vh * 0.3, docY(faq) + faq.offsetHeight - vh * 0.95,
      { alpha: SC.cloudAlpha, dens: CONFIG.cloudDensity, cursor: SC.cloudCursor, breathe: CONFIG.breathe.cloud });

    // 7 · Contacto: bolsa de compra; estallido al llegar a «Enviar»
    var cs = $('.contact-slot'), sub = $('.btn--submit'), ysub = docY(sub) + sub.offsetHeight / 2;
    add('bag', cs, docY(cs) - vh * 0.66, Math.max(docY(cs) - vh * 0.3, ysub - vh * 0.42), { burstAt: ysub - vh * 0.72 });

    // 8 · Pie: el RG otra vez
    add('rg', $('.footer-mark'), docY($('.footer-mark')) - vh * 0.75, 1e9);

    // Orden y huecos: cada morph dura al menos SC.morph pantallas; el último tramo cabe en la página
    var gap = vh * SC.morph, minGap = vh * 0.12;
    for (var i = 1; i < H.length; i++) {
      if (H[i].s < H[i - 1].e + minGap) H[i].s = H[i - 1].e + minGap;
      if (H[i].e < H[i].s) H[i].e = H[i].s;
      var room = H[i].s - H[i - 1].e;
      // si el morph queda corto, se le cede como mucho la mitad del tramo quieto anterior
      if (room < gap && i > 1) H[i - 1].e = Math.max(H[i - 1].s + (H[i - 1].e - H[i - 1].s) * 0.5, H[i].s - gap);
    }
    var last = H[H.length - 1];
    if (last.s > maxY - 2) {
      last.s = maxY - 2;
      for (i = H.length - 2; i > 0; i--) {
        if (H[i].e > H[i + 1].s - minGap) H[i].e = H[i + 1].s - minGap;
        if (H[i].s > H[i].e) H[i].s = H[i].e;
      }
    }
    holds = H;
    requestRender();
  }

  function stateAt(y) {
    var H = holds;
    if (!H.length || y <= H[0].e) return { a: 0, b: 0, t: 0 };
    for (var i = 1; i < H.length; i++) {
      if (y < H[i].s) return { a: i - 1, b: i, t: (y - H[i - 1].e) / Math.max(1, H[i].s - H[i - 1].e) };
      if (y <= H[i].e) return { a: i, b: i, t: 0 };
    }
    return { a: H.length - 1, b: H.length - 1, t: 0 };
  }

  var W = 0, Hh = 0, dpr = 1;
  function rectFor(h, out) {
    var name = shapeOf(h);
    if (name === 'cloud' || !h.el) { out[0] = W / 2; out[1] = Hh / 2; out[2] = W * 1.15; out[3] = Hh * 1.15; return out; }
    var r = h.el.getBoundingClientRect();
    if (!r.width || !r.height) { out[0] = W / 2; out[1] = Hh / 2; out[2] = out[3] = Math.min(W, Hh) * 0.4; return out; }
    var ar = shapeAR[name] || 1, s = Math.min(r.width / ar, r.height) * CONFIG.fit;
    out[0] = r.left + r.width / 2; out[1] = r.top + r.height / 2; out[2] = out[3] = s;
    return out;
  }
  function shapeOf(h) { return ready[h.shape] ? h.shape : ready.cloud ? 'cloud' : 'rg'; }

  /* ------------------------------------------------------------------ *
   * Tamaño
   * ------------------------------------------------------------------ */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, software ? CONFIG.software.dpr : CONFIG.dprMax);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    W = w; Hh = h;
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    gl.viewport(0, 0, bw, bh);
  }

  /* ------------------------------------------------------------------ *
   * Entrada: cursor (solo ratón), inclinación del móvil o deriva lenta
   * ------------------------------------------------------------------ */
  var C = CONFIG.cursor;
  var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, on: 0, ton: 0 };
  var trail = new Float32Array(24), trailIx = 0, lastTrail = { x: -9999, y: -9999 };
  for (var t0 = 0; t0 < 8; t0++) trail[t0 * 3 + 2] = -1;
  if (finePointer && !reduced) {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (mouse.x < -999) { mouse.x = e.clientX; mouse.y = e.clientY; }
      mouse.tx = e.clientX; mouse.ty = e.clientY; mouse.ton = 1;
      var dx = e.clientX - lastTrail.x, dy = e.clientY - lastTrail.y;
      if (dx * dx + dy * dy > C.trailEvery * C.trailEvery) {
        lastTrail.x = e.clientX; lastTrail.y = e.clientY;
        trail[trailIx * 3] = e.clientX; trail[trailIx * 3 + 1] = e.clientY; trail[trailIx * 3 + 2] = 0;
        trailIx = (trailIx + 1) % 8;
      }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.ton = 0; });
    window.addEventListener('blur', function () { mouse.ton = 0; });
  }

  var tilt = { on: false, base: null, tx: 0, ty: 0, x: 0, y: 0 };
  function onOrientation(e) {
    if (e.gamma == null || e.beta == null) return;
    var ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    var g = e.gamma, b = e.beta;
    if (ang === 90) { g = e.beta; b = -e.gamma; } else if (ang === -90 || ang === 270) { g = -e.beta; b = e.gamma; }
    if (!tilt.base) tilt.base = [g, b];
    // la postura de partida se va adaptando poco a poco: solo cuenta el gesto
    tilt.base[0] += (g - tilt.base[0]) * 0.004; tilt.base[1] += (b - tilt.base[1]) * 0.004;
    var R = CONFIG.tilt.range;
    tilt.tx = Math.max(-1, Math.min(1, (g - tilt.base[0]) / R)) * CONFIG.tilt.amp;
    tilt.ty = Math.max(-1, Math.min(1, (b - tilt.base[1]) / R)) * CONFIG.tilt.amp;
    tilt.on = true;
  }
  if (!finePointer && !reduced && 'DeviceOrientationEvent' in window) {
    var DOE = window.DeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {
      // iPhone: Safari solo deja pedir permiso tras un toque. Se pide en el primer toque
      // que no sea sobre un enlace, botón o campo, para no interrumpir lo que el usuario iba a hacer.
      var asking = false;
      var ask = function (e) {
        if (asking || (e.target.closest && e.target.closest('a, button, input, textarea, select, label, summary'))) return;
        asking = true;
        DOE.requestPermission().then(function (st) {
          window.removeEventListener('touchend', ask); window.removeEventListener('click', ask);
          if (st === 'granted') window.addEventListener('deviceorientation', onOrientation, { passive: true });
        }).catch(function () { asking = false; });   // sin gesto válido: se reintenta en el siguiente toque
      };
      window.addEventListener('touchend', ask, { passive: true });
      window.addEventListener('click', ask);
    } else {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
    }
  }

  /* ------------------------------------------------------------------ *
   * Bucle
   * ------------------------------------------------------------------ */
  var start = performance.now(), last = start, introT = reduced ? 1 : 0, fade = 0;
  var burst = { t: 1, amp: 0, x: 0, y: 0, armed: true };
  var prevY = window.scrollY;
  var RA = [0, 0, 0, 0], RB = [0, 0, 0, 0];
  var pair = null;
  var running = false, rafId = 0, dirty = true;
  var fps = { avg: 16.7, slowSince: 0, drops: 0, graceUntil: start + CONFIG.fps.grace };
  var shift = { x: 0, y: 0 };
  var useTicker = !!(gsap && gsap.ticker) && !reduced;

  gl.uniform1f(U.uStagger, reduced ? 0 : CONFIG.morph.stagger);
  gl.uniform1f(U.uSpread, CONFIG.intro.spread);
  gl.uniform1f(U.uRadius, C.radius);
  gl.uniform1f(U.uCore, 1 / CONFIG.halo);
  gl.uniform1f(U.uHaloA, CONFIG.haloAlpha);
  gl.uniform1f(U.uGlow, CONFIG.glow);
  gl.uniform1f(U.uAlpha, CONFIG.alpha);
  gl.uniform2f(U.uW, W0[0], W0[0] + W0[1]);
  gl.uniform1f(U.uSize, (mobile ? CONFIG.pointSize.mobile : CONFIG.pointSize.desktop) * CONFIG.halo);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  function setPal(locs, p) { gl.uniform3fv(locs[0], p[0]); gl.uniform3fv(locs[1], p[1]); gl.uniform3fv(locs[2], p[2]); }

  function frame(now) {
    if (document.hidden || !holds.length) return;
    var dt = Math.min(0.1, (now - last) / 1000), dtMs = now - last; last = now;
    var time = (now - start) / 1000;
    var y = window.scrollY;
    var st = stateAt(y), ha = holds[st.a], hb = holds[st.b], t = st.t;

    // Intro y fundido de entrada
    if (introT < 1) introT = Math.min(1, introT + dt / CONFIG.intro.dur);
    if (fade < 1) fade = Math.min(1, fade + dt / 0.9);

    // Movimiento reducido: sin morph, fundido corto entre la forma de una sección y la siguiente
    var alphaMul = 1;
    if (reduced) {
      if (t > 0) { alphaMul = Math.abs(t * 2 - 1); if (t < 0.5) hb = ha; else ha = hb; }
      t = 0;
    }

    var sa = shapeOf(ha), sb = shapeOf(hb), key = sa + '|' + sb;
    if (pair !== key) {
      pair = key;
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.vertexAttribPointer(A.a, 2, gl.FLOAT, false, 0, shapeIx[sa] * N * 8);
      gl.vertexAttribPointer(A.b, 2, gl.FLOAT, false, 0, shapeIx[sb] * N * 8);
    }
    rectFor(ha, RA); rectFor(hb, RB);
    if (sa === 'cloud') { RA[3] = Hh * 1.15; } else RA[3] = RA[2];
    if (sb === 'cloud') { RB[3] = Hh * 1.15; } else RB[3] = RB[2];

    // Estallido al pasar por «Enviar» (bajando)
    if (!reduced) {
      holds.forEach(function (h) {
        if (h.burstAt != null && prevY < h.burstAt && y >= h.burstAt) fireBurst();
      });
    }
    prevY = y;
    if (burst.t < 1) burst.t = Math.min(1, burst.t + dt / CONFIG.burst.dur);

    // Cursor con muelle (posición) y ondas del rastro
    var force = 0;
    if (!reduced && finePointer) {
      mouse.vx = (mouse.vx + (mouse.tx - mouse.x) * C.stiffness) * C.damping;
      mouse.vy = (mouse.vy + (mouse.ty - mouse.y) * C.stiffness) * C.damping;
      mouse.x += mouse.vx; mouse.y += mouse.vy;
      mouse.on += (mouse.ton - mouse.on) * 0.06;
      force = C.force * mouse.on * (ha.cursor + (hb.cursor - ha.cursor) * t);
      for (var k = 0; k < 8; k++) { if (trail[k * 3 + 2] >= 0) { trail[k * 3 + 2] += dt; if (trail[k * 3 + 2] > C.trailLife) trail[k * 3 + 2] = -1; } }
    }

    // Inclinación (móvil con permiso) o deriva lenta
    if (!reduced) {
      var tx, ty;
      if (tilt.on) { tx = tilt.tx; ty = tilt.ty; }
      else { var dp = time * CONFIG.drift.speed * 6.2832; tx = Math.sin(dp) * CONFIG.drift.amp; ty = Math.cos(dp * 0.8) * CONFIG.drift.amp * 0.6; }
      shift.x += (tx - shift.x) * CONFIG.tilt.smooth; shift.y += (ty - shift.y) * CONFIG.tilt.smooth;
    }

    gl.uniform2f(U.uRes, W, Hh);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform4fv(U.uRA, RA); gl.uniform4fv(U.uRB, RB);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uTime, reduced ? 0 : time);
    gl.uniform1f(U.uScatter, reduced || sa === sb ? 0 : CONFIG.morph.scatter * Math.min(W, Hh));
    gl.uniform1f(U.uIntro, introT);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uMouseF, force);
    gl.uniform1f(U.uRipple, force * C.ripple);
    gl.uniform3fv(U.uTrail, trail);
    gl.uniform2f(U.uShift, shift.x, shift.y);
    gl.uniform3f(U.uBreath, reduced ? 0 : ha.breathe, reduced ? 0 : hb.breathe, CONFIG.breathe.speed);
    gl.uniform4f(U.uBurst, burst.x, burst.y, burst.t < 1 ? burst.amp : 0, burst.t);
    setPal([U.uCA0, U.uCA1, U.uCA2], PAL[ha.pal]); setPal([U.uCB0, U.uCB1, U.uCB2], PAL[hb.pal]);
    gl.uniform4f(U.uMix, ha.alpha * alphaMul, hb.alpha * alphaMul, ha.dens, hb.dens);
    gl.uniform1f(U.uFade, fade);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, drawN);

    // Si los fps caen de forma sostenida, menos partículas (como mucho dos veces)
    if (!reduced && now > fps.graceUntil && dtMs < 250) {
      var per = software ? dtMs / CONFIG.software.fpsDivider : dtMs;   // en software se dibuja un tick de cada N
      fps.avg = fps.avg * 0.92 + per * 0.08;
      if (fps.avg > CONFIG.fps.limitMs) {
        if (!fps.slowSince) fps.slowSince = now;
        else if (now - fps.slowSince > CONFIG.fps.window && fps.drops < CONFIG.fps.maxDrops) {
          fps.drops++; drawN = Math.floor(drawN * CONFIG.fps.factor);
          fps.slowSince = 0; fps.avg = 16.7; fps.graceUntil = now + 1500;
        }
      } else fps.slowSince = 0;
    }
    RG.particles.drawn = drawN;
    dirty = false;
  }

  function fireBurst() {
    var h = holds.filter(function (x) { return x.burstAt != null; })[0];
    if (!h) return;
    var r = rectFor(h, [0, 0, 0, 0]);
    burst.x = r[0]; burst.y = r[1]; burst.amp = CONFIG.burst.amp; burst.t = 0;
  }

  // Movimiento normal: un fotograma por tick de GSAP (después de Lenis, así la forma no va un fotograma tarde)
  var tickN = 0;
  function tickFn() { if (software && (tickN++ % CONFIG.software.fpsDivider)) return; frame(performance.now()); }
  function play() {
    if (running || reduced) return;
    running = true; last = performance.now();
    if (useTicker) gsap.ticker.add(tickFn);
    else (function loop() { if (!running) return; frame(performance.now()); rafId = requestAnimationFrame(loop); })();
  }
  function pause() {
    running = false;
    if (useTicker) gsap.ticker.remove(tickFn); else cancelAnimationFrame(rafId);
  }
  // Movimiento reducido: solo se dibuja cuando cambia algo (scroll, tamaño, fundido)
  function requestRender() {
    if (!reduced) return;
    if (dirty === 'queued') return;
    dirty = 'queued';
    requestAnimationFrame(function () { last = performance.now() - 16; frame(performance.now()); if (fade < 1) { dirty = false; requestRender(); } });
  }

  /* ------------------------------------------------------------------ *
   * Arranque
   * ------------------------------------------------------------------ */
  RG.particles = { ready: ready, count: N, drawn: N, software: software, tilt: tilt, config: CONFIG, burst: fireBurst, holds: function () { return holds; } };
  // Arranque en pasos cortos (cada uno en su propia tarea): no hay tareas largas que suban el TBT
  var boot = [
    function () { document.body.insertBefore(canvas, document.body.firstChild); resize(); },
    function () { sample('rg'); },
    function () { sample('cloud'); buildHolds(); },
    function () { root.classList.add('gl-on'); if (reduced) requestRender(); else play(); idle(pump, { timeout: 400 }); }
  ];
  (function step() {
    try { boot.shift()(); } catch (e) { return fail(); }
    if (boot.length) setTimeout(step, 0);
  })();

  window.addEventListener('resize', function () { resize(); buildHolds(); });
  window.addEventListener('rg:layout', buildHolds);
  window.addEventListener('load', buildHolds);
  window.addEventListener('rg:sent', function () { if (!reduced) fireBurst(); });
  window.addEventListener('scroll', requestRender, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    else { fps.graceUntil = performance.now() + 1500; if (reduced) requestRender(); else play(); }
  });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); pause(); fail(); });
  }
})();
