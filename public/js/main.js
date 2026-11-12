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

  if (!animate) root.classList.remove('js', 'is-travel');
  window.__rgReady = true;

  var header = $('.site-header');
  var headerH = function () { return header ? header.offsetHeight : 0; };

  /* ------------------------------------------------------------------ *
   * Funciones que no dependen de las animaciones
   * ------------------------------------------------------------------ */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  function scrollToTarget(target, immediate) {
    var y = target.id === 'inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY - (target.id === 'contacto' ? 0 : headerH() - 1);
    if (lenis) lenis.scrollTo(y, { immediate: !!immediate, duration: 1.4 });
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
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
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

  function revealTitle(el, opts) {
    var s = splitLines(el);
    gsap.set(el, { opacity: 1 });
    return gsap.from(s.lines, Object.assign({
      yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.1,
      onComplete: s.revert
    }, opts || {}));
  }

  var fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })])
    : Promise.resolve();

  /* --- El móvil: versión 3D para la escena fija --- */
  function buildStagePhone() {
    var phone = document.createElement('div');
    phone.className = 'phone';
    var body = '<div class="phone-body">';
    for (var i = 0; i < 9; i++) body += '<i style="--i:' + i + '"></i>';
    body += '</div>';
    phone.innerHTML = body +
      '<div class="phone-back"><span class="camera"><i></i><i></i><i></i></span><span class="back-mono">rg</span></div>' +
      '<div class="phone-front"><div class="phone-screen"></div><span class="island"></span><span class="gloss"></span></div>';
    var screen = $('.phone-screen', phone);
    $$('.project .screen').forEach(function (s) { screen.appendChild(s.cloneNode(true)); });
    return phone;
  }

  var mm = gsap.matchMedia();
  var introDone = false;

  /* ============ ESCRITORIO: el móvil viaja del hero a Trabajos ============ */
  mm.add(TRAVEL, function () {
    root.classList.add('is-travel');
    var stage = $('.stage');
    var heroSlot = $('.hero-slot'), worksSlot = $('.works-slot'), pin = $('.works-pin');
    var phone = buildStagePhone();
    var shadow = document.createElement('div'); shadow.className = 'phone-shadow';
    stage.appendChild(shadow); stage.appendChild(phone);
    var screens = $$('.screen', phone);
    var projects = $$('.project');
    var tints = $$('.works-tint');
    var bar = $('.works-progress i');
    var parts = function (i) { return $$('[data-p]', projects[i]); };

    var wob = { ry: 0, rx: 0 };
    var intro = { y: introDone ? 0 : 140, o: introDone ? 1 : 0, ry: introDone ? 0 : 40 };
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    var geo = { hx: 0, hy: 0, wx: 0, wy: 0, A: 1, B: 2, vh: window.innerHeight, u: 10 };

    projects.forEach(function (p, i) { gsap.set(p, { autoAlpha: i ? 0 : 1 }); });
    screens.forEach(function (s, i) { gsap.set(s, { yPercent: i ? 100 : 0 }); s.classList.add('is-live'); });

    var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    tl.to({}, { duration: 0.5 });
    [0, 1].forEach(function (i) {
      var at = 't' + i;
      tl.addLabel(at)
        .to(parts(i), { y: -36, autoAlpha: 0, stagger: 0.03, duration: 0.3, ease: 'power2.in' }, at)
        .set(projects[i], { autoAlpha: 0 }, at + '+=0.48')
        .set(projects[i + 1], { autoAlpha: 1 }, at + '+=0.48')
        .to(tints[i], { opacity: 1, duration: 0.8, ease: 'none' }, at + '+=0.1')
        .to(screens[i + 1], { yPercent: 0, duration: 0.8 }, at + '+=0.1')
        .to(screens[i], { yPercent: -30, duration: 0.8 }, at + '+=0.1')
        .to(wob, { ry: -20, rx: 4, duration: 0.45 }, at + '+=0.05')
        .to(wob, { ry: 0, rx: 0, duration: 0.5, ease: 'power2.out' }, at + '+=0.5')
        .fromTo(parts(i + 1), { y: 44, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.04, duration: 0.4, ease: 'power2.out' }, at + '+=0.5')
        .to({}, { duration: 0.5 }, at + '+=1.1');
    });
    tl.to(bar, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);

    var pinST = ST.create({
      trigger: pin, start: 'top top', end: '+=280%', pin: true, scrub: 0.5,
      animation: tl, anticipatePin: 1, invalidateOnRefresh: true
    });

    function measure() {
      var sy = window.scrollY;
      var h = heroSlot.getBoundingClientRect();
      var p = pin.getBoundingClientRect();
      var w = worksSlot.getBoundingClientRect();
      geo.hx = h.left + h.width / 2; geo.hy = h.top + sy + h.height / 2;
      geo.wx = w.left + w.width / 2; geo.wy = w.top - p.top + w.height / 2;
      geo.A = Math.max(1, pinST.start); geo.B = pinST.end;
      geo.vh = window.innerHeight; geo.u = w.height / 62;
    }
    ST.addEventListener('refresh', measure);
    measure();

    function onMove(e) {
      ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (finePointer) window.addEventListener('pointermove', onMove, { passive: true });

    var ease = gsap.parseEase('power2.inOut');
    var visible = true;
    function tick(time) {
      var s = window.scrollY;
      var gone = s > geo.B + geo.vh * 1.1;
      if (gone !== !visible) {
        visible = !gone;
        phone.style.visibility = shadow.style.visibility = visible ? 'visible' : 'hidden';
        screens.forEach(function (sc) { sc.classList.toggle('is-live', visible); });
      }
      if (!visible) return;
      var p = clamp(s / geo.A, 0, 1), e = ease(p), free = 1 - e;
      ptr.x += (ptr.tx - ptr.x) * 0.07; ptr.y += (ptr.ty - ptr.y) * 0.07;
      var x = lerp(geo.hx, geo.wx, e) + ptr.x * 14 * free;
      var y = lerp(geo.hy, geo.wy, e) + Math.sin(time * 0.9) * 8 * free + intro.y;
      if (s > geo.B) y -= s - geo.B;
      var sc = lerp(1.08, 1, e);
      var ry = lerp(-26, -360, e) + ptr.x * 12 * free + wob.ry + intro.ry;
      var rx = lerp(9, 0, e) - ptr.y * 9 * free + wob.rx;
      var rz = lerp(3, 0, e);
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
      gsap.set(projects.concat($$('[data-p]')), { clearProps: 'all' });
      gsap.set(tints.concat([bar]), { clearProps: 'all' });
    };
  });

  /* ============ MÓVIL / TABLET: móvil 3D en su sitio, sin fijar la sección ============ */
  mm.add('not all and ' + TRAVEL, function () {
    var slot = $('.hero-slot');
    var source = $('.project .phone');
    var heroPhone = source.cloneNode(true);
    heroPhone.removeAttribute('role'); heroPhone.removeAttribute('aria-label');
    slot.appendChild(heroPhone);

    // Entrada: el móvil llega girando desde el canto
    if (!introDone) {
      gsap.fromTo(heroPhone,
        { rotateY: -80, rotateX: 18, y: 110, autoAlpha: 0 },
        { rotateY: 0, rotateX: 0, y: 0, autoAlpha: 1, duration: 1.8, ease: 'expo.out', delay: 0.4 });
    }
    // Scroll en el hero: el móvil se inclina y se aleja
    gsap.fromTo(slot,
      { rotateY: 0, rotateX: 0, scale: 1, yPercent: 0 },
      { rotateY: 22, rotateX: -8, scale: 0.9, yPercent: -10, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // Las pantallas solo se mueven mientras se ven
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-live', en.isIntersecting); });
    }, { threshold: 0.35 });
    var phones = $$('.project .phone').concat([heroPhone]);
    phones.forEach(function (p) { io.observe(p); });

    var glosses = [];
    $$('.project').forEach(function (p) {
      var visual = $('.project-visual', p);
      var phone = $('.phone', p);

      // Reflejo de cristal que cruza la maqueta
      var gloss = document.createElement('span');
      gloss.className = 'gloss';
      $('.phone-screen', phone).appendChild(gloss);
      glosses.push(gloss);

      // La maqueta gira hasta quedar de frente según haces scroll
      gsap.fromTo(phone,
        { rotateY: -42, rotateX: 16, scale: 0.84, y: 50 },
        { rotateY: 0, rotateX: 0, scale: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: visual, start: 'top 92%', end: 'center 50%', scrub: 0.6 } });
      gsap.fromTo(gloss, { xPercent: -130 }, { xPercent: 130, ease: 'none',
        scrollTrigger: { trigger: visual, start: 'top 80%', end: 'bottom 30%', scrub: 0.6 } });

      gsap.from($$('[data-p]', p), { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.06, scrollTrigger: { trigger: p, start: 'top 78%', once: true } });
    });

    return function () {
      io.disconnect();
      heroPhone.remove();
      glosses.forEach(function (g) { g.remove(); });
      phones.forEach(function (p) { p.classList.remove('is-live'); });
      gsap.set($$('[data-p]').concat($$('.project .phone'), [slot]), { clearProps: 'all' });
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
      var cx = gsap.quickTo(cursor, 'x', { duration: 0.28, ease: 'power3.out' });
      var cy = gsap.quickTo(cursor, 'y', { duration: 0.28, ease: 'power3.out' });
      var shown = false;
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (!shown) { shown = true; gsap.set(cursor, { x: e.clientX, y: e.clientY }); gsap.to(cursor, { opacity: 1, duration: 0.3 }); }
        cx(e.clientX); cy(e.clientY);
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
