import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  BookOpen,
  Sparkles,
  Plus,
  LayoutGrid,
  List,
  Star,
  Globe,
  Loader2,
  Clock,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  X
} from 'lucide-react';
import type { Comic } from '../types/comic';
import { FEATURED_COMICS } from '../data/featuredComics';
import { ComicCard } from './ComicCard';
import { fetchMarmotaFeed, searchMarmota } from '../services/marmotaService';
import { fetchMegaBananaFeed, searchMegaBanana } from '../services/megabananaService';
import { searchComicsOnline } from '../services/archiveService';
import {
  getAllSavedProgress,
  loadFavorites,
  persistFavorites,
  getLastReadComic
} from '../services/localComicService';
import type { LastReadSession } from '../services/localComicService';
import { IS_API_MISCONFIGURED } from '../config';
import { usePersistentState, oneOf } from '../hooks/usePersistentState';
import { readUrlEnum, readUrlState, useSyncUrlState } from '../hooks/useUrlState';

interface LibraryProps {
  onOpenReader: (comic: Comic, page?: number) => void;
  onOpenImportModal: () => void;
  onSelectSeriesComic: (comic: Comic) => void;
  onRemoveCustomComic: (comic: Comic) => void;
  customComics: Comic[];
  lastReadSession?: LastReadSession | null;
}

type Publisher = 'ALL' | 'DC' | 'Marvel';
type SourceFilter = 'all' | 'megabanana' | 'marmota' | 'featured';
type TabFilter = 'all' | 'favorites' | 'custom';
type ViewMode = 'grid' | 'list';

const PUBLISHERS = ['ALL', 'DC', 'Marvel'] as const;
const SOURCES = ['all', 'megabanana', 'marmota', 'featured'] as const;
const TABS = ['all', 'favorites', 'custom'] as const;

const URL_DEFAULTS: Record<string, string> = { q: '', pub: 'ALL', src: 'all', tab: 'all', hero: 'ALL' };
const VIEW_KEY = 'kindle_comics_view_mode_v1';
const isViewMode = oneOf<ViewMode>('grid', 'list');

