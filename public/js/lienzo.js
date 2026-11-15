/* ==========================================================================
   rgdevstudio · El lienzo
   Una ventana de navegador en SVG que pasa por 5 fases. No sabe nada del scroll:
   recibe un estado numérico (0–1 por fase) y se dibuja. Quien lo mueve es main.js.

   Estado:
     f     marco dibujado            sk   boceto dibujado (intro)
     s     "a lápiz" (1) → limpio (0) w    cajas grises del wireframe
     wt    la línea repasa las cajas  d    diseño: se llenan de color (Le Petit Fleur)
     p     proyecto 0 flor · 1 café · 2 moda (barrido entre ellos)
     i     interacción: cursor, hover, añadir a la cesta
     url   barra de dirección         load barra de carga
     check sello «Publicado»          conf confeti (0→1, una pasada)
     m     se convierte en logo       tr   contorno de la línea alrededor del marco
   ========================================================================== */
(function () {
  'use strict';

  var VW = 960, VH = 600, TOP = 44;
  var uid = 0;

  var C = {
    paper: '#FBFAF7', ink: '#121214', frame: '#121214', chrome: '#DDD9D0',
    pencil: [112, 106, 96], wire: [176, 171, 161], wireFill: '#E8E5DE', imgFill: '#DCD8CF',
    accent: '#F0561D'
  };

  /* ---------------- utilidades ---------------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(v, a, b) { return clamp01((v - a) / (b - a)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIO(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function backOut(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function rgb(a, b, t) { return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')'; }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function f1(n) { return Math.round(n * 10) / 10; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ---------------- el boceto / wireframe: formas que se "enderezan" ---------------- */
  var SHAPES = [
    { k: 'box', x: 40, y: 62, w: 116, h: 28, r: 6 },          // logo
    { k: 'txt', x: 560, y: 72, w: 52, h: 8 },
    { k: 'txt', x: 636, y: 72, w: 52, h: 8 },
    { k: 'txt', x: 712, y: 72, w: 52, h: 8 },
    { k: 'box', x: 808, y: 60, w: 112, h: 32, r: 16 },        // botón nav
    { k: 'txt', x: 40, y: 140, w: 360, h: 26 },               // titular
    { k: 'txt', x: 40, y: 182, w: 300, h: 26 },
    { k: 'txt', x: 40, y: 236, w: 330, h: 8 },
    { k: 'txt', x: 40, y: 254, w: 268, h: 8 },
    { k: 'box', x: 40, y: 284, w: 150, h: 42, r: 21 },        // CTA
    { k: 'box', x: 470, y: 112, w: 450, h: 250, r: 14, img: 1 } // imagen grande
  ];
  for (var c = 0; c < 4; c++) {
    var cx = 40 + c * 225;
    SHAPES.push({ k: 'box', x: cx, y: 390, w: 205, h: 176, r: 12 });
    SHAPES.push({ k: 'box', x: cx + 10, y: 400, w: 185, h: 104, r: 8, img: 1 });
    SHAPES.push({ k: 'txt', x: cx + 12, y: 520, w: 104, h: 8 });
    SHAPES.push({ k: 'txt', x: cx + 12, y: 540, w: 50, h: 8 });
  }

  // Contorno de un rectángulo redondeado muestreado en puntos (mismos puntos en boceto y en limpio)
  function roundRectPts(x, y, w, h, r) {
    var pts = [], arc = 3, sides = 3, i, a;
    r = Math.min(r, h / 2, w / 2);
    var corners = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    var edges = [[x + r, y, x + w - r, y], [x + w, y + r, x + w, y + h - r], [x + w - r, y + h, x + r, y + h], [x, y + h - r, x, y + r]];
    for (var e = 0; e < 4; e++) {
      var E = edges[e];
      for (i = 0; i < sides; i++) pts.push([lerp(E[0], E[2], i / sides), lerp(E[1], E[3], i / sides)]);
      var K = corners[e];
      for (i = 0; i <= arc; i++) { a = K[2] + (Math.PI / 2) * (i / arc); pts.push([K[0] + Math.cos(a) * r, K[1] + Math.sin(a) * r]); }
    }
    return pts;
  }

  function prepShape(sh, idx) {
    var R = rng(1000 + idx * 97);
    sh.n = idx;
    if (sh.k === 'txt') {
      sh.pts = [];
      for (var i = 0; i <= 10; i++) sh.pts.push([sh.x + sh.w * i / 10, sh.y + sh.h / 2]);
      sh.phase = R() * 6;
    } else {
      sh.pts = roundRectPts(sh.x, sh.y, sh.w, sh.h, sh.r);
    }
    sh.jit = sh.pts.map(function () { return [R() * 2 - 1, R() * 2 - 1]; });
    sh.jit2 = sh.pts.map(function () { return [R() * 2 - 1, R() * 2 - 1]; });
    sh.over = [R() * 2 - 1, R() * 2 - 1];
  }
  SHAPES.forEach(prepShape);

  // Curva suave (Catmull-Rom) con tensión k: k=0 son rectas, k=1 es trazo a mano
  function smoothPath(P, k, closed) {
    var n = P.length, d = 'M' + f1(P[0][0]) + ' ' + f1(P[0][1]);
    var get = function (i) { return closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]; };
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      var c1x = p1[0] + (p2[0] - p0[0]) / 6 * k, c1y = p1[1] + (p2[1] - p0[1]) / 6 * k;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6 * k, c2y = p2[1] - (p3[1] - p1[1]) / 6 * k;
      d += 'C' + f1(c1x) + ' ' + f1(c1y) + ' ' + f1(c2x) + ' ' + f1(c2y) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    return d;
  }

  function shapeD(sh, s, alt) {
    var J = alt ? sh.jit2 : sh.jit, amp = (sh.k === 'txt' ? 1.6 : 5.5) * s, P;
    if (sh.k === 'txt') {
      var inset = (sh.h / 2) * (1 - s);
      P = sh.pts.map(function (p, i) {
        var t = i / (sh.pts.length - 1);
        return [lerp(sh.x + inset, sh.x + sh.w - inset, t) + J[i][0] * amp, p[1] + Math.sin(t * Math.PI * 3.2 + sh.phase) * 3 * s + J[i][1] * amp];
      });
      return smoothPath(P, s, false);
    }
    P = sh.pts.map(function (p, i) { return [p[0] + J[i][0] * amp, p[1] + J[i][1] * amp]; });
    // a lápiz el trazo no cierra: se pasa un poco del punto de partida
    P.push([P[0][0] + 9 * s + sh.over[0] * 3 * s, P[0][1] + sh.over[1] * 4 * s]);
    return smoothPath(P, s, false);
  }
  function imgX(sh, s) {
    var R = rng(500 + sh.n), a = 4 * s, j = function () { return (R() * 2 - 1) * a; };
    var x0 = sh.x + 10, y0 = sh.y + 10, x1 = sh.x + sh.w - 10, y1 = sh.y + sh.h - 10;
    return 'M' + f1(x0 + j()) + ' ' + f1(y0 + j()) + 'Q' + f1((x0 + x1) / 2 + j() * 2) + ' ' + f1((y0 + y1) / 2 + j() * 2) + ' ' + f1(x1 + j()) + ' ' + f1(y1 + j()) +
      'M' + f1(x1 + j()) + ' ' + f1(y0 + j()) + 'Q' + f1((x0 + x1) / 2 + j() * 2) + ' ' + f1((y0 + y1) / 2 + j() * 2) + ' ' + f1(x0 + j()) + ' ' + f1(y1 + j());
  }

  /* ---------------- anotaciones del boceto (solo a lápiz) ---------------- */
  var NOTES = [
    { t: '¿logo?', x: 172, y: 84, s: 22 },
    { t: 'foto grande', x: 695, y: 246, s: 28, a: 'middle' },
    { t: '¡que se vea!', x: 214, y: 312, s: 21 },
    { t: '4 productos', x: 486, y: 378, s: 20 }
  ];
  var SCRIBBLES = [
    'M50 70 l14 12 l8 -12 l12 14 l8 -12 l12 13 l8 -12 l12 13 l8 -11',        // relleno del logo
    'M22 305 C24 268 96 258 150 266 C210 274 220 300 206 322 C190 346 98 350 52 338 C30 332 22 318 26 300', // círculo al CTA
    'M210 302 C204 300 200 302 196 306 M196 306 l8 -2 M196 306 l2 7',           // flechita
    'M168 77 C162 76 160 76 158 77 M158 77 l6 -5 M158 77 l6 4',                 // flecha al logo
    'M580 372 C560 380 548 388 540 400 M540 400 l1 -9 M540 400 l8 -3',           // flecha a productos
    'M560 100 C600 96 680 96 770 101'                                           // subrayado del menú
  ];

  /* ---------------- los tres conceptos de web ---------------- */
  function T(x, y, txt, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '"' + (o.cls ? ' class="' + o.cls + '"' : '') + ' font-size="' + (o.size || 13) + '"' +
      (o.w ? ' font-weight="' + o.w + '"' : '') + ' fill="' + (o.fill || C.ink) + '"' + (o.op ? ' opacity="' + o.op + '"' : '') +
      (o.a ? ' text-anchor="' + o.a + '"' : '') + (o.ls ? ' letter-spacing="' + o.ls + '"' : '') + (o.id ? ' data-id="' + o.id + '"' : '') + '>' + esc(txt) + '</text>';
  }
  function R(x, y, w, h, r, fill, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function grad(id, c1, c2) { return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>'; }

  function cards(pid, items, o) {
    var out = '';
    items.forEach(function (it, i) {
      var x = 40 + i * 225, gid = pid + '-g' + i;
      out += '<g data-card="' + i + '">' + R(x, 390, 205, 176, 12, o.card) +
        (o.icon ? R(x + 10, 400, 185, 104, 8, 'url(#' + gid + ')') + o.icon(x + 102, 452, i) : R(x + 10, 400, 185, 104, 8, 'url(#' + gid + ')')) +
        T(x + 12, 530, it[0], { size: 13.5, w: 600, fill: o.text }) +
        T(x + 12, 551, it[1], { cls: 't-ital', size: 16, fill: o.price }) + (o.after ? o.after(x, i) : '') + '</g>';
    });
    return out;
  }

  function projFlor(id) {
    var ink = '#3A1F27', rose = '#C2324F';
    var items = [['Ramo Primavera', '35 €', '#F4B8C4', '#E2486B'], ['Girasoles', '29 €', '#F9D98B', '#F2B33D'], ['Lavanda', '32 €', '#D8BCEB', '#9A5BC9'], ['Peonías', '42 €', '#FBD3C3', '#E8866A']];
    var defs = items.map(function (it, i) { return grad(id + '-flor-g' + i, it[2], it[3]); }).join('');
    var tulips = '<g transform="translate(598 128) scale(1.16)"><g fill="none" stroke-linecap="round">' +
      '<path d="M64 200 C66 160 70 132 74 104" stroke="#5E7A55" stroke-width="3"/><path d="M100 200 C100 150 100 116 100 80" stroke="#5E7A55" stroke-width="3"/>' +
      '<path d="M138 200 C136 164 132 140 128 116" stroke="#5E7A55" stroke-width="3"/><path d="M84 168 C70 150 58 150 52 156" stroke="#5E7A55" stroke-width="3"/></g>' +
      '<path d="M74 106 C56 100 52 72 58 60 L66 72 L74 54 L82 72 L90 60 C96 72 92 100 74 106Z" fill="#E2486B"/>' +
      '<path d="M100 82 C80 76 76 44 82 30 L91 44 L100 22 L109 44 L118 30 C124 44 120 76 100 82Z" fill="#F2B33D"/>' +
      '<path d="M128 118 C110 112 106 84 112 72 L120 84 L128 66 L136 84 L144 72 C150 84 146 112 128 118Z" fill="#9A5BC9"/></g>';
    return {
      defs: defs,
      svg: '<g class="pj pj-flor">' + R(0, TOP, VW, VH - TOP, 0, '#F7E3E7', ' data-b="bg"') +
        '<g data-b="0">' + T(40, 86, 'Le Petit Fleur', { cls: 't-ital', size: 25, fill: ink }) +
          T(560, 81, 'Ramos', { fill: ink, op: .72 }) + T(636, 81, 'Eventos', { fill: ink, op: .72 }) + T(712, 81, 'Nosotros', { fill: ink, op: .72 }) +
          R(808, 60, 112, 32, 16, '#E2486B') + T(864, 81, 'Comprar', { a: 'middle', w: 600, fill: '#fff' }) + '</g>' +
        '<g data-b="1">' + T(40, 164, 'Flores frescas,', { cls: 't-serif', size: 37, fill: ink, ls: -1 }) +
          T(40, 207, 'a domicilio en el día', { cls: 't-ital', size: 40, fill: rose }) +
          T(40, 243, 'Ramos de temporada hechos a mano en Catarroja.', { fill: '#5B3B44' }) +
          T(40, 261, 'Entrega en Valencia y alrededores.', { fill: '#5B3B44' }) +
          R(40, 284, 150, 42, 21, ink) + T(115, 310, 'Ver ramos', { a: 'middle', w: 600, fill: '#F7E3E7' }) + '</g>' +
        '<g data-b="2">' + R(470, 112, 450, 250, 14, '#F0B9C5') + '<circle cx="770" cy="236" r="98" fill="#F6CDD6"/><circle cx="532" cy="300" r="46" fill="#EBA7B6"/>' + tulips +
          T(492, 142, 'Temporada de tulipanes', { cls: 't-ital', size: 16, fill: ink }) + '</g>' +
        '<g data-b="3">' + T(40, 378, 'Ramos de temporada', { cls: 't-serif', size: 17, fill: ink }) +
          cards(id + '-flor', items, { card: '#FFF7F8', text: ink, price: rose }) + '</g>' +
      '</g>'
    };
  }

  function projCafe(id) {
    var cream = '#EFE3CF', gold = '#E3AE6E', dark = '#2B1B13';
    var items = [['Espresso', '1,40 €', '#4A3122', '#2F1E15'], ['Cortado', '1,60 €', '#5C3E2B', '#3A271C'], ['Flat white', '2,60 €', '#7A5640', '#4A3122'], ['Tostada del día', '3,90 €', '#8E6A44', '#5C3E2B']];
    var defs = items.map(function (it, i) { return grad(id + '-cafe-g' + i, it[2], it[3]); }).join('');
    var bean = function (x, y, i) {
      return i < 3
        ? '<g transform="translate(' + x + ' ' + y + ')"><ellipse rx="22" ry="7" cy="10" fill="none" stroke="' + cream + '" stroke-width="2" opacity=".6"/><path d="M-16 -14 C-14 6 14 6 16 -14 Z" fill="none" stroke="' + cream + '" stroke-width="2"/><path d="M16 -10 C26 -10 26 2 14 0" fill="none" stroke="' + cream + '" stroke-width="2"/></g>'
        : '<g transform="translate(' + x + ' ' + y + ')"><rect x="-26" y="-16" width="52" height="34" rx="8" fill="none" stroke="' + cream + '" stroke-width="2"/><path d="M-18 -4 h36 M-18 6 h24" stroke="' + gold + '" stroke-width="2"/></g>';
    };
    var cup = '<g transform="translate(548 124) scale(1.48)" fill="none" stroke="' + cream + '" stroke-width="2.4" stroke-linecap="round">' +
      '<ellipse cx="94" cy="80" rx="56" ry="13"/><path d="M38 80 C40 118 62 140 94 140 C126 140 148 118 150 80"/><path d="M149 92 C176 90 178 120 148 120"/>' +
      '<path d="M80 60 C72 48 90 40 82 26" opacity=".6"/><path d="M98 62 C90 48 108 38 100 20" opacity=".6"/><ellipse cx="94" cy="150" rx="80" ry="10" opacity=".4"/>' +
      '<ellipse cx="94" cy="80" rx="46" ry="9" fill="#6B3B22" stroke="none"/></g>';
    return {
      defs: defs,
      svg: '<g class="pj pj-cafe">' + R(0, TOP, VW, VH - TOP, 0, dark) +
        T(40, 89, 'Molí', { cls: 't-serif', size: 30, fill: cream }) + T(104, 88, 'café de barrio', { cls: 't-ital', size: 15, fill: gold }) +
        T(560, 81, 'Carta', { fill: cream, op: .72 }) + T(636, 81, 'Horario', { fill: cream, op: .72 }) + T(712, 81, 'Dónde', { fill: cream, op: .72 }) +
        R(808, 60, 112, 32, 16, gold) + T(864, 81, 'Reservar', { a: 'middle', w: 600, fill: dark }) +
        T(40, 164, 'Café de barrio,', { cls: 't-serif', size: 37, fill: cream, ls: -1 }) +
        T(40, 207, 'desde las 7:30', { cls: 't-ital', size: 42, fill: gold }) +
        T(40, 243, 'Carta sin PDFs, horario y mapa a un toque.', { fill: '#CDBBA3' }) +
        T(40, 261, 'Reserva tu mesa por WhatsApp.', { fill: '#CDBBA3' }) +
        R(40, 284, 150, 42, 21, cream) + T(115, 310, 'Reservar mesa', { a: 'middle', w: 600, fill: dark }) +
        R(470, 112, 450, 250, 14, '#3A271C') + '<circle cx="852" cy="186" r="56" fill="#432D20"/>' + cup +
        T(492, 142, 'Lun–Vie 7:30–20:00 · Sáb 9:00–14:00', { size: 12, fill: '#CDBBA3' }) +
        T(40, 378, 'La carta', { cls: 't-serif', size: 17, fill: cream }) +
        cards(id + '-cafe', items, { card: '#36241A', text: cream, price: gold, icon: bean }) +
      '</g>'
    };
  }

  function projModa(id) {
    var ink = '#141414';
    var items = [['Abrigo lana', '129 €', '#B49673', '#8F7352'], ['Camisa lino', '59 €', '#9BA284', '#5F6A4A'], ['Pantalón recto', '79 €', '#3B3B3B', '#121212'], ['Punto crudo', '69 €', '#D6C8B6', '#B3A28C']];
    var defs = items.map(function (it, i) { return grad(id + '-moda-g' + i, it[2], it[3]); }).join('') + grad(id + '-coat', '#B9997A', '#8A6D4E');
    var addBtn = function (x, i) {
      if (i) return '';
      return '<g data-id="add" opacity="0" transform="translate(' + (x + 160) + ' 540)"><rect x="-36" y="-13" width="72" height="26" rx="13" fill="' + ink + '"/>' +
        '<text data-id="add-a" x="0" y="4.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="#fff">Añadir</text>' +
        '<text data-id="add-b" x="0" y="4.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="#fff" opacity="0">Añadido</text></g>';
    };
    var coat = '<path d="M652 138 Q695 126 738 138 L780 166 L800 300 L778 305 L766 216 L764 352 L626 352 L624 216 L612 305 L590 300 L610 166 Z" fill="url(#' + id + '-coat)"/>' +
      '<path d="M672 139 L695 196 L718 139" fill="none" stroke="#6E5338" stroke-width="2.5"/><g fill="#5A432C"><circle cx="702" cy="226" r="4"/><circle cx="702" cy="258" r="4"/><circle cx="702" cy="290" r="4"/></g>';
    return {
      defs: defs,
      svg: '<g class="pj pj-moda">' + R(0, TOP, VW, VH - TOP, 0, '#EFECE6') +
        T(40, 83, 'ATELIER NOU', { size: 15, w: 700, fill: ink, ls: 4.5 }) +
        T(560, 81, 'Mujer', { fill: ink, op: .7 }) + T(636, 81, 'Hombre', { fill: ink, op: .7 }) + T(712, 81, 'Lookbook', { fill: ink, op: .7 }) +
        R(808, 60, 112, 32, 16, 'none', ' stroke="' + ink + '" stroke-width="1.5"') +
        '<g data-id="cart">' + T(864, 81, 'Cesta 1', { a: 'middle', w: 600, fill: ink, id: 'cart-a' }) + T(864, 81, 'Cesta 2', { a: 'middle', w: 600, fill: ink, id: 'cart-b', op: 0 }) + '</g>' +
        '<g data-id="badge" transform="translate(916 60) scale(0)"><circle r="10" fill="' + C.accent + '"/><text y="4" text-anchor="middle" font-size="11" font-weight="700" fill="' + ink + '">+1</text></g>' +
        T(40, 170, 'Nueva', { cls: 't-serif', size: 48, fill: ink, ls: -1.5 }) +
        T(40, 216, 'colección', { cls: 't-ital', size: 52, fill: ink }) +
        T(40, 246, 'Prendas hechas para durar.', { fill: '#4A4741' }) +
        T(40, 264, 'Tallas y stock claros, envío en 48 h.', { fill: '#4A4741' }) +
        R(40, 284, 150, 42, 21, ink) + T(115, 310, 'Ver todo', { a: 'middle', w: 600, fill: '#fff' }) +
        R(470, 112, 450, 250, 14, '#D8CDBD') + '<rect x="830" y="112" width="90" height="250" fill="#CDBFAC"/>' + coat +
        T(492, 142, 'N.º 01 · Otoño', { size: 11, w: 600, fill: ink, ls: 2 }) +
        T(40, 378, 'Lo más nuevo', { cls: 't-serif', size: 17, fill: ink }) +
        cards(id + '-moda', items, { card: '#F8F6F2', text: ink, price: ink, after: addBtn }) +
      '</g>'
    };
  }

  /* ---------------- montaje ---------------- */
  function create(opts) {
    opts = opts || {};
    var id = 'lz' + (++uid);
    var flor = projFlor(id), cafe = projCafe(id), moda = projModa(id);
    var R2 = rng(77);

    var shapeSVG = '', fillSVG = '', traceSVG = '', xSVG = '';
    SHAPES.forEach(function (sh, i) {
      var isTxt = sh.k === 'txt';
      if (!isTxt) fillSVG += '<rect data-fill="' + i + '" x="' + sh.x + '" y="' + sh.y + '" width="' + sh.w + '" height="' + sh.h + '" rx="' + sh.r + '" fill="' + (sh.img ? C.imgFill : C.wireFill) + '" opacity="0"/>';
      shapeSVG += '<path data-sh="' + i + '" pathLength="1" stroke-dasharray="1 1"/>';
      if (!isTxt) shapeSVG += '<path data-sh2="' + i + '" pathLength="1" stroke-dasharray="1 1" opacity="0"/>';
      if (sh.img) xSVG += '<path data-x="' + i + '" pathLength="1" stroke-dasharray="1 1"/>';
      traceSVG += '<path data-tr="' + i + '" d="' + shapeD(sh, 0) + '" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>';
    });
    var noteSVG = NOTES.map(function (n, i) {
      return '<text data-note="' + i + '" class="t-ital" x="' + n.x + '" y="' + n.y + '" font-size="' + n.s + '"' + (n.a ? ' text-anchor="' + n.a + '"' : '') + ' fill="rgb(112,106,96)" opacity="0">' + esc(n.t) + '</text>';
    }).join('') + SCRIBBLES.map(function (d, i) { return '<path data-scr="' + i + '" d="' + d + '" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>'; }).join('');

    // confeti
    var CONF = [], confSVG = '';
    var palette = [C.accent, C.ink, '#F2B33D', '#E2486B', '#9A5BC9', '#E3AE6E'];
    for (var k = 0; k < 26; k++) {
      var ang = -Math.PI / 2 + (R2() * 2 - 1) * 1.25, sp = 140 + R2() * 260;
      CONF.push({ vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: (R2() * 2 - 1) * 540, c: palette[k % palette.length], sq: R2() > .4 });
      confSVG += CONF[k].sq ? '<rect data-cf="' + k + '" x="-5" y="-2.5" width="10" height="5" rx="1" fill="' + CONF[k].c + '" opacity="0"/>' : '<circle data-cf="' + k + '" r="3.5" fill="' + CONF[k].c + '" opacity="0"/>';
    }

    var svg =
      '<svg class="lienzo-svg" viewBox="0 0 ' + VW + ' ' + VH + '" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">' +
      '<defs>' + flor.defs + cafe.defs + moda.defs +
        '<clipPath id="' + id + '-content"><path d="M0 ' + TOP + 'H' + VW + 'V' + (VH - 18) + 'Q' + VW + ' ' + VH + ' ' + (VW - 18) + ' ' + VH + 'H18Q0 ' + VH + ' 0 ' + (VH - 18) + 'Z"/></clipPath>' +
        '<clipPath id="' + id + '-w1"><rect data-wipe="1" x="0" y="' + VH + '" width="' + VW + '" height="0"/></clipPath>' +
        '<clipPath id="' + id + '-w2"><rect data-wipe="2" x="0" y="' + VH + '" width="' + VW + '" height="0"/></clipPath>' +
      '</defs>' +
      '<rect data-id="trace" x="-14" y="-14" width="' + (VW + 28) + '" height="' + (VH + 28) + '" rx="30" fill="none" stroke="' + C.accent + '" stroke-width="2.5" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>' +
      '<rect data-id="paper" x="0" y="0" width="' + VW + '" height="' + VH + '" rx="18" fill="' + C.paper + '" opacity="0"/>' +
      '<g data-id="content" clip-path="url(#' + id + '-content)">' +
        '<g data-id="design">' + flor.svg +
          '<g clip-path="url(#' + id + '-w1)" data-id="pj1">' + cafe.svg + '</g>' +
          '<g clip-path="url(#' + id + '-w2)" data-id="pj2">' + moda.svg +
            '<circle data-id="fly" r="6" fill="' + C.accent + '" opacity="0"/>' +
            '<path data-id="cursor" d="M0 0 L0 22 L6 17 L10.5 26 L14.5 24 L10 15 L17 15 Z" fill="' + C.ink + '" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" opacity="0"/>' +
          '</g>' +
        '</g>' +
        '<g data-id="wire">' +
          '<g data-id="fills">' + fillSVG + '</g>' +
          '<g data-id="shapes" fill="none" stroke-linecap="round" stroke-linejoin="round">' + shapeSVG + xSVG + '</g>' +
          '<g data-id="notes" fill="none" stroke="rgb(112,106,96)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + noteSVG + '</g>' +
          '<g data-id="traces" fill="none" stroke="' + C.accent + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0">' + traceSVG + '</g>' +
        '</g>' +
        '<rect data-id="load" x="0" y="' + (TOP - 1) + '" width="' + VW + '" height="3" fill="' + C.accent + '" transform="scale(0 1)"/>' +
      '</g>' +
      '<g data-id="chrome">' +
        '<path data-id="sep" d="M0 ' + TOP + 'H' + VW + '" stroke="' + C.chrome + '" stroke-width="1.5" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>' +
        '<g data-id="dots" opacity="0"><circle cx="24" cy="22" r="6" fill="#E2DED5"/><circle cx="44" cy="22" r="6" fill="#E2DED5"/><circle cx="64" cy="22" r="6" fill="#E2DED5"/></g>' +
        '<g data-id="url" opacity="0" transform="translate(480 22) scale(0 1) translate(-480 -22)">' +
          '<rect x="320" y="10" width="320" height="24" rx="12" fill="#EEEBE5"/>' +
          '<path d="M338 20 v-2.5 a4 4 0 0 1 8 0 v2.5 M335.5 20 h13 v8.5 h-13 Z" fill="none" stroke="#7A766E" stroke-width="1.6" stroke-linejoin="round"/>' +
          '<text data-id="url-t" x="356" y="27" font-size="12.5" fill="#4A4741"></text>' +
          '<rect data-id="caret" x="356" y="15" width="1.5" height="14" fill="#4A4741"/>' +
        '</g>' +
      '</g>' +
      '<rect data-id="frame" x="0" y="0" width="' + VW + '" height="' + VH + '" rx="18" fill="none" stroke="' + C.frame + '" stroke-width="2" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>' +
      '<text data-id="logo" class="t-ital" x="' + VW / 2 + '" y="' + (TOP + (VH - TOP) / 2 + 92) + '" text-anchor="middle" font-size="300" fill="' + C.ink + '" opacity="0" letter-spacing="-12">rg</text>' +
      '<g data-id="fx">' +
      '<g data-id="conf">' + confSVG + '</g>' +
      '<g data-id="check" opacity="0" transform="translate(842 0) scale(0)">' +
        '<rect x="-104" y="-24" width="208" height="48" rx="24" fill="' + C.accent + '"/>' +
        '<circle cx="-74" cy="0" r="13" fill="' + C.ink + '"/><path d="M-80 0 l4.5 4.5 l8.5 -9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<text x="-50" y="7" font-size="19" font-weight="700" fill="' + C.ink + '">Publicado</text>' +
      '</g></g>' +
      '</svg>';

    var el = document.createElement('div');
    el.className = 'lienzo';
    el.innerHTML = '<div class="lienzo-shadow"></div><div class="lienzo-float">' + svg + '</div>';
    var root = el.querySelector('svg');
    var q = function (s) { return root.querySelector('[data-id="' + s + '"]'); };
    var qa = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

    var ref = {
      paper: q('paper'), frame: q('frame'), sep: q('sep'), dots: q('dots'), trace: q('trace'),
      wire: q('wire'), fills: qa('[data-fill]'), sh: qa('[data-sh]'), sh2: qa('[data-sh2]'), xs: qa('[data-x]'),
      traces: q('traces'), tr: qa('[data-tr]'), notes: qa('[data-note]'), scr: qa('[data-scr]'), notesG: q('notes'),
      florBg: root.querySelector('.pj-flor [data-b="bg"]'), blocks: qa('.pj-flor [data-b]:not([data-b="bg"])'),
      wipe1: root.querySelector('[data-wipe="1"]'), wipe2: root.querySelector('[data-wipe="2"]'), pj1: q('pj1'), pj2: q('pj2'),
      design: q('design'), content: q('content'), chrome: q('chrome'),
      cursor: q('cursor'), add: q('add'), addA: q('add-a'), addB: q('add-b'), card0: root.querySelector('.pj-moda [data-card="0"]'),
      cartA: q('cart-a'), cartB: q('cart-b'), badge: q('badge'), fly: q('fly'),
      url: q('url'), urlT: q('url-t'), caret: q('caret'), load: q('load'), check: q('check'), fx: q('fx'), conf: qa('[data-cf]'), logo: q('logo')
    };
    var shByIdx = {}; ref.sh.forEach(function (p) { shByIdx[p.getAttribute('data-sh')] = p; });
    var sh2ByIdx = {}; ref.sh2.forEach(function (p) { sh2ByIdx[p.getAttribute('data-sh2')] = p; });
    var xByIdx = {}; ref.xs.forEach(function (p) { xByIdx[p.getAttribute('data-x')] = p; });

    var URL_TEXT = opts.url || 'tunegocio.es';
    var st = { f: 0, sk: 0, s: 1, w: 0, wt: 0, d: 0, p: 0, i: 0, url: 0, load: 0, check: 0, conf: 0, m: 0, tr: 0 };
    var prev = {};
    var nShapes = SHAPES.length, nDraw = nShapes + SCRIBBLES.length + NOTES.length;

    function attr(el, k, v) { if (el.__c === undefined) el.__c = {}; if (el.__c[k] !== v) { el.__c[k] = v; el.setAttribute(k, v); } }
    function op(el, v) { var o = f1(v * 100) / 100; attr(el, 'opacity', o); attr(el, 'visibility', o > 0 ? 'inherit' : 'hidden'); }
    function changed() { for (var i = 0; i < arguments.length; i++) if (prev[arguments[i]] !== st[arguments[i]]) return true; return false; }

    function render() {
      var S = st;

      if (changed('f')) {
        attr(ref.frame, 'stroke-dashoffset', f1((1 - easeIO(S.f)) * 1000) / 1000);
        attr(ref.sep, 'stroke-dashoffset', f1((1 - seg(S.f, .45, 1)) * 1000) / 1000);
        op(ref.paper, seg(S.f, .2, .9));
        op(ref.dots, seg(S.f, .6, 1));
      }
      if (changed('tr')) attr(ref.trace, 'stroke-dashoffset', f1((1 - S.tr) * 1000) / 1000);

      // boceto → wireframe
      if (changed('s', 'sk', 'd', 'w')) {
        var s = Math.round(S.s * 60) / 60, fade = 1 - seg(S.d, 0, .6); // escalones finos: menos trazos que recalcular
        op(ref.wire, fade);
        if (fade > 0) {
          var col = rgb(C.pencil, C.wire, 1 - s);
          SHAPES.forEach(function (sh, i) {
            var p = shByIdx[i], drawn = easeOut(seg(S.sk, i / nDraw * .75, i / nDraw * .75 + .25));
            if (p.__s !== s) { p.__s = s; attr(p, 'd', shapeD(sh, s)); }
            attr(p, 'stroke', col);
            attr(p, 'stroke-width', sh.k === 'txt' ? f1(lerp(2, sh.h, 1 - s)) : f1(lerp(2, 1.4, 1 - s)));
            attr(p, 'stroke-dashoffset', f1((1 - drawn) * 1000) / 1000);
            var p2 = sh2ByIdx[i];
            if (p2) {
              if (p2.__s !== s) { p2.__s = s; attr(p2, 'd', shapeD(sh, s, true)); }
              attr(p2, 'stroke', col); attr(p2, 'stroke-width', '1.3');
              attr(p2, 'stroke-dashoffset', f1((1 - drawn) * 1000) / 1000);
              op(p2, s * .5);
            }
            var x = xByIdx[i];
            if (x) {
              if (x.__s !== s) { x.__s = s; attr(x, 'd', imgX(sh, s)); }
              attr(x, 'stroke', col); attr(x, 'stroke-width', f1(lerp(1.6, 1.2, 1 - s)));
              attr(x, 'stroke-dashoffset', f1((1 - drawn) * 1000) / 1000);
            }
          });
          ref.fills.forEach(function (r) { op(r, S.w * .95); });
          ref.scr.forEach(function (p, j) {
            var k = nShapes + j, drawn = easeOut(seg(S.sk, k / nDraw * .75, k / nDraw * .75 + .25));
            attr(p, 'stroke-dashoffset', f1((1 - drawn) * 1000) / 1000);
          });
          ref.notes.forEach(function (t, j) {
            var k = nShapes + SCRIBBLES.length + j;
            op(t, seg(S.sk, k / nDraw * .75, k / nDraw * .75 + .2));
          });
          op(ref.notesG, s);
        }
      }
      if (changed('wt', 'd')) {
        var tf = 1 - seg(S.d, 0, .45);
        op(ref.traces, S.wt > 0 ? tf : 0);
        if (S.wt > 0 && tf > 0) ref.tr.forEach(function (p, i) {
          var a = i / nShapes * .6;
          attr(p, 'stroke-dashoffset', f1((1 - easeIO(seg(S.wt, a, a + .4))) * 1000) / 1000);
        });
      }

      // diseño: los bloques se llenan de color
      if (changed('d')) {
        op(ref.design, S.d > 0 ? 1 : 0);
        op(ref.florBg, seg(S.d, 0, .5));
        ref.blocks.forEach(function (b, i) { op(b, easeOut(seg(S.d, .12 + i * .14, .52 + i * .14))); });
      }
      // proyectos: barrido de abajo arriba
      if (changed('p')) {
        var t1 = easeIO(clamp01(S.p)), t2 = easeIO(clamp01(S.p - 1));
        attr(ref.wipe1, 'y', f1(TOP + (VH - TOP) * (1 - t1))); attr(ref.wipe1, 'height', f1((VH - TOP) * t1));
        attr(ref.wipe2, 'y', f1(TOP + (VH - TOP) * (1 - t2))); attr(ref.wipe2, 'height', f1((VH - TOP) * t2));
        attr(ref.pj1, 'display', t1 > 0 ? 'inline' : 'none');
        attr(ref.pj2, 'display', t2 > 0 ? 'inline' : 'none');
      }

      // interacción (sobre Atelier Nou)
      if (changed('i')) {
        var I = S.i;
        var path = [[760, 600], [150, 470], [200, 540], [200, 540], [520, 500]];
        var cx, cy;
        if (I < .38) { var a1 = easeIO(seg(I, .04, .36)); cx = lerp(path[0][0], path[1][0], a1); cy = lerp(path[0][1], path[1][1], a1); }
        else if (I < .56) { var a2 = easeIO(seg(I, .42, .54)); cx = lerp(path[1][0], path[2][0], a2); cy = lerp(path[1][1], path[2][1], a2); }
        else { var a3 = easeIO(seg(I, .82, 1)); cx = lerp(path[3][0], path[4][0], a3); cy = lerp(path[3][1], path[4][1], a3); }
        var press = I > .55 && I < .6 ? .88 : 1;
        attr(ref.cursor, 'transform', 'translate(' + f1(cx) + ' ' + f1(cy) + ') scale(' + press + ')');
        op(ref.cursor, seg(I, 0, .06) * (1 - seg(I, .94, 1)));
        var lift = easeOut(seg(I, .28, .38)) * (1 - seg(I, .9, 1));
        attr(ref.card0, 'transform', 'translate(0 ' + f1(-8 * lift) + ')');
        attr(ref.card0, 'filter', '');
        op(ref.add, easeOut(seg(I, .36, .44)) * (1 - seg(I, .9, 1)));
        var addSc = I > .55 && I < .6 ? .9 : 1;
        attr(ref.add, 'transform', 'translate(200 540) scale(' + addSc + ')');
        op(ref.addA, 1 - seg(I, .57, .6)); op(ref.addB, seg(I, .57, .6));
        // la bolita vuela a la cesta
        var fl = seg(I, .6, .76);
        op(ref.fly, fl > 0 && fl < 1 ? 1 : 0);
        attr(ref.fly, 'cx', f1(lerp(200, 916, easeIO(fl)))); attr(ref.fly, 'cy', f1(lerp(540, 62, fl) - Math.sin(fl * Math.PI) * 120));
        var got = seg(I, .76, .8);
        op(ref.cartA, 1 - got); op(ref.cartB, got);
        var b = seg(I, .76, .88);
        attr(ref.badge, 'transform', 'translate(916 60) scale(' + f1(b > 0 ? backOut(b) * 100 : 0) / 100 + ')');
      }

      // lanzamiento
      if (changed('url')) {
        var u = S.url, sx = easeOut(seg(u, 0, .3));
        op(ref.url, sx > 0 ? 1 : 0);
        attr(ref.url, 'transform', 'translate(480 22) scale(' + f1(sx * 100) / 100 + ' 1) translate(-480 -22)');
        var n = Math.round(seg(u, .3, .95) * URL_TEXT.length);
        if (ref.urlT.__n !== n) { ref.urlT.__n = n; ref.urlT.textContent = URL_TEXT.slice(0, n); }
        attr(ref.caret, 'x', f1(356 + n * 7.1 + 1));
        op(ref.caret, u > .3 && u < 1 ? 1 : 0);
      }
      if (changed('load')) attr(ref.load, 'transform', 'scale(' + f1(easeOut(S.load) * 1000) / 1000 + ' 1)');
      if (changed('check')) {
        var ck = S.check;
        op(ref.check, ck > 0 ? 1 : 0);
        attr(ref.check, 'transform', 'translate(842 0) scale(' + f1(ck > 0 ? backOut(ck) * 100 : 0) / 100 + ')');
      }
      if (changed('conf')) {
        var c = S.conf;
        CONF.forEach(function (P, k) {
          var e = ref.conf[k];
          if (c <= 0 || c >= 1) { op(e, 0); return; }
          var x = 842 + P.vx * c, y = 0 + P.vy * c + 520 * c * c;
          attr(e, 'transform', 'translate(' + f1(x) + ' ' + f1(y) + ') rotate(' + f1(P.rot * c) + ')');
          op(e, c < .7 ? 1 : (1 - c) / .3);
        });
      }
      // logo
      if (changed('m')) {
        var m = S.m;
        op(ref.content, 1 - seg(m, 0, .6));
        op(ref.url, (S.url > 0 ? 1 : 0) * (1 - seg(m, 0, .4)));
        op(ref.logo, easeOut(seg(m, .4, 1)));
        op(ref.fx, 1 - seg(m, 0, .3));
      }

      for (var key in st) prev[key] = st[key];
    }

    function set(o) { for (var k in o) if (k in st) st[k] = o[k]; render(); }
    render();
    return { el: el, svg: root, set: set, state: st };
  }

  window.RGLienzo = { create: create };
})();
