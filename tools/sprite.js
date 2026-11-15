// Genera el sprite de símbolos SVG de public/index.html: es la fuente única de las formas
// (las partículas las muestrean y, sin WebGL, se ven tal cual en punteado).
// Uso: node tools/sprite.js   (reescribe el bloque <svg class="sprite"> de public/index.html)
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const RG = html.match(/d="(M57\.5[^"]*)"/)[1];

const n = v => Math.round(v * 100) / 100;
const rr = (x, y, w, h, r) => r ? `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${r} ${r} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${n(y)}Z`
  : `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
const circ = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0Z`;
// f = relleno, s = trazo; d = detalle (se omite en móvil)
// Estilo en atributos: los estilos del documento no siempre llegan dentro de <use>
const F = (d, extra = '') => `<path class="f${extra}" fill="url(#pdots)" d="${d}"/>`;
const S = (d, extra = '') => extra.includes('k')
  ? `<path class="s${extra}" fill="none" stroke="#F0561D" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0 5.4" d="${d}"/>`
  : `<path class="s${extra}" fill="none" stroke="#F0561D" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0 4.2" d="${d}"/>`;

const frame = () => S(rr(2, 2, 156, 106, 7)) + S('M2 17H158') + F(circ(11, 9.5, 2) + circ(18, 9.5, 2) + circ(25, 9.5, 2)) + S(rr(48, 6.5, 64, 6, 3), ' d');

