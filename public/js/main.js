/* ==========================================================================
   rgdevstudio · «Vista explosionada»
   GSAP + ScrollTrigger + Lenis. Una sola pieza (la web de un cliente en 5 capas)
   viaja por un escenario fijo y se recoloca en el hueco de cada sección.

   Cómo se mueve la pieza (sección 4, «motor»):
     · cada hueco (.slot[data-slot]) tiene un ESTADO numérico (ex = separación,
       iso = ángulo de plano, frame = marco, sc = escala) y unos ATRIBUTOS
       (data-v proyecto, data-svc servicio, data-step paso…) que el CSS convierte
       en contenido.
     · en cada fotograma se mide qué huecos se ven: la pieza se coloca en el que
       domina y, al pasar de uno a otro, se desliza y se funde (nunca tapa texto).
     · solo se escriben transform y opacity.
   Modos: escritorio (≥1024×600) / móvil · prefers-reduced-motion (pieza quieta).
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Ajustes. Profundidad, ángulos y tamaño de la pieza viven en CSS
   * (:root, --pz-*) y se leen desde aquí; lo demás se ajusta en CONFIG.
   * ------------------------------------------------------------------ */
  var CONFIG = {
    desktop: '(min-width: 1024px) and (min-height: 600px)',
    lenisLerp: 0.1,
    toTop: 2.2,                 // «Volver arriba»: duración del scroll suave (s)
    hero: { screens: 0.6 },     // pantallas de scroll que dura la separación del hero
    fit: 0.94,                  // la pieza ocupa este % de su hueco
    tagsAt: 0.72,               // separación a partir de la que aparecen las etiquetas
    blend: { power: 4, fade: 0.35, minPresence: 0.1 },  // cómo pasa la pieza de un hueco a otro
    light: { from: -0.34, to: 0.34 },                   // recorrido de la luz (fracción del ancho de la pieza)
    shadow: { off: 18, drop: 14, scale: 0.2 },          // sombras: desplazamiento con la separación
    tilt: { mouse: 4, device: 2, lerp: 0.07 },          // grados máximos y suavizado
    states: {                   // estado de la pieza en cada hueco
      hero:     { ex: 0,    iso: 0,    frame: 1, sc: 1 },
      works:    { ex: 1,    iso: 1,    frame: 0, sc: 1 },
      services: { ex: 0.85, iso: 1,    frame: 0, sc: 1, long: 0 },
      process:  { ex: 0.75, iso: 1,    frame: 0, sc: 1 },
      perks:    { ex: 0.7,  iso: 1,    frame: 0, sc: 0.92 },
      about:    { ex: 0,    iso: 0.12, frame: 0, sc: 1 },
      faq:      { ex: 0,    iso: 0.12, frame: 0, sc: 1 },
      contact:  { ex: 1,    iso: 1,    frame: 0, sc: 1 },
      footer:   { ex: 0,    iso: 0,    frame: 0, sc: 1 }
    },
    care: { ex: 0.34, iso: 0.55 },        // Mantenimiento: capas alineadas
    launch: { ex: 0, iso: 0.08 },         // Proceso · Lanzamos: todo junto
    trigger: { mobile: 'top 72%', desktop: 'top 55%' },   // cuándo cambia de proyecto/servicio/paso
    swap: { dur: 0.9, ease: 'power3.inOut' },
    reveal: { dur: 0.9, y: 24, stagger: 0.08 },
    title: { dur: 1.05, stagger: 0.08 },
    services: { y: 40, stagger: 0.12 },
    project: { stagger: 0.07, y: 22 },
    counter: [1.1, 1.3],        // duración de los contadores (0,8 s y 99,9 %)
    publish: { lit: 1.1 },      // segundos hasta que se ilumina «Enviar» tras publicar
    magnetic: 0.3
  };

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp01(t); return t * t * (3 - 2 * t); };
  var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var RAD = Math.PI / 180;

  var gsap = window.gsap, ST = window.ScrollTrigger;
  var reduced = root.classList.contains('is-reduced') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mqDesk = window.matchMedia(CONFIG.desktop);
  var lenis = null;
  if (!gsap || !ST) root.classList.remove('js');
  window.__rgReady = true;

  var header = $('.site-header');

  /* ==================================================================
     1 · Lo que funciona siempre (con o sin animaciones)
     ================================================================== */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });


  function scrollToTarget(target, immediate) {
    var y = target.id === 'inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY - (target.id === 'contacto' ? 0 : header.offsetHeight - 1);
    if (lenis) lenis.scrollTo(y, { immediate: !!immediate, duration: target.id === 'inicio' ? CONFIG.toTop : 1.5 });
    else window.scrollTo({ top: y, behavior: reduced || immediate ? 'auto' : 'smooth' });
  }

  /* Menú móvil */
  var menu = $('#menu'), toggle = $('.menu-toggle');
  function setMenu(open) {
    if (!menu || !toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    $('.menu-toggle-label', toggle).textContent = open ? 'Cerrar' : 'Menú';
    root.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false; void menu.offsetWidth; menu.classList.add('is-open');
      if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden';
    } else {
      menu.classList.remove('is-open');
      if (lenis) lenis.start(); else document.body.style.overflow = '';
      setTimeout(function () { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 380);
    }
  }
  if (toggle) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }

  /* Enlaces internos con scroll suave (y el foco va al destino, para teclado y lector) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    var wasOpen = root.classList.contains('menu-open');
    if (wasOpen) setMenu(false);
    if (a.dataset.service) {
      var radio = $('.form input[name="proyecto"][value="' + a.dataset.service + '"]');
      if (radio) radio.checked = true;
    }
    scrollToTarget(target, wasOpen);
    history.replaceState(null, '', target.id === 'inicio' ? location.pathname : '#' + target.id);
    var focusEl = target.id === 'contenido' ? target : (target.id === 'inicio' ? $('.logo') : target);
    if (focusEl && focusEl !== $('.logo')) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
  });

  /* Cabecera: desenfoque al bajar + barra de progreso */
  var progressBar = $('.nav-progress i');
  // La altura total se guarda (leerla en cada fotograma obligaría a recalcular la maquetación)
  var docMax = 0, scrolledState = null, lastBar = '';
  function measureDoc() { docMax = document.documentElement.scrollHeight - window.innerHeight; }
  window.addEventListener('resize', measureDoc);
  window.addEventListener('load', measureDoc);
  measureDoc();
  function onScrollUI(y) {
    var sc = y > 80;
    if (sc !== scrolledState) { scrolledState = sc; header.classList.toggle('is-scrolled', sc); }
    var bar = 'scaleX(' + (docMax > 0 ? clamp01(y / docMax) : 0).toFixed(4) + ')';
    if (progressBar && bar !== lastBar) { lastBar = bar; progressBar.style.transform = bar; }
  }
  window.addEventListener('scroll', function () { if (!lenis) onScrollUI(window.scrollY); }, { passive: true });
  onScrollUI(window.scrollY);

  /* Enlace activo en la navegación */
  (function () {
    var links = $$('.nav a[href^="#"]');
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        if (current) { current.classList.remove('is-active'); current.removeAttribute('aria-current'); }
        current = map[id] || null;
        if (current) { current.classList.add('is-active'); current.setAttribute('aria-current', 'location'); }
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    ['inicio', 'trabajos', 'servicios', 'proceso', 'ventajas', 'sobre-mi', 'faq', 'contacto'].forEach(function (id) {
      var s = document.getElementById(id); if (s) io.observe(s);
    });
  })();

  /* FAQ: acordeón con altura fluida (solo uno abierto a la vez) */
  var refreshSoon = (function () { var t; return function () { clearTimeout(t); t = setTimeout(function () { if (lenis) lenis.resize(); if (ST) ST.refresh(); }, 120); }; })();
  $$('.faq-item').forEach(function (d) {
    var sum = $('summary', d), body = $('.faq-answer', d);
    sum.addEventListener('click', function (e) {
      if (reduced || !body.animate) { refreshSoon(); return; }
      e.preventDefault();
      if (d.__anim) d.__anim.cancel();
      if (d.open) {
        var h = body.offsetHeight;
        d.__anim = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)' });
        d.__anim.onfinish = function () { d.open = false; d.__anim = null; refreshSoon(); };
      } else {
        $$('.faq-item[open]').forEach(function (o) { if (o !== d) $('summary', o).click(); });
        d.open = true;
        var h2 = body.offsetHeight;
        d.__anim = body.animate([{ height: '0px', opacity: 0 }, { height: h2 + 'px', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
        d.__anim.onfinish = function () { d.__anim = null; refreshSoon(); };
      }
    });
  });

  /* Formulario de contacto (Web3Forms) · micro-interacciones y validación */
  (function () {
    var form = $('.form');
    if (!form) return;
    var status = $('.form-status', form), btn = $('.btn--submit', form), label = $('.submit-label', form);
    var MAIL = 'rubeng.seo@gmail.com';
    var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
    var isPhone = function (v) { return v.replace(/\D/g, '').length >= 9 && /^[\d\s+().-]+$/.test(v); };
    function setError(input, msg) {
      var field = input.closest('.field');
      field.classList.toggle('has-error', !!msg);
      if (msg) field.classList.remove('is-valid');
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      $('.field-error', field).textContent = msg || '';
    }
    function setStatus(msg, type) { status.className = 'form-status' + (type ? ' is-' + type : ''); status.innerHTML = msg; }
    function validate() {
      var name = form.elements.nombre, contact = form.elements.contacto, first = null;
      var n = name.value.trim(), c = contact.value.trim();
      setError(name, n ? '' : 'Dime cómo te llamas.');
      if (!n) first = name;
      var cMsg = !c ? 'Déjame un email o un teléfono para responderte.' : (isEmail(c) || isPhone(c)) ? '' : 'Revisa el email o el teléfono, parece incompleto.';
      setError(contact, cMsg);
      if (cMsg && !first) first = contact;
      if (first) first.focus();
      return !first;
    }
    form.elements.nombre.addEventListener('input', function (e) {
      setError(e.target, ''); e.target.closest('.field').classList.toggle('is-valid', e.target.value.trim().length > 1);
    });
    form.elements.contacto.addEventListener('input', function (e) {
      setError(e.target, ''); var v = e.target.value.trim(); e.target.closest('.field').classList.toggle('is-valid', isEmail(v) || isPhone(v));
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var data = new FormData(form);
      var contact = String(data.get('contacto')).trim();
      if (isEmail(contact)) data.append('email', contact);
      var key = String(data.get('access_key') || '');
      if (!key || /^TU_/.test(key)) {
        var body = 'Nombre: ' + data.get('nombre') + '\nNegocio: ' + (data.get('negocio') || '-') +
          '\nNecesito: ' + (data.get('proyecto') || '-') + '\nContacto: ' + contact + '\n\n' + (data.get('mensaje') || '');
        location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Proyecto web') + '&body=' + encodeURIComponent(body);
        setStatus('Se ha abierto tu correo con el mensaje listo para enviar.', 'ok');
        return;
      }
      btn.disabled = true; label.textContent = 'Enviando…'; setStatus('');
      fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.success }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error('send');
          form.reset(); $$('.field', form).forEach(function (f) { f.classList.remove('is-valid'); });
          setStatus('¡Mensaje enviado! Te respondo en menos de 24 horas.', 'ok');
        })
        .catch(function () { setStatus('No se ha podido enviar. Escríbeme a <a href="mailto:' + MAIL + '">' + MAIL + '</a>.', 'error'); })
        .then(function () { btn.disabled = false; label.textContent = 'Enviar'; });
    });
  })();

  // Sin GSAP no hay escenas: la pieza se queda montada y quieta en el hero y todo el contenido es visible
  if (!gsap || !ST) return;

  /* ==================================================================
     2 · Arranque: scroll suave y ScrollTrigger
     ================================================================== */
  gsap.registerPlugin(ST);
  gsap.defaults({ ease: 'power3.out', duration: 1 });
  ST.config({ ignoreMobileResize: true });

  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ lerp: CONFIG.lenisLerp, wheelMultiplier: 1 });
    lenis.on('scroll', function (l) { ST.update(); onScrollUI(l.animatedScroll); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // En movimiento reducido los cambios de estado son inmediatos (el CSS deja solo fundidos cortos)
  function tw(target, vars) {
    if (reduced) { for (var k in vars) if (k in target) target[k] = vars[k]; return null; }
    return gsap.to(target, Object.assign({ duration: CONFIG.swap.dur, ease: CONFIG.swap.ease, overwrite: 'auto' }, vars));
  }
  var isDesk = function () { return mqDesk.matches; };
  var trigStart = function () { return isDesk() ? CONFIG.trigger.desktop : CONFIG.trigger.mobile; };
  var trigEnd = function () { return trigStart().replace('top', 'bottom'); };

  /* ==================================================================
     3 · La pieza: escenario fijo y huecos
     ================================================================== */
  var stage = $('.stage'), wrap = $('.pz-wrap');
  var pz = $('.pz', wrap), tiltEl = $('.pz-tilt', wrap), light = $('.pz-light', wrap);
  var ground = $('.pz-ground', wrap), frameEl = $('.pz-frame', wrap);
  var layers = $$('.ly', wrap), shadows = $$('.sh', wrap);
  stage.appendChild(wrap);   // la pieza pasa del hero al escenario fijo (fuera del flujo: CLS 0)

  var SLOTS = {}, slotList = [];
  $$('.slot[data-slot]').forEach(function (el) {
    var name = el.getAttribute('data-slot');
    var s = { name: name, el: el, st: Object.assign({}, CONFIG.states[name]), at: { scene: name, v: 0, com: 1 }, p: 0 };
    SLOTS[name] = s; slotList.push(s);
  });
  SLOTS.works.at.v = 1;
  SLOTS.process.at.step = 1; SLOTS.process.at.com = 0;
  SLOTS.footer.at = { scene: 'footer', mono: 1 };
  if (reduced) { // quieta en el estado de cada sección
    SLOTS.process.at.step = 4; SLOTS.process.at.com = 1; Object.assign(SLOTS.process.st, CONFIG.launch);
    Object.assign(SLOTS.contact.st, { ex: 0, iso: 0, frame: 1 }); SLOTS.contact.at.pub = 1;
  }

  // Parámetros de la pieza leídos del CSS (cambian entre móvil y escritorio)
  var P = {};
  function readParams() {
    var cs = getComputedStyle(root), n = function (k) { return parseFloat(cs.getPropertyValue(k)) || 0; };
    P.font = n('--pz-font'); P.W = n('--pz-w') * P.font; P.H = n('--pz-h') * P.font; P.gap = n('--pz-gap');
    P.A = { rx: n('--pz-rx-a'), ry: n('--pz-ry-a'), rz: n('--pz-rz-a') };
    P.E = { rx: n('--pz-rx-e'), ry: n('--pz-ry-e'), rz: n('--pz-rz-e') };
    P.desk = isDesk();
  }
  readParams();
  mqDesk.addEventListener('change', function () { readParams(); cache = {}; ST.refresh(); });

  /* Inclinación: ratón en escritorio; giroscopio en móvil solo si no pide permiso (Android) */
  var tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduced && finePointer) {
    window.addEventListener('pointermove', function (e) {
      tilt.tx = -(e.clientY / window.innerHeight - 0.5) * 2 * CONFIG.tilt.mouse;
      tilt.ty = (e.clientX / window.innerWidth - 0.5) * 2 * CONFIG.tilt.mouse;
    }, { passive: true });
  } else if (!reduced && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    var base = null;
    window.addEventListener('deviceorientation', function (e) {
      if (e.beta == null || e.gamma == null) return;
      if (!base) base = { b: e.beta, g: e.gamma };
      var m = CONFIG.tilt.device;
      tilt.tx = Math.max(-m, Math.min(m, (e.beta - base.b) * 0.1));
      tilt.ty = Math.max(-m, Math.min(m, e.gamma * 0.1));
    }, { passive: true });
  }

  /* ==================================================================
     4 · Motor: cada fotograma coloca la pieza (solo transform y opacity)
     ================================================================== */
  var cache = {};
  function put(el, key, prop, val) { if (cache[key] !== val) { cache[key] = val; el.style[prop] = val; } }
  var appliedAt = '';
  function applyAttrs(at) {
    var sig = JSON.stringify(at);
    if (sig === appliedAt) return;
    appliedAt = sig;
    ['scene', 'v', 'com', 'svc', 'step', 'load', 'pub', 'mono'].forEach(function (k) {
      if (at[k] === undefined || at[k] === '') pz.removeAttribute('data-' + k); else pz.setAttribute('data-' + k, at[k]);
    });
    wrap.classList.toggle('is-mono', !!at.mono);
  }
  function scrollY() { return lenis ? lenis.animatedScroll : window.scrollY; }
  var docMaxY = 1;
  function measureMax() { docMaxY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  window.addEventListener('resize', measureMax); measureMax();

  function presence(s, vh, top) {
    var r = s.el.getBoundingClientRect();
    s.r = r;
    if (!r.height || !r.width) return 0;
    var vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, top)) / Math.max(1, Math.min(r.height, vh - top));
    var close = 1 - Math.min(1, Math.abs((r.top + r.bottom) / 2 - vh * 0.5) / (vh * 0.85));
    return clamp01(vis) * (0.3 + 0.7 * close);
  }

  /* Caja que ocupa en pantalla la pila girada (proyección ortográfica de sus esquinas) */
  function bbox(rx, ry, rz, W, H, Z, ext) {
    var cX = Math.cos(rx * RAD), sX = Math.sin(rx * RAD), cY = Math.cos(ry * RAD), sY = Math.sin(ry * RAD);
    var cZ = Math.cos(rz * RAD), sZ = Math.sin(rz * RAD);
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    var xs = [-W / 2, W / 2], ys = [-H / 2, H / 2 + ext], zs = [0, Z];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) for (var m = 0; m < 2; m++) {
      var X = xs[i], Y = ys[j], z = zs[m];
      var xa = X * cZ - Y * sZ, ya = X * sZ + Y * cZ;          // rotateZ
      var xb = xa * cY + z * sY, zb = -xa * sY + z * cY;       // rotateY
      var yc = ya * cX - zb * sX;                              // rotateX
      if (xb < x0) x0 = xb; if (xb > x1) x1 = xb; if (yc < y0) y0 = yc; if (yc > y1) y1 = yc;
    }
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  function frame() {
    var vh = window.innerHeight, top = header.offsetHeight * 0.5;
    var a = null, b = null;
    for (var i = 0; i < slotList.length; i++) {
      var s = slotList[i];
      s.p = presence(s, vh, top);
      if (!a || s.p > a.p) { b = a; a = s; } else if (!b || s.p > b.p) b = s;
    }
    // Al final de la página manda el pie (el monograma)
    var y = scrollY();
    if (SLOTS.footer.p > 0.05 && y > docMaxY - 4) { if (a !== SLOTS.footer) { b = a; a = SLOTS.footer; } a.p = Math.max(a.p, 1); }
    if (!a || a.p < 0.001) { put(wrap, 'op', 'opacity', '0'); return; }

    var t = 0;
    if (b && b.p > 0 && !reduced) { var wa = Math.pow(a.p, CONFIG.blend.power), wb = Math.pow(b.p, CONFIG.blend.power); t = wb / (wa + wb); }
    var bb = t > 0 ? b : a;
    var S = {}; ['ex', 'iso', 'frame', 'sc', 'long'].forEach(function (k) { S[k] = lerp(a.st[k] || 0, bb.st[k] || 0, t); });
    var dom = b ? (a.p - b.p) / a.p : 1;
    var op = smooth(dom / CONFIG.blend.fade) * smooth(a.p / CONFIG.blend.minPresence);
    applyAttrs(a.at);

    // Ángulos y tamaño
    var rx = lerp(P.A.rx, P.E.rx, S.iso), ry = lerp(P.A.ry, P.E.ry, S.iso), rz = lerp(P.A.rz, P.E.rz, S.iso);
    var ex = S.ex, gap = P.gap, fr = S.frame * 2.6 * P.font;
    var B = bbox(rx, ry, rz, P.W + fr, P.H + fr, (layers.length - 1) * (1 + ex * gap), S.long * 0.5 * P.H);
    var mx = ex * (P.desk ? 12 : 10) * P.font;          // sitio para las etiquetas (derecha en escritorio, izquierda en móvil)
    function fitIn(r) { return Math.min(r.width * CONFIG.fit / (B.w + mx), r.height * CONFIG.fit / B.h); }
    var ka = fitIn(a.r), kb = t > 0 ? fitIn(b.r) : ka, k = lerp(ka, kb, t) * S.sc;
    // el centro de la pila (no el de la capa de abajo) va al centro del hueco
    var cx = lerp(a.r.left + a.r.width / 2, bb.r.left + bb.r.width / 2, t) - (B.cx + (P.desk ? mx : -mx) / 2) * k;
    var cy = lerp(a.r.top + a.r.height / 2, bb.r.top + bb.r.height / 2, t) - B.cy * k;
    tilt.x += (tilt.tx - tilt.x) * CONFIG.tilt.lerp; tilt.y += (tilt.ty - tilt.y) * CONFIG.tilt.lerp;
    var calm = a.name === 'about' || a.name === 'faq' || a.name === 'footer' ? 0.25 : 1;

    put(wrap, 'wt', 'transform', 'translate3d(' + (cx - P.W / 2).toFixed(1) + 'px,' + (cy - P.H / 2).toFixed(1) + 'px,0) scale(' + k.toFixed(4) + ')');
    put(wrap, 'op', 'opacity', op.toFixed(3));
    put(tiltEl, 'tl', 'transform', 'rotateX(' + (tilt.x * calm).toFixed(2) + 'deg) rotateY(' + (tilt.y * calm).toFixed(2) + 'deg)');
    put(pz, 'rot', 'transform', 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)');
    for (var j = 0; j < layers.length; j++) put(layers[j], 'l' + j, 'transform', 'translate3d(0,0,' + (j * (1 + ex * gap)).toFixed(1) + 'px)');

    // Luz ligada al scroll y sombras que se alargan y se desplazan con la separación
    var lp = lerp(CONFIG.light.from, CONFIG.light.to, clamp01(y / docMaxY));
    put(light, 'li', 'transform', 'translate3d(' + (lp * P.W).toFixed(1) + 'px,0,0)');
    var Sh = CONFIG.shadow, sx = (-lp * 2 * Sh.off * ex).toFixed(1), sy = (Sh.drop * ex).toFixed(1);
    var shT = 'translate3d(' + sx + 'px,' + sy + 'px,' + (-(ex * gap * 0.92)).toFixed(1) + 'px) scale(' + (1 + Sh.scale * ex).toFixed(3) + ')';
    for (var q = 0; q < shadows.length; q++) put(shadows[q], 's' + q, 'transform', shT);
    var shO = (ex * 0.9).toFixed(3);
    for (q = 0; q < shadows.length; q++) put(shadows[q], 'so' + q, 'opacity', shO);
    put(ground, 'gt', 'transform', 'translate3d(' + (sx * 1.6).toFixed(1) + 'px,' + (sy * 1.4).toFixed(1) + 'px,' + (-2 - ex * gap * 0.5).toFixed(1) + 'px) scale(' + (1 + 0.28 * ex).toFixed(3) + ')');
    put(ground, 'go', 'opacity', (0.6 + 0.4 * ex).toFixed(3));
    put(frameEl, 'fo', 'opacity', (S.frame * (1 - smooth(ex / 0.45))).toFixed(3));
    var tags = ex > CONFIG.tagsAt && !a.at.mono;
    if (cache.tags !== tags) { cache.tags = tags; pz.classList.toggle('is-tags', tags); }
    var split = ex > 0.25 && !a.at.mono;
    if (cache.split !== split) { cache.split = split; pz.classList.toggle('is-split', split); }
  }
  gsap.ticker.add(frame);
  window.addEventListener('resize', function () { cache = {}; });
  frame();

  /* ==================================================================
     5 · Escenas
     ================================================================== */
  /* --- Hero: la web se separa en capas con el primer scroll (cámara lenta, con scrub) --- */
  if (!reduced) {
    ST.create({
      trigger: '.hero', start: 'top top', end: function () { return '+=' + window.innerHeight * CONFIG.hero.screens; },
      scrub: 0.9,
      onUpdate: function (s) {
        var p = s.progress;
        SLOTS.hero.st.ex = easeIO(p);
        SLOTS.hero.st.iso = easeIO(clamp01(p * 1.15));
      }
    });
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: function () { return '+=' + window.innerHeight * CONFIG.hero.screens; }, scrub: 0.6 } })
      .to('.hero-text', { y: -36, opacity: 0.25, ease: 'none', duration: 0.45 }, 0.55);
  }

  /* --- Trabajos: capa a capa (fondo → imagen → tipografía, el CSS escalona) --- */
  var works = $('.works');
  function setProject(n) {
    var at = SLOTS.works.at;
    if (at.v === n) return;
    at.v = n; at.com = n === 2 ? 0 : 1;   // Molí Café es una landing: sin capa de comercio
    works.setAttribute('data-p', n);
  }
  $$('.project').forEach(function (p, i) {
    ST.create({
      trigger: p, start: trigStart, end: trigEnd,
      onToggle: function (s) { if (s.isActive) setProject(i + 1); }
    });
    if (!reduced) gsap.from($$('[data-p]', p), {
      autoAlpha: 0, y: CONFIG.project.y, duration: 0.8, stagger: CONFIG.project.stagger,
      scrollTrigger: { trigger: p, start: 'top 88%', once: true }
    });
  });

  /* --- Servicios: la pila se reordena según la oferta --- */
  var cards = $$('.service');
  function setService(mode, card) {
    var S = SLOTS.services;
    if (S.at.svc === mode) return;
    S.at.svc = mode;
    S.at.com = mode === 'landing' ? 0 : 1;
    cards.forEach(function (c) { c.classList.toggle('is-active', c === card); });
    var target = mode === 'care' ? Object.assign({ long: 0 }, CONFIG.care) : { ex: CONFIG.states.services.ex, iso: 1, long: mode === 'landing' ? 1 : 0 };
    tw(S.st, target);
  }
  cards.forEach(function (c) {
    ST.create({
      trigger: c, start: trigStart, end: trigEnd,
      onToggle: function (s) { if (s.isActive) setService(c.getAttribute('data-svc'), c); },
      onLeaveBack: function () { if (c === cards[0]) setService('', null); }
    });
  });
  if (!reduced) gsap.from(cards, {
    autoAlpha: 0, y: CONFIG.services.y, duration: 1, stagger: CONFIG.services.stagger, ease: 'power3.out',
    scrollTrigger: { trigger: '.services-grid', start: 'top 85%', once: true }
  });

  /* --- Proceso: 4 pasos sincronizados con el montaje --- */
  var steps = $$('.step');
  function setStep(k) {
    var S = SLOTS.process;
    steps.forEach(function (s, i) { s.classList.toggle('is-on', i < k); s.classList.toggle('is-done', i < k - 1); });
    if (S.at.step === k) return;
    S.at.step = k; S.at.com = k === 4 ? 1 : 0;
    tw(S.st, k === 4 ? CONFIG.launch : { ex: CONFIG.states.process.ex, iso: 1 });
  }
  if (reduced) steps.forEach(function (s) { s.classList.add('is-on', 'is-done'); });
  else steps.forEach(function (s, i) {
    ST.create({
      trigger: s, start: trigStart,
      onEnter: function () { setStep(i + 1); },
      onLeaveBack: function () { setStep(Math.max(1, i)); if (!i) steps[0].classList.remove('is-on'); }
    });
  });

  /* --- Ventajas: la capa de carga se adelanta mientras cuentan los contadores --- */
  var stats = $$('.stat-num');
  if (!reduced) stats.forEach(function (n) { n.textContent = '0'; });
  ST.create({
    trigger: '.stats-row', start: 'top 70%', once: !reduced,
    onEnter: function () {
      SLOTS.perks.at.load = 1;
      if (reduced) return;
      var delay = 0;
      stats.forEach(function (n, i) {
        var to = parseFloat(n.dataset.count), dec = parseInt(n.dataset.decimals || '0', 10), o = { v: 0 };
        gsap.to(o, { v: to, duration: CONFIG.counter[i] || 1.2, delay: delay, ease: 'power2.out', onUpdate: function () { n.textContent = o.v.toFixed(dec).replace('.', ','); } });
        delay += (CONFIG.counter[i] || 1.2) * 0.8;
      });
    }
  });

  /* --- Contacto: las capas se juntan y la web se publica; «Enviar» se ilumina al terminar --- */
  var submit = $('.btn--submit'), litT = null;
  function publish(on) {
    var at = SLOTS.contact.at;
    if (!!at.pub === on) return;
    at.pub = on ? 1 : 0;
    clearTimeout(litT);
    if (on) litT = setTimeout(function () { submit.classList.add('is-lit'); }, reduced ? 0 : CONFIG.publish.lit * 1000);
    else submit.classList.remove('is-lit');
  }
  if (reduced) publish(true);
  else ST.create({
    trigger: '.contact-slot', start: 'top 95%', end: 'center 58%', scrub: 0.6,
    onUpdate: function (s) {
      var p = easeIO(s.progress), st = SLOTS.contact.st;
      st.ex = 1 - p; st.iso = 1 - p * 0.92; st.frame = p;
      if (s.progress > 0.97) publish(true); else if (s.progress < 0.85) publish(false);
    }
  });

  /* ==================================================================
     6 · Resto de animaciones (títulos, textos, contadores…)
     ================================================================== */
  if (reduced) return;

  function splitLines(el) {
    var original = el.innerHTML, words = [], cur = null, needNew = true;
    function push(text, tag) {
      text.split(/(\s+)/).forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) { needNew = true; return; }
        if (needNew || !cur) { cur = document.createElement('span'); cur.style.display = 'inline-block'; words.push(cur); needNew = false; }
        if (tag) { var t = document.createElement(tag); t.textContent = piece; cur.appendChild(t); } else cur.appendChild(document.createTextNode(piece));
      });
    }
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) push(n.textContent, null); else if (n.nodeType === 1) push(n.textContent, n.tagName.toLowerCase());
    });
    el.innerHTML = '';
    words.forEach(function (w, i) { if (i) el.appendChild(document.createTextNode(' ')); el.appendChild(w); });
    var lines = [], top = null;
    words.forEach(function (w) {
      var t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w.innerHTML);
    });
    el.innerHTML = lines.map(function (l) { return '<span class="line"><span class="line-in">' + l.join(' ') + '</span></span>'; }).join('');
    return { lines: $$('.line-in', el), revert: function () { el.innerHTML = original; } };
  }

  // El arranque se reparte en tareas cortas para no bloquear el hilo principal (TBT)
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]) : Promise.resolve();

  tick().then(function () { return fontsReady; }).then(function () {
    /* Titulares de sección por líneas */
    $$('[data-split]').forEach(function (el) {
      var s = splitLines(el);
      gsap.set(el, { opacity: 1 });
      gsap.from(s.lines, {
        yPercent: 112, duration: CONFIG.title.dur, ease: 'expo.out', stagger: CONFIG.title.stagger,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }, onComplete: s.revert
      });
    });
    return tick();
  }).then(function () {
    /* Bloques con fundido y deslizamiento */
    $$('[data-reveal]').forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: CONFIG.reveal.dur, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    $$('[data-reveal-group]').forEach(function (g) {
      gsap.to(g.children, { opacity: 1, y: 0, duration: CONFIG.reveal.dur, stagger: CONFIG.reveal.stagger, scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
    });
    /* Sobre mí: las palabras se encienden al leer */
    var lead = $('[data-words]');
    if (lead) {
      lead.innerHTML = lead.textContent.trim().split(/\s+/).map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
      gsap.fromTo($$('.word', lead), { opacity: 0.16 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 80%', end: 'bottom 55%', scrub: 0.4 } });
    }
    /* Pie: «rgdevstudio» gigante que se revela */
    gsap.fromTo('.footer-word .fw', { yPercent: 102 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.5 } });
    /* Botones magnéticos (solo con ratón) */
    if (finePointer) $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }), yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * CONFIG.magnetic);
        yTo((e.clientY - (r.top + r.height / 2)) * CONFIG.magnetic * 1.3);
      });
      el.addEventListener('pointerleave', function () { gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true }); });
    });
    return tick();
  }).then(function () { ST.refresh(); measureMax(); measureDoc(); });
})();
