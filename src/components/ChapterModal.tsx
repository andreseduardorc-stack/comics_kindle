import React, { useState, useEffect, useCallback } from 'react';
import { X, BookOpen, Loader2, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import type { Comic, Chapter } from '../types/comic';
import { fetchMarmotaChapters, fetchMarmotaChapterPages } from '../services/marmotaService';
import { fetchMegaBananaReader } from '../services/megabananaService';
import { ApiError } from '../services/apiError';
import { Dialog } from './Dialog';

interface ChapterModalProps {
  comic: Comic | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (comic: Comic, chapter: Chapter, pages: string[]) => void;
}

function describe(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const ChapterModal: React.FC<ChapterModalProps> = ({ comic, isOpen, onClose, onSelectChapter }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [cachedPagesByChapter, setCachedPagesByChapter] = useState<Record<string, string[]>>({});
  const [isLoadingChapters, setIsLoadingChapters] = useState<boolean>(true);
  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readerEmbedUrl, setReaderEmbedUrl] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState<number>(0);

  const providerLabel =
    comic?.source === 'megabanana' ? 'MegaBanana' : comic?.source === 'marmota' ? 'Marmota' : 'la web';

  const openAsSingleVolume = useCallback(
    (target: Comic, embedUrl: string) => {
      const readyComic: Comic = { ...target, embedUrl, totalPages: 1 };
      onSelectChapter(
        readyComic,
        { id: 'full-collection', number: 1, title: 'Edición completa', url: embedUrl },
        []
      );
      onClose();
    },
    [onSelectChapter, onClose]
  );

  useEffect(() => {
    // Al cerrarse no se toca el estado: se limpia al volver a abrir, y así
    // cerrar el diálogo no provoca una tanda de renders inútiles.
    if (!isOpen || !comic) return;

    const controller = new AbortController();
    setChapters([]);
    setIsLoadingChapters(true);
    setError(null);
    setReaderEmbedUrl(comic.embedUrl ?? null);

    const load = async () => {
      try {
        if (comic.source === 'megabanana' && comic.megaBananaPostId) {
          const readerData = await fetchMegaBananaReader(comic.megaBananaPostId, 1, controller.signal);
          if (controller.signal.aborted) return;

          if (readerData.embedUrl) setReaderEmbedUrl(readerData.embedUrl);

          if (readerData.embedUrl && !readerData.chapters?.length) {
            openAsSingleVolume(comic, readerData.embedUrl);
            return;
          }

          setChapters(readerData.chapters || []);
          if (readerData.pages?.length) {
            setCachedPagesByChapter(prev => ({
              ...prev,
              [`ch-${readerData.currentChapter}`]: readerData.pages
            }));
          }
        } else if (comic.url) {
          const chaps = await fetchMarmotaChapters(comic.url, controller.signal);
          if (controller.signal.aborted) return;
          setChapters(chaps);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        // Si la serie trae un visor propio, se abre eso antes que fallar.
        if (comic.embedUrl) {
          openAsSingleVolume(comic, comic.embedUrl);
          return;
        }
        setError(describe(err, `No se pudieron obtener los números de ${providerLabel}.`));
      } finally {
        if (!controller.signal.aborted) setIsLoadingChapters(false);
      }
    };

    load();
    return () => controller.abort();
  }, [isOpen, comic, retryToken, openAsSingleVolume, providerLabel]);

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
          const readerData = await fetchMegaBananaReader(comic.megaBananaPostId, chapter.number || 1);
          pages = readerData.pages;
          setCachedPagesByChapter(prev => ({ ...prev, [chapter.id]: pages }));
        }
      } else {
        pages = await fetchMarmotaChapterPages(chapter.url || '');
      }

      if (pages.length === 0) {
        throw new Error('Este número no tiene páginas publicadas. Prueba con otro.');
      }

      onSelectChapter(comic, chapter, pages);
      onClose();
    } catch (err) {
      setError(describe(err, 'No se pudieron cargar las páginas de este número. Prueba con otro.'));
    } finally {
      setLoadingChapterId(null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="chapter-modal-title"
      className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-100"
    >
      <div className="p-5 border-b border-zinc-800 flex items-start gap-4 bg-zinc-950/60">
        <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 shadow-lg border border-zinc-800">
          <img
            src={comic.coverUrl}
            alt=""
            width={200}
            height={300}
            className="w-full h-full object-cover"
          />
          <span
            className={`absolute top-1 left-1 text-[8px] font-black px-1 rounded text-white ${
              comic.publisher === 'DC' ? 'bg-blue-600' : 'bg-red-600'
            }`}
          >
            {comic.publisher}
          </span>
        </div>

        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              {comic.hero}
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
              {providerLabel}
            </span>
          </div>
          <h2 id="chapter-modal-title" className="text-base font-bold text-white line-clamp-2 break-words">
            {comic.title}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            <span className="nums">
              {isLoadingChapters ? 'Cargando números…' : `${chapters.length} números disponibles`}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el selector de números"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-5 mt-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="break-words">{error}</p>
            <button
              type="button"
              onClick={() => setRetryToken(t => t + 1)}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-900 text-red-100 font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </div>
      )}

      <div className="dialog-scroll flex-1 overflow-y-auto p-5 no-scrollbar flex flex-col gap-2">
        {isLoadingChapters ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400" aria-live="polite">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium">Obteniendo los números de {providerLabel}…</p>
          </div>
        ) : chapters.length === 0 ? (
          comic.embedUrl || readerEmbedUrl ? (
            <div className="py-10 px-4 flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-zinc-300">
                Esta obra se publica como tomo completo en un visor integrado.
              </p>
              <button
                type="button"
                onClick={() => openAsSingleVolume(comic, comic.embedUrl || readerEmbedUrl || '')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg transition-colors"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>Leer el cómic completo</span>
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 text-sm">
              {error
                ? 'No se pudo consultar la lista de números.'
                : 'Esta serie todavía no tiene números publicados.'}
            </div>
          )
        ) : (
          chapters.map(ch => {
            const isCurrentLoading = loadingChapterId === ch.id;
            return (
              <div
                key={ch.id}
                className="group flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors truncate">
                      {ch.title}
                    </span>
                    {ch.pageCount && <span className="text-[10px] text-zinc-500 nums">{ch.pageCount} páginas</span>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleReadChapter(ch)}
                  disabled={isCurrentLoading}
                  aria-label={`Leer ${ch.title}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-colors flex-shrink-0"
                >
                  {isCurrentLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      <span>Abriendo…</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-3 h-3" aria-hidden="true" />
                      <span>Leer</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 text-center text-[11px] text-zinc-500">
        Sincronizado con {providerLabel} • Lector sin publicidad
      </div>
    </Dialog>
  );
};
