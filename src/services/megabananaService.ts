import type { Comic, Chapter } from '../types/comic';

export async function fetchMegaBananaFeed(): Promise<{ dc: Comic[]; marvel: Comic[] }> {
  try {
    const res = await fetch('/api/megabanana/feed');
    if (!res.ok) throw new Error('Error al conectar con MegaBanana');
    const data = await res.json();
    return {
      dc: data.dc || [],
      marvel: data.marvel || []
    };
  } catch (err) {
    console.error('Error in fetchMegaBananaFeed:', err);
    return { dc: [], marvel: [] };
  }
}

export async function searchMegaBanana(query: string, publisher: 'ALL' | 'DC' | 'Marvel' = 'ALL'): Promise<Comic[]> {
  try {
    const params = new URLSearchParams({ q: query, publisher });
    const res = await fetch(`/api/megabanana/search?${params.toString()}`);
    if (!res.ok) throw new Error('Error en búsqueda de MegaBanana');
    return await res.json();
  } catch (err) {
    console.error('Error in searchMegaBanana:', err);
    return [];
  }
}

export async function resolveMegaBananaComic(url: string): Promise<Comic | null> {
  try {
    const params = new URLSearchParams({ url });
    const res = await fetch(`/api/megabanana/resolve?${params.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error in resolveMegaBananaComic:', err);
    return null;
  }
}

export async function fetchMegaBananaReader(postId: number | string, chapterNumber: number | string = 1): Promise<{
  postId: number;
  title: string;
  currentChapter: number;
  chapters: Chapter[];
  pages: string[];
  embedUrl?: string;
}> {
  try {
    const params = new URLSearchParams({ postId: String(postId), chapter: String(chapterNumber) });
    const res = await fetch(`/api/megabanana/reader?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar lector de MegaBanana');
    return await res.json();
  } catch (err) {
    console.error('Error in fetchMegaBananaReader:', err);
    throw err;
  }
}
