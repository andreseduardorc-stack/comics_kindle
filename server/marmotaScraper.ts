// Scraper and API parser for https://marmota.me/
import type { Comic, Chapter, Publisher } from '../src/types/comic';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string, options: RequestInit = {}): Promise<string> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': USER_AGENT,
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} from ${url}`);
    }
    return await res.text();
  } catch (err: any) {
    console.error(`Error fetching ${url}:`, err.message);
    throw err;
  }
}

export function parseMarmotaCards(html: string, defaultPublisher: Publisher = 'DC'): Comic[] {
  const comics: Comic[] = [];
  const cardChunks = html.split(/<div class=["'](?:col-6|row\s+c-tabs-item__content|page-item-detail manga)/i);
  
  for (const chunk of cardChunks.slice(1)) {
    const titleMatch = chunk.match(/<h3[^>]*>[\s\S]*?<a href=["'](https:\/\/marmota\.me\/comic\/[^"']+)["']>([\s\S]*?)<\/a>/i) ||
                       chunk.match(/<div class=["']post-title[\s\S]*?<a href=["'](https:\/\/marmota\.me\/comic\/[^"']+)["']>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    const url = titleMatch[1];
    const rawTitle = titleMatch[2].replace(/<[^>]+>/g, '').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").trim();
    
    // Extract cover image
    const coverMatch = chunk.match(/data-src=["']\s*(https?:\/\/marmota\.me\/wp-content\/uploads\/[^"'\s]+)/i) ||
                       chunk.match(/src=["']\s*(https?:\/\/marmota\.me\/wp-content\/uploads\/[^"'\s]+)/i);
    const coverUrl = coverMatch ? coverMatch[1].replace('http://', 'https://') : 'https://marmota.me/wp-content/uploads/2023/03/logo-marmota-me.png';

    // Extract year from title if present (e.g. "Batman: Bad Seeds (2026)")
    const yearMatch = rawTitle.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    const cleanTitle = rawTitle.replace(/\(\d{4}\)/, '').trim();

    let hero = cleanTitle.split(/[:\-\/]/)[0].trim();
    if (!hero || hero.length > 25) {
      hero = defaultPublisher;
    }

    comics.push({
      id: 'marmota-' + url.replace(/https?:\/\/marmota\.me\/comic\//, '').replace(/\/$/, ''),
      title: cleanTitle || rawTitle,
      fullTitle: rawTitle,
      publisher: defaultPublisher,
      hero,
      year,
      language: 'Español',
      coverUrl,
      description: `Cómic publicado en español en Marmota Comics (${cleanTitle}). Disponible para leer en modo Kindle.`,
      source: 'marmota',
      url,
      totalPages: 24
    });
  }

  // Deduplicate
  const seen = new Set<string>();
  return comics.filter(c => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

export async function getMarmotaFeed(): Promise<{ dc: Comic[]; marvel: Comic[] }> {
  const [dcHtml, marvelHtml] = await Promise.allSettled([
    fetchHtml('https://marmota.me/genero/dc-comics/'),
    fetchHtml('https://marmota.me/genero/marvel-comics/')
  ]);

  const dcCards = dcHtml.status === 'fulfilled' ? parseMarmotaCards(dcHtml.value, 'DC') : [];
  const marvelCards = marvelHtml.status === 'fulfilled' ? parseMarmotaCards(marvelHtml.value, 'Marvel') : [];

  return { dc: dcCards, marvel: marvelCards };
}

export async function searchMarmotaComics(query: string, publisherFilter: string = 'ALL'): Promise<Comic[]> {
  if (!query || !query.trim()) return [];
  const cleanQuery = encodeURIComponent(query.trim());
  const searchUrl = `https://marmota.me/?s=${cleanQuery}&post_type=wp-manga`;

  try {
    const html = await fetchHtml(searchUrl);
    let defaultPub: Publisher = 'Other';
    const lower = query.toLowerCase();
    if (lower.includes('batman') || lower.includes('superman') || lower.includes('flash') || lower.includes('dc')) {
      defaultPub = 'DC';
    } else if (lower.includes('spider') || lower.includes('hulk') || lower.includes('marvel') || lower.includes('x-men') || lower.includes('avengers')) {
      defaultPub = 'Marvel';
    } else if (publisherFilter === 'DC') {
      defaultPub = 'DC';
    } else if (publisherFilter === 'Marvel') {
      defaultPub = 'Marvel';
    }

    const results = parseMarmotaCards(html, defaultPub);
    return results;
  } catch (err) {
    console.error('Error in searchMarmotaComics:', err);
    return [];
  }
}

export async function getComicChapters(comicUrl: string): Promise<Chapter[]> {
  try {
    const cleanUrl = comicUrl.replace(/\/$/, '') + '/ajax/chapters/';
    const html = await fetchHtml(cleanUrl, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    const chapterRegex = /<li[^>]*wp-manga-chapter[^>]*>[\s\S]*?<a href=["']([^"']+)["']>([\s\S]*?)<\/a>/gi;
    const chapters: Chapter[] = [];
    let match;
    while ((match = chapterRegex.exec(html)) !== null) {
      const url = match[1];
      const rawName = match[2].replace(/<[^>]+>/g, '').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").trim();
      chapters.push({
        id: url.replace(/https?:\/\/marmota\.me\/comic\/[^/]+\/([^/]+)\/?/, '$1'),
        title: rawName,
        url
      });
    }

    return chapters;
  } catch (err) {
    console.error('Error fetching comic chapters:', err);
    return [];
  }
}

export async function getChapterPages(chapterUrl: string): Promise<string[]> {
  try {
    const html = await fetchHtml(chapterUrl);
    const imgRegex = /<img[^>]+(?:data-src|src)=["']\s*(https?:\/\/marmota\.me\/wp-content\/uploads\/WP-manga\/data\/[^"'\s]+)/gi;
    const pages: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      pages.push(match[1].replace('http://', 'https://').trim());
    }

    const uniquePages = Array.from(new Set(pages));
    return uniquePages;
  } catch (err) {
    console.error('Error fetching chapter pages:', err);
    return [];
  }
}
