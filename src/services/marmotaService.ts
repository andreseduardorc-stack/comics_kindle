import type { Comic, Chapter } from '../types/comic';
import { apiUrl } from '../config';
import { fetchJson } from './apiError';

const SOURCE = 'Marmota';

export async function fetchMarmotaFeed(signal?: AbortSignal): Promise<{ dc: Comic[]; marvel: Comic[] }> {
  const data = await fetchJson<{ dc?: Comic[]; marvel?: Comic[] }>(SOURCE, apiUrl('/api/marmota/feed'), signal);
  return { dc: data.dc || [], marvel: data.marvel || [] };
}

export async function searchMarmota(
  query: string,
  publisher: 'ALL' | 'DC' | 'Marvel' = 'ALL',
  signal?: AbortSignal
): Promise<Comic[]> {
  const params = new URLSearchParams({ q: query, publisher });
  return fetchJson<Comic[]>(SOURCE, apiUrl(`/api/marmota/search?${params}`), signal);
}

export async function fetchMarmotaChapters(comicUrl: string, signal?: AbortSignal): Promise<Chapter[]> {
  const params = new URLSearchParams({ url: comicUrl });
  return fetchJson<Chapter[]>(SOURCE, apiUrl(`/api/marmota/chapters?${params}`), signal);
}

export async function fetchMarmotaChapterPages(chapterUrl: string, signal?: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams({ url: chapterUrl });
  return fetchJson<string[]>(SOURCE, apiUrl(`/api/marmota/pages?${params}`), signal);
}
