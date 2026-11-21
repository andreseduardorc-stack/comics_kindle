import React, { useState, useEffect } from 'react';
import { X, BookOpen, Loader2, Layers, AlertCircle } from 'lucide-react';
import type { Comic, Chapter } from '../types/comic';
import { fetchMarmotaChapters, fetchMarmotaChapterPages } from '../services/marmotaService';
import { fetchMegaBananaReader } from '../services/megabananaService';

interface ChapterModalProps {
  comic: Comic | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (comic: Comic, chapter: Chapter, pages: string[]) => void;
}

export const ChapterModal: React.FC<ChapterModalProps> = ({
  comic,
  isOpen,
  onClose,
  onSelectChapter
}) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [cachedPagesByChapter, setCachedPagesByChapter] = useState<Record<string, string[]>>({});
  const [isLoadingChapters, setIsLoadingChapters] = useState<boolean>(true);
  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readerEmbedUrl, setReaderEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !comic) {
      setChapters([]);
      setReaderEmbedUrl(null);
      return;
    }

    if (comic.embedUrl) {
      setReaderEmbedUrl(comic.embedUrl);
    }

    setIsLoadingChapters(true);
    setError(null);

    // ============= MEGABANANA SOURCE =============
    if (comic.source === 'megabanana' && comic.megaBananaPostId) {
      fetchMegaBananaReader(comic.megaBananaPostId, 1)
        .then((readerData) => {
          if (readerData.embedUrl) {
            setReaderEmbedUrl(readerData.embedUrl);
          }

          if (readerData.embedUrl && (!readerData.chapters || readerData.chapters.length === 0)) {
            const readyComic: Comic = {
              ...comic,
              embedUrl: readerData.embedUrl,
              totalPages: 1
            };
            onSelectChapter(readyComic, { id: 'full-collection', number: 1, title: 'Edición Completa', url: readerData.embedUrl || comic.embedUrl || comic.url || '' }, []);
            onClose();
            return;
          }

          setChapters(readerData.chapters || []);
          // Pre-cache chapter 1 pages if available
          if (readerData.pages && readerData.pages.length > 0) {
            setCachedPagesByChapter(prev => ({
              ...prev,
              [`ch-${readerData.currentChapter}`]: readerData.pages
            }));
          }
          setIsLoadingChapters(false);
        })
        .catch((err) => {
          console.error(err);
          if (comic.embedUrl) {
            const readyComic: Comic = {
              ...comic,
              embedUrl: comic.embedUrl,
              totalPages: 1
            };
            onSelectChapter(readyComic, { id: 'full-collection', number: 1, title: 'Edición Completa', url: comic.embedUrl || comic.url || '' }, []);
            onClose();
            return;
          }
          setError('No se pudieron obtener los capítulos de MegaBanana.');
          setIsLoadingChapters(false);
        });
      return;
    }

    // ============= MARMOTA SOURCE =============
    if (comic.url) {
      fetchMarmotaChapters(comic.url)
        .then((chaps) => {
          setChapters(chaps);
          setIsLoadingChapters(false);
        })
        .catch((err) => {
          console.error(err);
          setError('No se pudieron obtener los capítulos de Marmota Comics.');
          setIsLoadingChapters(false);
        });
    } else {
      setIsLoadingChapters(false);
    }
  }, [isOpen, comic]);

  if (!isOpen || !comic) return null;

  const handleReadChapter = async (chapter: Chapter) => {
    setLoadingChapterId(chapter.id);
    setError(null);
    try {
      let pages: string[] = [];

      if (comic.source === 'megabanana' && comic.megaBananaPostId) {
        if (cachedPagesByChapter[chapter.id]) {
          pages = cachedPagesByChapter[chapter.id];
        } else {
          const chNum = chapter.number || 1;
          const readerData = await fetchMegaBananaReader(comic.megaBananaPostId, chNum);
          pages = readerData.pages;
          setCachedPagesByChapter(prev => ({ ...prev, [chapter.id]: pages }));
        }
      } else {
        pages = await fetchMarmotaChapterPages(chapter.url || '');
      }

      if (pages.length === 0) {
        throw new Error('No se encontraron imágenes en este capítulo.');
      }

      onSelectChapter(comic, chapter, pages);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar las páginas de este capítulo. Intenta con otro número.');
    } finally {
      setLoadingChapterId(null);
    }
  };

  const providerLabel = comic.source === 'megabanana' 
    ? 'MegaBanana Comics' 
    : comic.source === 'marmota' 
      ? 'Marmota Comics' 
      : 'Web';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with comic info */}
        <div className="p-5 border-b border-zinc-800 flex items-start gap-4 bg-zinc-950/60">
          <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 shadow-lg border border-zinc-800">
            <img src={comic.coverUrl} alt={comic.title} className="w-full h-full object-cover" />
            <span className={`absolute top-1 left-1 text-[8px] font-black px-1 rounded text-white ${
              comic.publisher === 'DC' ? 'bg-blue-600' : 'bg-red-600'
            }`}>
              {comic.publisher}
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {comic.hero}
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                🇪🇸 {providerLabel}
              </span>
            </div>
            <h2 className="text-base font-bold text-white line-clamp-2">
              {comic.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>{isLoadingChapters ? 'Cargando números...' : `${chapters.length} números/capítulos disponibles`}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Chapters list */}
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar flex flex-col gap-2">
          {isLoadingChapters ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm font-medium">Obteniendo números disponibles de {providerLabel}...</p>
            </div>
          ) : chapters.length === 0 ? (
            (comic.embedUrl || readerEmbedUrl) ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm text-zinc-300">
                  Esta obra está disponible en formato de tomo / colección completa en visor integrado.
                </p>
                <button
                  onClick={() => {
                    const readyComic: Comic = {
                      ...comic,
                      embedUrl: comic.embedUrl || readerEmbedUrl || undefined,
                      totalPages: 1
                    };
                    onSelectChapter(readyComic, { id: 'full-collection', number: 1, title: 'Edición Completa', url: comic.embedUrl || readerEmbedUrl || comic.url || '' }, []);
                    onClose();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Leer Cómic Completo</span>
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No se encontraron números disponibles para esta serie.
              </div>
            )
          ) : (
            chapters.map((ch) => {
              const isCurrentLoading = loadingChapterId === ch.id;
              return (
                <div
                  key={ch.id}
                  className="group flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
                        {ch.title}
                      </span>
                      {ch.pageCount && (
                        <span className="text-[10px] text-zinc-500">
                          {ch.pageCount} páginas
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleReadChapter(ch)}
                    disabled={isCurrentLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-all flex-shrink-0"
                  >
                    {isCurrentLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Abriendo...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3 h-3" />
                        <span>Leer</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 text-center text-[11px] text-zinc-500">
          Sincronizado con {providerLabel} • Lector Kindle sin publicidad
        </div>
      </div>
    </div>
  );
};
