/* ==========================================================================
   rgdevstudio · «Partículas que se ordenan»
   GSAP + ScrollTrigger + Lenis para el scroll, los textos y las escenas.
   El campo de partículas (js/particulas.js) se carga DESPUÉS, cuando la página
   ya está pintada, y lee de aquí el guion de escenas (CONFIG.scenes).

   Modos (los decide el <head> antes de pintar):
     is-wide     escritorio con ratón ≥1024×600: composiciones en dos columnas
     is-pin      is-wide con movimiento: Trabajos y Proceso se fijan
     is-reduced  prefers-reduced-motion: todo quieto y visible
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Ajustes (duraciones en segundos, pins en pantallas de scroll)
   * ------------------------------------------------------------------ */
  var CONFIG = {
    lenisLerp: 0.1,
    toTopDuration: 2.8,          // «Volver arriba»: recorrido inverso de todas las formas
    pin: { works: 3.5, process: 3 },
    reveal: { dur: 0.9, y: 24, stagger: 0.08 },
    title: { dur: 1.05, stagger: 0.08 },
    services: { y: 60, stagger: 0.12 },
    project: { stagger: 0.06, y: 22 },
    counter: 1.4,
    magnetic: 0.3,
    particlesDelay: 1500,        // máx. espera (ms) tras «load» antes de cargar las partículas
    /* Guion de escenas (lo usa js/particulas.js). Fracciones del pin o de la pantalla. */
    scenes: {
      works: [[0, 0.22], [0.36, 0.58], [0.72, 1]],     // forma quieta de cada proyecto dentro del pin
      process: [[0, 0.16], [0.25, 0.41], [0.5, 0.66], [0.75, 1]],
      morph: 0.55,               // pantallas de scroll que dura un morph entre secciones (como mínimo)
      cloudAlpha: 0.45,          // opacidad de la nube de Sobre mí y FAQ
      cloudCursor: 0.35          // fuerza del cursor en la nube
    }
  };

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  var gsap = window.gsap, ST = window.ScrollTrigger;
  var reduced = root.classList.contains('is-reduced') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = !!(gsap && ST) && !reduced;
  var pinMode = root.classList.contains('is-pin') && animate;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lenis = null;
  if (!gsap || !ST) root.classList.remove('js', 'is-pin');
  if (!pinMode) root.classList.remove('is-pin');
  window.__rgReady = true;

  /* Lo que comparte con js/particulas.js */
  var RG = window.RG = { config: CONFIG, pins: {}, lenis: null, reduced: reduced };
  function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }

  var header = $('.site-header');

  /* ==================================================================
     1 · Lo que funciona siempre (con o sin animaciones)
     ================================================================== */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  function scrollToTarget(target, immediate) {
    var y = target.id === 'inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY - (target.id === 'contacto' ? 0 : header.offsetHeight - 1);
    if (lenis) lenis.scrollTo(y, { immediate: !!immediate, duration: target.id === 'inicio' ? CONFIG.toTopDuration : 1.5 });
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
    var focusEl = target.id === 'inicio' ? null : target;
    if (focusEl) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
  });

  /* Cabecera: desenfoque al bajar + barra de progreso */
  var progressBar = $('.nav-progress i');
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
    var map = {}, current = null;
    $$('.nav a[href^="#"]').forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (current) { current.classList.remove('is-active'); current.removeAttribute('aria-current'); }
        current = map[en.target.id] || null;
        if (current) { current.classList.add('is-active'); current.setAttribute('aria-current', 'location'); }
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    ['inicio', 'trabajos', 'servicios', 'proceso', 'ventajas', 'sobre-mi', 'faq', 'contacto'].forEach(function (id) {
      var s = document.getElementById(id); if (s) io.observe(s);
    });
  })();

  /* FAQ: acordeón con altura fluida (solo uno abierto a la vez) */
  var refreshSoon = (function () {
    var t;
    return function () { clearTimeout(t); t = setTimeout(function () { measureDoc(); if (lenis) lenis.resize(); if (ST && animate) ST.refresh(); emit('rg:layout'); }, 120); };
  })();
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
        emit('rg:sent');
        return;
      }
      btn.disabled = true; label.textContent = 'Enviando…'; setStatus('');
      fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.success }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error('send');
          form.reset(); $$('.field', form).forEach(function (f) { f.classList.remove('is-valid'); });
          setStatus('¡Mensaje enviado! Te respondo en menos de 24 horas.', 'ok');
          emit('rg:sent');
        })
        .catch(function () { setStatus('No se ha podido enviar. Escríbeme a <a href="mailto:' + MAIL + '">' + MAIL + '</a>.', 'error'); })
        .then(function () { btn.disabled = false; label.textContent = 'Enviar'; });
    });
  })();

  /* ==================================================================
     2 · Partículas: se cargan cuando la página ya está pintada y en calma
         (después de «load» y en un hueco libre del hilo principal)
     ================================================================== */
  (function () {
    var loaded = false;
    function inject() {
      if (loaded) return; loaded = true;
      var s = document.createElement('script');
      s.src = '/js/particulas.js?v=20'; s.async = true;
      s.onerror = function () { root.classList.add('no-gl'); };
      document.body.appendChild(s);
    }
    function schedule() {
      if (window.requestIdleCallback) window.requestIdleCallback(inject, { timeout: CONFIG.particlesDelay });
      else setTimeout(inject, 350);
    }
    if (document.readyState === 'complete') schedule(); else window.addEventListener('load', schedule);
  })();

  /* Pasos del proceso y servicios sin animaciones: todos encendidos */
  if (!animate) {
    $$('.step').forEach(function (s) { s.classList.add('is-on'); });
    return;
  }

  /* ==================================================================
     3 · Animaciones
     ================================================================== */
  gsap.registerPlugin(ST);
  gsap.defaults({ ease: 'power3.out', duration: 1 });
  ST.config({ ignoreMobileResize: true });

  // Scroll suave (en táctil, Lenis deja el scroll nativo: en iPhone se siente como siempre)
  if (window.Lenis) {
    lenis = RG.lenis = new window.Lenis({ lerp: CONFIG.lenisLerp, wheelMultiplier: 1 });
    lenis.on('scroll', function (l) { ST.update(); onScrollUI(l.animatedScroll); });
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

  var tick = function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); };
  var fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]) : Promise.resolve();

  tick().then(function () { return fontsReady; }).then(function () {
    $$('[data-split]').forEach(function (el) {
      var s = splitLines(el);
      gsap.set(el, { opacity: 1 });
      gsap.from(s.lines, {
        yPercent: 112, duration: CONFIG.title.dur, ease: 'expo.out', stagger: CONFIG.title.stagger,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onComplete: s.revert
      });
    });
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
    ST.addEventListener('refresh', function () { measureDoc(); emit('rg:layout'); });
    ST.refresh();
    RG.ready = true;
    emit('rg:layout');
  });

  /* ==================================================================
     Escenas
     ================================================================== */
  function setupScenes() {
    var vh = function () { return window.innerHeight; };
    var projects = $$('.project'), steps = $$('.step');

    /* --- Pins (solo escritorio con ratón) --- */
    if (pinMode) {
      RG.pins.works = ST.create({ trigger: '.works-pin', start: 'top top', end: function () { return '+=' + vh() * CONFIG.pin.works; }, pin: true, anticipatePin: 1 });
      RG.pins.process = ST.create({ trigger: '.process-pin', start: 'top top', end: function () { return '+=' + vh() * CONFIG.pin.process; }, pin: true, anticipatePin: 1 });
    }

    /* --- Trabajos: el texto cambia a mitad de cada morph --- */
    var W = CONFIG.scenes.works;
    var cuts = [(W[0][1] + W[1][0]) / 2, (W[1][1] + W[2][0]) / 2];
    var shown = 0;
    function showProject(i) {
      if (i === shown) return;
      // Solo opacidad (no visibility): el lector de pantalla puede leer los tres proyectos
      var out = projects[shown], inn = projects[i], dir = i > shown ? 1 : -1;
      shown = i;
      var outP = $$('[data-p]', out), inP = $$('[data-p]', inn);
      gsap.killTweensOf(outP.concat(inP));
      out.classList.remove('is-current'); inn.classList.add('is-current');
      gsap.fromTo(outP, { opacity: 1, y: 0 }, { opacity: 0, y: -CONFIG.project.y * dir, duration: 0.35, ease: 'power2.in', stagger: 0.02, immediateRender: false });
      gsap.fromTo(inP, { opacity: 0, y: CONFIG.project.y * dir }, { opacity: 1, y: 0, duration: 0.7, delay: 0.2, stagger: CONFIG.project.stagger, ease: 'power3.out' });
    }
    if (pinMode) {
      var dots = $$('.works-dots li');
      ST.create({
        trigger: '.works-pin', start: 'top top', end: function () { return RG.pins.works.end; },
        onUpdate: function (s) {
          var p = s.progress;
          showProject(p < cuts[0] ? 0 : p < cuts[1] ? 1 : 2);
          dots.forEach(function (d, k) { d.style.setProperty('--p', clamp01((p - (k ? cuts[k - 1] : 0)) / ((k < 2 ? cuts[k] : 1) - (k ? cuts[k - 1] : 0))).toFixed(3)); });
        }
      });
    } else {
      projects.forEach(function (p) {
        gsap.from($$('[data-p]', p), { autoAlpha: 0, y: CONFIG.project.y, duration: 0.8, stagger: CONFIG.project.stagger, scrollTrigger: { trigger: p, start: 'top 75%', once: true } });
      });
    }

    /* --- Servicios: cascada y tarjeta activa (la que dibujan las partículas) --- */
    var services = $$('.service');
    gsap.from(services, {
      autoAlpha: 0, y: CONFIG.services.y, duration: 1, stagger: CONFIG.services.stagger, ease: 'power3.out',
      scrollTrigger: { trigger: '.services-grid', start: 'top 80%', once: true }
    });
    if (root.classList.contains('is-wide')) services.forEach(function (s) {
      ST.create({ trigger: s, start: 'top 62%', end: 'bottom 62%', toggleClass: 'is-on' });
    });

    /* --- Proceso: los pasos se activan uno a uno, a la vez que cambia la forma --- */
    if (pinMode) {
      var P = CONFIG.scenes.process;
      ST.create({
        trigger: '.process-pin', start: 'top top', end: function () { return RG.pins.process.end; },
        onUpdate: function (s) {
          steps.forEach(function (st, k) {
            var from = k ? (P[k - 1][1] + P[k][0]) / 2 : 0;
            st.classList.toggle('is-on', s.progress > 0 && s.progress >= from);
          });
        },
        onLeaveBack: function () { steps.forEach(function (st) { st.classList.remove('is-on'); }); }
      });
    } else {
      steps.forEach(function (st) {
        ST.create({ trigger: st, start: 'top 72%', onEnter: function () { st.classList.add('is-on'); }, onLeaveBack: function () { st.classList.remove('is-on'); } });
      });
    }

    /* --- Ventajas: contadores (las partículas forman el número a la vez) --- */
    var stats = $$('.stat-num');
    stats.forEach(function (n) { n.textContent = '0'; });
    ST.create({
      trigger: '.stats', start: 'top 75%', once: true,
      onEnter: function () {
        stats.forEach(function (n, k) {
          var to = parseFloat(n.dataset.count), dec = parseInt(n.dataset.decimals || '0', 10), o = { v: 0 };
          gsap.to(o, { v: to, duration: CONFIG.counter, delay: k * 0.25, ease: 'power2.out', onUpdate: function () { n.textContent = o.v.toFixed(dec).replace('.', ','); } });
        });
      }
    });

    /* --- Sobre mí: las palabras se encienden al leer --- */
    var lead = $('[data-words]');
    if (lead) {
      lead.innerHTML = lead.textContent.trim().split(/\s+/).map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
      gsap.fromTo($$('.word', lead), { opacity: 0.16 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 78%', end: 'bottom 50%', scrub: 0.4 } });
    }

    /* --- Contacto: el botón «Enviar» se enciende cuando las partículas estallan --- */
    var submit = $('.btn--submit');
    ST.create({
      trigger: submit, start: 'center 72%',
      onEnter: function () { submit.classList.add('is-lit'); setTimeout(function () { submit.classList.remove('is-lit'); }, 1400); }
    });

    /* --- Pie: «rgdevstudio» gigante que se revela --- */
    gsap.fromTo('.footer-word .fw', { yPercent: 102 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.5 } });

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
})();
