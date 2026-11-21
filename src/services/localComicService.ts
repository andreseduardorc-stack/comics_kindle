import type { Comic } from '../types/comic';
import { detectPublisherAndHero } from './archiveService';
import { savePages, loadPageUrls, deletePages } from './comicStore';

const STORAGE_KEY_PROGRESS = 'kindle_comics_progress_v1';
const STORAGE_KEY_FAVORITES = 'kindle_comics_favorites_v1';
const STORAGE_KEY_CUSTOM = 'kindle_comics_custom_list_v1';
const STORAGE_KEY_LAST_READ = 'kindle_comics_last_read_v1';
const STORAGE_KEY_BOOKMARKS = 'kindle_comics_bookmarks_v1';

export interface LastReadSession {
  comic: Comic;
  page: number;
  timestamp: number;
}

/* ------------------------------------------------------------------ *
 * Importación de CBZ / ZIP
 * ------------------------------------------------------------------ */

export async function processCbzFile(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<Comic> {
  // jszip solo hace falta al importar un archivo: se carga bajo demanda en vez
  // de entrar en el paquete inicial que descarga todo el mundo.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
  const imageEntries: { name: string; file: import('jszip').JSZipObject }[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      const lower = relativePath.toLowerCase();
      if (imageExtensions.some(ext => lower.endsWith(ext))) {
        imageEntries.push({ name: relativePath, file: zipEntry });
      }
    }
  });

  // Orden natural de páginas: page_1, page_2, page_10 y no page_1, page_10, page_2
  imageEntries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  if (imageEntries.length === 0) {
    throw new Error('No se encontraron imágenes válidas dentro del archivo CBZ/ZIP.');
  }

  const blobs: Blob[] = [];
  for (let i = 0; i < imageEntries.length; i++) {
    blobs.push(await imageEntries[i].file.async('blob'));
    onProgress?.(i + 1, imageEntries.length);
  }

  const cleanTitle = file.name.replace(/\.(cbz|cbr|zip)$/i, '').replace(/[-_]/g, ' ');
  const { publisher, hero } = detectPublisherAndHero(cleanTitle);
  const id = `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Se guardan los binarios antes de crear las URLs: así el cómic sobrevive a
  // un F5, en vez de quedarse como una tarjeta con la portada rota.
  await savePages(id, blobs);
  const pageUrls = (await loadPageUrls(id)) ?? blobs.map(b => URL.createObjectURL(b));

  return {
    id,
    title: cleanTitle,
    publisher: publisher === 'Other' ? 'Marvel' : publisher,
    hero,
    year: new Date().getFullYear(),
    language: 'Español',
    coverUrl: pageUrls[0],
    description: `Cómic importado desde ${file.name}. Guardado en este navegador.`,
    source: 'local',
    totalPages: pageUrls.length,
    pages: pageUrls,
    readProgress: 1,
    lastReadTimestamp: Date.now()
  };
}

/**
 * Devuelve el cómic local con sus páginas recuperadas de IndexedDB.
 * Si ya no están guardadas, lo marca con `needsReimport` para que la tarjeta
 * lo diga, en vez de abrir un lector lleno de imágenes rotas.
 */
export async function hydrateLocalComic(comic: Comic): Promise<Comic> {
  if (comic.source !== 'local') return comic;
  if (comic.pages && comic.pages.length > 0 && comic.pages[0].startsWith('blob:')) return comic;

  const pages = await loadPageUrls(comic.id);
  if (!pages || pages.length === 0) {
    return { ...comic, pages: [], needsReimport: true };
  }

  return {
    ...comic,
    pages,
    coverUrl: pages[0],
    totalPages: pages.length,
    needsReimport: false
  };
}

/* ------------------------------------------------------------------ *
 * Progreso de lectura
 * ------------------------------------------------------------------ */

export function saveLastReadComic(comic: Comic, page: number): void {
  try {
    const now = Date.now();

    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    const progressMap = raw ? JSON.parse(raw) : {};
    progressMap[comic.id] = { page, timestamp: now };
    if (comic.seriesId) {
      progressMap[comic.seriesId] = { page, timestamp: now };
    }
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progressMap));

    // Las blob URLs no se guardan: no sobreviven a la recarga. Las páginas de
    // un cómic local se recuperan de IndexedDB con `hydrateLocalComic`.
    const storedComic: Comic = {
      ...comic,
      pages: comic.source === 'local' ? [] : comic.pages || [],
      coverUrl: comic.source === 'local' ? '' : comic.coverUrl,
      readProgress: page,
      lastReadTimestamp: now
    };

    const session: LastReadSession = { comic: storedComic, page, timestamp: now };
    localStorage.setItem(STORAGE_KEY_LAST_READ, JSON.stringify(session));
  } catch (err) {
    console.error('Error saving last read session:', err);
  }
}

export function getLastReadComic(): LastReadSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_READ);
    if (!raw) return null;
    const session = JSON.parse(raw) as LastReadSession;
    return session?.comic?.id ? session : null;
  } catch {
    return null;
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

/* ------------------------------------------------------------------ *
 * Favoritos
 *
 * Se leen una sola vez a un Set en memoria. Antes `isFavoriteComic` hacía un
 * JSON.parse de localStorage por cada tarjeta y por cada render: con el
 * catálogo entero de MegaBanana eran miles por pulsación de tecla.
 * ------------------------------------------------------------------ */

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

export function persistFavorites(favorites: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(Array.from(favorites)));
  } catch (err) {
    console.error('Error saving favorites:', err);
  }
}

/* ------------------------------------------------------------------ *
 * Marcadores
 * ------------------------------------------------------------------ */

type BookmarkMap = Record<string, number[]>;

function readBookmarks(): BookmarkMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    return raw ? (JSON.parse(raw) as BookmarkMap) : {};
  } catch {
    return {};
  }
}

export function getBookmarks(comicId: string): number[] {
  return readBookmarks()[comicId] ?? [];
}

/** Marca o desmarca una página. Devuelve la lista resultante, ya ordenada. */
export function toggleBookmark(comicId: string, page: number): number[] {
  const all = readBookmarks();
  const current = new Set(all[comicId] ?? []);

  if (current.has(page)) current.delete(page);
  else current.add(page);

  const next = Array.from(current).sort((a, b) => a - b);
  if (next.length === 0) delete all[comicId];
  else all[comicId] = next;

  try {
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(all));
  } catch (err) {
    console.error('Error saving bookmarks:', err);
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * Cómics importados
 * ------------------------------------------------------------------ */

export function loadCustomComics(): Comic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    return raw ? (JSON.parse(raw) as Comic[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomComicMeta(comic: Comic): void {
  try {
    const list = loadCustomComics().filter(c => c.id !== comic.id);
    // Las blob URLs no se serializan: se regeneran desde IndexedDB al arrancar.
    const lightComic: Comic = {
      ...comic,
      pages: [],
      coverUrl: comic.source === 'local' ? '' : comic.coverUrl
    };
    list.unshift(lightComic);
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(list.slice(0, 30)));
  } catch (err) {
    console.error('Error saving custom comic meta:', err);
  }
}

export async function removeCustomComic(comicId: string): Promise<Comic[]> {
  const list = loadCustomComics().filter(c => c.id !== comicId);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(list));
  } catch (err) {
    console.error('Error removing custom comic:', err);
  }
  await deletePages(comicId);
  return list;
}
