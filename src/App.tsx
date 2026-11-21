import { useState, useEffect, useCallback } from 'react';
import type { Comic, Chapter } from './types/comic';
import { Library } from './components/Library';
import { KindleReader } from './components/KindleReader';
import { ImportModal } from './components/ImportModal';
import { ChapterModal } from './components/ChapterModal';
import { fetchComicDetails } from './services/archiveService';
import {
  getLastReadComic,
  saveLastReadComic,
  loadCustomComics,
  hydrateLocalComic,
  removeCustomComic
} from './services/localComicService';
import type { LastReadSession } from './services/localComicService';

export function App() {
  const [activeComic, setActiveComic] = useState<Comic | null>(null);
  const [initialPage, setInitialPage] = useState<number>(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [customComics, setCustomComics] = useState<Comic[]>([]);
  const [lastReadSession, setLastReadSession] = useState<LastReadSession | null>(() => getLastReadComic());

  const [selectedSeriesComic, setSelectedSeriesComic] = useState<Comic | null>(null);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState<boolean>(false);

  /**
   * Los cómics importados se guardan en localStorage solo con sus datos; las
   * páginas viven en IndexedDB. Al arrancar hay que volver a montarlas, o la
   * tarjeta aparecería con la portada rota y el lector con páginas muertas.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = loadCustomComics();
      const hydrated = await Promise.all(stored.map(hydrateLocalComic));
      if (!cancelled) setCustomComics(hydrated);

      const session = getLastReadComic();
      if (session?.comic?.source === 'local') {
        const comic = await hydrateLocalComic(session.comic);
        if (!cancelled) setLastReadSession({ ...session, comic });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenReader = useCallback(async (comic: Comic, page: number = 1) => {
    let comicToOpen = comic;

    if (comic.source === 'local') {
      comicToOpen = await hydrateLocalComic(comic);
      if (comicToOpen.needsReimport) {
        setIsImportModalOpen(true);
        return;
      }
    }

    if (comicToOpen.source === 'archive' && !comicToOpen.pages?.length && comicToOpen.identifier) {
      try {
        const details = await fetchComicDetails(comicToOpen.identifier);
        comicToOpen = {
          ...comicToOpen,
          totalPages: details.totalPages,
          pages: details.pageUrls,
          pdfUrl: details.pdfUrl || comicToOpen.pdfUrl,
          cbzUrl: details.cbzUrl || comicToOpen.cbzUrl
        };
      } catch {
        // El lector ya muestra su propio aviso si una página no carga.
      }
    }

    setLastReadSession({ comic: comicToOpen, page, timestamp: Date.now() });
    saveLastReadComic(comicToOpen, page);
    setActiveComic(comicToOpen);
    setInitialPage(page);
  }, []);

  const handleCloseReader = useCallback(() => {
    setActiveComic(null);
    const session = getLastReadComic();
    if (session?.comic?.source === 'local') {
      hydrateLocalComic(session.comic).then(comic => setLastReadSession({ ...session, comic }));
    } else {
      setLastReadSession(session);
    }
  }, []);

  const handleProgressUpdate = useCallback((comic: Comic, page: number) => {
    setLastReadSession({ comic, page, timestamp: Date.now() });
  }, []);

  const handleComicImported = (comic: Comic) => {
    setCustomComics(prev => [comic, ...prev.filter(c => c.id !== comic.id)]);
    handleOpenReader(comic, 1);
  };

  const handleRemoveCustomComic = useCallback(async (comic: Comic) => {
    // Borrar un cómic importado destruye el archivo guardado: se confirma antes.
    const confirmed = window.confirm(
      `¿Quitar «${comic.title}» de la biblioteca?\n\nSe borrarán sus páginas guardadas en este navegador. Tendrás que volver a importar el archivo.`
    );
    if (!confirmed) return;

    const remaining = await removeCustomComic(comic.id);
    const hydrated = await Promise.all(remaining.map(hydrateLocalComic));
    setCustomComics(hydrated);
  }, []);

  const handleSelectSeriesComic = (comic: Comic) => {
    setSelectedSeriesComic(comic);
    setIsChapterModalOpen(true);
  };

  const handleSelectChapter = (comic: Comic, chapter: Chapter, pages: string[]) => {
    const isSingleTome = chapter.id === 'full-collection' || !pages.length;
    const readyComic: Comic = {
      ...comic,
      id: `${comic.id}-${chapter.id}`,
      seriesId: comic.id,
      title: isSingleTome ? comic.title : `${comic.title} — ${chapter.title}`,
      totalPages: pages.length > 0 ? pages.length : comic.totalPages || 1,
      pages,
      currentChapterUrl: chapter.url,
      currentChapterNumber: chapter.number
    };

    setLastReadSession({ comic: readyComic, page: 1, timestamp: Date.now() });
    saveLastReadComic(readyComic, 1);
    setActiveComic(readyComic);
    setInitialPage(1);
  };

  return (
    <div className="w-full min-h-screen bg-[#111111] text-[#ededed]">
      {activeComic ? (
        <KindleReader
          comic={activeComic}
          initialPage={initialPage}
          onClose={handleCloseReader}
          onProgressChange={handleProgressUpdate}
        />
      ) : (
        <Library
          onOpenReader={handleOpenReader}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onSelectSeriesComic={handleSelectSeriesComic}
          onRemoveCustomComic={handleRemoveCustomComic}
          customComics={customComics}
          lastReadSession={lastReadSession}
        />
      )}

      <ChapterModal
        comic={selectedSeriesComic}
        isOpen={isChapterModalOpen}
        onClose={() => {
          setIsChapterModalOpen(false);
          setSelectedSeriesComic(null);
        }}
        onSelectChapter={handleSelectChapter}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onComicLoaded={handleComicImported}
      />
    </div>
  );
}

export default App;
