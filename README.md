# 📖 KindleComics — Lector de Cómics DC y Marvel en Español
### Bases: [megabanana.mx](https://megabanana.mx/megabanana-home/) & [marmota.me](https://marmota.me/) • Máscara: Lector Estilo Kindle

Una aplicación web moderna con diseño y experiencia de lectura **estilo Kindle**, que recopila cómics de **DC Comics** y **Marvel Comics** en español desde dos grandes fuentes de internet: **MegaBanana (`megabanana.mx`)** y **Marmota Comics (`marmota.me`)**, proporcionando una **máscara elegante, ultra-rápida y libre de anuncios y acortadores**.

---

## 🏗️ Arquitectura: Multi-Base + Máscara Kindle

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MÁSCARA: Interfaz KindleComics                       │
│  • Estética E-Reader (Kindle Dark OLED, Sepia Paperwhite, E-Ink)       │
│  • Modos de lectura: Página individual, Doble página, Scroll Webtoon   │
│  • Barra de progreso deslizante (scrubber), zoom y tiempo restante     │
│  • Continuar leyendo con guardado automático de posición               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (API Bridge / Proxy Interno)
         ┌──────────────────────────┴──────────────────────────┐
         │                                                     │
┌────────▼─────────────────────────┐         ┌─────────────────▼───────────────┐
│     BASE 1: MegaBanana           │         │     BASE 2: Marmota Comics      │
│  (https://megabanana.mx/)        │         │     (https://marmota.me/)       │
│  • Más de 1,400 cómics en español│         │  • Cómics recientes y eventos   │
│  • 347 DC / 551 Marvel en español│         │  • Desglose por tomos y números │
│  • Carga en formato WebP rápido  │         │  • Sincronización en vivo       │
└──────────────────────────────────┘         └─────────────────────────────────┘
```

---

## ✨ Características y Fuentes Integradas

### 1. Recopilación Dual: MegaBanana + Marmota Comics
- **MegaBanana (`megabanana.mx`)**: Conexión directa a través de su API interna REST (`/wp-json/megabanana/v1/`), con acceso a sus colecciones completas de **DC** (ej. *Batman Reptilian*, *Mr. Terrific Año Uno*, *Justice League Infinity*) y **Marvel** (ej. *Avengers Armageddon*, *Spider-Geddon*, *Spiderman 1602*).
- **Marmota Comics (`marmota.me`)**: Sincronización en vivo de lanzamientos recientes (*Batman: Bad Seeds*, *The Infernal Hulk*, *Nightwing*, *Iron Man*).
- **Selector de Números y Capítulos**: Muestra la lista de números disponibles para cada serie con el número de páginas por entrega.
- **Filtros por Fuente**: Permite ver todas las fuentes juntas, o filtrar específicamente por `🍌 MegaBanana` o `Marmota`.
- **Búsqueda Unificada**: La barra de búsqueda consulta en paralelo ambas plataformas para encontrar cualquier personaje o arco argumental.
- **Sin Publicidad**: Filtra automáticamente todo el spam publicitario, pop-ups y redirecciones de las páginas fuente.

### 2. Experiencia de Lectura Estilo Kindle
- **Barra de navegación inmersiva**: Ocultamiento automático de barras de control durante la lectura. Toca el centro de la pantalla o presiona `Esc`/`Espacio` para mostrarlas.
- **Temas Kindle**: Dark OLED (`#0e0e0e`), Sepia Paperwhite Cálido (`#f7efe0`), Claro (`#fcfcfc`) y E-Ink monocromático.
- **Modos de lectura**: Página única, doble página y scroll continuo (webtoon).
- **Continuar Lectura**: Banner inteligente que recuerda el cómic, capítulo y página exacta donde te quedaste.

---

## ⌨️ Atajos de Teclado del Lector

| Tecla | Acción |
| :--- | :--- |
| `▶` / `Espacio` / `AvPág` / `L` | Página siguiente |
| `◀` / `RePág` / `H` | Página anterior |
| `F` | Pantalla completa (Fullscreen) |
| `M` | Alternar modo: Página individual / Doble página / Scroll continuo |
| `T` | Alternar temas: Oscuro / Sepia / Claro / E-Ink |
| `+` / `-` | Aumentar / Disminuir Zoom |
| `0` | Restablecer Zoom al 100% |
| `Esc` | Mostrar / Ocultar controles Kindle |
| `?` | Abrir ayuda de atajos |

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Acceso Directo (Windows)
Haz doble clic sobre el archivo **`iniciar.bat`** en la carpeta del proyecto. Se abrirá automáticamente en tu navegador en `http://localhost:5173`.

### Opción 2: Desde la Terminal
```bash
# Iniciar servidor
npm run dev

# Compilar para producción
npm run build
```
# comics_kindle
