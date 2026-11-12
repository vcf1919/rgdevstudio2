/* ==========================================================================
   rgdevstudio · interacción y animaciones
   GSAP + ScrollTrigger + Lenis. Solo se animan transform y opacity.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = !!(gsap && ST) && !reduced;
  var TRAVEL = '(min-width: 1024px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)';
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lenis = null;
  var beforeJump = null; // en móvil, monta la escena de Trabajos antes de un salto para que la altura sea la final

  if (!animate) root.classList.remove('js', 'is-travel');
  window.__rgReady = true;

  var header = $('.site-header');
  var headerH = function () { return header ? header.offsetHeight : 0; };

  /* ------------------------------------------------------------------ *
   * Funciones que no dependen de las animaciones
   * ------------------------------------------------------------------ */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  function scrollToTarget(target, immediate) {
    if (beforeJump) beforeJump();
    var y = target.id === 'inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY - (target.id === 'contacto' ? 0 : headerH() - 1);
    if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: !!immediate, duration: 1.4 }); }
    else window.scrollTo({ top: y, behavior: reduced || immediate ? 'auto' : 'smooth' });
  }

  /* Menú móvil */
  var menu = $('#menu');
  var toggle = $('.menu-toggle');
  function setMenu(open) {
    if (!menu || !toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    $('.menu-toggle-label', toggle).textContent = open ? 'Cerrar' : 'Menú';
    root.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      void menu.offsetWidth;
      menu.classList.add('is-open');
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

  /* Enlaces internos */
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
  });

  /* FAQ: al abrir o cerrar cambia la altura de la página */
  $$('.faq-item').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (lenis) lenis.resize();
      if (animate) ST.refresh();
    });
  });

  /* Formulario de contacto (Web3Forms) */
  (function () {
    var form = $('.form');
    if (!form) return;
    var status = $('.form-status', form);
    var btn = $('.btn--submit', form);
    var label = $('.submit-label', form);
    var MAIL = 'rubeng.seo@gmail.com';
    var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
    var isPhone = function (v) { return v.replace(/\D/g, '').length >= 9 && /^[\d\s+().-]+$/.test(v); };

    function setError(input, msg) {
      var field = input.closest('.field');
      field.classList.toggle('has-error', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      $('.field-error', field).textContent = msg || '';
    }
    function setStatus(msg, type) {
      status.className = 'form-status' + (type ? ' is-' + type : '');
      status.innerHTML = msg;
    }
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
    ['nombre', 'contacto'].forEach(function (n) {
      form.elements[n].addEventListener('input', function () { setError(form.elements[n], ''); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var data = new FormData(form);
      var contact = String(data.get('contacto')).trim();
      if (isEmail(contact)) data.append('email', contact); // así puedes darle a "Responder" en tu correo
      var key = String(data.get('access_key') || '');

      // Mientras no haya clave configurada, abrimos el correo del visitante con el mensaje ya escrito
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
          form.reset();
          setStatus('¡Mensaje enviado! Te respondo en menos de 24 horas.', 'ok');
        })
        .catch(function () {
          setStatus('No se ha podido enviar. Escríbeme a <a href="mailto:' + MAIL + '">' + MAIL + '</a>.', 'error');
        })
        .then(function () { btn.disabled = false; label.textContent = 'Enviar'; });
    });
  })();

  /* Texto que se desplaza en botones y enlaces (duplicado solo visual) */
  $$('[data-roll]').forEach(function (el) {
    var text = el.textContent;
    el.textContent = '';
    var wrap = document.createElement('span'); wrap.className = 'roll';
    var a = document.createElement('span'); a.textContent = text;
    var b = document.createElement('span'); b.textContent = text; b.setAttribute('aria-hidden', 'true');
    wrap.appendChild(a); wrap.appendChild(b); el.appendChild(wrap);
  });

  /* Cabecera: fondo al bajar, se esconde al hacer scroll hacia abajo */
  (function () {
    var last = window.scrollY;
    function onScroll() {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 24);
      if (Math.abs(y - last) > 6) {
        header.classList.toggle('is-hidden', y > last && y > 240 && !root.classList.contains('menu-open'));
        last = y;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  if (!animate) return;

  /* ------------------------------------------------------------------ *
   * Animaciones
   * ------------------------------------------------------------------ */
  gsap.registerPlugin(ST);
  gsap.defaults({ ease: 'power3.out', duration: 1 });
  ST.config({ ignoreMobileResize: true });

  /* Scroll suave */
  // Posición de scroll guardada al moverse: leer window.scrollY en cada fotograma obliga a recalcular la maquetación
  var scrollPos = window.scrollY;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', function (l) { scrollPos = l.animatedScroll; ST.update(); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', function () { scrollPos = window.scrollY; }, { passive: true });
  }

  /* --- Partir un titular en líneas con máscara --- */
  function splitLines(el) {
    var original = el.innerHTML;
    var words = [], cur = null, needNew = true;
    function push(text, tag) {
      text.split(/(\s+)/).forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) { needNew = true; return; }
        if (needNew || !cur) { cur = document.createElement('span'); cur.style.display = 'inline-block'; words.push(cur); needNew = false; }
        if (tag) { var t = document.createElement(tag); t.textContent = piece; cur.appendChild(t); }
        else cur.appendChild(document.createTextNode(piece));
      });
    }
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) push(n.textContent, null);
      else if (n.nodeType === 1) push(n.textContent, n.tagName.toLowerCase());
    });
    el.innerHTML = '';
    words.forEach(function (w, i) { if (i) el.appendChild(document.createTextNode(' ')); el.appendChild(w); });
    var lines = [], top = null;
    words.forEach(function (w) {
      var t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w.innerHTML);
    });
    el.innerHTML = lines.map(function (l) {
      return '<span class="line"><span class="line-in">' + l.join(' ') + '</span></span>';
    }).join('');
    return { lines: $$('.line-in', el), revert: function () { el.innerHTML = original; } };
  }

  /* Titular: las líneas suben con máscara y la cursiva se "escribe" letra a letra */
  function revealTitle(el, opts) {
    var o = opts || {};
    var s = splitLines(el);
    var chars = [];
    $$('em', el).forEach(function (em) {
      em.innerHTML = em.textContent.split('').map(function (c) { return '<span class="ch">' + c + '</span>'; }).join('');
      chars = chars.concat($$('.ch', em));
    });
    gsap.set(el, { opacity: 1 });
    var tl = gsap.timeline({ delay: o.delay || 0, onComplete: s.revert });
    tl.from(s.lines, { yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: o.stagger || 0.1 });
    if (chars.length) {
      tl.from(chars, { opacity: 0, yPercent: 55, rotate: 16, x: -8, duration: 0.75, ease: 'back.out(2.2)', stagger: 0.045 }, 0.3);
    }
    return tl;
  }

  /* ==========================================================================
     Escenas: «lluvia de pedidos» (inicio) y «tu web se construye» (Trabajos)
     Todo se anima con transform y opacity sobre elementos pequeños.
     ========================================================================== */
  var fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })])
    : Promise.resolve();

  /* --- El móvil 3D: cuerpo, trasera y las pantallas de los tres proyectos --- */
  function buildStagePhone() {
    var phone = document.createElement('div');
    phone.className = 'phone';
    var body = '<div class="phone-body">';
    [-0.6, 0, 0.6].forEach(function (z) { body += '<i style="transform:translateZ(' + z + 'em)"></i>'; }); // grosor con 3 capas
    body += '</div>';
    phone.innerHTML = body +
      '<div class="phone-back"><span class="camera"><i></i><i></i><i></i></span><span class="back-mono">rg</span></div>' +
      '<div class="phone-front"><div class="phone-screen"></div><span class="island"></span><span class="gloss"></span></div>';
    var screen = $('.phone-screen', phone);
    $$('.project .screen').forEach(function (s) { screen.appendChild(s.cloneNode(true)); });
    return phone;
  }

  /* Posición de un elemento dentro de un antecesor (valores de maquetación: no les afectan los giros) */
  function offsetIn(el, ancestor) {
    var x = 0, y = 0, n = el;
    while (n && n !== ancestor) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function fmtEuros(v) {
    var s = String(Math.round(v));
    return s.length > 3 ? s.slice(0, -3) + '.' + s.slice(-3) : s;
  }

  var TINTS = ['#F2D9DD', '#E7D5BD', '#D6D9CC'];
  var TAP_BTN = ['.fl-btn', '.mc-btn', '.mn-btn'];
  // Notificaciones de un negocio genérico (ilustración, no son datos de clientes reales)
  var RAIN_ITEMS = [
    ['Nuevo pedido', '2 productos · envío hoy · 64,00 €'],
    ['Reserva confirmada', 'Mesa para 4 · sábado 10:00'],
    ['Pago recibido', 'Pedido #1043 · 129,00 €'],
    ['Nuevo mensaje', '¿Hacéis envíos esta tarde?'],
    ['Nuevo pedido', '3 productos · recogida en tienda'],
    ['Reseña de 5 estrellas', '«Precioso, y llegó rapidísimo»'],
    ['Pago recibido', 'Pedido #1044 · 48,00 €']
  ];
  // Hacia dónde salta cada notificación: fracción del ancho y alto desde el centro, y giro
  var SCATTER = [[-0.3, -0.3, -9], [0.3, -0.19, 8], [-0.33, 0.02, 6], [0.32, 0.1, -7], [-0.25, 0.29, -5], [0.27, 0.34, 9], [0.03, -0.4, 4]];

  /* --- Lluvia de pedidos: las notificaciones se apilan en el móvil y luego llenan la página --- */
  function buildRain(box, G) {
    box.className = 'rain-wrap';
    var html = '<div class="rain-total"><p class="rain-kicker">Un buen día con tu web</p><p class="rain-num"><span>0</span> <em>€</em></p></div>';
    RAIN_ITEMS.forEach(function () {
      html += '<div class="notif"><i class="notif-ico">rg</i><div class="notif-txt"><b></b><span></span></div><small>ahora</small></div>';
    });
    box.innerHTML = html;
    var cards = $$('.notif', box), total = $('.rain-total', box), num = $('.rain-num span', box);
    cards.forEach(function (c, k) {
      $('b', c).textContent = RAIN_ITEMS[k][0];
      $('.notif-txt span', c).textContent = RAIN_ITEMS[k][1];
    });

    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    var cw = function () { return G.card ? G.card().w : cards[0].offsetWidth; };
    var ch = function () { return G.card ? G.card().h : cards[0].offsetHeight; };
    var ax = function () { return G.anchor().x - cw() / 2; };
    var ay = function () { var a = G.anchor(); return a.y - a.u * 25; };
    var step = function () { return ch() + G.anchor().u * 0.9; };

    // 1) Llegan una a una a la pantalla del móvil y empujan a las anteriores
    cards.forEach(function (c, k) {
      var t = k * 0.28;
      tl.fromTo(c, { x: ax, y: function () { return ay() - 30; }, autoAlpha: 0, scale: 0.9, rotate: 0 },
        { y: ay, autoAlpha: 1, scale: 1, duration: 0.32, ease: 'back.out(1.7)', immediateRender: false }, t);
      cards.slice(0, k).forEach(function (prev, j) {
        tl.to(prev, { y: function () { return ay() + (k - j) * step(); }, duration: 0.3 }, t);
      });
    });

    // 2) El contador de ventas sube
    var B = cards.length * 0.28 + 0.35;
    var TA = G.totalAt || 0.5;
    var sum = { v: 0 };
    // Tamaño del contador medido una vez por recálculo (tiene ancho fijo, así no se mueve al crecer la cifra)
    var tsz = null;
    var TS = function () { if (!tsz) tsz = { w: total.offsetWidth, h: total.offsetHeight }; return tsz; };
    ST.addEventListener('refreshInit', function () { tsz = null; });
    var tx = function () { return G.total().x - TS().w / 2; };
    var ty = function () { return G.total().y - TS().h / 2; };
    tl.fromTo(total, { x: tx, y: function () { return ty() + 24; }, autoAlpha: 0 },
      { y: ty, autoAlpha: 1, duration: 0.4, immediateRender: false }, TA)
      .to(sum, { v: 1284, duration: Math.min(2.4, B + 1.4 - TA), ease: 'power1.inOut', onUpdate: function () { num.textContent = fmtEuros(sum.v); } }, TA);

    // 3) Las notificaciones saltan fuera del móvil y se reparten por la página; después se van
    cards.forEach(function (c, k) {
      var s = (G.scatter || SCATTER)[k];
      var px = function () { var z = G.size(); return z.w / 2 + s[0] * z.w * G.spread - cw() / 2; };
      var py = function () { var z = G.size(); return z.h / 2 + s[1] * z.h - ch() / 2; };
      tl.to(c, { x: px, y: py, rotate: s[2], scale: 1.06, duration: 0.8, ease: 'power3.out' }, B + k * 0.035)
        .to(c, { y: function () { return py() - G.size().h * 0.3; }, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, B + 1.3 + k * 0.03);
    });
    tl.to(total, { y: function () { return ty() - 30; }, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, B + 1.5);
    return tl;
  }

  /* --- «Tu web se construye»: boceto gris encima de cada pantalla --- */
  function buildWire(screen) {
    var scroller = $('.screen-scroll', screen);
    var wire = document.createElement('div');
    wire.className = 'wire';
    var paper = document.createElement('i');
    paper.className = 'wire-paper';
    wire.appendChild(paper);
    var blocks = [], boxes = [];
    Array.prototype.forEach.call(scroller.children, function (el) {
      if (typeof el.offsetTop !== 'number') return; // los SVG sueltos aparecen con el color
      var b = document.createElement('i');
      b.className = 'wire-box';
      wire.appendChild(b);
      blocks.push(el); boxes.push(b);
    });
    screen.appendChild(wire);
    var W = {
      blocks: blocks, boxes: boxes, paper: paper,
      place: function () {
        var Wd = screen.offsetWidth, H = screen.offsetHeight;
        if (!Wd || !H) return;
        blocks.forEach(function (el, i) {
          var b = boxes[i], top = el.offsetTop, h = Math.min(el.offsetHeight, H - top);
          b.style.display = top < H * 0.95 && h > 4 ? '' : 'none';
          b.style.left = (el.offsetLeft / Wd * 100) + '%';
          b.style.top = (top / H * 100) + '%';
          b.style.width = (el.offsetWidth / Wd * 100) + '%';
          b.style.height = (Math.max(h, 0) / H * 100) + '%';
        });
      }
    };
    W.place();
    gsap.set(boxes, { scaleX: 0 });
    gsap.set(blocks, { opacity: 0, y: 26, scale: 0.94 });
    return W;
  }

  /* --- Objetos de cada cliente que salen de la pantalla --- */
  function objSVG(type) {
    if (type === 'flor') return '<svg viewBox="0 0 240 240" aria-hidden="true">' +
      '<g fill="none" stroke="#5E7A55" stroke-width="5" stroke-linecap="round">' +
      '<path class="o-stem" d="M120 236 C112 196 92 160 66 128"/><path class="o-stem" d="M120 236 C120 186 120 140 120 92"/><path class="o-stem" d="M120 236 C128 196 150 162 176 132"/></g>' +
      '<path class="o-leaf" d="M118 214 C92 204 76 184 76 160 C100 170 114 190 118 214Z" fill="#6E9A63"/>' +
      '<path class="o-leaf" d="M122 200 C148 190 164 170 164 146 C140 156 126 176 122 200Z" fill="#6E9A63"/>' +
      '<path class="o-head" d="M66 132 C42 124 36 88 44 72 L55 88 L66 64 L77 88 L88 72 C96 88 90 124 66 132Z" fill="#E2486B"/>' +
      '<path class="o-head" d="M120 96 C96 88 90 52 98 36 L109 52 L120 28 L131 52 L142 36 C150 52 144 88 120 96Z" fill="#F2B33D"/>' +
      '<path class="o-head" d="M176 136 C152 128 146 92 154 76 L165 92 L176 68 L187 92 L198 76 C206 92 200 128 176 136Z" fill="#9A5BC9"/></svg>';
    if (type === 'cafe') return '<svg viewBox="0 0 240 240" aria-hidden="true">' +
      '<g class="o-steam" fill="none" stroke="#8A5A3C" stroke-width="6" stroke-linecap="round">' +
      '<path d="M94 100 C80 82 108 70 94 48"/><path d="M120 94 C106 74 136 62 120 36"/><path d="M146 100 C132 82 160 70 146 48"/></g>' +
      '<ellipse cx="120" cy="206" rx="92" ry="15" fill="#D9C7AA"/>' +
      '<path d="M56 124 C58 176 86 200 120 200 C154 200 182 176 184 124 Z" fill="#FBF7F0" stroke="#24150F" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M182 138 C218 134 218 180 176 176" fill="none" stroke="#24150F" stroke-width="5" stroke-linecap="round"/>' +
      '<ellipse cx="120" cy="124" rx="64" ry="14" fill="#6B3B22" stroke="#24150F" stroke-width="5"/></svg>';
    return '<svg viewBox="0 0 240 240" aria-hidden="true"><g class="o-swing">' +
      '<path d="M120 12 C134 12 136 30 124 34 L120 40" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M120 40 L36 82 L204 82 Z" fill="none" stroke="#141414" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M80 78 L120 104 L160 78 L198 104 L186 158 L168 152 L168 236 L72 236 L72 152 L54 158 L42 104 Z" fill="#B49673"/>' +
      '<path d="M120 104 L104 146 L120 236 M120 104 L136 146 L120 236" fill="none" stroke="#8F7352" stroke-width="4" stroke-linejoin="round"/>' +
      '<circle cx="129" cy="170" r="4.5" fill="#5F4A33"/><circle cx="129" cy="200" r="4.5" fill="#5F4A33"/></g></svg>';
  }
  function buildFx(box, types) {
    var objs = types.map(function (t) {
      var d = document.createElement('div');
      d.className = 'obj obj--' + t;
      d.innerHTML = objSVG(t);
      box.appendChild(d);
      if (t === 'flor') {
        gsap.set($$('.o-stem', d), { scaleY: 0, transformOrigin: '50% 100%' });
        gsap.set($$('.o-leaf', d), { scale: 0, transformOrigin: '50% 100%' });
        gsap.set($$('.o-head', d), { scale: 0, transformOrigin: '50% 100%' });
      } else if (t === 'cafe') {
        gsap.set($$('.o-steam path', d), { opacity: 0, y: 12 });
      } else {
        gsap.set($('.o-swing', d), { rotate: -26, svgOrigin: '120 12' });
      }
      return d;
    });
    var mk = function (c) { var d = document.createElement('div'); d.className = c; box.appendChild(d); return d; };
    return { objs: objs, finger: mk('tap-finger'), ripple: mk('tap-ripple'), flood: mk('flood') };
  }
  function addObjectMotion(tl, d, t, T) {
    if (t === 'flor') {
      tl.to($$('.o-stem', d), { scaleY: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out' }, T)
        .to($$('.o-leaf', d), { scale: 1, duration: 0.35, stagger: 0.06, ease: 'back.out(2)' }, T + 0.2)
        .to($$('.o-head', d), { scale: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(2.4)' }, T + 0.3)
        .to($$('.o-head', d), { rotate: 7, duration: 0.35, stagger: 0.05, ease: 'sine.inOut' }, T + 0.8);
    } else if (t === 'cafe') {
      var steam = $$('.o-steam path', d);
      tl.to(steam, { opacity: 0.9, y: -16, duration: 0.4, stagger: 0.12, ease: 'sine.out' }, T)
        .to(steam, { opacity: 0, y: -48, duration: 0.45, stagger: 0.12, ease: 'sine.in' }, T + 0.45);
    } else {
      var sw = $('.o-swing', d);
      tl.to(sw, { rotate: 16, duration: 0.35, ease: 'sine.inOut' }, T)
        .to(sw, { rotate: -9, duration: 0.3, ease: 'sine.inOut' }, T + 0.35)
        .to(sw, { rotate: 4, duration: 0.25, ease: 'sine.inOut' }, T + 0.65)
        .to(sw, { rotate: 0, duration: 0.2, ease: 'sine.out' }, T + 0.9);
    }
  }

  /* --- La historia de cada proyecto: boceto → web, objeto, toque que tiñe → siguiente --- */
  function addStory(S) {
    var tl = S.tl, N = S.screens.length;
    function tapAt(i) {
      var btn = $(TAP_BTN[i], S.screens[i]);
      var c = S.center(), u = S.unit(), o = offsetIn(btn, S.screens[i]);
      return { x: c.x - 14 * u + o.x + o.w / 2, y: c.y - 30 * u + o.y + o.h / 2 };
    }
    function coverAt(i) {
      var t = tapAt(i), z = S.scene();
      var R = Math.max(Math.hypot(t.x, t.y), Math.hypot(z.w - t.x, t.y), Math.hypot(t.x, z.h - t.y), Math.hypot(z.w - t.x, z.h - t.y));
      return R * 2 / 20 * 1.06;
    }
    S.screens.forEach(function (screen, i) {
      var W = S.wires[i], n = W.blocks.length, T = tl.duration();

      // 1) Boceto → web: se dibujan las cajas, entra el color y cada bloque cae en su sitio
      tl.to(W.boxes, { scaleX: 1, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, T)
        .to(S.wob, { ry: 0, rx: 0, duration: 1.6, ease: 'power1.inOut' }, T)
        .to(W.paper, { opacity: 0, duration: 0.35, ease: 'none' }, T + 0.55)
        .to(W.blocks, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.8)' }, T + 0.8)
        .to(W.boxes, { opacity: 0, duration: 0.25, stagger: 0.1 }, T + 0.8);
      T += 0.8 + 0.1 * (n - 1) + 0.55;

      // 2) El objeto del cliente sale de la pantalla
      var obj = S.objs[i];
      tl.fromTo(obj, { autoAlpha: 0, scale: 0.15, y: 0, rotate: -14 },
        { autoAlpha: 1, scale: 1, y: function () { return -S.unit() * 8; }, rotate: 0, duration: 0.6, ease: 'back.out(1.5)', immediateRender: false }, T)
        .to(S.wob, { ry: 14, rx: -6, duration: 0.55 }, T);
      addObjectMotion(tl, obj, S.types[i], T + 0.25);
      tl.to(obj, { autoAlpha: 0, scale: 1.35, y: function () { return -S.unit() * 16; }, duration: 0.45, ease: 'power2.in' }, T + 1.4)
        .to(S.wob, { ry: 0, rx: 0, duration: 0.45 }, T + 1.4);
      T += 1.9;

      // 3) Un dedo pulsa el botón y el color del siguiente cliente inunda la escena
      if (i < N - 1) {
        var btn = $(TAP_BTN[i], screen);
        var tx = function () { return tapAt(i).x; }, ty = function () { return tapAt(i).y; };
        tl.fromTo(S.finger,
          { x: function () { return tx() + S.unit() * 14; }, y: function () { return ty() + S.unit() * 24; }, autoAlpha: 0, scale: 1 },
          { x: tx, y: ty, autoAlpha: 1, duration: 0.5, ease: 'power2.out', immediateRender: false }, T)
          .to(S.finger, { scale: 0.75, duration: 0.12 }, T + 0.5)
          .to(btn, { scale: 0.9, duration: 0.12 }, T + 0.5)
          .to(S.finger, { scale: 1, duration: 0.15 }, T + 0.62)
          .to(btn, { scale: 1, duration: 0.15 }, T + 0.62)
          .fromTo(S.ripple, { x: tx, y: ty, scale: 0.3, autoAlpha: 0.9 },
            { scale: 3, autoAlpha: 0, duration: 0.45, immediateRender: false }, T + 0.55)
          .set(S.flood, { backgroundColor: TINTS[i + 1] }, T)
          .fromTo(S.flood, { x: tx, y: ty, scale: 0, autoAlpha: 1 },
            { scale: function () { return coverAt(i); }, duration: 0.7, ease: 'power2.in', immediateRender: false }, T + 0.62)
          .to(S.finger, { autoAlpha: 0, duration: 0.2 }, T + 0.75);
        S.swap(tl, i, T + 1.34);
        tl.to(S.flood, { autoAlpha: 0, duration: 0.45, ease: 'none' }, T + 1.4);
        S.reveal(tl, i + 1, T + 1.45);
        tl.to({}, { duration: 0.05 }, T + 1.85);
      }
    });
  }

  var mm = gsap.matchMedia();
  var introDone = false;

  /* ============ ESCRITORIO: lluvia de pedidos en el inicio y el móvil viaja a Trabajos ============ */
  mm.add(TRAVEL, function () {
    root.classList.add('is-travel');
    var stage = $('.stage');
    var heroSlot = $('.hero-slot'), worksSlot = $('.works-slot'), pin = $('.works-pin');
    var phone = buildStagePhone();
    var shadow = document.createElement('div'); shadow.className = 'phone-shadow';
    stage.appendChild(shadow); stage.appendChild(phone);
    var screens = $$('.screen', phone);
    // Copia acabada de la primera web para el inicio; se cambia por el boceto mientras el móvil gira
    var heroScreen = screens[0].cloneNode(true);
    heroScreen.classList.add('is-live');
    $('.phone-screen', phone).appendChild(heroScreen);
    var wires = screens.map(buildWire);
    var projects = $$('.project');
    var types = projects.map(function (p) { return p.dataset.project; });
    var fx = buildFx(stage, types);
    var rainBox = document.createElement('div');
    stage.appendChild(rainBox);
    var tints = $$('.works-tint');
    var bar = $('.works-progress i');
    var parts = function (i) { return $$('[data-p]', projects[i]); };

    var wob = { ry: -20, rx: 10 };
    var intro = { y: introDone ? 0 : 140, o: introDone ? 1 : 0, ry: introDone ? 0 : 40 };
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    var geo = { hx: 0, hy: 0, wx: 0, wy: 0, A: 1, B: 2, R: 0, vh: window.innerHeight, vw: window.innerWidth, u: 10 };
    var pinST = null, rainST = null;

    function measure() {
      // Posición del móvil en el inicio con valores de maquetación (no cambia aunque el inicio esté fijado)
      var h = offsetIn(heroSlot, null);
      var p = pin.getBoundingClientRect();
      var w = worksSlot.getBoundingClientRect();
      geo.hx = h.x + h.w / 2; geo.hy = h.y + h.h / 2;
      geo.wx = w.left + w.width / 2; geo.wy = w.top - p.top + w.height / 2;
      geo.vh = window.innerHeight; geo.vw = window.innerWidth; geo.u = w.height / 62 || geo.u;
      if (pinST) { geo.A = Math.max(1, pinST.start); geo.B = pinST.end; }
      geo.R = rainST ? rainST.end : 0;
      rainBox.style.fontSize = geo.u + 'px';
      fx.objs.forEach(function (o) {
        o.style.left = geo.wx + 'px'; o.style.top = geo.wy + 'px';
        o.style.setProperty('--ow', Math.round(geo.u * 46) + 'px');
      });
      wires.forEach(function (W) { W.place(); });
      return geo;
    }

    projects.forEach(function (p, i) { gsap.set(p, { autoAlpha: i ? 0 : 1 }); });
    screens.forEach(function (s, i) { gsap.set(s, { autoAlpha: i ? 0 : 1 }); });

    // Lluvia de pedidos: el inicio se queda fijo, el texto se aparta y el contador ocupa su sitio
    var G = {
      spread: 1,
      totalAt: 1.5,
      // En escritorio las notificaciones se reparten por arriba, abajo y a la derecha, sin tapar el contador
      scatter: [[-0.32, -0.34, -9], [0.04, -0.37, 8], [-0.36, 0.33, 6], [0.0, 0.35, -7], [0.13, -0.04, -5], [0.37, -0.33, 9], [0.38, 0.31, 4]],
      anchor: function () { measure(); return { x: geo.hx, y: geo.hy, u: geo.u }; },
      size: function () { return { w: window.innerWidth, h: window.innerHeight }; },
      total: function () { return { x: window.innerWidth * 0.3, y: window.innerHeight * 0.5 }; }
    };
    var rainTl = buildRain(rainBox, G);
    rainTl.to('.hero-text', { autoAlpha: 0, y: -50, duration: 0.5, ease: 'power2.in' }, 1.0);
    rainST = ST.create({
      trigger: '.hero', start: 'top top', end: '+=150%', pin: true, scrub: 0.6,
      animation: rainTl, invalidateOnRefresh: true
    });

    var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    tl.to({}, { duration: 0.2 });
    addStory({
      tl: tl, screens: screens, wires: wires, objs: fx.objs, finger: fx.finger, ripple: fx.ripple, flood: fx.flood,
      wob: wob, types: types,
      unit: function () { return measure().u; },
      center: function () { measure(); return { x: geo.wx, y: geo.wy }; },
      scene: function () { return { w: window.innerWidth, h: window.innerHeight }; },
      swap: function (t, i, at) {
        t.set(screens[i], { autoAlpha: 0 }, at).set(screens[i + 1], { autoAlpha: 1 }, at)
          .set(tints[i], { opacity: 1 }, at)
          .set(projects[i], { autoAlpha: 0 }, at).set(projects[i + 1], { autoAlpha: 1 }, at)
          .set(wob, { ry: -20, rx: 10 }, at);
      },
      reveal: function (t, i, at) {
        t.fromTo(parts(i), { y: 44, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.04, duration: 0.45, ease: 'power2.out', immediateRender: false }, at);
      }
    });
    tl.to({}, { duration: 0.4 });
    tl.to(bar, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);

    pinST = ST.create({
      trigger: pin, start: 'top top', end: '+=650%', pin: true, scrub: 0.5,
      animation: tl, anticipatePin: 1, invalidateOnRefresh: true
    });

    ST.addEventListener('refresh', measure);
    measure();

    function onMove(e) {
      ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (finePointer) window.addEventListener('pointermove', onMove, { passive: true });

    var ease = gsap.parseEase('power2.inOut');
    var visible = true, heroHidden = false;
    function tick(time) {
      var s = scrollPos;
      var gone = s > geo.B + geo.vh * 1.1;
      if (gone !== !visible) {
        visible = !gone;
        phone.style.visibility = shadow.style.visibility = visible ? 'visible' : 'hidden';
      }
      if (!visible) return;
      // El móvil se queda en el inicio durante la lluvia y luego viaja girando hasta Trabajos
      var e = ease(clamp((s - geo.R) / Math.max(1, geo.A - geo.R), 0, 1)), free = 1 - e;
      if (heroHidden !== (e > 0.5)) {
        heroHidden = e > 0.5; // a mitad del giro (se ve la trasera) se cambia la web acabada por el boceto
        heroScreen.style.visibility = heroHidden ? 'hidden' : '';
        heroScreen.classList.toggle('is-live', !heroHidden);
      }
      ptr.x += (ptr.tx - ptr.x) * 0.07; ptr.y += (ptr.ty - ptr.y) * 0.07;
      var x = lerp(geo.hx, geo.wx, e) + ptr.x * 14 * free;
      var y = lerp(geo.hy, geo.wy, e) + Math.sin(time * 0.9) * 8 * free + intro.y;
      if (s > geo.B) y -= s - geo.B;
      var sc = lerp(1.08, 1, e);
      var ry = lerp(-26, -360, e) + ptr.x * 12 * free + wob.ry * e + intro.ry;
      var rx = lerp(9, 0, e) - ptr.y * 9 * free + wob.rx * e;
      var rz = lerp(3, 0, e);
      // Canto y trasera solo mientras el móvil está girado (de frente no se ven y cuestan fotogramas)
      var flat = Math.cos(ry * Math.PI / 180) > 0.75;
      if (flat !== phone._flat) { phone._flat = flat; phone.classList.toggle('is-flat', flat); }
      phone.style.opacity = intro.o;
      phone.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) perspective(1500px) rotateX(' + rx.toFixed(2) +
        'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
      var squash = 0.45 + 0.55 * Math.abs(Math.cos(ry * Math.PI / 180));
      shadow.style.opacity = intro.o * 0.9;
      shadow.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + (y + geo.u * 33.5 * sc).toFixed(2) + 'px,0) scaleX(' + squash.toFixed(3) + ')';
    }
    gsap.ticker.add(tick);

    var introTween = introDone ? null : gsap.to(intro, { y: 0, o: 1, ry: 0, duration: 1.6, ease: 'expo.out', delay: 0.35 });

    return function () {
      if (introTween) introTween.kill();
      gsap.ticker.remove(tick);
      ST.removeEventListener('refresh', measure);
      window.removeEventListener('pointermove', onMove);
      stage.innerHTML = '';
      root.classList.remove('is-travel');
      gsap.set(projects.concat($$('[data-p]'), [$('.hero-text')]), { clearProps: 'all' });
      gsap.set(tints.concat([bar]), { clearProps: 'all' });
    };
  });

  /* ============ MÓVIL / TABLET ============
     Inicio: el móvil asoma inclinado y, al bajar, se queda fijo mientras llueven los pedidos.
     Trabajos: escena fijada a pantalla completa con la misma historia (se monta al acercarse). */
  mm.add('not all and ' + TRAVEL, function (context) {
    root.classList.add('has-reel');
    var slot = $('.hero-slot');
    var visual = $('.hero-visual');
    var heroPhone = $('.project .phone').cloneNode(true);
    heroPhone.removeAttribute('role'); heroPhone.removeAttribute('aria-label');
    slot.appendChild(heroPhone);

    if (!introDone) {
      gsap.fromTo(heroPhone,
        { rotateY: -80, rotateX: 18, y: 160, autoAlpha: 0 },
        { rotateY: 0, rotateX: 0, y: 0, autoAlpha: 1, duration: 1.8, ease: 'expo.out', delay: 0.35 });
    }

    // Lluvia de pedidos con el móvil fijo en el centro
    var rainBox = document.createElement('div');
    visual.appendChild(rainBox);
    // Medidas guardadas: se leen una vez por recálculo, no en cada posición
    var gc = { w: 390, h: 844, u: 9, cw: 243, ch: 56, total: null };
    var G = {
      spread: 1,
      anchor: function () { return { x: gc.w / 2, y: gc.h / 2, u: gc.u }; },
      size: function () { return { w: gc.w, h: gc.h }; },
      card: function () { return { w: gc.cw, h: gc.ch }; },
      total: function () {
        var bottom = gc.h / 2 + 31 * gc.u;
        return { x: gc.w / 2, y: bottom + (gc.h - bottom) / 2 };
      }
    };
    var rainTl = buildRain(rainBox, G);
    var firstCard = $('.notif', rainBox);
    var cacheG = function () {
      gc.u = parseFloat(getComputedStyle(heroPhone).fontSize) || 9;
      rainBox.style.fontSize = gc.u + 'px';
      gc.w = rainBox.offsetWidth; gc.h = rainBox.offsetHeight;
      gc.cw = firstCard.offsetWidth; gc.ch = firstCard.offsetHeight;
    };
    ST.addEventListener('refreshInit', cacheG);
    rainTl.fromTo(slot, { rotateY: -22, rotateX: 14, rotateZ: 4 }, { rotateY: 0, rotateX: 0, rotateZ: 0, duration: 0.6, ease: 'power1.out' }, 0);

    // Lo que obliga a medir la página se prepara en tareas pequeñas aparte, para no bloquear la carga
    var alive = true;
    var later = function (fn) { setTimeout(function () { if (alive) context.add(fn); }, 0); };
    later(function () {
      cacheG();
      ST.create({
        trigger: visual, start: 'center center', end: '+=170%', pin: true, scrub: 0.6,
        animation: rainTl, invalidateOnRefresh: true
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-live', en.isIntersecting); });
    }, { threshold: 0.2 });
    io.observe(heroPhone);

    later(function () {
      $$('.project').forEach(function (p) {
        gsap.from($$('[data-p]', p), { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.06, scrollTrigger: { trigger: p, start: 'top 82%', once: true } });
      });
    });

    /* --- Escena de Trabajos --- */
    var works = $('.works'), pinWrap = $('.works-pin');
    var projects = $$('.project');
    var types = projects.map(function (p) { return p.dataset.project; });
    var names = projects.map(function (p) { return $('.project-name', p).textContent; });
    var tagLines = projects.map(function (p) { return $$('.project-tags span', p).map(function (s) { return s.textContent; }).join(' · '); });
    var N = projects.length;
    var reel = document.createElement('div');
    reel.className = 'reel';
    reel.setAttribute('aria-hidden', 'true'); // el contenido real está en las tarjetas de debajo
    reel.innerHTML =
      '<i class="reel-tint reel-tint--cafe"></i><i class="reel-tint reel-tint--moda"></i>' +
      '<p class="reel-count"><span class="reel-count-mask"><span class="reel-count-inner">' +
        names.map(function (_, i) { return '<span>0' + (i + 1) + '</span>'; }).join('') +
      '</span></span><span>/ 0' + N + '</span></p>' +
      '<p class="reel-kicker">Trabajos</p>' +
      '<div class="reel-shadow"></div><div class="reel-stage"></div>' +
      '<div class="reel-caption">' + names.map(function () {
        return '<div class="reel-item"><p class="reel-name"><span></span></p><p class="reel-tags"><span></span></p></div>';
      }).join('') + '</div>' +
      '<div class="reel-progress"><i></i></div>';
    $$('.reel-item', reel).forEach(function (it, i) {
      $('.reel-name span', it).textContent = names[i];
      $('.reel-tags span', it).textContent = tagLines[i];
    });
    works.insertBefore(reel, pinWrap);

    var wires = [];
    var placeAll = function () { wires.forEach(function (W) { W.place(); }); };
    ST.addEventListener('refresh', placeAll);

    var built = false;
    beforeJump = function () { if (!built) context.add(buildReel); };
    later(function () {
      ST.create({
        trigger: reel, start: function () { return 'top bottom+=' + Math.round(window.innerHeight); }, end: 'max', once: true,
        onEnter: function () { requestAnimationFrame(function () { if (alive) context.add(buildReel); }); }
      });
    });

    function buildReel() {
      if (built || !reel.isConnected) return;
      built = true;
      var phone = buildStagePhone();
      phone.classList.add('is-flat'); // en esta escena el móvil nunca se gira lo bastante para verle el canto
      $('.reel-stage', reel).appendChild(phone);
      var screens = $$('.screen', phone);
      wires = screens.map(buildWire);
      var fx = buildFx(reel, types);
      var tints = $$('.reel-tint', reel);
      var items = $$('.reel-item', reel);
      var countInner = $('.reel-count-inner', reel);
      var bar = $('.reel-progress i', reel);
      var ru = function () { return parseFloat(getComputedStyle(phone).fontSize); };
      var wob = { ry: -20, rx: 10 };
      var applyWob = function () { phone.style.transform = 'rotateY(' + wob.ry.toFixed(2) + 'deg) rotateX(' + wob.rx.toFixed(2) + 'deg)'; };

      screens.forEach(function (s, i) { gsap.set(s, { autoAlpha: i ? 0 : 1 }); });
      items.forEach(function (it, i) { if (i) gsap.set($$('span', it), { yPercent: 140 }); });
      applyWob();

      var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onUpdate: applyWob });
      tl.to({}, { duration: 0.15 });
      addStory({
        tl: tl, screens: screens, wires: wires, objs: fx.objs, finger: fx.finger, ripple: fx.ripple, flood: fx.flood,
        wob: wob, types: types,
        unit: ru,
        center: function () { return { x: reel.offsetWidth / 2, y: reel.offsetHeight * 0.45 }; },
        scene: function () { return { w: reel.offsetWidth, h: reel.offsetHeight }; },
        swap: function (t, i, at) {
          t.set(screens[i], { autoAlpha: 0 }, at).set(screens[i + 1], { autoAlpha: 1 }, at)
            .set(tints[i], { opacity: 1 }, at)
            .set($$('span', items[i]), { yPercent: -140 }, at)
            .set(countInner, { yPercent: -100 * (i + 1) / N }, at)
            .set(wob, { ry: -20, rx: 10 }, at);
        },
        reveal: function (t, i, at) {
          t.fromTo($$('span', items[i]), { yPercent: 140 }, { yPercent: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out', immediateRender: false }, at);
        }
      });
      tl.to({}, { duration: 0.3 });
      tl.to(bar, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);

      ST.create({
        trigger: reel, start: 'top top', end: '+=560%', pin: true, scrub: 0.5,
        animation: tl, anticipatePin: 1, invalidateOnRefresh: true
      });
      ST.refresh();
    }

    return function () {
      alive = false;
      io.disconnect();
      ST.removeEventListener('refresh', placeAll);
      ST.removeEventListener('refreshInit', cacheG);
      heroPhone.remove();
      rainBox.remove();
      var spacer = reel.parentNode && reel.parentNode.classList.contains('pin-spacer') ? reel.parentNode : null;
      reel.remove();
      if (spacer) spacer.remove();
      root.classList.remove('has-reel');
      beforeJump = null;
      gsap.set($$('[data-p]').concat([slot]), { clearProps: 'all' });
    };
  });

  /* --- Hero: titular línea a línea --- */
  fontsReady.then(function () {
    var h1 = $('[data-split="hero"]');
    revealTitle(h1, { delay: 0, stagger: 0.11 });
    gsap.to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, delay: 0.5, clearProps: 'transform' });
    gsap.from('.site-header', { yPercent: -100, duration: 1, delay: 0.1, clearProps: 'transform' });
    introDone = true;

    /* Titulares de sección */
    $$('[data-split]:not([data-split="hero"])').forEach(function (el) {
      ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { revealTitle(el); } });
    });
    ST.refresh();

    // Enlace directo a una sección (p. ej. /#contacto): recolocar con la altura definitiva
    var hashTarget = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (hashTarget) scrollToTarget(hashTarget, true);
  });

  /* --- Apariciones genéricas --- */
  ST.batch('[data-reveal]', {
    start: 'top 90%', once: true,
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1, stagger: 0.08, clearProps: 'transform' }); }
  });
  $$('[data-reveal-group]').forEach(function (group) {
    gsap.to(group.children, {
      opacity: 1, y: 0, duration: 1, stagger: 0.1, clearProps: 'transform',
      scrollTrigger: { trigger: group, start: 'top 85%', once: true }
    });
  });

  /* --- Proceso: línea de progreso y pasos --- */
  (function () {
    var track = $('.process-track');
    if (!track) return;
    var line = $('.process-line i'), steps = $$('.step', track);
    var row = window.matchMedia('(min-width: 900px)');
    var prop = function () { return row.matches ? 'scaleX' : 'scaleY'; };
    var setter = null;
    function build() { gsap.set(line, { clearProps: 'transform' }); gsap.set(line, row.matches ? { scaleX: 0 } : { scaleY: 0 }); setter = gsap.quickSetter(line, prop()); }
    build();
    row.addEventListener('change', function () { build(); ST.refresh(); });
    ST.create({
      trigger: track, start: 'top 72%', end: 'bottom 55%', scrub: 0.6,
      onUpdate: function (self) {
        var p = self.progress;
        setter(p);
        steps.forEach(function (s, i) { s.classList.toggle('is-on', p >= i / steps.length + 0.02); });
      }
    });
  })();

  /* --- Titulares que se estiran y se inclinan con la velocidad del scroll --- */
  (function () {
    var els = $$('.title, .project-name, .stat dd');
    var setters = els.map(function (el) {
      return { sy: gsap.quickSetter(el, 'scaleY'), sk: gsap.quickSetter(el, 'skewY', 'deg') };
    });
    gsap.set(els, { transformOrigin: '0% 50%' });
    var lastY = scrollPos, vel = 0, shown = 0;
    gsap.ticker.add(function () {
      var y = scrollPos, dy = y - lastY;
      lastY = y;
      vel += (dy - vel) * 0.18;
      var a = clamp(vel / 45, -1, 1);
      if (Math.abs(a - shown) < 0.002) return;
      shown = a;
      var sy = 1 + Math.abs(a) * 0.16, sk = -a * 3.5;
      setters.forEach(function (s) { s.sy(sy); s.sk(sk); });
    });
  })();

  /* --- Cifras con contador --- */
  $$('[data-count]').forEach(function (el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10);
    var fmt = function (v) { return v.toFixed(dec).replace('.', ','); };
    var o = { v: 0 };
    el.textContent = fmt(0);
    ST.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () {
        gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); } });
      }
    });
  });

  /* --- Sobre mí: el texto se va "encendiendo" con el scroll --- */
  $$('[data-words]').forEach(function (el) {
    var text = el.textContent.trim();
    el.innerHTML = text.split(/\s+/).map(function (w) { return '<span class="word">' + w + '</span>'; }).join(' ');
    gsap.to($$('.word', el), {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: 0.4 }
    });
  });

  /* --- Transición al bloque de contacto --- */
  gsap.from('.contact-panel', {
    scale: 0.93, ease: 'none',
    scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top 35%', scrub: true }
  });
  gsap.from('.footer-word', {
    yPercent: 60, ease: 'none',
    scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true }
  });

  /* --- Microinteracciones de escritorio --- */
  if (finePointer) {
    /* Botones magnéticos */
    $$('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.42);
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true });
      });
    });

    /* Cursor personalizado */
    var cursor = $('.cursor');
    if (cursor) {
      root.classList.add('has-cursor');
      // El punto va pegado al ratón (sin retraso): se coloca en cuanto llega el movimiento
      var shown = false;
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        cursor.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
        if (!shown) { shown = true; gsap.to(cursor, { opacity: 1, duration: 0.2 }); }
      }, { passive: true });
      document.addEventListener('pointerover', function (e) {
        var t = e.target;
        if (!t.closest) return;
        cursor.classList.toggle('is-text', !!t.closest('input:not([type="radio"]), textarea'));
        cursor.classList.toggle('is-hover', !!t.closest('a, button, summary, .choice'));
      });
      document.addEventListener('pointerleave', function () { shown = false; gsap.to(cursor, { opacity: 0, duration: 0.2 }); });
    }
  }

  window.addEventListener('load', function () { ST.refresh(); });
})();
