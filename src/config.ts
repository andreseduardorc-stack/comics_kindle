/**
 * Base del puente API que habla con megabanana.mx y marmota.me.
 *
 * - En desarrollo (`npm run dev`) queda vacía: las peticiones van a `/api/...`
 *   y las atiende el plugin de Vite declarado en `vite.config.ts`.
 * - En producción (GitHub Pages) apunta al Cloudflare Worker de `worker/`,
 *   porque un hosting estático no puede ejecutar los scrapers.
 *
 * Se define al compilar con la variable de entorno `VITE_API_BASE`.
 */
const RAW_BASE = (import.meta.env.VITE_API_BASE ?? '').trim();

export const API_BASE = RAW_BASE.replace(/\/+$/, '');

/**
 * `true` cuando la app está compilada para producción pero nadie configuró
 * el Worker. Sin esto la biblioteca saldría vacía y en silencio.
 */
export const IS_API_MISCONFIGURED = import.meta.env.PROD && API_BASE === '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
