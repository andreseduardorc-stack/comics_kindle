import { useState, useEffect } from 'react';
import type { Comic, Chapter } from './types/comic';
import { Library } from './components/Library';
import { KindleReader } from './components/KindleReader';
import { ImportModal } from './components/ImportModal';
import { ChapterModal } from './components/ChapterModal';
import { fetchComicDetails } from './services/archiveService';
import { getLastReadComic, saveLastReadComic, LastReadSession } from './services/localComicService';

const STORAGE_KEY_CUSTOM = 'kindle_comics_custom_list_v1';

export function App() {
  const [activeComic, setActiveComic] = useState<Comic | null>(null);
  const [initialPage, setInitialPage] = useState<number>(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [customComics, setCustomComics] = useState<Comic[]>([]);
  const [lastReadSession, setLastReadSession] = useState<LastReadSession | null>(() => getLastReadComic());

  // Chapter modal state (for MegaBanana & Marmota multi-issue series)
  const [selectedSeriesComic, setSelectedSeriesComic] = useState<Comic | null>(null);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState<boolean>(false);

  // Load custom saved comics from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
      if (raw) {
        const saved: Comic[] = JSON.parse(raw);
        setCustomComics(saved);
      }
    } catch (e) {
      console.error('Failed to load custom comics from localStorage', e);
    }
  }, []);

  const handleOpenReader = async (comic: Comic, page: number = 1) => {
    let comicToOpen = comic;
    if (comic.source === 'archive' && (!comic.pages || comic.pages.length === 0) && comic.identifier) {
      try {
        const details = await fetchComicDetails(comic.identifier);
        comicToOpen = {
          ...comic,
          totalPages: details.totalPages,
          pages: details.pageUrls,
          pdfUrl: details.pdfUrl || comic.pdfUrl,
          cbzUrl: details.cbzUrl || comic.cbzUrl
        };
      } catch (err) {
        console.warn('Could not fetch details beforehand, opening with default params', err);
      }
    }

    setLastReadSession({ comic: comicToOpen, page, timestamp: Date.now() });
    saveLastReadComic(comicToOpen, page);
    setActiveComic(comicToOpen);
    setInitialPage(page);
  };

  const handleCloseReader = () => {
    setActiveComic(null);
    setLastReadSession(getLastReadComic());
  };

  const handleProgressUpdate = (comic: Comic, page: number) => {
    setLastReadSession({
      comic,
      page,
      timestamp: Date.now()
    });
  };

  const handleComicImported = (comic: Comic) => {
    setCustomComics(prev => [comic, ...prev.filter(c => c.id !== comic.id)]);
    handleOpenReader(comic, 1);
  };

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
      totalPages: pages.length > 0 ? pages.length : (comic.totalPages || 1),
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
      {/* Kindle Reader View (when a comic is selected) */}
      {activeComic ? (
        <KindleReader
          comic={activeComic}
          initialPage={initialPage}
          onClose={handleCloseReader}
          onProgressChange={handleProgressUpdate}
        />
      ) : (
        /* Library & Search View (Using MegaBanana and Marmota as base) */
        <Library
          onOpenReader={handleOpenReader}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onSelectSeriesComic={handleSelectSeriesComic}
          customComics={customComics}
          lastReadSession={lastReadSession}
        />
      )}

      {/* Chapter / Issues Picker Modal (for MegaBanana and Marmota) */}
      <ChapterModal
        comic={selectedSeriesComic}
        isOpen={isChapterModalOpen}
        onClose={() => {
          setIsChapterModalOpen(false);
          setSelectedSeriesComic(null);
        }}
        onSelectChapter={handleSelectChapter}
      />

      {/* Import / Add Custom Comic Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onComicLoaded={handleComicImported}
      />
    </div>
  );
}

export default App;
