/**
 * Puente API de KindleComics (Cloudflare Worker).
 *
 * GitHub Pages es hosting estático: no puede ejecutar los scrapers de
 * `server/`. Este Worker expone los mismos endpoints que el plugin de Vite
 * usa en desarrollo, para que el front compilado no note la diferencia.
 *
 * Reutiliza tal cual los scrapers: solo usan `fetch`, expresiones regulares y
 * cadenas, así que corren en el runtime de Workers sin adaptación.
 */
import { getMarmotaFeed, searchMarmotaComics, getComicChapters, getChapterPages } from '../server/marmotaScraper';
import { getMegaBananaFeed, searchMegaBanana, getMegaBananaReader, resolveMegaBananaUrl } from '../server/megabananaScraper';

export interface Env {
  /** Orígenes autorizados, separados por comas. Vacío = cualquiera. */
  ALLOWED_ORIGINS?: string;
}

/** Segundos que cada respuesta se queda en la caché de borde. */
const CACHE_TTL: Record<string, number> = {
  '/api/marmota/feed': 900,
  '/api/megabanana/feed': 900,
  '/api/marmota/search': 300,
  '/api/megabanana/search': 300,
  '/api/marmota/chapters': 600,
  '/api/marmota/pages': 3600,
  '/api/megabanana/reader': 3600,
  '/api/megabanana/resolve': 3600
};

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowList = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowed = allowList.length === 0 || allowList.includes(origin);

  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : (allowList.length === 0 ? '*' : allowList[0]),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(body: unknown, status: number, headers: Record<string, string>, ttl: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 && ttl > 0 ? `public, max-age=${ttl}` : 'no-store'
    }
  });
}

/** Un catálogo totalmente vacío significa que el scraping se rompió, no que no haya cómics. */
function assertFeedNotEmpty(feed: { dc: unknown[]; marvel: unknown[] }, source: string): void {
  if (feed.dc.length === 0 && feed.marvel.length === 0) {
    throw new Error(`${source} no devolvió ningún cómic. Puede que haya cambiado su estructura.`);
  }
}

async function route(pathname: string, params: URLSearchParams): Promise<unknown> {
  switch (pathname) {
    case '/api/marmota/feed': {
      const feed = await getMarmotaFeed();
      assertFeedNotEmpty(feed, 'Marmota');
      return feed;
    }
    case '/api/marmota/search':
      return searchMarmotaComics(params.get('q') || '', params.get('publisher') || 'ALL');
    case '/api/marmota/chapters':
      return getComicChapters(params.get('url') || '');
    case '/api/marmota/pages':
      return getChapterPages(params.get('url') || '');
    case '/api/megabanana/feed': {
      const feed = await getMegaBananaFeed();
      assertFeedNotEmpty(feed, 'MegaBanana');
      return feed;
    }
    case '/api/megabanana/search':
      return searchMegaBanana(params.get('q') || '', params.get('publisher') || 'ALL');
    case '/api/megabanana/resolve':
      return resolveMegaBananaUrl(params.get('url') || '');
    case '/api/megabanana/reader':
      return getMegaBananaReader(params.get('postId') || '', params.get('chapter') || '1');
    default:
      return undefined;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Método no permitido' }, 405, cors, 0);
    }

    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    if (pathname === '/' || pathname === '/health') {
      return json({ ok: true, service: 'kindlecomics-api' }, 200, cors, 0);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const withCors = new Response(cached.body, cached);
      Object.entries(cors).forEach(([k, v]) => withCors.headers.set(k, v));
      withCors.headers.set('X-Cache', 'HIT');
      return withCors;
    }

    try {
      const data = await route(pathname, searchParams);
      if (data === undefined) {
        return json({ error: 'Endpoint no encontrado' }, 404, cors, 0);
      }

      const ttl = CACHE_TTL[pathname] ?? 0;
      const response = json(data, 200, cors, ttl);
      if (ttl > 0) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno del puente API';
      return json({ error: message }, 502, cors, 0);
    }
  }
};
