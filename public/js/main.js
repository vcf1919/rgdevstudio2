/* ==========================================================================
   rgdevstudio · «La web que se construye sola»
   GSAP + ScrollTrigger + Lenis. El lienzo (js/lienzo.js) y la línea se mueven
   con el scroll; el resto de secciones tienen sus propias entradas.

   Modos (los decide el <head> antes de pintar):
     is-cine     escritorio ≥1024×600: lienzo fijo que viaja + línea completa + secciones fijadas
     (ninguno)   móvil/tablet: lienzos en línea con menos fases, línea fina, sin fijar secciones
     is-reduced  prefers-reduced-motion: todo quieto y visible, solo fundidos mínimos
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Ajustes (duraciones en segundos, pins en pantallas de scroll)
   * ------------------------------------------------------------------ */
  var CONFIG = {
    lenisLerp: 0.1,
    pin: { build: 1.2, works: 3, process: 2 },
    pen: 0.55,                 // la "punta" de la línea va a esta altura de la pantalla
    intro: { line: 0.9, toCanvas: 0.55, frame: 0.9, sketch: 1.6 },
    reveal: { dur: 0.9, y: 24, stagger: 0.08 },
    title: { dur: 1.05, stagger: 0.08 },
    services: { x: -60, stagger: 0.12 },
    project: { stagger: 0.06, y: 22 },
    counter: 1.2,
    launch: { load: 0.8, check: 0.7, confetti: 1.5 },
    heroParallax: 0.12,
    magnetic: 0.3,
    marqueeBoost: 4,
    tints: ['#F3D7DD', '#E6D2B8', '#DAD7CF']   // = --tint-flor / --tint-cafe / --tint-moda
  };

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var seg = function (v, a, b) { return b === a ? (v >= b ? 1 : 0) : clamp01((v - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  var gsap = window.gsap, ST = window.ScrollTrigger, L = window.RGLienzo;
  var reduced = root.classList.contains('is-reduced') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cine = root.classList.contains('is-cine') && !reduced;
  var animate = !!(gsap && ST) && !reduced;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lenis = null;
  if (!gsap || !ST) root.classList.remove('js', 'is-cine');
  if (!animate) cine = false;
  window.__rgReady = true;

  var header = $('.site-header');

  /* ==================================================================
     1 · Lo que funciona siempre (con o sin animaciones)
     ================================================================== */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  function scrollToTarget(target, immediate) {
    var y = target.id === 'inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY - (target.id === 'contacto' ? 0 : header.offsetHeight - 1);
    if (lenis) lenis.scrollTo(y, { immediate: !!immediate, duration: target.id === 'inicio' ? 2.4 : 1.5 });
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
  var refreshSoon = (function () { var t; return function () { clearTimeout(t); t = setTimeout(function () { if (lenis) lenis.resize(); if (ST && animate) ST.refresh(); }, 120); }; })();
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

  /* ==================================================================
     2 · Lienzos en línea (móvil, tablet y movimiento reducido)
     ================================================================== */
  var inline = {};
  function mount(slot, state) {
    if (!slot || !L) return null;
    var lz = L.create();
    slot.appendChild(lz.el);
    lz.set(state);
    return lz;
  }
  // Los lienzos que no se ven al cargar se montan al acercarse (menos trabajo en el arranque)
  // (o antes, en un momento libre del navegador, uno cada vez, para que no coincida con el scroll)
  var idleQ = [];
  function idleNext() {
    var ric = window.requestIdleCallback || function (f) { return setTimeout(f, 200); };
    ric(function () { var f = idleQ.shift(); if (f) { f(); if (idleQ.length) idleNext(); } }, { timeout: 3000 });
  }
  function mountLazy(key, slot, state, then) {
    if (!slot || !L) return;
    var done = false;
    function go() {
      if (done) return; done = true; io.disconnect();
      inline[key] = mount(slot, state);
      if (then) then(inline[key]);
    }
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) go(); }, { rootMargin: '800px 0px' });
    io.observe(slot);
    idleQ.push(go);
    if (idleQ.length === 1) setTimeout(idleNext, 1500);
  }
  var onLazy = {};
  var DONE = { f: 1, sk: 1, s: 0, w: 1, wt: 0, d: 1 };
  function withDone(o) { var r = {}, k; for (k in DONE) r[k] = DONE[k]; for (k in o) r[k] = o[k]; return r; }

  function mountInline() {
  if (!cine && L) {
    inline.hero = mount($('[data-slot="hero"]'), reduced ? { f: 1, sk: 1, s: 1 } : { f: 0, sk: 0, s: 1 });
    ['flor', 'cafe', 'moda'].forEach(function (k, i) {
      mountLazy(k, $('[data-slot="' + k + '"]'), withDone({ p: i }), function (lz) { if (onLazy.project) onLazy.project(lz); });
    });
    mountLazy('launch', $('[data-slot="launch"]'), withDone({ url: 1, load: reduced ? 1 : 0, check: reduced ? 1 : 0 }), function (lz) { if (onLazy.launch) onLazy.launch(lz); });
    mountLazy('logo', $('[data-slot="logo"]'), withDone({ m: 1 }));
  }
  }
  // El arranque se reparte en tareas cortas para no bloquear el hilo principal (TBT)
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  /* ==================================================================
     3 · La línea: un trazo por sección que empieza donde acaba el anterior
     ================================================================== */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var threads = {};

  // Posición dentro de la sección SIN transformaciones (las entradas animadas no deben torcer la línea)
  function absOff(el) { var x = 0, y = 0; while (el) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return [x, y]; }
  function relRect(el, box) {
    var a = absOff(el), o = absOff(box), w = el.offsetWidth, h = el.offsetHeight, l = a[0] - o[0], t = a[1] - o[1];
    return { l: l, t: t, r: l + w, b: t + h, w: w, h: h, cx: l + w / 2, cy: t + h / 2 };
  }
  function P(x, y) { return Math.round(x * 10) / 10 + ' ' + Math.round(y * 10) / 10; }
  function vline(x0, y0, x1, y1) { // bajada suave en S entre dos puntos
    var my = (y1 - y0) * 0.5;
    return 'M' + P(x0, y0) + 'C' + P(x0, y0 + my) + ' ' + P(x1, y1 - my) + ' ' + P(x1, y1);
  }
  function contour(r, pad, rad) { // contorno de una tarjeta, empezando arriba a la izquierda
    var l = r.l - pad, t = r.t - pad, ri = r.r + pad, b = r.b + pad, k = rad + pad;
    return 'L' + P(l + k, t) + 'L' + P(ri - k, t) + 'Q' + P(ri, t) + ' ' + P(ri, t + k) + 'L' + P(ri, b - k) + 'Q' + P(ri, b) + ' ' + P(ri - k, b) +
      'L' + P(l + k, b) + 'Q' + P(l, b) + ' ' + P(l, b - k) + 'L' + P(l, t + k) + 'Q' + P(l, t) + ' ' + P(l + k, t);
  }

  // Dónde cruza la línea de una sección a la siguiente (x en px desde la izquierda de la pantalla)
  function edgeX(name) {
    var W = window.innerWidth, g = Math.min(Math.max(20, W * 0.04), 56);
    if (!cine) {
      if (name === 'faq' || name === 'contact') { var fl = $('.faq-list'); return fl.getBoundingClientRect().left - Math.min(22, g - 6) + 1; }
      return Math.max(8, g * 0.45);
    }
    var ws = $('.works-slot').getBoundingClientRect(), sn = $('.step-num').getBoundingClientRect(), fl2 = $('.faq-list').getBoundingClientRect();
    return {
      hero: W / 2, build: W / 2, works: ws.left + ws.width / 2, marquee: ws.left + ws.width / 2,
      services: sn.left + sn.width / 2, process: g * 0.6, perks: g * 0.6, about: fl2.left - 21, faq: fl2.left - 21, contact: fl2.left - 21
    }[name];
  }
  function bx(name, box) { return edgeX(name) - box.getBoundingClientRect().left; }

  // Cada constructor devuelve trozos { d, a, b } (a–b: tramo del progreso de la sección en que se dibuja)
  var BUILD = {
    hero: function (box, H, W) {
      // el titular puede estar animándose: se mide su máscara (sin transformar), no el texto
      var k = relRect($('.hero-kicker'), box), slot = relRect($('.hero-slot'), box);
      var lastL = relRect($('.hero-title .l:last-child'), box), emEl = $('.hero-title em');
      var em = { l: lastL.l + emEl.offsetLeft * 0, w: emEl.offsetWidth, b: lastL.b - lastL.h * 0.1, h: lastL.h };
      em.l = lastL.l + (emEl.getBoundingClientRect().left - emEl.parentNode.getBoundingClientRect().left);
      em.r = em.l + em.w;
      var x0 = cine ? Math.max(10, k.l - 34) : Math.max(8, k.l * 0.45), y0 = k.t + 2;
      var uy = em.b - em.h * 0.02;
      var a = 'M' + P(x0, y0) + 'C' + P(x0, y0 + (uy - y0) * 0.55) + ' ' + P(em.l - 60, uy + 6) + ' ' + P(em.l - 4, uy + 4) +
        'C' + P(em.l + em.w * 0.3, uy - 3) + ' ' + P(em.l + em.w * 0.65, uy + 7) + ' ' + P(em.r + 8, uy);
      var b, c, end = bx('hero', box);
      if (cine || slot.l > W * 0.4) {
        b = 'M' + P(em.r + 8, uy) + 'C' + P(em.r + 70, uy - 10) + ' ' + P(slot.l - 80, slot.cy + 40) + ' ' + P(slot.l - 6, slot.cy);
        c = cine ? vline(slot.cx, slot.b + 30, end, H)
          : 'M' + P(slot.cx, slot.b + 24) + 'L' + P(slot.cx, H - 90) + 'C' + P(slot.cx, H - 30) + ' ' + P(end + 60, H - 50) + ' ' + P(end, H);
      } else {
        // en móvil vuelve al margen para no cruzar el texto
        b = 'M' + P(em.r + 8, uy) + 'C' + P(em.r + 40, uy + 4) + ' ' + P(em.r + 10, uy + 34) + ' ' + P(lerp(x0, em.r, .5), uy + 30) +
          'C' + P(x0 + 30, uy + 28) + ' ' + P(x0, uy + 40) + ' ' + P(x0, uy + 80) + 'L' + P(x0, slot.t - 30) +
          'C' + P(x0, slot.t - 12) + ' ' + P(slot.l + 4, slot.t - 14) + ' ' + P(slot.l + 10, slot.t - 4);
        c = vline(slot.l + 10, slot.b + 8, end, H);
      }
      return [{ d: a, intro: 'a' }, { d: b, intro: 'b' }, { d: c, a: 0.04, b: 0.9 }];
    },
    build: function (box, H, W, pre) {
      var s = relRect($('.build-slot'), box), x = bx('build', box);
      return [{ d: vline(bx('hero', box), 0, s.cx, s.t - 14), a: 0, b: pre }, { d: vline(s.cx, s.b + 14, x, H), a: 0.93, b: 1 }];
    },
    works: function (box, H, W, pre) {
      if (!cine) { var x = bx('works', box); return [{ d: 'M' + P(x, 0) + 'L' + P(x, H), a: 0, b: 1 }]; }
      var s = relRect($('.works-slot'), box);
      return [
        { d: 'M' + P(bx('build', box), 0) + 'C' + P(bx('build', box), s.t * 0.6) + ' ' + P(s.l - 60, s.t - 10) + ' ' + P(s.l - 16, s.t + 30), a: 0, b: pre },
        { d: vline(s.cx, s.b + 70, bx('works', box), H), a: 0.95, b: 1 }
      ];
    },
    marquee: function (box, H) { var x = bx('marquee', box); return [{ d: 'M' + P(bx('works', box), 0) + 'L' + P(x, H), a: 0, b: 1 }]; },
    services: function (box, H) {
      var cards = $$('.service', box).map(function (c) { return relRect(c, box); });
      var x0 = bx('marquee', box), d = 'M' + P(x0, 0);
      var c0 = cards[0], pad = 9;
      d += 'C' + P(x0, c0.t * 0.6) + ' ' + P(c0.l + 80, c0.t - pad - 60) + ' ' + P(c0.l + 30, c0.t - pad);
      cards.forEach(function (c, i) {
        d += contour(c, pad, 24);
        var n = cards[i + 1];
        if (n) d += 'C' + P(c.l - pad - 18, c.t + 40) + ' ' + P(n.l - pad - 18, n.t - 40) + ' ' + P(n.l + 30, n.t - pad);
      });
      var last = cards[cards.length - 1], xe = bx('services', box);
      d += 'C' + P(last.l - 40, last.t + 60) + ' ' + P(last.l - 30, last.b + 40) + ' ' + P(lerp(last.l, xe, .5), last.b + 60) + 'S' + P(xe, H - 60) + ' ' + P(xe, H);
      return [{ d: d, a: 0, b: 1 }];
    },
    process: function (box, H, W, pre) {
      var nums = $$('.step-num', box).map(function (n) { return relRect(n, box); });
      var x0 = bx('services', box), first = nums[0], last = nums[nums.length - 1];
      var mid = 'M' + P(first.cx, first.t + 4) + 'L' + P(last.cx, last.b - 4);
      var out = [
        { d: vline(x0, 0, first.cx, first.t + 4), a: 0, b: cine ? pre : 0.12 },
        { d: mid, a: cine ? pre + 0.02 : 0.12, b: cine ? 0.94 : 0.85, steps: nums.map(function (n) { return (n.cy - first.t) / Math.max(1, last.b - first.t); }) },
        { d: vline(last.cx, last.b - 4, bx('process', box), H), a: cine ? 0.96 : 0.85, b: 1 }
      ];
      return out;
    },
    perks: function (box, H) {
      if (!cine) { var xm = bx('perks', box); return [{ d: 'M' + P(xm, 0) + 'L' + P(xm, H), a: 0, b: 1 }]; }
      var st = $$('.stat', box).map(function (s) { return relRect(s, box); });
      var x0 = bx('process', box), x1 = bx('perks', box);
      var mx = st.length > 1 && st[1].l > st[0].r ? (st[0].r + st[1].l) / 2 : st[0].r + 24;
      var top = st[0].t - 30, bot = Math.max(st[0].b, (st[1] || st[0]).b) + 30;
      return [{ d: 'M' + P(x0, 0) + 'C' + P(x0, top * 0.7) + ' ' + P(mx, top - 140) + ' ' + P(mx, top) + 'L' + P(mx, bot) + 'C' + P(mx, bot + 160) + ' ' + P(x1, H - 220) + ' ' + P(x1, H), a: 0, b: 1 }];
    },
    about: function (box, H) {
      if (!cine) { var xa = bx('perks', box); return [{ d: 'M' + P(xa, 0) + 'C' + P(xa, H * .6) + ' ' + P(bx('about', box), H * .6) + ' ' + P(bx('about', box), H), a: 0, b: 1 }]; }
      var s = relRect($('.about-sign'), box), x0 = bx('perks', box), x1 = bx('about', box);
      var y = s.b + 6;
      var d = 'M' + P(x0, 0) + 'C' + P(x0, y * 0.5) + ' ' + P(s.l - 90, y - 10) + ' ' + P(s.l - 6, y) +
        'C' + P(s.l + s.w * 0.4, y + 8) + ' ' + P(s.r - 10, y - 6) + ' ' + P(s.r + 22, y - 20) +   // firma
        'C' + P(s.r + 40, y - 34) + ' ' + P(s.r + 20, y - 46) + ' ' + P(s.r + 8, y - 28) +
        'C' + P(s.r - 4, y - 8) + ' ' + P(s.r + 30, y + 20) + ' ' + P(s.r + 70, y + 10) +
        'C' + P(s.r + 140, y + 60) + ' ' + P(x1, H - 160) + ' ' + P(x1, H);
      return [{ d: d, a: 0, b: 1 }];
    },
    faq: function (box, H) { var x = bx('faq', box); return [{ d: 'M' + P(bx('about', box), 0) + 'L' + P(x, H), a: 0, b: 1 }]; },
    contact: function (box, H) {
      var x0 = bx('faq', box);
      var fields = $$('.form [data-anchor]', box).map(function (f) { return relRect(f, box); });
      var btn = relRect($('.btn--submit', box), box);
      var fx = fields[0].l - 22;
      var d = 'M' + P(x0, 0) + 'C' + P(x0, fields[0].t * 0.6) + ' ' + P(fx, fields[0].t - 120) + ' ' + P(fx, fields[0].t + 10);
      d += 'L' + P(fx, btn.cy - 40) + 'C' + P(fx, btn.cy - 10) + ' ' + P(btn.l - 30, btn.cy) + ' ' + P(btn.l - 3, btn.cy);
      return [{ d: d, a: 0, b: 1, end: true }];
    }
  };

  function makeThread(box) {
    var name = box.getAttribute('data-thread');
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'thread'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    var tip = document.createElementNS(SVGNS, 'circle');
    tip.setAttribute('class', 'thread-tip'); tip.setAttribute('r', cine ? '3.6' : '2.6'); tip.style.opacity = '0';
    svg.appendChild(tip);
    box.insertBefore(svg, box.firstChild);
    var T = { name: name, box: box, svg: svg, tip: tip, pieces: [], prog: 0, intro: { a: reduced ? 1 : 0, b: reduced ? 1 : 0 }, pre: 0 };
    threads[name] = T;
    return T;
  }

  function buildThread(T) {
    var box = T.box, H = box.offsetHeight, W = box.offsetWidth;
    T.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    T.pieces.forEach(function (p) { p.el.remove(); });
    var defs = BUILD[T.name](box, H, W, T.pre);
    T.pieces = defs.map(function (def) {
      var el = document.createElementNS(SVGNS, 'path');
      el.setAttribute('d', def.d);
      T.svg.insertBefore(el, T.tip);
      def.el = el; def.len = el.getTotalLength();
      def.pts = [];
      for (var i = 0; i <= 96; i++) { var q = el.getPointAtLength(def.len * i / 96); def.pts.push([q.x, q.y]); }
      el.style.strokeDasharray = def.len + ' ' + (def.len + 2);
      return def;
    });
    drawThread(T, T.prog, true);
  }

  function setPiece(p, t) {
    if (p.t === t) return; p.t = t;
    p.el.style.strokeDashoffset = String(p.len * (1 - t));
  }
  function drawThread(T, prog, force) {
    if (!force && T.prog === prog) return;
    T.prog = prog;
    var tipAt = null;
    T.pieces.forEach(function (p) {
      var t = p.intro ? T.intro[p.intro] : (reduced ? 1 : seg(prog, p.a, p.b));
      if (force) p.t = -1;
      setPiece(p, t);
      if (t > 0 && t < 1 && !reduced) tipAt = p;
      if (p.steps) T.onSteps && T.onSteps(t, p.steps);
      if (p.end && T.onEnd) T.onEnd(t >= 0.999);
    });
    if (tipAt) {
      var f = tipAt.t * 96, i0 = Math.floor(f), A = tipAt.pts[i0], B = tipAt.pts[Math.min(96, i0 + 1)], k = f - i0;
      T.tip.setAttribute('cx', (A[0] + (B[0] - A[0]) * k).toFixed(1)); T.tip.setAttribute('cy', (A[1] + (B[1] - A[1]) * k).toFixed(1));
      if (!T.tipOn) { T.tipOn = true; T.tip.style.opacity = '1'; }
    } else if (T.tipOn !== false) { T.tipOn = false; T.tip.style.opacity = '0'; }
  }

  var threadBoxes = $$('[data-thread]').filter(function (b) { return b.offsetParent !== null || getComputedStyle(b).display !== 'none'; });
  if (!cine) threadBoxes = threadBoxes.filter(function (b) { return b.getAttribute('data-thread') !== 'build'; });
  threadBoxes.forEach(makeThread);

  // pasos del proceso (sin animación: todos activos)
  var steps = $$('.step');
  if (threads.process) threads.process.onSteps = function (t, fr) {
    steps.forEach(function (s, i) { s.classList.toggle('is-on', reduced || t >= fr[i] - 0.004); });
  };
  var submit = $('.btn--submit');
  if (threads.contact) threads.contact.onEnd = function (on) { submit.classList.toggle('is-lit', on); };

  function buildAllThreads() { Object.keys(threads).forEach(function (k) { buildThread(threads[k]); }); }

  if (!animate) {
    // Sin animaciones: la línea ya dibujada y todo en su sitio
    var fontsOk = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsOk.then(function () { mountInline(); buildAllThreads(); });
    window.addEventListener('resize', (function () { var t; return function () { clearTimeout(t); t = setTimeout(buildAllThreads, 200); }; })());
    return;
  }

  /* ==================================================================
     4 · Animaciones
     ================================================================== */
  gsap.registerPlugin(ST);
  gsap.defaults({ ease: 'power3.out', duration: 1 });
  ST.config({ ignoreMobileResize: true });

  // Scroll suave
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: CONFIG.lenisLerp, wheelMultiplier: 1 });
    lenis.on('scroll', function (l) { ST.update(); onScrollUI(l.animatedScroll); marqueeVelocity(l.velocity); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* --- Titulares por líneas con máscara --- */
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

  var fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]) : Promise.resolve();

  tick().then(function () { mountInline(); return tick(); }).then(function () { return fontsReady; }).then(function () {
    /* Titulares de sección */
    $$('[data-split]').forEach(function (el) {
      var s = splitLines(el);
      gsap.set(el, { opacity: 1 });
      gsap.from(s.lines, {
        yPercent: 112, duration: CONFIG.title.dur, ease: 'expo.out', stagger: CONFIG.title.stagger,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onComplete: s.revert
      });
    });
    /* Bloques que aparecen */
    $$('[data-reveal]').forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: CONFIG.reveal.dur, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-reveal-group]').forEach(function (g) {
      gsap.to(g.children, { opacity: 1, y: 0, duration: CONFIG.reveal.dur, stagger: CONFIG.reveal.stagger, scrollTrigger: { trigger: g, start: 'top 85%', once: true } });
    });

    return tick();
  }).then(function () {
    setupScenes();
    return tick();
  }).then(function () {
    ST.refresh();
  });

  /* --- Intro: titular (CSS), la línea se dibuja sola y el lienzo aparece --- */
  function intro(lz) {
    var I = CONFIG.intro;
    var T = threads.hero, ex = { f: 0, sk: 0 };
    var tl = gsap.timeline({ delay: 0.35 });
    if (T) {
      tl.to(T.intro, { a: 1, duration: I.line, ease: 'power2.inOut', onUpdate: function () { drawThread(T, T.prog, true); } });
      tl.to(T.intro, { b: 1, duration: I.toCanvas, ease: 'power1.inOut', onUpdate: function () { drawThread(T, T.prog, true); } });
    }
    tl.to(ex, { f: 1, duration: I.frame, ease: 'none', onUpdate: function () { lz.extra(ex); } }, T ? '-=0.12' : 0);
    tl.to(ex, { sk: 1, duration: I.sketch, ease: 'none', onUpdate: function () { lz.extra(ex); } }, '-=0.45');
  }

  /* ==================================================================
     Escenas
     ================================================================== */
  function setupScenes() {
    var vh = function () { return window.innerHeight; };
    var pins = {};
    var projects = $$('.project');

    // Los hilos se recalculan en cada refresh (cambia el tamaño de la pantalla, se abre una FAQ…)
    ST.addEventListener('refresh', function () { measureDoc(); buildAllThreads(); if (director) director.rebuild(); });

    /* --- Pins (solo escritorio) --- */
    if (cine) {
      pins.build = ST.create({ trigger: '.build-pin', start: 'top top', end: function () { return '+=' + vh() * CONFIG.pin.build; }, pin: true, anticipatePin: 1 });
      pins.works = ST.create({ trigger: '.works-pin', start: 'top top', end: function () { return '+=' + vh() * CONFIG.pin.works; }, pin: true, anticipatePin: 1 });
      pins.process = ST.create({ trigger: '.process-pin', start: 'top top', end: function () { return '+=' + vh() * CONFIG.pin.process; }, pin: true, anticipatePin: 1 });
    }

    /* --- Progreso de la línea en cada sección --- */
    Object.keys(threads).forEach(function (name) {
      var T = threads[name], pin = pins[name];
      if (name === 'hero') {
        T.st = ST.create({ trigger: T.box, start: 'top top', end: 'bottom top', onUpdate: function (s) { drawThread(T, s.progress); } });
        return;
      }
      if (pin) {
        // empieza antes del pin (cuando la sección asoma) y acaba con él
        T.st = ST.create({
          trigger: T.box, start: 'top ' + Math.round(CONFIG.pen * 100) + '%', end: function () { return pin.end; },
          onRefresh: function (s) { T.pre = (pin.start - s.start) / Math.max(1, s.end - s.start); },
          onUpdate: function (s) { drawThread(T, s.progress); }
        });
        return;
      }
      var endTrig = name === 'contact' ? { endTrigger: '.btn--submit', end: 'center 62%' } : { end: 'bottom ' + Math.round(CONFIG.pen * 100) + '%' };
      T.st = ST.create(Object.assign({ trigger: T.box, start: 'top ' + Math.round(CONFIG.pen * 100) + '%', onUpdate: function (s) { drawThread(T, s.progress); } }, endTrig));
    });

    /* --- Trabajos: texto de cada caso --- */
    projects.forEach(function (p, i) { if (cine) gsap.set(p, { autoAlpha: i ? 0 : 1 }); });
    var shown = 0;
    function showProject(i) {
      if (i === shown) return;
      var out = projects[shown], inn = projects[i], dir = i > shown ? 1 : -1;
      shown = i;
      gsap.killTweensOf([out, inn, $$('[data-p]', out), $$('[data-p]', inn)]);
      gsap.to($$('[data-p]', out), { autoAlpha: 0, y: -CONFIG.project.y * dir, duration: 0.35, ease: 'power2.in', stagger: 0.02 });
      gsap.set(out, { autoAlpha: 0, delay: 0.4 });
      gsap.set(inn, { autoAlpha: 1 });
      gsap.fromTo($$('[data-p]', inn), { autoAlpha: 0, y: CONFIG.project.y * dir }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.25, stagger: CONFIG.project.stagger, ease: 'power3.out' });
    }
    var worksBox = $('.works'), dots = $$('.works-dots li');
    var tint = gsap.utils.interpolate(CONFIG.tints);
    if (cine) ST.create({
      trigger: '.works-pin', start: 'top top', end: function () { return pins.works.end; },
      onUpdate: function (s) { dots.forEach(function (d, k) { d.style.setProperty('--p', clamp01(s.progress * 3 - k).toFixed(3)); }); }
    });

    /* --- Lienzo de escritorio + director --- */
    if (cine && L) director = makeDirector(pins, showProject, function (p) { worksBox.style.backgroundColor = tint(clamp01(p / 2)); });

    /* --- Móvil: el lienzo del hero pasa de boceto a diseño al bajar; resto de fases en su sitio --- */
    if (!cine) {
      var H = inline.hero;
      if (H) {
        H.extra = function (o) { H.set(o); };
        intro(H);
        var hs = { s: 1, w: 0, wt: 0, d: 0 };
        ST.create({
          trigger: '[data-slot="hero"]', start: 'center 80%', end: 'center 20%',
          onUpdate: function (st) {
            var t = st.progress;
            H.set({ s: 1 - easeIO(seg(t, 0, .35)), w: seg(t, .15, .4), wt: seg(t, .1, .45), d: easeIO(seg(t, .45, .9)) });
          }
        });
      }
      onLazy.project = function (lz) {
        gsap.from(lz.el, { autoAlpha: 0, y: 30, scale: .96, duration: 1, scrollTrigger: { trigger: lz.el, start: 'top 88%', once: true } });
      };
      onLazy.launch = function (lz) { launchFX(lz, '[data-slot="launch"]'); };
      ['flor', 'cafe', 'moda'].forEach(function (k) { if (inline[k]) onLazy.project(inline[k]); });
      if (inline.launch) onLazy.launch(inline.launch);
      // pasos del proceso: con la línea
    } else if (director) {
      intro(director.lz);
      launchFX(director.lz, '.contact-slot');
    }

    /* --- Servicios: cascada --- */
    gsap.from('.service', {
      autoAlpha: 0, x: CONFIG.services.x, duration: 1, stagger: CONFIG.services.stagger, ease: 'power3.out',
      scrollTrigger: { trigger: '.services-grid', start: 'top 78%', once: true }
    });

    /* --- Ventajas: contadores + barra de carga del lienzo --- */
    var stats = $$('.stat-num');
    stats.forEach(function (n) { n.textContent = '0'; });
    ST.create({
      trigger: '.stats', start: 'top 78%', once: true,
      onEnter: function () {
        stats.forEach(function (n) {
          var to = parseFloat(n.dataset.count), dec = parseInt(n.dataset.decimals || '0', 10), o = { v: 0 };
          gsap.to(o, { v: to, duration: CONFIG.counter, ease: 'power2.out', onUpdate: function () { n.textContent = o.v.toFixed(dec).replace('.', ','); } });
        });
        var lz = director ? director.lz : null;
        if (lz) { var e = { load: 0 }; gsap.to(e, { load: 1, duration: CONFIG.launch.load, ease: 'power1.inOut', onUpdate: function () { lz.extra(e); } }); }
      }
    });

    /* --- Sobre mí: las palabras se encienden al leer --- */
    var lead = $('[data-words]');
    if (lead) {
      lead.innerHTML = lead.textContent.trim().split(/\s+/).map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
      gsap.fromTo($$('.word', lead), { opacity: 0.16 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 78%', end: 'bottom 50%', scrub: 0.4 } });
    }

    /* --- Pie: «rgdevstudio» gigante que se revela --- */
    gsap.fromTo('.footer-word .fw', { yPercent: 102 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.5 } });

    /* --- Notas de la escena del boceto --- */
    if (cine) {
      gsap.timeline({ scrollTrigger: { trigger: '.build-pin', start: 'top top', end: function () { return pins.build.end; }, scrub: 0.5 } })
        .fromTo('.build-note--1', { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.2 }, 0.04)
        .fromTo('.build-note--2', { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.2 }, 0.42)
        .to('.build-note', { autoAlpha: 0, y: -20, duration: 0.12 }, 0.88);
    }

    /* --- Botones magnéticos --- */
    if (finePointer) $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }), yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * CONFIG.magnetic);
        yTo((e.clientY - (r.top + r.height / 2)) * CONFIG.magnetic * 1.3);
      });
      el.addEventListener('pointerleave', function () { gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true }); });
    });
  }

  /* --- Lanzamiento: sello «Publicado» + confeti (una vez) --- */
  function launchFX(lz, trigger) {
    var e = { check: 0, conf: 0, load: 0 }, fired = false;
    if (!lz.extra) lz.extra = function (o) { lz.set(o); };
    ST.create({
      trigger: trigger, start: 'top 72%',
      onEnter: function () {
        gsap.to(e, { check: 1, duration: CONFIG.launch.check, ease: 'none', delay: 0.15, onUpdate: function () { lz.extra({ check: e.check }); } });
        if (!director) gsap.to(e, { load: 1, duration: CONFIG.launch.load, ease: 'none', onUpdate: function () { lz.extra({ load: e.load }); } });
        if (!fired) { fired = true; gsap.fromTo(e, { conf: 0 }, { conf: 1, duration: CONFIG.launch.confetti, ease: 'power1.out', delay: 0.3, onUpdate: function () { lz.extra({ conf: e.conf }); } }); }
      },
      onLeaveBack: function () { gsap.to(e, { check: 0, duration: 0.3, onUpdate: function () { lz.extra({ check: e.check }); } }); }
    });
  }

  /* --- Marquee: acelera con la velocidad del scroll --- */
  var mqAnim = null, mqRate = 1;
  function marqueeVelocity(v) {
    if (!mqAnim) { var t = $('.marquee-track'); mqAnim = t && t.getAnimations ? t.getAnimations()[0] : null; if (!mqAnim) return; }
    var target = 1 + Math.min(Math.abs(v || 0) / 12, CONFIG.marqueeBoost);
    mqRate += (target - mqRate) * 0.15;
    mqAnim.playbackRate = mqRate;
  }

  /* ==================================================================
     5 · Director: coloca el lienzo fijo y decide su fase según el scroll
     ================================================================== */
  var director = null;
  function makeDirector(pins, showProject, onProject) {
    var stage = $('.lienzo-stage');
    var lz = L.create();
    stage.appendChild(lz.el);
    var el = lz.el, W0 = 900;
    var extras = { f: 0, sk: 0, load: 0, check: 0, conf: 0 };
    lz.extra = function (o) { for (var k in o) extras[k] = o[k]; update(); };

    var DOCKS = {
      hero: '.hero-slot', build: '.build-slot', works: '.works-slot', services: '.services-slot', process: '.process-slot',
      perks: '.perks-slot', about: '.about-slot', contact: '.contact-slot', logo: '.footer-mark'
    };
    Object.keys(DOCKS).forEach(function (k) { DOCKS[k] = $(DOCKS[k]); });
    function dock(name, y) {
      var r = DOCKS[name].getBoundingClientRect();
      var o = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
      if (name === 'hero') o.cy += y * CONFIG.heroParallax;
      return o;
    }

    var tracks = {};
    function key(at, props, ease) {
      for (var p in props) (tracks[p] = tracks[p] || []).push({ at: at, v: props[p], e: ease || easeIO });
    }
    function sample(p, x) {
      var T = tracks[p];
      if (!T) return undefined;
      if (x <= T[0].at) return { a: T[0].v, b: T[0].v, t: 0 };
      for (var i = 0; i < T.length - 1; i++) {
        if (x < T[i + 1].at) return { a: T[i].v, b: T[i + 1].v, t: T[i + 1].e(seg(x, T[i].at, T[i + 1].at)) };
      }
      var l = T[T.length - 1]; return { a: l.v, b: l.v, t: 0 };
    }
    function num(p, x) { var s = sample(p, x); return s ? lerp(s.a, s.b, s.t) : 0; }

    var marks = {};
    function mark(name, trigger, start, end) {
      marks[name] = ST.create({ trigger: trigger, start: start, end: end || start });
    }
    mark('services', '.services', 'top 65%', 'bottom 70%');
    mark('perks', '.perks', 'top 70%', 'bottom 55%');
    mark('about', '.about', 'top 45%');
    mark('faq', '.faq', 'top 80%', 'top 40%');
    mark('contact', '.contact', 'top 70%', 'top 25%');
    mark('footer', '.site-footer', 'top bottom');

    function rebuild() {
      tracks = {};
      var B = pins.build, Wk = pins.works, Pr = pins.process;
      var Lb = B.end - B.start, Lw = Wk.end - Wk.start;
      var S0 = marks.services.start, S1 = marks.services.end;
      var maxY = ST.maxScroll(window);

      // hero → boceto
      key(0, { dock: 'hero', o: 1, s: 1, w: 0, wt: 0, d: 0, p: 0, i: 0, url: 0, m: 0, tr: 0 });
      // boceto → wireframe (pin)
      key(B.start, { dock: 'build', s: 1, w: 0, wt: 0 });
      key(B.start + Lb * 0.55, { s: 0 });
      key(B.start + Lb * 0.4, { w: 0 }); key(B.start + Lb * 0.8, { w: 1 });
      key(B.start + Lb * 0.18, { wt: 0 }); key(B.start + Lb * 0.85, { wt: 1 });
      key(B.end, { dock: 'build', d: 0 });
      // diseño + proyectos (pin)
      key(Wk.start, { dock: 'works', d: 0.85, tr: 0 });
      key(Wk.start + Lw * 0.1, { d: 1 });
      key(Wk.start + Lw * 0.26, { p: 0 }); key(Wk.start + Lw * 0.4, { p: 1 });
      key(Wk.start + Lw * 0.6, { p: 1 }); key(Wk.start + Lw * 0.74, { p: 2 });
      key(Wk.end, { dock: 'works', p: 2, tr: 1 }, function (t) { return t; });
      // interactivo (servicios)
      key(S0, { dock: 'services', i: 0, tr: 0 });
      key(S1, { dock: 'services', i: 1, p: 2, d: 1 });
      // proceso: rebobina y repite las fases sincronizado con la línea
      var T = threads.process, fr = [0.02, 0.27, 0.52, 0.77];
      var proc = T && T.pieces[1] && T.pieces[1].steps ? T.pieces[1] : null;
      var stepY = fr.map(function (f, k) {
        var pp = proc ? lerp(proc.a, proc.b, proc.steps[k]) : f;
        return T.st ? T.st.start + pp * (T.st.end - T.st.start) : Pr.start + f * (Pr.end - Pr.start);
      });
      var R1 = Math.max(stepY[0], S1 + 10), D = R1 - S1;
      key(S1 + D * 0.35, { p: 0, i: 0, d: 1 });
      key(S1 + D * 0.6, { s: 0, w: 1, wt: 1 });
      key(S1 + D * 0.7, { d: 0 });
      key(R1, { s: 1, w: 0, wt: 0, d: 0 });
      key(Pr.start, { dock: 'process' });
      var hold = function (k) { return stepY[k] - (stepY[k] - stepY[k - 1]) * 0.6; };
      key(hold(1), { s: 1, w: 0, wt: 0 }); key(stepY[1], { s: 0, w: 1, wt: 1 });
      key(hold(2), { d: 0 }); key(stepY[2], { d: 1 });
      key(hold(3), { url: 0 }); key(stepY[3], { url: 1 });
      key(Pr.end, { dock: 'process' });
      // ventajas, sobre mí, FAQ (se esconde), contacto, logo
      key(marks.perks.start, { dock: 'perks' });
      key(marks.perks.end, { dock: 'perks' });
      key(marks.about.start, { dock: 'about' });
      key(marks.faq.start, { o: 1 }); key(marks.faq.end, { o: 0 });
      key(marks.contact.start, { dock: 'about', o: 0 });
      key(marks.contact.start + 1, { dock: 'contact' });
      key(marks.contact.end, { o: 1 });
      key(Math.min(marks.footer.start, maxY - 1), { dock: 'contact', m: 0 });
      key(maxY, { dock: 'logo', m: 1 });

      Object.keys(tracks).forEach(function (p) { tracks[p].sort(function (a, b) { return a.at - b.at; }); });

      // tamaño base del lienzo = el mayor de sus huecos (así nunca se escala hacia arriba)
      W0 = Math.max(DOCKS.build.offsetWidth, DOCKS.works.offsetWidth, DOCKS.services.offsetWidth, 300);
      el.style.width = W0 + 'px'; el.style.height = (W0 / 1.6) + 'px';
      last = null; update();
    }

    var last = null, lastP = -1, current = 0;
    function update() {
      var y = lenis ? lenis.animatedScroll : window.scrollY;
      if (!tracks.dock) return;
      var ds = sample('dock', y), A = dock(ds.a, y), Bd = ds.a === ds.b ? A : dock(ds.b, y);
      var t = ds.t, cx = lerp(A.cx, Bd.cx, t), cy = lerp(A.cy, Bd.cy, t), w = lerp(A.w, Bd.w, t);
      var o = num('o', y);
      var k = w / W0, x = cx - w / 2, yy = cy - (w / 1.6) / 2;
      var tf = 'translate3d(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px,0) scale(' + k.toFixed(4) + ')';
      if (tf !== last) { el.style.transform = tf; last = tf; }
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';

      var s = { s: num('s', y), w: num('w', y), wt: num('wt', y), d: num('d', y), p: num('p', y), i: num('i', y), url: num('url', y), m: num('m', y), tr: num('tr', y) };
      for (var e in extras) s[e] = extras[e];
      lz.set(s);
      if (s.p !== lastP) {
        lastP = s.p; onProject(s.p);
        var idx = s.p < 0.5 ? 0 : s.p < 1.5 ? 1 : 2;
        if (idx !== current) { current = idx; showProject(idx); }
      }
    }

    ST.create({ start: 0, end: 'max', onUpdate: update });
    window.addEventListener('resize', function () { last = null; });
    return { lz: lz, rebuild: rebuild, update: update };
  }
})();
