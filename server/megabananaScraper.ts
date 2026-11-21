import type { Comic, Chapter, Publisher } from '../src/types/comic';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function cleanMegaBananaTitle(title: string): string {
  return title
    .replace(/^Leer\s+/i, '')
    .replace(/\s+Comic\s+Online\s+en\s+Español/i, '')
    .replace(/\s+Comic\s+Online/i, '')
    .replace(/\s+Online\s+en\s+Español/i, '')
    .replace(/\s+en\s+Español/i, '')
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, '&')
    .trim();
}

function detectHeroAndPublisher(cleanTitle: string, defaultPublisher: Publisher = 'DC'): { publisher: Publisher; hero: string } {
  const lower = cleanTitle.toLowerCase();
  
  if (lower.includes('batman') || lower.includes('superman') || lower.includes('justice league') || lower.includes('liga de la justicia') || lower.includes('flash') || lower.includes('green lantern') || lower.includes('wonder woman') || lower.includes('aquaman') || lower.includes('nightwing') || lower.includes('dc') || lower.includes('metal') || lower.includes('joker')) {
    const hero = cleanTitle.split(/[:\-\/]/)[0].trim();
    return { publisher: 'DC', hero: hero || 'Batman' };
  }

  if (lower.includes('spider') || lower.includes('spiderman') || lower.includes('hulk') || lower.includes('avengers') || lower.includes('vengadores') || lower.includes('x-men') || lower.includes('wolverine') || lower.includes('iron man') || lower.includes('thor') || lower.includes('deadpool') || lower.includes('captain america') || lower.includes('marvel')) {
    const hero = cleanTitle.split(/[:\-\/]/)[0].trim();
    return { publisher: 'Marvel', hero: hero || 'Marvel Comics' };
  }

  const hero = cleanTitle.split(/[:\-\/]/)[0].trim();
  return { publisher: defaultPublisher, hero: hero || defaultPublisher };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`MegaBanana API HTTP error ${res.status} for ${url}`);
  }
  return await res.json() as T;
}

// Convert a WP v2 post (legacy or standard) into a Comic object
export function mapWpPostToComic(p: any, defaultPub: Publisher = 'DC'): Comic {
  const rawTitle = p.title?.rendered || '';
  const cleanTitle = cleanMegaBananaTitle(rawTitle);
  const { publisher, hero } = detectHeroAndPublisher(cleanTitle, defaultPub);
  const year = p.date ? new Date(p.date).getFullYear() : 2021;

  const media = p._embedded?.['wp:featuredmedia'];
  const coverUrl = media && media[0]?.source_url 
    ? media[0].source_url 
    : 'https://megabanana.mx/wp-content/plugins/megabanana-reader/assets/placeholder-cover.svg';

  const content = p.content?.rendered || '';
  const iframeMatch = content.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const embedUrl = iframeMatch ? iframeMatch[1] : undefined;

  const excerpt = (p.excerpt?.rendered || `Cómic ${cleanTitle} en español en MegaBanana.`).replace(/<[^>]*>/g, '').trim();

  return {
    id: `megabanana-${p.id}`,
    megaBananaPostId: p.id,
    title: cleanTitle,
    fullTitle: rawTitle,
    publisher,
    hero,
    year,
    language: 'Español',
    coverUrl,
    embedUrl,
    description: excerpt,
    source: 'megabanana',
    url: p.link,
    totalPages: 32
  };
}

