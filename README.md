# rgdevstudio

Web personal de rgdevstudio. HTML, CSS y JavaScript sin framework ni paso de build.

```
public/          el sitio (lo que se publica)
  index.html
  css/styles.css   colores, tipografía, la pieza 3D (profundidad, ángulos, tamaños) y curvas en :root
  js/main.js       el motor de la pieza, las escenas y el resto de animaciones (ajustes en CONFIG)
  vendor/        GSAP, ScrollTrigger y Lenis (copias locales)
  fonts/         Lora (titulares), Newsreader cursiva y Archivo, recortadas a latín
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

## El concepto: «vista explosionada»

La protagonista es la web de un cliente (la «pieza») que flota girada en 3D y, con el scroll, se separa
en 5 capas a distinta profundidad: **Fondo, Imagen, Tipografía, Interfaz y Comercio**. Cada capa es HTML/SVG
con su `translateZ`, su sombra precalculada y una etiqueta técnica («Tipografía · Lora», «Botón · 44 px»…).

La pieza está en el HTML del hero (sin JS se ve ahí, montada y quieta). Al arrancar, el JS la pasa a un
escenario fijo (`.stage`) y, en cada fotograma, la coloca en el hueco (`.slot[data-slot]`) de la sección
que domina la pantalla. Al pasar de un hueco a otro se desliza y se funde, así que nunca tapa texto.

- **Móvil**: en Trabajos, Servicios y Proceso la pieza va en una franja pegada arriba (`.band`) y el texto
  pasa por debajo. En el resto de secciones va en su hueco, en línea con el texto.
- **Escritorio** (≥1024×600): la franja es una columna fija al lado contrario del texto.
- **Movimiento reducido**: sin scroll suave ni flotación; la pieza se queda quieta en el estado de cada sección.

Escenas: hero (se separa con el primer scroll) → Trabajos (cambio capa a capa por proyecto) → Servicios
(landing alargada / tarjeta al carrito +1 / capas alineadas y «Actualizado») → Proceso (notas → cajas grises
→ contenido → todo junto) → Ventajas (la capa «Carga · 0,8 s» se adelanta) → Sobre mí y FAQ (pequeña y casi
quieta) → Contacto (se monta y se publica; «Enviar» se ilumina) → Footer (se comprime en el monograma RG).

## Ajustar las animaciones

**La pieza, en CSS** (`:root` de `public/css/styles.css`; el bloque `@media (min-width: 1024px) and (min-height: 600px)`
tiene los valores de escritorio). Son números sin unidad porque el JS también los lee:

| Variable | Qué hace | Móvil | Escritorio |
| --- | --- | --- | --- |
| `--pz-gap` | separación entre capas (px de la pieza, antes de escalar) | 60 | 70 |
| `--pz-rx-a`, `--pz-ry-a`, `--pz-rz-a` | ángulos con la pieza montada (grados) | 6 / 16 / −2 | 6 / −16 / 1 |
| `--pz-rx-e`, `--pz-ry-e`, `--pz-rz-e` | ángulos con las capas separadas (abanico lateral) | 12 / 48 / −3 | 16 / −38 / 2 |
| `--pz-w`, `--pz-h`, `--pz-font` | tamaño de la pieza en em y px por em | 24×42 em · 10 px | 44×28 em · 14 px |
| `--pz-persp` | perspectiva | 1100px | 1900px |
| `--pz-load-x`, `--pz-load-z` | Ventajas: cuánto se aparta y se adelanta la capa de carga | −78 % · 2,6 | −8 % · 5,4 |

Otras: `--pz-swap` (retraso entre capas al cambiar de proyecto), `--pz-float-amp` y `--pz-float-dur`
(flotación continua), `--band-h` (alto de la franja en móvil), `--light` (color de la luz), `--tint-*`
(paletas de los proyectos, solo en Trabajos), `--dur-*` y `--ease-*` (duraciones y curvas).
Los colores de cada variante de la pieza están en las reglas `.bg0`–`.bg3`, `.cta .var:nth-of-type(n)` y en los SVG del HTML.

**El ritmo, en JS** (objeto `CONFIG` al principio de `public/js/main.js`):

- `states`: estado de la pieza en cada hueco (`ex` separación 0–1, `iso` ángulo de plano 0–1, `frame` marco, `sc` escala).
- `hero.screens`: pantallas de scroll que dura la separación del hero.
- `care` y `launch`: cómo quedan las capas en Mantenimiento y en «Lanzamos».
- `trigger`: en qué punto de la pantalla cambian proyecto, servicio y paso (móvil y escritorio).
- `blend`: cómo pasa la pieza de un hueco a otro; `fit`: cuánto ocupa de su hueco; `tagsAt`: cuándo aparecen las etiquetas.
- `light`, `shadow`, `tilt`: recorrido de la luz, desplazamiento de las sombras e inclinación (ratón ±4°, giroscopio ±2°).
- `swap`, `reveal`, `title`, `services`, `project`, `counter`, `publish`, `toTop`, `magnetic`: duraciones y easings del resto.

El contenido de la pieza en cada escena se decide con atributos `data-*` en `.pz` (`data-v` proyecto,
`data-svc` servicio, `data-step` paso, `data-load`, `data-pub`, `data-mono`), y el CSS los traduce a lo que se ve
(sección «Estados» de la pieza en `styles.css`).

**Rendimiento**: solo se animan `transform` y `opacity`; las sombras son degradados ya pintados que solo
cambian de posición, escala y opacidad. Las variantes ocultas usan `visibility: hidden` para no pintarse.
El titular del hero se revela solo con CSS (el LCP no depende del JS).

El giroscopio solo se usa donde no hace falta pedir permiso (Android). En iOS no se pide para no interrumpir
con un aviso, así que no hay inclinación.
