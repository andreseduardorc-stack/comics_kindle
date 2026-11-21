import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import { getMarmotaFeed, searchMarmotaComics, getComicChapters, getChapterPages } from './server/marmotaScraper.ts';
import { getMegaBananaFeed, searchMegaBanana, getMegaBananaReader, resolveMegaBananaUrl } from './server/megabananaScraper.ts';

/**
 * Puente API para desarrollo.
 *
 * OJO: esto vive en `configureServer`, así que SOLO existe con `npm run dev`.
 * El build de producción no lo lleva. Para GitHub Pages, los mismos endpoints
 * los sirve el Cloudflare Worker de `worker/index.ts`, y el front lo encuentra
 * a través de la variable de entorno `VITE_API_BASE`.
 */
function comicApiPlugin(): Plugin {
  /** Un catálogo totalmente vacío significa scraping roto, no «no hay cómics». */
  const assertFeedNotEmpty = (feed: { dc: unknown[]; marvel: unknown[] }, source: string) => {
    if (feed.dc.length === 0 && feed.marvel.length === 0) {
      throw new Error(`${source} no devolvió ningún cómic. Puede que haya cambiado su estructura.`);
    }
  };

  const routes: Record<string, (p: URLSearchParams) => Promise<unknown>> = {
    '/api/marmota/feed': async () => {
      const feed = await getMarmotaFeed();
      assertFeedNotEmpty(feed, 'Marmota');
      return feed;
    },
    '/api/marmota/search': p => searchMarmotaComics(p.get('q') || '', p.get('publisher') || 'ALL'),
    '/api/marmota/chapters': p => getComicChapters(p.get('url') || ''),
    '/api/marmota/pages': p => getChapterPages(p.get('url') || ''),
    '/api/megabanana/feed': async () => {
      const feed = await getMegaBananaFeed();
      assertFeedNotEmpty(feed, 'MegaBanana');
      return feed;
    },
    '/api/megabanana/search': p => searchMegaBanana(p.get('q') || '', p.get('publisher') || 'ALL'),
    '/api/megabanana/resolve': p => resolveMegaBananaUrl(p.get('url') || ''),
    '/api/megabanana/reader': p => getMegaBananaReader(p.get('postId') || '', p.get('chapter') || '1')
  };

  return {
    name: 'comic-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const urlObj = new URL(req.url, 'http://localhost:5173');
        const handler = routes[urlObj.pathname];

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (!handler) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
          return;
        }

        try {
          res.end(JSON.stringify(await handler(urlObj.searchParams)));
        } catch (error: any) {
          console.error('API Error:', error);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: error?.message || 'Error interno del puente API' }));
        }
      });
    }
  };
}

/**
 * GitHub Pages sirve el sitio bajo /<repo>/. En local, `npm run dev` usa '/'.
 * Se normaliza para que una barra de más o de menos no rompa el despliegue.
 */
function resolveBasePath(): string {
  const raw = (process.env.VITE_BASE_PATH || '/').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig({
  base: resolveBasePath(),
  plugins: [react(), comicApiPlugin()],
  build: {
    target: 'es2022'
  }
});