const HEROES = [
  'Batman', 'Spider-Man', 'Superman', 'X-Men', 'Deadpool',
  'Avengers', 'Iron Man', 'Daredevil', 'Wolverine', 'Hulk'
];

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const Library: React.FC<LibraryProps> = ({
  onOpenReader,
  onOpenImportModal,
  onSelectSeriesComic,
  onRemoveCustomComic,
  customComics,
  lastReadSession
}) => {
  /* Estado reflejado en la URL: se puede compartir y sobrevive a una recarga. */
  const [searchQuery, setSearchQuery] = useState<string>(() => readUrlState().get('q') ?? '');
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher>(() => readUrlEnum('pub', PUBLISHERS, 'ALL'));
  const [selectedSource, setSelectedSource] = useState<SourceFilter>(() => readUrlEnum('src', SOURCES, 'all'));
  const [selectedTab, setSelectedTab] = useState<TabFilter>(() => readUrlEnum('tab', TABS, 'all'));
  const [selectedHero, setSelectedHero] = useState<string>(() => readUrlState().get('hero') ?? 'ALL');
  const [viewMode, setViewMode] = usePersistentState<ViewMode>(VIEW_KEY, 'grid', isViewMode);

  useSyncUrlState(
    useMemo(
      () => ({ q: searchQuery, pub: selectedPublisher, src: selectedSource, tab: selectedTab, hero: selectedHero }),
      [searchQuery, selectedPublisher, selectedSource, selectedTab, selectedHero]
    ),
    URL_DEFAULTS
  );

  /* Catálogos por fuente, cada uno con su propio error. */
  const [marmota, setMarmota] = useState<{ dc: Comic[]; marvel: Comic[] }>({ dc: [], marvel: [] });
  const [megaBanana, setMegaBanana] = useState<{ dc: Comic[]; marvel: Comic[] }>({ dc: [], marvel: [] });
  const [feedErrors, setFeedErrors] = useState<{ marmota?: string; megabanana?: string }>({});
  const [isLoadingFeeds, setIsLoadingFeeds] = useState<boolean>(true);

  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Comic[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [readingProgressMap] = useState<Record<string, { page: number; timestamp: number }>>(() => getAllSavedProgress());

  // Los favoritos viven en memoria. Antes se leía y parseaba localStorage por
  // cada tarjeta y por cada render: miles de JSON.parse por cada tecla pulsada.
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());

  const searchAbort = useRef<AbortController | null>(null);

  /* ---------------------------------------------------------------- *
   * Catálogos
   * ---------------------------------------------------------------- */

  const loadAllFeeds = useCallback(async () => {
    setIsLoadingFeeds(true);
    setFeedErrors({});

    const [marmotaRes, megaRes] = await Promise.allSettled([fetchMarmotaFeed(), fetchMegaBananaFeed()]);

    const errors: { marmota?: string; megabanana?: string } = {};

    if (marmotaRes.status === 'fulfilled') setMarmota(marmotaRes.value);
    else errors.marmota = messageOf(marmotaRes.reason, 'Marmota no respondió.');

    if (megaRes.status === 'fulfilled') setMegaBanana(megaRes.value);
    else errors.megabanana = messageOf(megaRes.reason, 'MegaBanana no respondió.');

    setFeedErrors(errors);
    setIsLoadingFeeds(false);
  }, []);

  useEffect(() => {
    loadAllFeeds();
  }, [loadAllFeeds]);

  /* ---------------------------------------------------------------- *
   * Búsqueda
   * ---------------------------------------------------------------- */

  const performSearch = useCallback(async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }

    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;

    setIsSearchingOnline(true);
    setSearchError(null);

    const [mega, marmotaRes, archive] = await Promise.allSettled([
      searchMegaBanana(trimmed, 'ALL', controller.signal),
      searchMarmota(trimmed, 'ALL', controller.signal),
      searchComicsOnline(trimmed, 'Other')
    ]);

    if (controller.signal.aborted) return;

    const lists = [mega, marmotaRes, archive]
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Comic[]>).value);

    const failures = [mega, marmotaRes, archive].filter(r => r.status === 'rejected');

    const seen = new Set<string>();
    const deduplicated = lists.flat().filter(c => {
      const key = c.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setSearchResults(deduplicated);

    // Solo es un error si no quedó nada que enseñar: si una fuente de tres
    // falló pero las otras respondieron, el aviso sobra.
    if (failures.length === 3) {
      setSearchError('Ninguna de las fuentes respondió a la búsqueda. Comprueba tu conexión y reinténtalo.');
    } else if (failures.length > 0 && deduplicated.length === 0) {
      setSearchError('Las fuentes disponibles no devolvieron resultados y alguna no respondió.');
    }

    setIsSearchingOnline(false);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleHeroClick = (hero: string) => {
    if (selectedHero === hero) {
      setSelectedHero('ALL');
      setSearchQuery('');
      setSearchResults(null);
    } else {
      setSelectedHero(hero);
      setSearchQuery(hero);
      performSearch(hero);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedPublisher('ALL');
    setSelectedHero('ALL');
    setSelectedSource('all');
    setSelectedTab('all');
    setSearchResults(null);
    setSearchError(null);
  };

  const handleToggleFav = useCallback((comicId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(comicId)) next.delete(comicId);
      else next.add(comicId);
      persistFavorites(next);
      return next;
    });
  }, []);

  const handleComicClick = (comic: Comic) => {
    if (comic.needsReimport) {
      onOpenImportModal();
      return;
    }
    if (comic.embedUrl) onOpenReader(comic, 1);
    else if (comic.source === 'megabanana' || comic.source === 'marmota') onSelectSeriesComic(comic);
    else onOpenReader(comic, readingProgressMap[comic.id]?.page || 1);
  };

  /* ---------------------------------------------------------------- *
   * Listas derivadas
   * ---------------------------------------------------------------- */

  const allComics = useMemo(() => {
    if (searchResults !== null) return searchResults;

    // Un crossover (Batman/Deadpool, por ejemplo) aparece en la sección de DC
    // y en la de Marvel de la misma fuente: sin deduplicar por id, React recibe
    // dos tarjetas con la misma clave y acaba omitiendo una.
    const seen = new Set<string>();
    return [
      ...customComics,
      ...megaBanana.dc,
      ...marmota.dc,
      ...megaBanana.marvel,
      ...marmota.marvel,
      ...FEATURED_COMICS
    ].filter(comic => {
      if (seen.has(comic.id)) return false;
      seen.add(comic.id);
      return true;
    });
  }, [customComics, megaBanana, marmota, searchResults]);

  const filteredComics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const useLocalTextFilter = q.length > 0 && searchResults === null;

    return allComics.filter(comic => {
      if (selectedSource === 'megabanana' && comic.source !== 'megabanana') return false;
      if (selectedSource === 'marmota' && comic.source !== 'marmota') return false;
      if (selectedSource === 'featured' && comic.source !== 'archive') return false;

      if (selectedTab === 'custom' && comic.source !== 'local') return false;
      if (selectedTab === 'favorites' && !favorites.has(comic.id)) return false;

      if (selectedPublisher !== 'ALL' && comic.publisher !== selectedPublisher) return false;

      if (selectedHero !== 'ALL' && !comic.hero.toLowerCase().includes(selectedHero.toLowerCase())) return false;

      if (useLocalTextFilter) {
        const haystack = `${comic.title} ${comic.hero} ${comic.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allComics, selectedSource, selectedTab, selectedPublisher, selectedHero, searchQuery, searchResults, favorites]);

  const totalDC = megaBanana.dc.length + marmota.dc.length;
  const totalMarvel = megaBanana.marvel.length + marmota.marvel.length;
  const totalMega = megaBanana.dc.length + megaBanana.marvel.length;
  const totalMarmota = marmota.dc.length + marmota.marvel.length;

  const activeSession = lastReadSession || getLastReadComic();
  const recentComic = activeSession?.comic ?? null;
  const recentPage = activeSession?.page ?? 1;
  const recentTotalPages = Math.max(recentComic?.totalPages || 1, 1);
  const recentPercent = Math.min(100, Math.round((recentPage / recentTotalPages) * 100));

  const hasAnyFeed = totalDC + totalMarvel > 0;
  const feedErrorList = Object.entries(feedErrors).filter(([, msg]) => Boolean(msg));

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#111111] text-[#ededed]">
      <a
        href="#catalogo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-amber-600 focus:text-white focus:font-semibold"
      >
        Saltar al catálogo
      </a>

      <header className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-600/20 flex-shrink-0">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white font-serif" translate="no">
                  Kindle<span className="text-amber-500">Comics</span>
                </h1>
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                  Español
                </span>

                <div className="hidden lg:flex items-center gap-1.5 text-[10px]">
                  <a
                    href="https://megabanana.mx/megabanana-home/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="MegaBanana, se abre en una pestaña nueva"
                    className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium px-2 py-0.5 rounded-full border border-amber-500/30 transition-colors"
                  >
                    <span translate="no">MegaBanana</span>
                    <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                  </a>
                  <a
                    href="https://marmota.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Marmota, se abre en una pestaña nueva"
                    className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-2 py-0.5 rounded-full border border-zinc-700 transition-colors"
                  >
                    <span translate="no">Marmota</span>
                    <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Cómics de DC y Marvel en español, con lector de tinta electrónica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={loadAllFeeds}
              disabled={isLoadingFeeds}
              aria-label="Recargar el catálogo de cómics"
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFeeds ? 'animate-spin text-amber-500' : ''}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs sm:text-sm font-semibold shadow-md shadow-amber-600/20 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Importar cómic</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-8">
        {/* El puente API no está configurado: sin esto la biblioteca saldría
            vacía y en silencio, culpando a los filtros de un fallo de despliegue. */}
        {IS_API_MISCONFIGURED && (
          <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-amber-950/40 border border-amber-700/60 text-amber-100">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <div className="text-sm min-w-0">
              <p className="font-semibold">El puente de datos no está configurado</p>
              <p className="text-xs mt-1 text-amber-200/80">
                Esta copia se compiló sin <code className="font-mono">VITE_API_BASE</code>, así que no puede consultar
                MegaBanana ni Marmota. Despliega el Worker de <code className="font-mono">worker/</code> y vuelve a
                compilar con esa variable. Mientras tanto siguen funcionando los cómics importados y Archive.org.
              </p>
            </div>
          </div>
        )}

        {/* Fuentes caídas: antes el fallo se tragaba en la consola y el usuario
            solo veía un catálogo vacío. */}
        {!isLoadingFeeds && feedErrorList.length > 0 && (
          <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-100">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
            <div className="text-sm flex-1 min-w-0">
              <p className="font-semibold">
                {feedErrorList.length === 2 ? 'Ninguna fuente respondió' : 'Una de las fuentes no respondió'}
              </p>
              <ul className="text-xs mt-1 text-red-200/80 list-disc pl-4 space-y-0.5">
                {feedErrorList.map(([source, msg]) => (
                  <li key={source} className="break-words">
                    <span className="font-semibold capitalize">{source}:</span> {msg}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={loadAllFeeds}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-900 text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* ============ CONTINUAR LEYENDO ============ */}
        {recentComic && !recentComic.needsReimport && (
          <section
            aria-labelledby="continue-title"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-6"
          >
            <div className="relative w-28 sm:w-36 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border border-zinc-700">
              {recentComic.coverUrl ? (
                <img
                  src={recentComic.coverUrl}
                  alt=""
                  width={288}
                  height={432}
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-zinc-600" aria-hidden="true" />
                </div>
              )}
              <span
                className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded text-white ${
                  recentComic.publisher === 'DC' ? 'bg-blue-600' : 'bg-red-600'
                }`}
              >
                {recentComic.publisher}
              </span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-amber-500 text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Continuar donde lo dejaste</span>
              </div>

              <h2 id="continue-title" className="text-lg sm:text-2xl font-bold text-white mb-1.5 line-clamp-1 break-words">
                {recentComic.title}
              </h2>

              <p className="text-xs text-zinc-400 max-w-2xl line-clamp-2 mb-4 break-words">{recentComic.description}</p>

              <div className="max-w-md w-full mb-4 mx-auto sm:mx-0">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1 nums">
                  <span>
                    Página {recentPage} de {recentTotalPages}
                  </span>
                  <span className="text-amber-500 font-bold">{recentPercent}%</span>
                </div>
                <div
                  className="h-2 bg-zinc-800 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={recentPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso de ${recentComic.title}`}
                >
                  <div className="h-full bg-amber-500 rounded-full transition-[width] duration-300" style={{ width: `${recentPercent}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => onOpenReader(recentComic, recentPage)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-colors"
                >
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span>Reanudar en la página {recentPage}</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ============ BÚSQUEDA ============ */}
        <section aria-label="Buscar cómics" className="flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <label htmlFor="comic-search" className="sr-only">
                Buscar cómics en MegaBanana, Marmota y Archive.org
              </label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" aria-hidden="true" />
              <input
                id="comic-search"
                type="search"
                name="q"
                autoComplete="off"
                spellCheck={false}
                placeholder="Batman, Spider-Man, Hulk, X-Men…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setSearchError(null);
                  }}
                  aria-label="Borrar la búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-200 rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearchingOnline || !searchQuery.trim()}
              className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {isSearchingOnline ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" aria-hidden="true" />
              ) : (
                <Globe className="w-4 h-4 text-amber-500" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isSearchingOnline ? 'Buscando…' : 'Buscar en la web'}</span>
            </button>
          </form>

          {searchError && (
            <p role="alert" className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">
              {searchError}
            </p>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs" role="group" aria-label="Filtrar por héroe">
            <span className="text-zinc-500 font-semibold mr-1 flex items-center gap-1 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Héroes:
            </span>
            {HEROES.map(hero => (
              <button
                key={hero}
                type="button"
                onClick={() => handleHeroClick(hero)}
                aria-pressed={selectedHero === hero}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                  selectedHero === hero
                    ? 'bg-amber-600 text-white font-bold shadow'
                    : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                {hero}
              </button>
            ))}
          </div>
        </section>

        {/* ============ FILTROS ============ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar el catálogo">
            <button
              type="button"
              onClick={() => setSelectedPublisher('ALL')}
              aria-pressed={selectedPublisher === 'ALL'}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap nums ${
                selectedPublisher === 'ALL' ? 'bg-zinc-200 text-zinc-900 shadow' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              Todos ({allComics.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedPublisher('DC')}
              aria-pressed={selectedPublisher === 'DC'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap nums ${
                selectedPublisher === 'DC' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-zinc-900 text-blue-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
              DC ({totalDC})
            </button>

            <button
              type="button"
              onClick={() => setSelectedPublisher('Marvel')}
              aria-pressed={selectedPublisher === 'Marvel'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap nums ${
                selectedPublisher === 'Marvel' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-zinc-900 text-red-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
              Marvel ({totalMarvel})
            </button>

            <div className="h-4 w-px bg-zinc-800 mx-1 flex-shrink-0" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setSelectedSource(selectedSource === 'megabanana' ? 'all' : 'megabanana')}
              aria-pressed={selectedSource === 'megabanana'}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap nums ${
                selectedSource === 'megabanana' ? 'bg-amber-500 text-black shadow' : 'bg-zinc-900 text-amber-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span translate="no">MegaBanana</span> ({totalMega})
            </button>

            <button
              type="button"
              onClick={() => setSelectedSource(selectedSource === 'marmota' ? 'all' : 'marmota')}
              aria-pressed={selectedSource === 'marmota'}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap nums ${
                selectedSource === 'marmota' ? 'bg-zinc-200 text-zinc-900 shadow' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span translate="no">Marmota</span> ({totalMarmota})
            </button>

            <div className="h-4 w-px bg-zinc-800 mx-1 flex-shrink-0" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setSelectedTab(selectedTab === 'favorites' ? 'all' : 'favorites')}
              aria-pressed={selectedTab === 'favorites'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap nums ${
                selectedTab === 'favorites' ? 'bg-amber-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              Favoritos ({favorites.size})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTab(selectedTab === 'custom' ? 'all' : 'custom')}
              aria-pressed={selectedTab === 'custom'}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap nums ${
                selectedTab === 'custom' ? 'bg-amber-600 text-white font-bold' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              Importados ({customComics.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-zinc-500 nums" aria-live="polite">
              {filteredComics.length} {filteredComics.length === 1 ? 'cómic' : 'cómics'}
            </span>

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5" role="group" aria-label="Forma de ver el catálogo">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Ver en cuadrícula"
                aria-pressed={viewMode === 'grid'}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="Ver en lista"
                aria-pressed={viewMode === 'list'}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <List className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* ============ CATÁLOGO ============ */}
        <section id="catalogo" aria-label="Catálogo de cómics" style={{ scrollMarginTop: '5rem' }}>
          {isLoadingFeeds && !hasAnyFeed ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-3" aria-live="polite">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" aria-hidden="true" />
              <p className="text-sm font-medium text-zinc-300">Consultando MegaBanana y Marmota…</p>
              <p className="text-xs text-zinc-500">Preparando la biblioteca</p>
            </div>
          ) : filteredComics.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center p-6 bg-zinc-900/30 rounded-3xl border border-zinc-800/50">
              <BookOpen className="w-12 h-12 text-zinc-600 mb-3" aria-hidden="true" />
              <h3 className="text-base font-semibold text-zinc-300 mb-1">
                {feedErrorList.length > 0 && !hasAnyFeed
                  ? 'No se pudo cargar el catálogo'
                  : 'No hay cómics con estos filtros'}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mb-4">
                {feedErrorList.length > 0 && !hasAnyFeed
                  ? 'El problema está en las fuentes, no en tu búsqueda. Reintenta la carga o importa un CBZ para leer sin conexión.'
                  : 'Prueba con otro héroe o quita algún filtro para ver todo el catálogo.'}
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-xl transition-colors"
                >
                  Quitar los filtros
                </button>
                {feedErrorList.length > 0 && (
                  <button
                    type="button"
                    onClick={loadAllFeeds}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white rounded-xl transition-colors"
                  >
                    Reintentar la carga
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {filteredComics.map(comic => (
                <ComicCard
                  key={comic.id}
                  comic={comic}
                  progressPage={readingProgressMap[comic.id]?.page}
                  isFavorite={favorites.has(comic.id)}
                  viewMode="grid"
                  onRead={handleComicClick}
                  onToggleFavorite={handleToggleFav}
                  onRemove={onRemoveCustomComic}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredComics.map(comic => (
                <ComicCard
                  key={comic.id}
                  comic={comic}
                  progressPage={readingProgressMap[comic.id]?.page}
                  isFavorite={favorites.has(comic.id)}
                  viewMode="list"
                  onRead={handleComicClick}
                  onToggleFavorite={handleToggleFav}
                  onRemove={onRemoveCustomComic}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-800/80 bg-zinc-950 mt-16 py-8 px-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-zinc-300" translate="no">
              KindleComics
            </span>
            <span>— Cómics de DC y Marvel en español</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
            <span>
              Fuentes:{' '}
              <a
                href="https://megabanana.mx/megabanana-home/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="megabanana.mx, se abre en una pestaña nueva"
                className="text-amber-400 hover:underline"
              >
                megabanana.mx
              </a>{' '}
              y{' '}
              <a
                href="https://marmota.me/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="marmota.me, se abre en una pestaña nueva"
                className="text-zinc-400 hover:underline"
              >
                marmota.me
              </a>
            </span>
            <span aria-hidden="true">•</span>
            <span>Proyecto de aficionado, sin publicidad</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
