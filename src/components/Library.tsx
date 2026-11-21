import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink
} from 'lucide-react';
import type { Comic } from '../types/comic';
import { FEATURED_COMICS } from '../data/featuredComics';
import { ComicCard } from './ComicCard';
import { fetchMarmotaFeed, searchMarmota } from '../services/marmotaService';
import { fetchMegaBananaFeed, searchMegaBanana } from '../services/megabananaService';
import { searchComicsOnline } from '../services/archiveService';
import { getAllSavedProgress, isFavoriteComic, toggleFavorite, getLastReadComic } from '../services/localComicService';
import type { LastReadSession } from '../services/localComicService';

interface LibraryProps {
  onOpenReader: (comic: Comic, page?: number) => void;
  onOpenImportModal: () => void;
  onSelectSeriesComic: (comic: Comic) => void;
  customComics: Comic[];
  lastReadSession?: LastReadSession | null;
}

export const Library: React.FC<LibraryProps> = ({
  onOpenReader,
  onOpenImportModal,
  onSelectSeriesComic,
  customComics,
  lastReadSession
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPublisher, setSelectedPublisher] = useState<'ALL' | 'DC' | 'Marvel'>('ALL');
  const [selectedHero, setSelectedHero] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<'all' | 'megabanana' | 'marmota' | 'featured'>('all');
  const [selectedTab, setSelectedTab] = useState<'all' | 'favorites' | 'custom'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Provider Feeds
  const [marmotaDC, setMarmotaDC] = useState<Comic[]>([]);
  const [marmotaMarvel, setMarmotaMarvel] = useState<Comic[]>([]);
  const [megaBananaDC, setMegaBananaDC] = useState<Comic[]>([]);
  const [megaBananaMarvel, setMegaBananaMarvel] = useState<Comic[]>([]);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState<boolean>(true);

  // Search states
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Comic[]>([]);
  
  // Local storage reading progress and favorites
  const [readingProgressMap, setReadingProgressMap] = useState<Record<string, { page: number; timestamp: number }>>({});
  const [, setFavoritesVersion] = useState<number>(0);

  // Load feeds on mount
  const loadAllFeeds = async () => {
    setIsLoadingFeeds(true);
    try {
      const [marmotaRes, megaBananaRes] = await Promise.allSettled([
        fetchMarmotaFeed(),
        fetchMegaBananaFeed()
      ]);

      if (marmotaRes.status === 'fulfilled') {
        setMarmotaDC(marmotaRes.value.dc);
        setMarmotaMarvel(marmotaRes.value.marvel);
      }

      if (megaBananaRes.status === 'fulfilled') {
        setMegaBananaDC(megaBananaRes.value.dc);
        setMegaBananaMarvel(megaBananaRes.value.marvel);
      }
    } catch (err) {
      console.error('Error loading comic feeds:', err);
    } finally {
      setIsLoadingFeeds(false);
    }
  };

  useEffect(() => {
    setReadingProgressMap(getAllSavedProgress());
    loadAllFeeds();
  }, []);

  // Combine comics from all sources (MegaBanana + Marmota + Featured)
  const allComics = useMemo(() => {
    if (searchResults.length > 0) {
      return searchResults;
    }

    // Interleave MegaBanana & Marmota comics so the user gets rich variety
    const combinedDC = [...megaBananaDC, ...marmotaDC];
    const combinedMarvel = [...megaBananaMarvel, ...marmotaMarvel];

    return [...customComics, ...combinedDC, ...combinedMarvel, ...FEATURED_COMICS];
  }, [customComics, megaBananaDC, megaBananaMarvel, marmotaDC, marmotaMarvel, searchResults]);

  // Find most recent comic for "Continuar Leyendo" Kindle Hero section
  const activeSession = lastReadSession || getLastReadComic();
  const recentComic: Comic | null = activeSession?.comic || null;
  const recentPage: number = activeSession?.page || 1;
  const recentTotalPages: number = Math.max(recentComic?.totalPages || 1, 1);
  const recentPercent: number = Math.min(100, Math.round((recentPage / recentTotalPages) * 100));

  // Handle live search across all connected sources
  const handlePerformSearch = async (queryText: string) => {
    if (!queryText.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearchingOnline(true);
    try {
      const [megaBananaMatches, marmotaMatches, archiveMatches] = await Promise.allSettled([
        searchMegaBanana(queryText, selectedPublisher),
        searchMarmota(queryText, selectedPublisher),
        searchComicsOnline(queryText, selectedPublisher === 'ALL' ? 'Other' : selectedPublisher)
      ]);

      const list1 = megaBananaMatches.status === 'fulfilled' ? megaBananaMatches.value : [];
      const list2 = marmotaMatches.status === 'fulfilled' ? marmotaMatches.value : [];
      const list3 = archiveMatches.status === 'fulfilled' ? archiveMatches.value : [];

      // Interleave results
      const combined = [...list1, ...list2, ...list3];
      // Deduplicate by title/id
      const seen = new Set<string>();
      const deduplicated = combined.filter(c => {
        const key = c.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSearchResults(deduplicated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePerformSearch(searchQuery);
  };

  const handleHeroClick = (hero: string) => {
    if (selectedHero === hero) {
      setSelectedHero('ALL');
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setSelectedHero(hero);
      setSearchQuery(hero);
      handlePerformSearch(hero);
    }
  };

  const handleToggleFav = (comicId: string) => {
    toggleFavorite(comicId);
    setFavoritesVersion(v => v + 1);
  };

  const handleComicClick = (comic: Comic) => {
    if (comic.embedUrl) {
      onOpenReader(comic, 1);
    } else if (comic.source === 'megabanana' || comic.source === 'marmota') {
      onSelectSeriesComic(comic);
    } else {
      onOpenReader(comic, readingProgressMap[comic.id]?.page || 1);
    }
  };

  // Filtered list
  const filteredComics = useMemo(() => {
    return allComics.filter(comic => {
      // Source filter
      if (selectedSource === 'megabanana' && comic.source !== 'megabanana') return false;
      if (selectedSource === 'marmota' && comic.source !== 'marmota') return false;
      if (selectedSource === 'featured' && comic.source !== 'archive') return false;

      // Tab filter
      if (selectedTab === 'custom' && comic.source !== 'local') return false;
      if (selectedTab === 'favorites' && !isFavoriteComic(comic.id)) return false;

      // Publisher filter
      if (selectedPublisher !== 'ALL' && comic.publisher !== selectedPublisher) {
        return false;
      }

      // Hero filter
      if (selectedHero !== 'ALL' && !comic.hero.toLowerCase().includes(selectedHero.toLowerCase())) {
        return false;
      }

      // Search Query filter (local fuzzy if search results empty)
      if (searchQuery.trim() && searchResults.length === 0) {
        const q = searchQuery.toLowerCase();
        const matchTitle = comic.title.toLowerCase().includes(q);
        const matchHero = comic.hero.toLowerCase().includes(q);
        const matchDesc = comic.description.toLowerCase().includes(q);
        if (!matchTitle && !matchHero && !matchDesc) return false;
      }

      return true;
    });
  }, [allComics, selectedSource, selectedTab, selectedPublisher, selectedHero, searchQuery, searchResults]);

  const heroesList = [
    'Batman', 'Spider-Man', 'Superman', 'X-Men', 'Deadpool', 
    'Avengers', 'Iron Man', 'Daredevil', 'Wolverine', 'Hulk'
  ];

  const totalDC = megaBananaDC.length + marmotaDC.length;
  const totalMarvel = megaBananaMarvel.length + marmotaMarvel.length;

  return (
    <div className="min-h-screen bg-[#111111] text-[#ededed]">
      {/* ================= TOP KINDLE HEADER ================= */}
      <header className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white font-serif">
                  Kindle<span className="text-amber-500">Comics</span>
                </h1>
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                  Español
                </span>
                
                {/* Active Bases Pills */}
                <div className="hidden lg:flex items-center gap-1.5 text-[10px]">
                  <a
                    href="https://megabanana.mx/megabanana-home/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium px-2 py-0.5 rounded-full border border-amber-500/30 transition-colors"
                  >
                    <span>🍌 MegaBanana (1,400+)</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <a
                    href="https://marmota.me/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-2 py-0.5 rounded-full border border-zinc-700 transition-colors"
                  >
                    <span>Marmota.me</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Recopilación de cómics de DC y Marvel en español desde MegaBanana y Marmota con lector Kindle
              </p>
            </div>
          </div>

          {/* Action Buttons: Refresh & Import */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={loadAllFeeds}
              disabled={isLoadingFeeds}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Recargar catálogo de cómics"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFeeds ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs sm:text-sm font-semibold shadow-md shadow-amber-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Importar Cómic (CBZ/URL)</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-8">
        {/* ================= KINDLE "CONTINUAR LEYENDO" HERO BANNER ================= */}
        {recentComic && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-28 sm:w-36 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border border-zinc-700">
              <img
                src={recentComic.coverUrl}
                alt={recentComic.title}
                className="w-full h-full object-cover"
              />
              <span className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded text-white ${
                recentComic.publisher === 'DC' ? 'bg-blue-600' : 'bg-red-600'
              }`}>
                {recentComic.publisher}
              </span>
              <span className="absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/80 text-amber-400">
                {recentComic.source === 'megabanana' ? '🍌 MegaBanana' : recentComic.source === 'marmota' ? 'Marmota' : 'Clásico'}
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-amber-500 text-xs font-semibold mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Continuar leyendo donde lo dejaste</span>
              </div>

              <h2 className="text-lg sm:text-2xl font-bold text-white mb-1.5 line-clamp-1">
                {recentComic.title}
              </h2>

              <p className="text-xs text-zinc-400 max-w-2xl line-clamp-2 mb-4">
                {recentComic.description}
              </p>

              {/* Progress bar */}
              <div className="max-w-md w-full mb-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Página {recentPage} de {recentTotalPages}</span>
                  <span className="text-amber-500 font-bold">
                    {recentPercent}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${recentPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3">
                <button
                  onClick={() => onOpenReader(recentComic, recentPage)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Reanudar en Lector Kindle</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SEARCH & DISCOVERY BAR ================= */}
        <div className="flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          {/* Main Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar cómics en MegaBanana y Marmota (Batman, Spider-Man, Hulk, X-Men, Avengers...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300 px-1"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearchingOnline}
              className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSearchingOnline ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <Globe className="w-4 h-4 text-amber-500" />
              )}
              <span className="hidden sm:inline">Buscar en la Web</span>
            </button>
          </form>

          {/* Quick Hero Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <span className="text-zinc-500 font-semibold mr-1 flex items-center gap-1 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Héroes:
            </span>
            {heroesList.map((hero) => (
              <button
                key={hero}
                onClick={() => handleHeroClick(hero)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                  selectedHero === hero
                    ? 'bg-amber-600 text-white font-bold shadow'
                    : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                {hero}
              </button>
            ))}
          </div>
        </div>

        {/* ================= FILTER TABS & VIEW TOGGLE ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          {/* Tabs: Publishers + Sources */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Publisher Filter */}
            <button
              onClick={() => setSelectedPublisher('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedPublisher === 'ALL'
                  ? 'bg-zinc-200 text-zinc-900 shadow'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              Todos ({allComics.length})
            </button>

            <button
              onClick={() => setSelectedPublisher('DC')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedPublisher === 'DC'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-zinc-900 text-blue-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              DC Comics ({totalDC})
            </button>

            <button
              onClick={() => setSelectedPublisher('Marvel')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedPublisher === 'Marvel'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-zinc-900 text-red-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Marvel Comics ({totalMarvel})
            </button>

            <div className="h-4 w-px bg-zinc-800 mx-1" />

            {/* Source Specific Filter */}
            <button
              onClick={() => setSelectedSource(selectedSource === 'megabanana' ? 'all' : 'megabanana')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedSource === 'megabanana'
                  ? 'bg-amber-500 text-black shadow'
                  : 'bg-zinc-900 text-amber-400 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              🍌 MegaBanana ({megaBananaDC.length + megaBananaMarvel.length})
            </button>

            <button
              onClick={() => setSelectedSource(selectedSource === 'marmota' ? 'all' : 'marmota')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedSource === 'marmota'
                  ? 'bg-zinc-200 text-zinc-900 shadow'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              Marmota ({marmotaDC.length + marmotaMarvel.length})
            </button>

            <div className="h-4 w-px bg-zinc-800 mx-1" />

            <button
              onClick={() => setSelectedTab(selectedTab === 'favorites' ? 'all' : 'favorites')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedTab === 'favorites'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              Favoritos
            </button>
          </div>

          {/* Right: View Mode (Grid vs List) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">
              {filteredComics.length} cómics en español
            </span>

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Vista Estantería / Cuadrícula"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Vista Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= COMICS LIST / GRID ================= */}
        {isLoadingFeeds && allComics.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-sm font-medium text-zinc-300">Conectando con MegaBanana y Marmota para recopilar cómics...</p>
            <p className="text-xs text-zinc-500">Preparando la biblioteca para el lector estilo Kindle...</p>
          </div>
        ) : filteredComics.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6 bg-zinc-900/30 rounded-3xl border border-zinc-800/50">
            <BookOpen className="w-12 h-12 text-zinc-600 mb-3" />
            <h3 className="text-base font-semibold text-zinc-300 mb-1">
              No se encontraron cómics con esos criterios
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              Prueba buscar otro héroe o restablecer los filtros para ver todas las colecciones.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedPublisher('ALL');
                setSelectedHero('ALL');
                setSelectedSource('all');
                setSelectedTab('all');
                setSearchResults([]);
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-xl transition-colors"
            >
              Restablecer filtros
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredComics.map((comic) => (
              <ComicCard
                key={comic.id}
                comic={comic}
                progressPage={readingProgressMap[comic.id]?.page}
                isFavorite={isFavoriteComic(comic.id)}
                viewMode="grid"
                onRead={handleComicClick}
                onToggleFavorite={handleToggleFav}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredComics.map((comic) => (
              <ComicCard
                key={comic.id}
                comic={comic}
                progressPage={readingProgressMap[comic.id]?.page}
                isFavorite={isFavoriteComic(comic.id)}
                viewMode="list"
                onRead={handleComicClick}
                onToggleFavorite={handleToggleFav}
              />
            ))}
          </div>
        )}
      </main>

      {/* ================= KINDLE FOOTER ================= */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 mt-16 py-8 px-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-zinc-300">KindleComics</span>
            <span>— Cómics DC y Marvel en Español</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Fuentes: <a href="https://megabanana.mx/megabanana-home/" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">megabanana.mx</a> & <a href="https://marmota.me/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:underline">marmota.me</a></span>
            <span>•</span>
            <span>Máscara: Lector Kindle (Sin anuncios)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