const sym = {
  rg: ['0 0 125.8 83.8', `<path class="f" fill="url(#pdots)" fill-rule="evenodd" d="${RG}"/>`],
  'web-argila': ['0 0 160 110', frame() +
    F(rr(12, 24, 22, 4, 0)) + F(rr(110, 24, 10, 3, 0) + rr(124, 24, 10, 3, 0) + rr(138, 24, 10, 3, 0), ' d') +
    F(rr(12, 33, 62, 7, 0) + rr(12, 43, 42, 7, 0)) +
    [0, 1, 2, 3].map(k => S(rr(12 + k * 36.5, 58, 31, 32, 2)) +
      F(`M${n(20 + k * 36.5)} 86C${n(18 + k * 36.5)} 76 ${n(22 + k * 36.5)} 70 ${n(25 + k * 36.5)} 67V63H${n(30 + k * 36.5)}V67C${n(33 + k * 36.5)} 70 ${n(37 + k * 36.5)} 76 ${n(35 + k * 36.5)} 86Z`) +
      F(rr(12 + k * 36.5, 95, 18, 3, 0), ' d')).join('')],
  'web-cafe': ['0 0 160 110', frame() +
    F(rr(12, 26, 66, 8, 0) + rr(12, 37, 46, 8, 0)) +
    F(rr(12, 52, 62, 2.4, 0) + rr(12, 58, 58, 2.4, 0) + rr(12, 64, 50, 2.4, 0), ' d') +
    F(rr(12, 74, 36, 11, 5.5)) +
    S(rr(92, 26, 56, 72, 4)) + S('M96 88C108 80 104 64 118 60S138 48 144 32', ' d') +
    F('M122 66C116 58 112 53 112 48A10 10 0 0 1 132 48C132 53 128 58 122 66Z') +
    F(rr(12, 93, 30, 2.6, 0) + rr(64, 93, 10, 2.6, 0), ' d')],
  'web-moda': ['0 0 160 110', frame() +
    F(rr(12, 24, 74, 76, 2)) +
    F(rr(96, 27, 52, 9, 0) + rr(96, 40, 38, 9, 0)) +
    F(rr(96, 58, 52, 2.2, 0) + rr(96, 64, 46, 2.2, 0) + rr(96, 70, 50, 2.2, 0), ' d') +
    [0, 1, 2, 3].map(k => S(rr(96 + k * 13.5, 79, 10, 8, 2))).join('') +
    F(rr(96, 92, 52, 8, 4))],
  landing: ['0 0 70 140', S(rr(2, 2, 66, 136, 6)) +
    F(rr(10, 10, 18, 3, 0)) + F(rr(46, 10, 14, 3, 0), ' d') +
    F(rr(10, 20, 42, 6, 0) + rr(10, 29, 30, 6, 0)) +
    F(rr(10, 42, 50, 28, 2)) +
    F(circ(17, 82, 4.5) + circ(35, 82, 4.5) + circ(53, 82, 4.5)) +
    F(rr(10, 94, 50, 2.2, 0) + rr(10, 99.5, 42, 2.2, 0), ' d') +
    F(rr(18, 108, 34, 9, 4.5)) + S('M10 127H60', ' d')],
  tienda: ['0 0 76 140', S(rr(2, 2, 72, 136, 13)) + F(rr(28, 7, 20, 5, 2.5)) +
    F(rr(10, 20, 18, 3, 0)) + S(rr(56, 18, 10, 7, 1.5), ' d') +
    [0, 1, 2].map(j => [0, 1].map(i => F(rr(10 + i * 30, 30 + j * 30, 26, 21, 3)) + F(rr(10 + i * 30, 54 + j * 30, 14, 2, 0), ' d')).join('')).join('') +
    S(rr(10, 122, 56, 9, 4.5))],
  shield: ['0 0 100 112', S('M50 4L90 18V52C90 78 72 96 50 106C28 96 10 78 10 52V18Z') +
    S('M50 15L80 26V52C80 72 67 86 50 94C33 86 20 72 20 52V26Z', ' d') + S('M33 54L45 66L68 40', ' k')],
  bubble: ['0 0 120 96', S('M20 8H100A12 12 0 0 1 112 20V56A12 12 0 0 1 100 68H48L28 86L32 68H20A12 12 0 0 1 8 56V20A12 12 0 0 1 20 8Z') +
    F(circ(40, 38, 6) + circ(60, 38, 6) + circ(80, 38, 6))],
  doc: ['0 0 92 120', S('M8 4H62L84 26V116H8Z') + S('M62 4V26H84') +
    F(rr(18, 30, 36, 5, 0)) + F(rr(18, 44, 56, 2.4, 0) + rr(18, 52, 56, 2.4, 0) + rr(18, 60, 48, 2.4, 0) + rr(18, 68, 52, 2.4, 0), ' d') +
    F(rr(18, 86, 22, 3, 0) + rr(54, 83, 20, 7, 0)) + S('M18 104C26 96 30 110 38 102S50 98 56 104', ' d')],
  browser: ['0 0 160 110', frame() +
    F(rr(14, 26, 40, 4, 0) + rr(14, 33, 26, 4, 0), ' d') +
    S('M64 48L48 63L64 78', ' k') + S('M96 48L112 63L96 78', ' k') + S('M86 42L74 84', ' k') +
    F('M124 72L124 96L130 90L135 100L139.5 98L134.5 88L142 88Z')],
  rocket: ['0 0 100 132', S('M50 6C70 22 76 48 72 82H28C24 48 30 22 50 6Z') + S(circ(50, 44, 9)) +
    S('M28 64L14 86L28 82') + S('M72 64L86 86L72 82') + S('M38 82L42 92H58L62 82', ' d') +
    F('M42 97C44 108 48 116 50 126C52 116 56 108 58 97Z')],
  bag: ['0 0 110 120', S('M38 38V27A17 17 0 0 1 72 27V38', ' k') +
    F('M16 38H94L100 114H10Z') + S('M16 38H94L100 114H10Z', ' d')]
};

let out = '<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0"><defs>' +
  '<pattern id="pdots" width="3.4" height="3.4" patternUnits="userSpaceOnUse"><circle cx="1.7" cy="1.7" r=".8" fill="#F0561D"/></pattern></defs>';
for (const [k, [vb, body]] of Object.entries(sym)) out += `<symbol id="s-${k}" viewBox="${vb}">${body}</symbol>`;
out += '</svg>';
const next = html.replace(/<svg class="sprite"[\s\S]*?<\/svg>/, () => out);
fs.writeFileSync(FILE, next);
console.log('Sprite actualizado (' + out.length + ' bytes)');
