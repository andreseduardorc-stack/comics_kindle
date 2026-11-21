import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import { getMarmotaFeed, searchMarmotaComics, getComicChapters, getChapterPages } from './server/marmotaScraper.ts';
import { getMegaBananaFeed, searchMegaBanana, getMegaBananaReader, resolveMegaBananaUrl } from './server/megabananaScraper.ts';

// Custom Vite plugin acting as API bridge for marmota.me and megabanana.mx
function comicApiPlugin(): Plugin {
  return {
    name: 'comic-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url || (!req.url.startsWith('/api/marmota/') && !req.url.startsWith('/api/megabanana/'))) {
          return next();
        }

        const urlObj = new URL(req.url, 'http://localhost:5173');
        const pathname = urlObj.pathname;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          // ============= MARMOTA.ME ENDPOINTS =============
          if (pathname === '/api/marmota/feed') {
            const feed = await getMarmotaFeed();
            res.end(JSON.stringify(feed));
            return;
          }

          if (pathname === '/api/marmota/search') {
            const q = urlObj.searchParams.get('q') || '';
            const pub = urlObj.searchParams.get('publisher') || 'ALL';
            const results = await searchMarmotaComics(q, pub);
            res.end(JSON.stringify(results));
            return;
          }

          if (pathname === '/api/marmota/chapters') {
            const comicUrl = urlObj.searchParams.get('url') || '';
            const chapters = await getComicChapters(comicUrl);
            res.end(JSON.stringify(chapters));
            return;
          }

          if (pathname === '/api/marmota/pages') {
            const chapterUrl = urlObj.searchParams.get('url') || '';
            const pages = await getChapterPages(chapterUrl);
            res.end(JSON.stringify(pages));
            return;
          }

          // ============= MEGABANANA.MX ENDPOINTS =============
          if (pathname === '/api/megabanana/feed') {
            const feed = await getMegaBananaFeed();
            res.end(JSON.stringify(feed));
            return;
          }

          if (pathname === '/api/megabanana/search') {
            const q = urlObj.searchParams.get('q') || '';
            const pub = urlObj.searchParams.get('publisher') || 'ALL';
            const results = await searchMegaBanana(q, pub);
            res.end(JSON.stringify(results));
            return;
          }

          if (pathname === '/api/megabanana/resolve') {
            const targetUrl = urlObj.searchParams.get('url') || '';
            const resolved = await resolveMegaBananaUrl(targetUrl);
            res.end(JSON.stringify(resolved));
            return;
          }

          if (pathname === '/api/megabanana/reader') {
            const postId = urlObj.searchParams.get('postId') || '';
            const chapter = urlObj.searchParams.get('chapter') || '1';
            const readerData = await getMegaBananaReader(postId, chapter);
            res.end(JSON.stringify(readerData));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        } catch (error: any) {
          console.error('API Error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error?.message || 'Internal Server Error' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), comicApiPlugin()],
});
