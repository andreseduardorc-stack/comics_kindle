import type { Comic, Chapter } from '../types/comic';

export async function fetchMarmotaFeed(): Promise<{ dc: Comic[]; marvel: Comic[] }> {
  try {
    const res = await fetch('/api/marmota/feed');
    if (!res.ok) throw new Error('Error al conectar con la base de Marmota');
    const data = await res.json();
    return {
      dc: data.dc || [],
      marvel: data.marvel || []
    };
  } catch (err) {
    console.error('Error fetching Marmota feed:', err);
    return { dc: [], marvel: [] };
  }
}

export async function searchMarmota(query: string, publisher: 'ALL' | 'DC' | 'Marvel' = 'ALL'): Promise<Comic[]> {
  try {
    const params = new URLSearchParams({ q: query, publisher });
    const res = await fetch(`/api/marmota/search?${params.toString()}`);
    if (!res.ok) throw new Error('Error en búsqueda de Marmota');
    return await res.json();
  } catch (err) {
    console.error('Error in searchMarmota:', err);
    return [];
  }
}

export async function fetchMarmotaChapters(comicUrl: string): Promise<Chapter[]> {
  try {
    const params = new URLSearchParams({ url: comicUrl });
    const res = await fetch(`/api/marmota/chapters?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar capítulos de Marmota');
    return await res.json();
  } catch (err) {
    console.error('Error in fetchMarmotaChapters:', err);
    return [];
  }
}

export async function fetchMarmotaChapterPages(chapterUrl: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({ url: chapterUrl });
    const res = await fetch(`/api/marmota/pages?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar páginas del capítulo');
    return await res.json();
  } catch (err) {
    console.error('Error in fetchMarmotaChapterPages:', err);
    return [];
  }
}