export async function getMegaBananaFeed(): Promise<{ dc: Comic[]; marvel: Comic[] }> {
  try {
    const [dcRes, marvelRes, dcLegacyRes, marvelLegacyRes] = await Promise.allSettled([
      fetchJson<any>('https://megabanana.mx/wp-json/megabanana/v1/catalog?category=dc&per_page=30'),
      fetchJson<any>('https://megabanana.mx/wp-json/megabanana/v1/catalog?category=marvel&per_page=30'),
      fetchJson<any[]>('https://megabanana.mx/wp-json/wp/v2/posts?categories=77&_embed=wp:featuredmedia&per_page=20'),
      fetchJson<any[]>('https://megabanana.mx/wp-json/wp/v2/posts?categories=76&_embed=wp:featuredmedia&per_page=20')
    ]);

    const dcItems: any[] = dcRes.status === 'fulfilled' ? (dcRes.value.items || []) : [];
    const marvelItems: any[] = marvelRes.status === 'fulfilled' ? (marvelRes.value.items || []) : [];
    const dcLegacy: any[] = dcLegacyRes.status === 'fulfilled' ? dcLegacyRes.value : [];
    const marvelLegacy: any[] = marvelLegacyRes.status === 'fulfilled' ? marvelLegacyRes.value : [];

    const mapItemToComic = (it: any, defaultPub: Publisher): Comic => {
      const cleanTitle = cleanMegaBananaTitle(it.title || '');
      const { publisher, hero } = detectHeroAndPublisher(cleanTitle, defaultPub);
      const year = it.date ? new Date(it.date).getFullYear() : new Date().getFullYear();

      const rawChapters: string[] = it.chapters || [];
      const chapters: Chapter[] = rawChapters.map((chName, idx) => ({
        id: `ch-${idx + 1}`,
        number: idx + 1,
        title: chName,
        url: `https://megabanana.mx/wp-json/megabanana/v1/reader/${it.id}?chapter=${idx + 1}`
      }));

      return {
        id: `megabanana-${it.id}`,
        megaBananaPostId: it.id,
        title: cleanTitle,
        fullTitle: it.title,
        publisher,
        hero,
        year,
        language: 'Español',
        coverUrl: it.thumbnail || 'https://megabanana.mx/wp-content/plugins/megabanana-reader/assets/placeholder-cover.svg',
        description: (it.excerpt || `Cómic ${cleanTitle} en español en MegaBanana.`).replace(/<[^>]*>/g, '').trim(),
        source: 'megabanana',
        url: it.url,
        chapters,
        totalPages: 24
      };
    };

    const modernDC = dcItems.map(it => mapItemToComic(it, 'DC'));
    const modernMarvel = marvelItems.map(it => mapItemToComic(it, 'Marvel'));
    const legacyDC = dcLegacy.map(it => mapWpPostToComic(it, 'DC'));
    const legacyMarvel = marvelLegacy.map(it => mapWpPostToComic(it, 'Marvel'));

    // Deduplicate by ID and retain embedUrl if present in legacy
    const mergeDedupe = (modernList: Comic[], legacyList: Comic[]) => {
      const map = new Map<string, Comic>();
      legacyList.forEach(c => map.set(c.id, c));
      modernList.forEach(c => {
        if (map.has(c.id)) {
          const leg = map.get(c.id)!;
          map.set(c.id, {
            ...c,
            embedUrl: leg.embedUrl || c.embedUrl,
            coverUrl: c.coverUrl.includes('placeholder') ? leg.coverUrl : c.coverUrl
          });
        } else {
          map.set(c.id, c);
        }
      });
      return Array.from(map.values());
    };

    return { 
      dc: mergeDedupe(modernDC, legacyDC), 
      marvel: mergeDedupe(modernMarvel, legacyMarvel) 
    };
  } catch (err) {
    console.error('Error fetching MegaBanana feed:', err);
    return { dc: [], marvel: [] };
  }
}

export async function searchMegaBanana(query: string, publisherFilter: string = 'ALL'): Promise<Comic[]> {
  if (!query || !query.trim()) return [];
  const cleanQ = encodeURIComponent(query.trim());

  try {
    // Search both modern reader catalog AND WordPress posts catalog to capture 100% of comics
    const [catalogRes, postsRes] = await Promise.allSettled([
      fetchJson<any>(`https://megabanana.mx/wp-json/megabanana/v1/catalog?search=${cleanQ}&per_page=25`),
      fetchJson<any[]>(`https://megabanana.mx/wp-json/wp/v2/posts?search=${cleanQ}&_embed=wp:featuredmedia&per_page=25`)
    ]);

    const catalogItems: any[] = catalogRes.status === 'fulfilled' ? (catalogRes.value.items || []) : [];
    const wpPosts: any[] = postsRes.status === 'fulfilled' ? postsRes.value : [];

    let defaultPub: Publisher = 'Other';
    if (publisherFilter === 'DC') defaultPub = 'DC';
    else if (publisherFilter === 'Marvel') defaultPub = 'Marvel';

    const comicsFromWp: Comic[] = wpPosts.map((p: any) => mapWpPostToComic(p, defaultPub));

    const comicsFromCatalog: Comic[] = catalogItems.map((it: any) => {
      const cleanTitle = cleanMegaBananaTitle(it.title || '');
      const { publisher, hero } = detectHeroAndPublisher(cleanTitle, defaultPub);
      const year = it.date ? new Date(it.date).getFullYear() : new Date().getFullYear();

      const rawChapters: string[] = it.chapters || [];
      const chapters: Chapter[] = rawChapters.map((chName, idx) => ({
        id: `ch-${idx + 1}`,
        number: idx + 1,
        title: chName,
        url: `https://megabanana.mx/wp-json/megabanana/v1/reader/${it.id}?chapter=${idx + 1}`
      }));

      return {
        id: `megabanana-${it.id}`,
        megaBananaPostId: it.id,
        title: cleanTitle,
        fullTitle: it.title,
        publisher,
        hero,
        year,
        language: 'Español',
        coverUrl: it.thumbnail || 'https://megabanana.mx/wp-content/plugins/megabanana-reader/assets/placeholder-cover.svg',
        description: (it.excerpt || `Cómic ${cleanTitle} en español en MegaBanana.`).replace(/<[^>]*>/g, '').trim(),
        source: 'megabanana',
        url: it.url,
        chapters,
        totalPages: 24
      };
    });

    // Merge: Put WP posts in map first (to capture embedUrl), then overlay catalog data
    const map = new Map<string, Comic>();
    for (const c of comicsFromWp) {
      map.set(c.id, c);
    }
    for (const c of comicsFromCatalog) {
      if (map.has(c.id)) {
        const existing = map.get(c.id)!;
        map.set(c.id, {
          ...c,
          embedUrl: existing.embedUrl || c.embedUrl,
          coverUrl: c.coverUrl.includes('placeholder') ? existing.coverUrl : c.coverUrl
        });
      } else {
        map.set(c.id, c);
      }
    }

    const seenTitles = new Set<string>();
    const results: Comic[] = [];
    for (const c of map.values()) {
      const key = c.title.toLowerCase();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        results.push(c);
      }
    }

    return results;
  } catch (err) {
    console.error('Error in searchMegaBanana:', err);
    return [];
  }
}

