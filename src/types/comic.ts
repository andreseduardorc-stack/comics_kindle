export type Publisher = 'DC' | 'Marvel' | 'Other';

export interface Chapter {
  id: string;
  title: string;
  url?: string;
  number?: string | number;
  pageCount?: string | number;
  pages?: string[];
  totalPages?: number;
}

export interface Comic {
  id: string;
  seriesId?: string;
  title: string;
  fullTitle?: string;
  publisher: Publisher;
  hero: string;
  year?: number | string;
  language: string;
  coverUrl: string;
  description: string;
  source: 'archive' | 'local' | 'curated' | 'web' | 'marmota' | 'megabanana';
  identifier?: string;
  url?: string;
  megaBananaPostId?: number;
  chapters?: Chapter[];
  currentChapterUrl?: string;
  currentChapterNumber?: string | number;
  totalPages: number;
  pages?: string[];
  pdfUrl?: string;
  cbzUrl?: string;
  embedUrl?: string;
  readProgress?: number; // last read page (1-indexed)
  isFavorite?: boolean;
  lastReadTimestamp?: number;
  /** Cómic local cuyas páginas ya no están en IndexedDB: hay que volver a importarlo. */
  needsReimport?: boolean;
}

export type ReaderTheme = 'dark' | 'sepia' | 'light' | 'eink';
export type ReaderMode = 'single' | 'double' | 'vertical';
export type PageTransition = 'slide' | 'fade' | 'eink' | 'none';
export type ComicSource = 'all' | 'megabanana' | 'marmota' | 'archive';
