import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ExternalLink,
  Flame,
  Check
} from 'lucide-react';
import type { Comic, ReaderTheme, ReaderMode, PageTransition } from '../types/comic';
import { saveLastReadComic } from '../services/localComicService';

interface KindleReaderProps {
  comic: Comic;
  initialPage?: number;
  onClose: () => void;
  onProgressChange?: (comic: Comic, page: number) => void;
}

export const KindleReader: React.FC<KindleReaderProps> = ({
  comic,
  initialPage = 1,
  onClose,
  onProgressChange
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [theme, setTheme] = useState<ReaderTheme>('dark');
  const [readerMode, setReaderMode] = useState<ReaderMode>('single');
  const [transition, setTransition] = useState<PageTransition>('slide');
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [showOriginalEmbed, setShowOriginalEmbed] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const totalPages = Math.max(comic.totalPages || 32, 1);

  // Pre-calculate page URL for a given page index (1-based)
  const getPageSrc = useCallback((pageIndex: number): string => {
    if (comic.pages && comic.pages[pageIndex - 1]) {
      return comic.pages[pageIndex - 1];
    }
    if (comic.identifier) {
      return `https://archive.org/download/${comic.identifier}/page/n${pageIndex - 1}.jpg`;
    }
    return comic.coverUrl;
  }, [comic]);

  // Preload adjacent pages for instant Kindle flip
  useEffect(() => {
    const pagesToPreload = [currentPage, currentPage + 1, currentPage + 2];
    pagesToPreload.forEach(p => {
      if (p >= 1 && p <= totalPages) {
        const img = new Image();
        img.src = getPageSrc(p);
      }
    });
  }, [currentPage, totalPages, getPageSrc]);

  // Save reading progress and last read comic on page change
  useEffect(() => {
    saveLastReadComic(comic, currentPage);
    onProgressChange?.(comic, currentPage);
  }, [comic, currentPage, onProgressChange]);

  // Auto-hide controls timer
  const scheduleControlsHide = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setControlsVisible(false);
    }, 4500);
  }, []);

  useEffect(() => {
    scheduleControlsHide();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [scheduleControlsHide]);

  // Navigation handlers
  const goToNextPage = useCallback(() => {
    if (readerMode === 'double') {
      if (currentPage + 2 <= totalPages) {
        setDirection('next');
        setCurrentPage(prev => Math.min(prev + 2, totalPages));
      } else if (currentPage + 1 <= totalPages) {
        setDirection('next');
        setCurrentPage(prev => prev + 1);
      }
    } else {
      if (currentPage < totalPages) {
        setDirection('next');
        setCurrentPage(prev => prev + 1);
      }
    }
    setZoomLevel(1);
  }, [currentPage, totalPages, readerMode]);

  const goToPrevPage = useCallback(() => {
    if (readerMode === 'double') {
      if (currentPage > 2) {
        setDirection('prev');
        setCurrentPage(prev => Math.max(prev - 2, 1));
      } else if (currentPage > 1) {
        setDirection('prev');
        setCurrentPage(1);
      }
    } else {
      if (currentPage > 1) {
        setDirection('prev');
        setCurrentPage(prev => prev - 1);
      }
    }
    setZoomLevel(1);
  }, [currentPage, readerMode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showHelp) {
        if (e.key === 'Escape' || e.key === '?') setShowHelp(false);
        return;
      }

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
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen?.();
          } else {
            setControlsVisible(v => !v);
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoomLevel(z => Math.min(z + 0.25, 3));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setZoomLevel(z => Math.max(z - 0.25, 0.75));
          break;
        case '0':
          e.preventDefault();
          setZoomLevel(1);
          break;
        case 'm':
        case 'M':
          setReaderMode(m => m === 'single' ? 'double' : m === 'double' ? 'vertical' : 'single');
          break;
        case 't':
        case 'T':
          setTheme(t => t === 'dark' ? 'sepia' : t === 'sepia' ? 'light' : t === 'light' ? 'eink' : 'dark');
          break;
        case '?':
          setShowHelp(h => !h);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage, isFullscreen, showHelp]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Screen zones click handler
  const handleReaderAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If zoomed in, clicking shouldn't turn page
    if (zoomLevel > 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    const leftZone = width * 0.3;
    const rightZone = width * 0.7;

    if (x < leftZone) {
      // Tap left -> Prev page
      goToPrevPage();
    } else if (x > rightZone) {
      // Tap right -> Next page
      goToNextPage();
    } else {
      // Tap center -> Toggle Kindle overlay controls
      setControlsVisible(v => !v);
      if (!controlsVisible) scheduleControlsHide();
    }
  };

  // Theme styling definitions
  const themeClasses: Record<ReaderTheme, { bg: string; text: string; barBg: string; border: string }> = {
    dark: {
      bg: 'bg-[#0e0e0e]',
      text: 'text-zinc-200',
      barBg: 'bg-[#181818]/95 backdrop-blur-md',
      border: 'border-zinc-800'
    },
    sepia: {
      bg: 'bg-[#f7efe0]',
      text: 'text-[#3e3228]',
      barBg: 'bg-[#eee2ce]/95 backdrop-blur-md',
      border: 'border-[#dfceb5]'
    },
    light: {
      bg: 'bg-[#fcfcfc]',
      text: 'text-zinc-800',
      barBg: 'bg-white/95 backdrop-blur-md',
      border: 'border-zinc-200'
    },
    eink: {
      bg: 'bg-[#e2e2dd]',
      text: 'text-black',
      barBg: 'bg-[#d5d5cf]/95 backdrop-blur-md',
      border: 'border-zinc-400'
    }
  };

  const currentThemeStyle = themeClasses[theme];
  const percentComplete = Math.round((currentPage / totalPages) * 100);
  const minutesLeft = Math.max(1, Math.round((totalPages - currentPage) * 0.8));

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col select-none transition-colors duration-300 ${currentThemeStyle.bg} ${currentThemeStyle.text}`}
    >
      {/* ================= KINDLE TOP BAR ================= */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between border-b transition-all duration-300 ${
          currentThemeStyle.barBg
        } ${currentThemeStyle.border} ${
          controlsVisible ? 'translate-y-0 opacity-100 shadow-lg' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Exit & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Volver a la Biblioteca (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Biblioteca</span>
          </button>
          
          <div className="h-4 w-px bg-zinc-600/40" />

          <div>
            <h2 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md">
              {comic.title}
            </h2>
            <div className="flex items-center gap-2 text-xs opacity-70">
              <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[10px] ${
                comic.publisher === 'DC' ? 'bg-blue-600/20 text-blue-400' : 'bg-red-600/20 text-red-400'
              }`}>
                {comic.publisher}
              </span>
              <span>•</span>
              <span>Pág. {currentPage} de {totalPages}</span>
              <span>•</span>
              <span className="text-amber-500 font-medium">{percentComplete}%</span>
            </div>
          </div>
        </div>

        {/* Right: Controls & Options */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Reader Mode (Single / Double / Vertical) */}
          <div className="flex items-center bg-black/10 dark:bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setReaderMode('single')}
              className={`p-1.5 rounded text-xs transition-colors ${readerMode === 'single' ? 'bg-amber-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
              title="Página Individual"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => setReaderMode('double')}
              className={`p-1.5 rounded text-xs transition-colors ${readerMode === 'double' ? 'bg-amber-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
              title="Doble Página (Spread)"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setReaderMode('vertical')}
              className={`p-1.5 rounded text-xs transition-colors ${readerMode === 'vertical' ? 'bg-amber-600 text-white shadow' : 'opacity-70 hover:opacity-100'}`}
              title="Scroll Continuo (Webtoon)"
            >
              <Scroll className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="flex items-center bg-black/10 dark:bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setTheme('dark')}
              className={`px-2 py-1 rounded text-xs transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-white shadow' : 'opacity-60 hover:opacity-100'}`}
              title="Modo Oscuro Kindle"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`px-2 py-1 rounded text-xs transition-colors ${theme === 'sepia' ? 'bg-[#dcc6a8] text-[#3e3228] shadow font-bold' : 'opacity-60 hover:opacity-100'}`}
              title="Modo Sepia / Luz Cálida Kindle Paperwhite"
            >
              <Flame className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-2 py-1 rounded text-xs transition-colors ${theme === 'light' ? 'bg-white text-zinc-900 shadow' : 'opacity-60 hover:opacity-100'}`}
              title="Modo Claro"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('eink')}
              className={`px-2 py-1 rounded text-xs transition-colors ${theme === 'eink' ? 'bg-zinc-300 text-black font-mono font-bold shadow' : 'opacity-60 hover:opacity-100'}`}
              title="Modo E-Ink Monocromo"
            >
              E-Ink
            </button>
          </div>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-black/10 dark:bg-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.75, z - 0.25))}
              className="p-1.5 opacity-70 hover:opacity-100"
              title="Reducir Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono px-1">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
              className="p-1.5 opacity-70 hover:opacity-100"
              title="Aumentar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoomLevel !== 1 && (
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-amber-500 hover:opacity-100"
                title="Restablecer (0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bookmark */}
          <button
            onClick={() => setIsBookmarked(b => !b)}
            className={`p-2 rounded-lg transition-colors ${isBookmarked ? 'text-amber-500 fill-amber-500 bg-amber-500/10' : 'opacity-70 hover:opacity-100'}`}
            title="Marcar Página"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg opacity-70 hover:opacity-100 transition-colors"
            title="Pantalla Completa (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Help Shortcuts */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg opacity-70 hover:opacity-100 transition-colors"
            title="Atajos de teclado (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= KINDLE READING CANVAS ================= */}
      <div
        className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-default select-none"
        onClick={handleReaderAreaClick}
      >
        {/* Subtle Side Navigation Chevrons (Kindle Page Turner hints) */}
        {readerMode !== 'vertical' && currentPage > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevPage();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white transition-all opacity-0 hover:opacity-100 backdrop-blur-sm"
            title="Página Anterior (Flecha Izq / Espacio atrás)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {readerMode !== 'vertical' && currentPage < totalPages && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNextPage();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white transition-all opacity-0 hover:opacity-100 backdrop-blur-sm"
            title="Página Siguiente (Flecha Der / Espacio)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Content View Mode: Embed / Single / Double / Vertical */}
        {comic.embedUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4">
            <iframe
              src={comic.embedUrl}
              title={comic.title}
              className="w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl border border-zinc-700/60 bg-black"
              allow="autoplay"
            />
          </div>
        ) : readerMode === 'vertical' ? (
          // Continuous Vertical Scroll (Webtoon style)
          <div className="w-full h-full overflow-y-auto no-scrollbar flex flex-col items-center py-16 px-2 gap-4">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <div key={pNum} className="flex flex-col items-center max-w-4xl w-full shadow-2xl">
                  <img
                    src={getPageSrc(pNum)}
                    alt={`Página ${pNum}`}
                    loading="lazy"
                    className="w-full h-auto object-contain rounded-sm"
                  />
                  <div className="text-xs opacity-50 py-1 font-mono">
                    Página {pNum} de {totalPages}
                  </div>
                </div>
              );
            })}
          </div>
        ) : readerMode === 'double' ? (
          // Double Page Spread Mode
          <div
            className={`w-full h-full flex items-center justify-center p-2 sm:p-6 gap-2 sm:gap-4 overflow-hidden transition-transform duration-150 ${
              transition === 'slide' ? (direction === 'next' ? 'animate-kindle-next' : 'animate-kindle-prev') : 'animate-kindle-fade'
            } ${theme === 'eink' ? 'grayscale contrast-125' : ''}`}
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* Left Page (Current) */}
            <div className="h-full flex-1 max-w-[50%] flex items-center justify-end">
              <img
                src={getPageSrc(currentPage)}
                alt={`Página ${currentPage}`}
                className="max-h-[92vh] max-w-full object-contain rounded shadow-2xl border border-black/10"
              />
            </div>
            {/* Right Page (Next) */}
            {currentPage + 1 <= totalPages && (
              <div className="h-full flex-1 max-w-[50%] flex items-center justify-start">
                <img
                  src={getPageSrc(currentPage + 1)}
                  alt={`Página ${currentPage + 1}`}
                  className="max-h-[92vh] max-w-full object-contain rounded shadow-2xl border border-black/10"
                />
              </div>
            )}
          </div>
        ) : (
          // Single Page Mode (Kindle default)
          <div
            className={`relative w-full h-full flex items-center justify-center p-2 sm:p-6 overflow-hidden transition-transform duration-150 ${
              transition === 'slide' ? (direction === 'next' ? 'animate-kindle-next' : 'animate-kindle-prev') : 'animate-kindle-fade'
            } ${theme === 'eink' ? 'grayscale contrast-125' : ''}`}
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              key={currentPage}
              src={getPageSrc(currentPage)}
              alt={`Página ${currentPage}`}
              onLoad={() => setPageLoading(false)}
              onError={() => setPageLoading(false)}
              className="max-h-[94vh] max-w-full object-contain rounded-sm shadow-2xl border border-black/15 transition-all"
            />
          </div>
        )}
      </div>

      {/* ================= KINDLE BOTTOM BAR ================= */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 px-4 py-3 border-t transition-all duration-300 ${
          currentThemeStyle.barBg
        } ${currentThemeStyle.border} ${
          controlsVisible ? 'translate-y-0 opacity-100 shadow-2xl' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {/* Kindle Page Scrubber Slider */}
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs font-mono opacity-70 w-12 text-right">
              Pág. {currentPage}
            </span>

            <input
              type="range"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
              className="flex-1 h-2 bg-zinc-700/40 rounded-lg cursor-pointer"
            />

            <span className="text-xs font-mono opacity-70 w-12">
              {totalPages}
            </span>
          </div>

          {/* Kindle Footer Stats & Quick Navigation */}
          <div className="flex items-center justify-between text-xs opacity-80 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:opacity-100 disabled:opacity-30 text-[11px]"
              >
                Primera pág.
              </button>
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:opacity-100 disabled:opacity-30 text-[11px]"
              >
                Anterior
              </button>
            </div>

            {/* Reading Speed Estimation */}
            <div className="font-serif text-[11px] sm:text-xs tracking-wide">
              {percentComplete}% leído • ~{minutesLeft} min restantes en el cómic
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:opacity-100 disabled:opacity-30 text-[11px]"
              >
                Siguiente
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:opacity-100 disabled:opacity-30 text-[11px]"
              >
                Última pág.
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= KEYBOARD SHORTCUTS MODAL ================= */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className={`max-w-md w-full p-6 rounded-2xl shadow-2xl border ${currentThemeStyle.barBg} ${currentThemeStyle.border} ${currentThemeStyle.text}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-700/30">
              <h3 className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" /> Atajos de Lectura Kindle
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 text-sm rounded hover:bg-black/10 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Página siguiente</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">▶ / Espacio</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Página anterior</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">◀ / RePág</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Pantalla completa</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">F</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Cambiar Modo Vista</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Alternar Temas</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">T</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Zoom +/-</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">+ / -</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Menú / Salir</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">Esc</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span className="opacity-80">Tocar centro</span>
                <span className="opacity-60 text-[11px]">Oculta/Muestra menú</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
