import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  BookOpen,
  Bookmark,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  HelpCircle,
  Columns,
  Square,
  Scroll,
  Flame,
  Loader2,
  ImageOff
} from 'lucide-react';
import type { Comic, ReaderTheme, ReaderMode } from '../types/comic';
import { saveLastReadComic, getBookmarks, toggleBookmark } from '../services/localComicService';
import { usePersistentState, oneOf } from '../hooks/usePersistentState';
import { Dialog } from './Dialog';

interface KindleReaderProps {
  comic: Comic;
  initialPage?: number;
  onClose: () => void;
  onProgressChange?: (comic: Comic, page: number) => void;
}

const THEME_KEY = 'kindle_comics_reader_theme_v1';
const MODE_KEY = 'kindle_comics_reader_mode_v1';

const isTheme = oneOf<ReaderTheme>('dark', 'sepia', 'light', 'eink');
const isMode = oneOf<ReaderMode>('single', 'double', 'vertical');

const THEME_LABEL: Record<ReaderTheme, string> = {
  dark: 'oscuro',
  sepia: 'sepia',
  light: 'claro',
  eink: 'tinta electrónica'
};

export const KindleReader: React.FC<KindleReaderProps> = ({
  comic,
  initialPage = 1,
  onClose,
  onProgressChange
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);

  // El tema y el modo se recuerdan entre sesiones: volver a elegir el sepia
  // en cada apertura era la fricción más repetida de la aplicación.
  const [theme, setTheme] = usePersistentState<ReaderTheme>(THEME_KEY, 'dark', isTheme);
  const [readerMode, setReaderMode] = usePersistentState<ReaderMode>(MODE_KEY, 'single', isMode);

  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [bookmarks, setBookmarks] = useState<number[]>(() => getBookmarks(comic.id));
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // Estado real de carga de cada página. Antes existía la variable pero nunca
  // se ponía a `true`: no había indicador, y una página rota dejaba el lector
  // en blanco para siempre y sin explicación.
  const [reloadToken, setReloadToken] = useState<number>(0);
  const [loadState, setLoadState] = useState<{ key: string; status: 'loading' | 'ready' | 'error' }>({
    key: '',
    status: 'loading'
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const totalPages = Math.max(comic.totalPages || 32, 1);
  const pagesLeft = Math.max(0, totalPages - currentPage);
  const percentComplete = Math.round((currentPage / totalPages) * 100);
  const isBookmarked = bookmarks.includes(currentPage);

  const getPageSrc = useCallback(
    (pageIndex: number): string => {
      if (comic.pages && comic.pages[pageIndex - 1]) return comic.pages[pageIndex - 1];
      if (comic.identifier) return `https://archive.org/download/${comic.identifier}/page/n${pageIndex - 1}.jpg`;
      return comic.coverUrl;
    },
    [comic]
  );

  /* ---------------------------------------------------------------- *
   * Navegación
   * ---------------------------------------------------------------- */

  const goToPage = useCallback(
    (page: number, dir: 'next' | 'prev') => {
      const clamped = Math.min(Math.max(page, 1), totalPages);
      setDirection(dir);
      setCurrentPage(clamped);
      setZoomLevel(1);
      scrollRef.current?.scrollTo({ top: 0, left: 0 });
    },
    [totalPages]
  );

  const goToNextPage = useCallback(() => {
    const step = readerMode === 'double' ? 2 : 1;
    if (currentPage < totalPages) goToPage(currentPage + step, 'next');
  }, [currentPage, totalPages, readerMode, goToPage]);

  const goToPrevPage = useCallback(() => {
    const step = readerMode === 'double' ? 2 : 1;
    if (currentPage > 1) goToPage(currentPage - step, 'prev');
  }, [currentPage, readerMode, goToPage]);

  /* ---------------------------------------------------------------- *
   * Botón Atrás del navegador
   *
   * En el móvil, el gesto de volver es el reflejo para salir del lector.
   * Antes sacaba de la aplicación entera; ahora devuelve a la biblioteca.
   * ---------------------------------------------------------------- */

  useEffect(() => {
    window.history.pushState({ kindleReader: true }, '');
    const handlePop = () => onCloseRef.current();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const requestClose = useCallback(() => {
    if (window.history.state?.kindleReader) window.history.back();
    else onCloseRef.current();
  }, []);

  /* ---------------------------------------------------------------- *
   * Carga de página y progreso
   * ---------------------------------------------------------------- */

  const currentSrc = getPageSrc(currentPage);
  const loadKey = `${currentSrc}#${reloadToken}`;

  // Ajuste de estado durante el render: al cambiar de página el indicador
  // vuelve a «cargando» en el mismo paso, sin un render intermedio en el que
  // la página nueva se daría por lista.
  if (loadState.key !== loadKey) {
    setLoadState({ key: loadKey, status: 'loading' });
  }
  const pageStatus = loadState.key === loadKey ? loadState.status : 'loading';
  const setPageStatus = (status: 'ready' | 'error') => setLoadState({ key: loadKey, status });

  useEffect(() => {
    const pagesToPreload = [currentPage + 1, currentPage + 2];
    pagesToPreload.forEach(p => {
      if (p >= 1 && p <= totalPages) {
        const img = new Image();
        img.src = getPageSrc(p);
      }
    });
  }, [currentPage, totalPages, getPageSrc]);

  useEffect(() => {
    saveLastReadComic(comic, currentPage);
    onProgressChange?.(comic, currentPage);
  }, [comic, currentPage, onProgressChange]);

  /* ---------------------------------------------------------------- *
   * Controles que se ocultan solos
   * ---------------------------------------------------------------- */

  const scheduleControlsHide = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 4500);
  }, []);

  useEffect(() => {
    scheduleControlsHide();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [scheduleControlsHide]);

  /* ---------------------------------------------------------------- *
   * Pantalla completa
   * ---------------------------------------------------------------- */

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  // El estado se sincroniza con el navegador: si se sale con F11 o Esc, el
  // icono tiene que enterarse igualmente.
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  /* ---------------------------------------------------------------- *
   * Marcadores
   * ---------------------------------------------------------------- */

  const handleToggleBookmark = useCallback(() => {
    setBookmarks(toggleBookmark(comic.id, currentPage));
  }, [comic.id, currentPage]);

  const nextBookmark = useMemo(
    () => bookmarks.find(p => p > currentPage) ?? bookmarks[0],
    [bookmarks, currentPage]
  );

  /* ---------------------------------------------------------------- *
   * Teclado
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showHelp) return; // El diálogo gestiona su propio Esc.

      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
        case 'l':
          e.preventDefault();
          goToNextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'h':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1, 'prev');
          break;
        case 'End':
          e.preventDefault();
          goToPage(totalPages, 'next');
          break;
        case 'Escape':
          if (document.fullscreenElement) document.exitFullscreen?.();
          else setControlsVisible(v => !v);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          handleToggleBookmark();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoomLevel(z => Math.min(z + 0.25, 3));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setZoomLevel(z => Math.max(z - 0.25, 1));
          break;
        case '0':
          e.preventDefault();
          setZoomLevel(1);
          break;
        case 'm':
        case 'M':
          setReaderMode(m => (m === 'single' ? 'double' : m === 'double' ? 'vertical' : 'single'));
          break;
        case 't':
        case 'T':
          setTheme(t => (t === 'dark' ? 'sepia' : t === 'sepia' ? 'light' : t === 'light' ? 'eink' : 'dark'));
          break;
        case '?':
          setShowHelp(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    goToNextPage,
    goToPrevPage,
    goToPage,
    totalPages,
    showHelp,
    toggleFullscreen,
    handleToggleBookmark,
    setReaderMode,
    setTheme
  ]);

  /* ---------------------------------------------------------------- *
   * Toque y gestos
   * ---------------------------------------------------------------- */

  const handleReaderAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel > 1) return; // Con zoom, el arrastre es para desplazarse.

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x < rect.width * 0.3) goToPrevPage();
    else if (x > rect.width * 0.7) goToNextPage();
    else {
      setControlsVisible(v => !v);
      if (!controlsVisible) scheduleControlsHide();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || zoomLevel > 1 || readerMode === 'vertical') return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;

    // Deslizar para pasar página, que es el gesto que todo el mundo intenta.
    if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
      if (dx < 0) goToNextPage();
      else goToPrevPage();
    }
  };

  /* ---------------------------------------------------------------- *
   * Temas
   * ---------------------------------------------------------------- */

  const themeClasses: Record<ReaderTheme, { bg: string; text: string; barBg: string; border: string }> = {
    dark: { bg: 'bg-[#0e0e0e]', text: 'text-zinc-200', barBg: 'bg-[#181818]/95 backdrop-blur-md', border: 'border-zinc-800' },
    sepia: { bg: 'bg-[#f7efe0]', text: 'text-[#3e3228]', barBg: 'bg-[#eee2ce]/95 backdrop-blur-md', border: 'border-[#dfceb5]' },
    light: { bg: 'bg-[#fcfcfc]', text: 'text-zinc-800', barBg: 'bg-white/95 backdrop-blur-md', border: 'border-zinc-200' },
    eink: { bg: 'bg-[#e2e2dd]', text: 'text-black', barBg: 'bg-[#d5d5cf]/95 backdrop-blur-md', border: 'border-zinc-400' }
  };

  const style = themeClasses[theme];
  const animationClass = direction === 'next' ? 'animate-kindle-next' : 'animate-kindle-prev';

  /**
   * Con zoom, la imagen crece y el contenedor se desplaza: así se llega a las
   * esquinas de la viñeta. Hay que levantar también los topes de tamaño del
   * CSS (`max-h-[94vh]`, `max-w-full`): si no, la imagen sigue encajada dentro
   * de la pantalla y el zoom no amplía nada.
   */
  const zoomedImageStyle: React.CSSProperties =
    zoomLevel > 1
      ? { width: `${zoomLevel * 100}%`, maxWidth: 'none', height: 'auto', maxHeight: 'none' }
      : {};

  const pageOverlay = (
    <>
      {pageStatus === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" aria-hidden="true" />
          <p className="text-xs opacity-70">Cargando página {currentPage}…</p>
        </div>
      )}

      {pageStatus === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <ImageOff className="w-10 h-10 opacity-60" aria-hidden="true" />
          <p className="text-sm font-semibold">No se pudo cargar la página {currentPage}</p>
          <p className="text-xs opacity-70 max-w-xs">
            La fuente puede haber movido la imagen. Reinténtalo o salta a la siguiente página.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setReloadToken(t => t + 1);
              }}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
            >
              Reintentar
            </button>
            {currentPage < totalPages && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  goToNextPage();
                }}
                className="px-4 py-2 rounded-lg bg-black/10 dark:bg-white/10 text-xs font-semibold transition-colors"
              >
                Saltar a la siguiente
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-300 ${style.bg} ${style.text}`}
    >
      {/* ================= BARRA SUPERIOR ================= */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between gap-3 border-b transition-all duration-300 ${style.barBg} ${style.border} ${
          controlsVisible ? 'translate-y-0 opacity-100 shadow-lg' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={requestClose}
            aria-label="Volver a la biblioteca"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black/10 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Biblioteca</span>
          </button>

          <div className="h-4 w-px bg-zinc-600/40 flex-shrink-0" aria-hidden="true" />

          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate max-w-[180px] sm:max-w-md">{comic.title}</h2>
            <div className="flex items-center gap-2 text-xs opacity-70">
              <span
                className={`px-1.5 rounded font-bold uppercase text-[10px] ${
                  comic.publisher === 'DC' ? 'bg-blue-600/20 text-blue-500' : 'bg-red-600/20 text-red-500'
                }`}
              >
                {comic.publisher}
              </span>
              <span className="nums">
                Pág. {currentPage} de {totalPages}
              </span>
              <span aria-hidden="true">•</span>
              <span className="text-amber-600 font-medium nums">{percentComplete}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center bg-black/10 rounded-lg p-0.5" role="group" aria-label="Modo de lectura">
            <button
              type="button"
              onClick={() => setReaderMode('single')}
              aria-label="Modo de página individual"
              aria-pressed={readerMode === 'single'}
              className={`p-1.5 rounded transition-colors ${readerMode === 'single' ? 'bg-amber-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
            >
              <Square className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setReaderMode('double')}
              aria-label="Modo de doble página"
              aria-pressed={readerMode === 'double'}
              className={`p-1.5 rounded transition-colors ${readerMode === 'double' ? 'bg-amber-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
            >
              <Columns className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setReaderMode('vertical')}
              aria-label="Modo de desplazamiento continuo"
              aria-pressed={readerMode === 'vertical'}
              className={`p-1.5 rounded transition-colors ${readerMode === 'vertical' ? 'bg-amber-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
            >
              <Scroll className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="hidden xs:flex items-center bg-black/10 rounded-lg p-0.5" role="group" aria-label="Tema del lector">
            {(['dark', 'sepia', 'light', 'eink'] as ReaderTheme[]).map(t => {
              const Icon = t === 'dark' ? Moon : t === 'sepia' ? Flame : t === 'light' ? Sun : null;
              const active = theme === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  aria-label={`Tema ${THEME_LABEL[t]}`}
                  aria-pressed={active}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    active
                      ? t === 'dark'
                        ? 'bg-zinc-800 text-white shadow'
                        : t === 'sepia'
                          ? 'bg-[#dcc6a8] text-[#3e3228] shadow font-bold'
                          : t === 'light'
                            ? 'bg-white text-zinc-900 shadow'
                            : 'bg-zinc-300 text-black font-bold shadow'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {Icon ? <Icon className="w-3.5 h-3.5" aria-hidden="true" /> : <span aria-hidden="true">E-Ink</span>}
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center bg-black/10 rounded-lg p-0.5" role="group" aria-label="Zoom">
            <button
              type="button"
              onClick={() => setZoomLevel(z => Math.max(1, z - 0.25))}
              disabled={zoomLevel <= 1}
              aria-label="Reducir zoom"
              className="p-1.5 opacity-70 hover:opacity-100 disabled:opacity-30"
            >
              <ZoomOut className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="text-[11px] nums px-1" aria-live="polite">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
              disabled={zoomLevel >= 3}
              aria-label="Aumentar zoom"
              className="p-1.5 opacity-70 hover:opacity-100 disabled:opacity-30"
            >
              <ZoomIn className="w-4 h-4" aria-hidden="true" />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                aria-label="Restablecer zoom al 100%"
                className="p-1.5 text-amber-600"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleBookmark}
            aria-label={isBookmarked ? `Quitar el marcador de la página ${currentPage}` : `Marcar la página ${currentPage}`}
            aria-pressed={isBookmarked}
            className={`p-2 rounded-lg transition-colors ${isBookmarked ? 'text-amber-600 bg-amber-500/10' : 'opacity-70 hover:opacity-100'}`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver a pantalla completa'}
            className="p-2 rounded-lg opacity-70 hover:opacity-100 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="Ver los atajos de teclado"
            className="p-2 rounded-lg opacity-70 hover:opacity-100 transition-colors"
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ================= LIENZO DE LECTURA ================= */}
      <div
        className="reader-canvas relative flex-1 w-full h-full overflow-hidden flex items-center justify-center"
        onClick={handleReaderAreaClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Anuncio de página para lectores de pantalla. */}
        <p className="sr-only" aria-live="polite">
          Página {currentPage} de {totalPages}
        </p>

        {readerMode !== 'vertical' && currentPage > 1 && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              goToPrevPage();
            }}
            aria-label="Página anterior"
            className="reveal-on-hover absolute left-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity backdrop-blur-sm"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
        )}

        {readerMode !== 'vertical' && currentPage < totalPages && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              goToNextPage();
            }}
            aria-label="Página siguiente"
            className="reveal-on-hover absolute right-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity backdrop-blur-sm"
          >
            <ChevronRight className="w-6 h-6" aria-hidden="true" />
          </button>
        )}

        {comic.embedUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4">
            <iframe
              src={comic.embedUrl}
              title={`Lector original de ${comic.title}`}
              className="w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl border border-zinc-700/60 bg-black"
            />
          </div>
        ) : readerMode === 'vertical' ? (
          <div className="w-full h-full overflow-y-auto no-scrollbar flex flex-col items-center py-16 px-2 gap-4">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <div key={pNum} className="flex flex-col items-center max-w-4xl w-full">
                  {/* El hueco se reserva con la proporción de una página: sin esto
                      el scroll saltaba bajo el dedo cada vez que cargaba una imagen. */}
                  <div className="w-full aspect-[2/3] bg-black/5 rounded-sm overflow-hidden shadow-2xl">
                    <img
                      src={getPageSrc(pNum)}
                      alt={`Página ${pNum} de ${comic.title}`}
                      loading="lazy"
                      decoding="async"
                      className={`w-full h-full object-contain ${theme === 'eink' ? 'grayscale contrast-125' : ''}`}
                    />
                  </div>
                  <div className="text-xs opacity-50 py-1 nums">
                    Página {pNum} de {totalPages}
                  </div>
                </div>
              );
            })}
          </div>
        ) : readerMode === 'double' ? (
          <div
            ref={scrollRef}
            className={`w-full h-full flex items-center justify-center p-2 sm:p-6 gap-2 sm:gap-4 ${zoomLevel > 1 ? 'overflow-auto' : 'overflow-hidden'} ${animationClass} ${
              theme === 'eink' ? 'grayscale contrast-125' : ''
            }`}
          >
            {pageOverlay}
            <div className="h-full flex-1 max-w-[50%] flex items-center justify-end">
              <img
                key={`${currentPage}-${reloadToken}`}
                src={currentSrc}
                alt={`Página ${currentPage} de ${comic.title}`}
                onLoad={() => setPageStatus('ready')}
                onError={() => setPageStatus('error')}
                style={zoomedImageStyle}
                className={`max-h-[92vh] max-w-full object-contain rounded shadow-2xl transition-opacity ${
                  pageStatus === 'ready' ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
            {currentPage + 1 <= totalPages && (
              <div className="h-full flex-1 max-w-[50%] flex items-center justify-start">
                <img
                  key={`${currentPage + 1}-${reloadToken}`}
                  src={getPageSrc(currentPage + 1)}
                  alt={`Página ${currentPage + 1} de ${comic.title}`}
                  style={zoomedImageStyle}
                  className="max-h-[92vh] max-w-full object-contain rounded shadow-2xl"
                />
              </div>
            )}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className={`relative w-full h-full flex items-center justify-center p-2 sm:p-6 ${
              zoomLevel > 1 ? 'overflow-auto items-start justify-start' : 'overflow-hidden'
            } ${animationClass} ${theme === 'eink' ? 'grayscale contrast-125' : ''}`}
          >
            {pageOverlay}
            <img
              key={`${currentPage}-${reloadToken}`}
              src={currentSrc}
              alt={`Página ${currentPage} de ${comic.title}`}
              onLoad={() => setPageStatus('ready')}
              onError={() => setPageStatus('error')}
              style={zoomedImageStyle}
              className={`max-h-[94vh] max-w-full object-contain rounded-sm shadow-2xl transition-opacity ${
                pageStatus === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        )}
      </div>

      {/* ================= BARRA INFERIOR ================= */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 px-4 py-3 border-t transition-all duration-300 ${style.barBg} ${style.border} ${
          controlsVisible ? 'translate-y-0 opacity-100 shadow-2xl' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs nums opacity-70 w-14 text-right">Pág. {currentPage}</span>

            <div className="relative flex-1">
              <label htmlFor="page-scrubber" className="sr-only">
                Ir a una página concreta
              </label>
              <input
                id="page-scrubber"
                type="range"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={e => goToPage(parseInt(e.target.value, 10), 'next')}
                className="w-full h-2 bg-zinc-700/40 rounded-lg cursor-pointer"
              />
              {/* Marcadores dibujados sobre la barra, para saber dónde están. */}
              {bookmarks.map(p => (
                <span
                  key={p}
                  aria-hidden="true"
                  className="absolute top-full mt-0.5 w-0.5 h-1.5 bg-amber-600 rounded"
                  style={{ left: `${((p - 1) / Math.max(1, totalPages - 1)) * 100}%` }}
                />
              ))}
            </div>

            <span className="text-xs nums opacity-70 w-14">{totalPages}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs opacity-80 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(1, 'prev')}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded bg-black/10 disabled:opacity-30 text-[11px]"
              >
                Primera
              </button>
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded bg-black/10 disabled:opacity-30 text-[11px]"
              >
                Anterior
              </button>
            </div>

            <div className="font-serif text-[11px] sm:text-xs tracking-wide nums text-center">
              {percentComplete}% leído
              <span className="hidden sm:inline">
                {' '}
                • quedan {pagesLeft} {pagesLeft === 1 ? 'página' : 'páginas'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {nextBookmark !== undefined && (
                <button
                  type="button"
                  onClick={() => goToPage(nextBookmark, nextBookmark > currentPage ? 'next' : 'prev')}
                  aria-label={`Ir al marcador de la página ${nextBookmark}`}
                  className="px-2 py-1 rounded bg-amber-600/20 text-amber-700 text-[11px] font-semibold nums"
                >
                  Marcador {nextBookmark}
                </button>
              )}
              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded bg-black/10 disabled:opacity-30 text-[11px]"
              >
                Siguiente
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages, 'next')}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded bg-black/10 disabled:opacity-30 text-[11px]"
              >
                Última
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ATAJOS DE TECLADO ================= */}
      <Dialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        labelledBy="help-title"
        className={`max-w-md w-full p-6 rounded-2xl shadow-2xl border ${style.barBg} ${style.border} ${style.text}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-700/30">
          <h3 id="help-title" className="text-base font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" aria-hidden="true" /> Atajos de lectura
          </h3>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            aria-label="Cerrar los atajos de teclado"
            className="p-1 text-sm rounded hover:bg-black/10"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-4 text-xs">
          {[
            ['Página siguiente', '→ / Espacio'],
            ['Página anterior', '← / RePág'],
            ['Primera / última', 'Inicio / Fin'],
            ['Pantalla completa', 'F'],
            ['Cambiar modo de vista', 'M'],
            ['Cambiar de tema', 'T'],
            ['Marcar esta página', 'B'],
            ['Zoom', '+ / − / 0'],
            ['Mostrar u ocultar menú', 'Esc'],
            ['Tocar el centro', 'Menú'],
            ['Deslizar en el móvil', 'Pasa página']
          ].map(([action, keys]) => (
            <div key={action} className="flex items-center justify-between gap-2 p-2 rounded bg-black/5">
              <dt className="opacity-80">{action}</dt>
              <dd className="m-0">
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold text-[11px]">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={() => setShowHelp(false)}
          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          Entendido
        </button>
      </Dialog>
    </div>
  );
};
