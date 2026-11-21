import JSZip from 'jszip';
import type { Comic } from '../types/comic';
import { detectPublisherAndHero } from './archiveService';

const STORAGE_KEY_PROGRESS = 'kindle_comics_progress_v1';
const STORAGE_KEY_FAVORITES = 'kindle_comics_favorites_v1';
const STORAGE_KEY_CUSTOM = 'kindle_comics_custom_list_v1';
const STORAGE_KEY_LAST_READ = 'kindle_comics_last_read_v1';

export interface LastReadSession {
  comic: Comic;
  page: number;
  timestamp: number;
}

export async function processCbzFile(file: File): Promise<Comic> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
  const imageEntries: { name: string; file: JSZip.JSZipObject }[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      const lower = relativePath.toLowerCase();
      if (imageExtensions.some(ext => lower.endsWith(ext))) {
        imageEntries.push({ name: relativePath, file: zipEntry });
      }
    }
  });

  // Natural alphabetical sorting of comic pages (e.g. page_1, page_2, page_10)
  imageEntries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  if (imageEntries.length === 0) {
    throw new Error('No se encontraron imágenes válidas dentro del archivo CBZ/ZIP.');
  }

  // Convert each image to a Blob URL
  const pageUrls: string[] = [];
  for (const entry of imageEntries) {
    const blob = await entry.file.async('blob');
    const url = URL.createObjectURL(blob);
    pageUrls.push(url);
  }

  const cleanTitle = file.name.replace(/\.(cbz|cbr|zip)$/i, '').replace(/[-_]/g, ' ');
  const { publisher, hero } = detectPublisherAndHero(cleanTitle);

  const customComic: Comic = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title: cleanTitle,
    publisher: publisher === 'Other' ? 'Marvel' : publisher,
    hero,
    year: new Date().getFullYear(),
    language: 'Español',
    coverUrl: pageUrls[0], // First page as cover
    description: `Cómic importado localmente (${file.name}). Listo para leer en modo Kindle.`,
    source: 'local',
    totalPages: pageUrls.length,
    pages: pageUrls,
    readProgress: 1,
    lastReadTimestamp: Date.now()
  };

  return customComic;
}

// Reading progress storage
export function saveReadingProgress(comicId: string, page: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    const progressMap = raw ? JSON.parse(raw) : {};
    progressMap[comicId] = {
      page,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progressMap));
  } catch (err) {
    console.error('Error saving reading progress:', err);
  }
}

// Save complete last-read session
export function saveLastReadComic(comic: Comic, page: number): void {
  try {
    const now = Date.now();

    // 1. Save in general progress map
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    const progressMap = raw ? JSON.parse(raw) : {};
    progressMap[comic.id] = { page, timestamp: now };

    // Also link parent/series ID if this is a chapter issue
    if (comic.seriesId) {
      progressMap[comic.seriesId] = { page, timestamp: now };
    }
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progressMap));

    // 2. Save active last read session (omit large blob URLs for local files to avoid quota limits)
    const storedComic: Comic = {
      ...comic,
      pages: comic.source === 'local' ? [] : (comic.pages || []),
      readProgress: page,
      lastReadTimestamp: now
    };

    const session: LastReadSession = {
      comic: storedComic,
      page,
      timestamp: now
    };
    localStorage.setItem(STORAGE_KEY_LAST_READ, JSON.stringify(session));
  } catch (err) {
    console.error('Error saving last read session:', err);
  }
}

export function getLastReadComic(): LastReadSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_READ);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getReadingProgress(comicId: string): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return 1;
    const progressMap = JSON.parse(raw);
    return progressMap[comicId]?.page || 1;
  } catch {
    return 1;
  }
}

export function getAllSavedProgress(): Record<string, { page: number; timestamp: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Favorites storage
export function toggleFavorite(comicId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    let isFav = false;
    if (set.has(comicId)) {
      set.delete(comicId);
      isFav = false;
    } else {
      set.add(comicId);
      isFav = true;
    }
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(Array.from(set)));
    return isFav;
  } catch {
    return false;
  }
}

export function isFavoriteComic(comicId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(comicId);
  } catch {
    return false;
  }
}

// Save custom added comics metadata
export function saveCustomComicMeta(comic: Comic): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    const list: Comic[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(c => c.id !== comic.id);
    const lightComic: Comic = {
      ...comic,
      pages: []
    };
    filtered.unshift(lightComic);
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(filtered.slice(0, 30)));
  } catch (err) {
    console.error('Error saving custom comic meta:', err);
  }
}
