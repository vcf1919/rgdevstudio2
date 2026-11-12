# rgdevstudio

Web personal de rgdevstudio. HTML, CSS y JavaScript sin framework ni paso de build.

```
public/          el sitio (lo que se publica)
  index.html
  css/styles.css
  js/main.js
  vendor/        GSAP, ScrollTrigger y Lenis (copias locales)
  fonts/         Archivo y Newsreader (copias locales)
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