// Resolve any specific MegaBanana URL (like https://megabanana.mx/leer-the-batman-who-laughs-el-batman-que-rie-online-en-espanol/)
export async function resolveMegaBananaUrl(rawUrl: string): Promise<Comic | null> {
  try {
    let slug = rawUrl.trim();
    if (slug.includes('megabanana.mx/')) {
      const match = slug.match(/megabanana\.mx\/([^/?#]+)/);
      slug = match ? match[1] : slug;
    }

    const apiUrl = `https://megabanana.mx/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia`;
    const posts = await fetchJson<any[]>(apiUrl);

    if (posts && posts.length > 0) {
      const p = posts[0];
      const comic = mapWpPostToComic(p, 'DC');
      
      // If it doesn't have an iframe embedUrl, try checking reader
      if (!comic.embedUrl) {
        try {
          const readerData = await getMegaBananaReader(p.id, 1);
          if (readerData.pages && readerData.pages.length > 0) {
            comic.pages = readerData.pages;
            comic.totalPages = readerData.pages.length;
            comic.chapters = readerData.chapters;
          } else if (readerData.embedUrl) {
            comic.embedUrl = readerData.embedUrl;
          }
        } catch {
          // Keep as is
        }
      }

      return comic;
    }

    return null;
  } catch (err) {
    console.error('Error in resolveMegaBananaUrl:', err);
    return null;
  }
}

export async function getMegaBananaReader(postId: number | string, chapterNumber: number | string = 1): Promise<{
  postId: number;
  title: string;
  currentChapter: number;
  chapters: Chapter[];
  pages: string[];
  embedUrl?: string;
}> {
  const cleanId = String(postId).replace(/[^0-9]/g, '') || String(postId);
  const url = `https://megabanana.mx/wp-json/megabanana/v1/reader/${cleanId}?chapter=${chapterNumber}`;
  try {
    const data = await fetchJson<any>(url);

    const rawChapters: any[] = data.chapters || [];
    const chapters: Chapter[] = rawChapters.map((c: any) => ({
      id: `ch-${c.number}`,
      number: c.number,
      title: c.title,
      pageCount: c.pageCount,
      url: `https://megabanana.mx/wp-json/megabanana/v1/reader/${cleanId}?chapter=${c.number}`
    }));

    const pages: string[] = data.pages || [];

    return {
      postId: data.postId,
      title: cleanMegaBananaTitle(data.title || ''),
      currentChapter: parseInt(String(data.currentChapter || chapterNumber), 10),
      chapters,
      pages
    };
  } catch (err) {
    // If reader API returned 404 (for legacy posts like The Batman Who Laughs), fallback to WP post content for iframe
    const postUrl = `https://megabanana.mx/wp-json/wp/v2/posts/${cleanId}`;
    const p = await fetchJson<any>(postUrl);
    const content = p.content?.rendered || '';
    const iframeMatch = content.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    const embedUrl = iframeMatch ? iframeMatch[1] : undefined;

    return {
      postId: p.id,
      title: cleanMegaBananaTitle(p.title?.rendered || ''),
      currentChapter: 1,
      chapters: [],
      pages: [],
      embedUrl
    };
  }
}
