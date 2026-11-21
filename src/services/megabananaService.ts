import type { Comic, Chapter } from '../types/comic';
import { apiUrl } from '../config';
import { fetchJson } from './apiError';

const SOURCE = 'MegaBanana';

export async function fetchMegaBananaFeed(signal?: AbortSignal): Promise<{ dc: Comic[]; marvel: Comic[] }> {
  const data = await fetchJson<{ dc?: Comic[]; marvel?: Comic[] }>(SOURCE, apiUrl('/api/megabanana/feed'), signal);
  return { dc: data.dc || [], marvel: data.marvel || [] };
}

export async function searchMegaBanana(
  query: string,
  publisher: 'ALL' | 'DC' | 'Marvel' = 'ALL',
  signal?: AbortSignal
): Promise<Comic[]> {
  const params = new URLSearchParams({ q: query, publisher });
  return fetchJson<Comic[]>(SOURCE, apiUrl(`/api/megabanana/search?${params}`), signal);
}

export async function resolveMegaBananaComic(url: string, signal?: AbortSignal): Promise<Comic | null> {
  const params = new URLSearchParams({ url });
  return fetchJson<Comic | null>(SOURCE, apiUrl(`/api/megabanana/resolve?${params}`), signal);
}

export interface MegaBananaReaderData {
  postId: number;
  title: string;
  currentChapter: number;
  chapters: Chapter[];
  pages: string[];
  embedUrl?: string;
}

export async function fetchMegaBananaReader(
  postId: number | string,
  chapterNumber: number | string = 1,
  signal?: AbortSignal
): Promise<MegaBananaReaderData> {
  const params = new URLSearchParams({ postId: String(postId), chapter: String(chapterNumber) });
  return fetchJson<MegaBananaReaderData>(SOURCE, apiUrl(`/api/megabanana/reader?${params}`), signal);
}
