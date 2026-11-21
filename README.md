# KindleComics — Lector de cómics DC y Marvel en español

Recopila cómics en español de **MegaBanana** (`megabanana.mx`) y **Marmota Comics** (`marmota.me`)
y los presenta en un lector con estética de tinta electrónica, sin anuncios ni acortadores.

---

## Arquitectura

El front es estático; los scrapers necesitan un servidor. Por eso hay **dos piezas**:

```
┌──────────────────────────────────────────────────────────┐
│  Front (React + Vite)                                    │
│  GitHub Pages — andreseduardorc-stack.github.io/…        │
│  Temas, modos de lectura, progreso, CBZ en IndexedDB     │
└───────────────────────────┬──────────────────────────────┘
                            │ fetch a  ${VITE_API_BASE}/api/…
┌───────────────────────────▼──────────────────────────────┐
│  Puente API                                              │
│  · En desarrollo: plugin de Vite  (vite.config.ts)       │
│  · En producción: Cloudflare Worker  (worker/index.ts)   │
│  Ambos usan los mismos scrapers de server/               │
└───────────────┬──────────────────────┬───────────────────┘
                │                      │
        megabanana.mx            marmota.me
```

**El puente no es opcional.** Un sitio estático no puede rascar esas dos webs: hay CORS de por
medio y hace falta cabecera de navegador. Si compilas sin `VITE_API_BASE`, la aplicación lo dice
en un aviso en pantalla en vez de mostrar una biblioteca vacía sin explicación.

---

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 — el plugin de Vite hace de puente API
npm run lint
npm run build
```

En Windows también sirve hacer doble clic en `iniciar.bat`.

---

## Publicar en GitHub Pages

### 1. Desplegar el puente API (una vez)

```bash
npx wrangler login
npx wrangler deploy          # usa wrangler.toml → worker/index.ts
```

Wrangler devuelve una dirección del tipo `https://kindlecomics-api.TU-SUBDOMINIO.workers.dev`.
Compruébala abriendo `…/api/megabanana/feed` en el navegador: debe devolver JSON.

Si cambia la dirección del sitio, ajusta `ALLOWED_ORIGINS` en `wrangler.toml` y vuelve a desplegar.
Con la cadena vacía acepta cualquier origen, lo cual va bien para probar y mal para dejarlo así.

### 2. Configurar el repositorio

- **Settings → Pages → Build and deployment → Source: GitHub Actions.**
- **Settings → Secrets and variables → Actions → Variables → New repository variable:**
  - Nombre: `VITE_API_BASE`
  - Valor: la dirección del Worker, sin barra final.

### 3. Desplegar

Cada `push` a `main` lanza `.github/workflows/deploy.yml`, que compila con
`VITE_BASE_PATH=/<nombre-del-repo>/` y publica `dist/`. También se puede lanzar a mano desde la
pestaña **Actions**.

### Compilar en local igual que en producción

```bash
VITE_BASE_PATH=/comics_kindle/ VITE_API_BASE=https://…workers.dev npm run build
npm run preview
```

En Git Bash usa PowerShell o `MSYS_NO_PATHCONV=1`: si no, convierte `/comics_kindle/` en una ruta
de Windows y la base del sitio sale mal.

---

## Lo que hace el lector

- **Temas**: oscuro, sepia, claro y tinta electrónica. Se recuerda entre sesiones.
- **Modos**: página individual, doble página y desplazamiento continuo. También se recuerda.
- **Zoom con desplazamiento**: al ampliar, la página crece de verdad y se puede recorrer. El
  pinch del móvil sigue disponible.
- **Gestos**: deslizar pasa página; tocar los tercios laterales también; el centro muestra u
  oculta los controles.
- **Marcadores** por página, guardados y dibujados sobre la barra de progreso.
- **Botón Atrás** del navegador: vuelve a la biblioteca en lugar de salir de la aplicación.
- **Errores visibles**: si una página no carga, lo dice y ofrece reintentar o saltarla.

### Atajos de teclado

| Tecla | Acción |
| :--- | :--- |
| `→` / `Espacio` / `AvPág` / `L` | Página siguiente |
| `←` / `RePág` / `H` | Página anterior |
| `Inicio` / `Fin` | Primera / última página |
| `F` | Pantalla completa |
| `M` | Modo: individual → doble → continuo |
| `T` | Tema: oscuro → sepia → claro → tinta electrónica |
| `B` | Marcar esta página |
| `+` / `−` / `0` | Zoom |
| `Esc` | Mostrar u ocultar los controles |
| `?` | Atajos de teclado |

---

## Biblioteca

- **Estado en la URL**: búsqueda, editorial, fuente, héroe y pestaña viajan en la dirección, así
  que se puede compartir y sobrevive a una recarga.
- **Favoritos** e **importados** como filtros, con su contador.
- **Importar CBZ/ZIP**: arrastrando o eligiendo el archivo. Las páginas se guardan en
  **IndexedDB**, de modo que el cómic sigue ahí tras recargar y se lee sin conexión. Si alguna vez
  se pierden (otro navegador, datos borrados), la tarjeta lo avisa en vez de abrir un lector lleno
  de imágenes rotas.
- **Importar por enlace**: identificador de Archive.org o URL de MegaBanana.

---

## Aviso

Proyecto de aficionado, sin ánimo de lucro y sin publicidad. Los cómics pertenecen a DC Comics y
Marvel Comics; este lector no los aloja: muestra lo que publican `megabanana.mx` y `marmota.me`.
