# rgdevstudio

Web personal de rgdevstudio. HTML, CSS y JavaScript sin framework ni paso de build.

```
public/          el sitio (lo que se publica)
  index.html
  css/styles.css   colores, tipografía, duraciones y curvas en :root
  js/lienzo.js     el lienzo SVG (boceto → wireframe → diseño → interactivo → publicado → logo)
  js/main.js       la línea, el "director" del lienzo y el resto de animaciones (ajustes en CONFIG)
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

## Ajustar las animaciones

- **Colores, duraciones y curvas**: variables al principio de `public/css/styles.css` (`--accent`, `--tint-*`, `--thread-w`, `--dur-*`, `--ease-*`, `--intro-*`, `--float-*`).
- **Ritmo del scroll**: objeto `CONFIG` al principio de `public/js/main.js` (pantallas que dura cada sección fijada, altura de la "punta" de la línea, duración del confeti, contadores…).
- **Las fases del lienzo** se reparten en la función `rebuild()` del director (`main.js`): cada `key(posición, { … })` dice en qué fase está el lienzo en ese punto del scroll.

Modos: escritorio (≥1024×600) con lienzo fijo y secciones fijadas; móvil/tablet con lienzos en línea y menos fases;
`prefers-reduced-motion` con todo quieto y visible.
