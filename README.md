# rgdevstudio

Web personal de rgdevstudio. HTML, CSS y JavaScript sin framework ni paso de build.

```
public/          el sitio (lo que se publica)
  index.html       contenido + sprite de formas SVG al final
  css/styles.css   colores (también los de las partículas), tipografía, duraciones y curvas en :root
  js/main.js       scroll suave, textos, pins y guion de escenas (ajustes en CONFIG)
  js/particulas.js el campo de partículas en WebGL (ajustes en CONFIG); se carga en diferido
  vendor/        GSAP, ScrollTrigger y Lenis (copias locales)
  fonts/         Lora (titulares), Newsreader cursiva y Archivo, recortadas a latín
tools/sprite.js  regenera las formas SVG del sprite (node tools/sprite.js)
wrangler.jsonc   configuración de Cloudflare Workers (static assets)
```

## Verla en local

```bash
npx wrangler dev
```

## Publicar en Cloudflare

```bash
npx wrangler deploy
```

La primera vez te pedirá iniciar sesión en Cloudflare. También puedes conectar el repositorio desde el panel
(Workers & Pages → Create → Import a repository); no hace falta comando de build.

## Formulario de contacto

Usa [Web3Forms](https://web3forms.com): los mensajes llegan por email, sin servidor ni contraseñas en el código.

1. Entra en web3forms.com, escribe `rubeng.seo@gmail.com` y pulsa "Create Access Key".
2. Copia la clave que te llega al correo.
3. En `public/index.html`, sustituye `TU_ACCESS_KEY` por esa clave.

Mientras no haya clave, el botón "Enviar" abre el correo del visitante con el mensaje ya escrito.

## Antes de lanzar

En `public/index.html`, cambia `https://rgdevstudio.netlify.app/` por tu dominio definitivo
(canonical, `og:url`, `og:image` y el bloque JSON-LD).

## Las partículas: cómo funcionan

Un único `<canvas>` fijo detrás de toda la web (decorativo, `aria-hidden`) dibuja miles de puntos que se
ordenan en una forma distinta en cada sección: RG → navegador de cada proyecto → página / móvil / escudo →
bocadillo / documento / navegador / cohete → «0,8» y «99,9 %» → nube suave → bolsa → RG.

- **Las formas** son los `<symbol>` del sprite que hay al final de `index.html`. Se dibujan con
  `tools/sprite.js`: cambia ahí una forma y ejecuta `node tools/sprite.js`. Las partículas las muestrean
  al cargar y, si no hay WebGL, esos mismos SVG se ven en punteado (versión estática).
- **Dónde se forman**: cada sección tiene un hueco `.pslot` (con su tamaño reservado en CSS, así no hay
  saltos de maquetación). La forma se ajusta al rectángulo de ese hueco.
- **Cuándo**: `buildHolds()` en `js/particulas.js` define, para cada forma, el tramo de scroll en que está
  quieta. Entre dos tramos hay un morph, que se calcula en la GPU.
- **Carga**: el titular lo pinta el CSS solo. `particulas.js` se pide después de `load`, en un momento
  libre, y aparece con un fundido. Si falla o no hay WebGL, la web sigue completa.
- **Rendimiento**: un solo draw call; devicePixelRatio ≤ 2; se pausa con la pestaña oculta; si los fps
  caen de forma sostenida, se dibujan menos partículas. Para probar otro número: `?particulas=18000`.
- **iPhone**: la inclinación necesita permiso. Se pide en el primer toque que no sea sobre un enlace,
  botón o campo. Si no se concede, el campo hace una deriva lenta.
- **Movimiento reducido**: sin morph ni cursor; cada sección muestra su forma quieta, con un fundido corto.

## Ajustar las animaciones

**Variables CSS** (al principio de `public/css/styles.css`)
- `--p-base-1..3`: colores de las partículas (naranja, gris perla profundo, gris perla claro).
- `--p-argila-*`, `--p-cafe-*`, `--p-moda-*`: paletas de cada proyecto (solo en Trabajos).
- `--p-fade`: fundido de entrada del campo. `--accent`, `--dur-*`, `--ease-*`, `--intro-*`: resto de la web.

**`CONFIG` en `public/js/particulas.js`** (el render)
- `count`: partículas por tipo de dispositivo (escritorio 18 000, escritorio potente 24 000, móvil 5 200,
  móvil modesto 3 600, GPU por software 6 000).
- `pointSize`, `halo`, `haloAlpha`, `glow`, `alpha`: tamaño y brillo de cada punto (`glow` 0 = mezcla
  normal, 1 = aditiva pura).
- `colorWeights`: reparto entre los tres tonos de cada paleta.
- `intro`, `morph` (`scatter`, `stagger`), `breathe`, `burst`: duraciones y fuerza de cada efecto.
- `cursor` (`radius`, `force`, `stiffness`, `damping`, `ripple`…): el «agua» alrededor del ratón.
- `tilt` y `drift`: inclinación del móvil y deriva lenta.
- `fps`: umbral y pasos de la reducción automática de partículas.

**`CONFIG` en `public/js/main.js`** (el scroll)
- `pin`: pantallas que duran Trabajos y Proceso fijados (escritorio).
- `scenes.works` / `scenes.process`: en qué fracción del pin está quieta cada forma.
- `scenes.morph`: pantallas mínimas de cada morph. `scenes.cloudAlpha` y `scenes.cloudCursor`: la nube.
- `reveal`, `title`, `services`, `project`, `counter`, `magnetic`, `toTopDuration`: resto de animaciones.

Modos: `is-wide` (escritorio con ratón ≥1024×600) con composiciones en dos columnas; `is-pin` (igual, con
movimiento) fija Trabajos y Proceso; móvil/tablet sin fijar, con un hueco por proyecto, servicio y paso;
`is-reduced` con todo quieto y visible.
