import React from 'react';
import { BookOpen, Bookmark, Star, Clock } from 'lucide-react';
import { Comic } from '../types/comic';

interface ComicCardProps {
  comic: Comic;
  progressPage?: number;
  isFavorite?: boolean;
  viewMode?: 'grid' | 'list';
  onRead: (comic: Comic) => void;
  onToggleFavorite: (comicId: string) => void;
}

export const ComicCard: React.FC<ComicCardProps> = ({
  comic,
  progressPage = 0,
  isFavorite = false,
  viewMode = 'grid',
  onRead,
  onToggleFavorite,
}) => {
  const percent = comic.totalPages && progressPage > 0 
    ? Math.min(100, Math.round((progressPage / comic.totalPages) * 100))
    : 0;

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 rounded-xl transition-all hover:border-zinc-700">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative w-14 h-20 flex-shrink-0 overflow-hidden rounded-md bg-zinc-950 shadow-md">
            <img
              src={comic.coverUrl}
              alt={comic.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <span className={`absolute top-1 left-1 text-[9px] font-black px-1 py-0.5 rounded ${
              comic.publisher === 'DC' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {comic.publisher}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {comic.hero}
              </span>
              <span className="text-[11px] text-zinc-400">
                {comic.year || 'Edición Clásica'}
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                🇪🇸 {comic.language}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-amber-400 transition-colors">
              {comic.title}
            </h3>

            <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
              {comic.description}
            </p>

            {percent > 0 && (
              <div className="flex items-center gap-2 mt-2 max-w-xs">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {percent}% (Pág. {progressPage}/{comic.totalPages})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onToggleFavorite(comic.id)}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Favorito"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => onRead(comic)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{percent > 0 ? 'Continuar' : 'Leer'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Grid view (Kindle Bookshelf card)
  return (
    <div className="group relative flex flex-col bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl">
      {/* Cover Image Container */}
      <div 
        className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-950 cursor-pointer shadow-lg"
        onClick={() => onRead(comic)}
      >
        <img
          src={comic.coverUrl}
          alt={comic.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Kindle Spine Effect gradient */}
        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        {/* Publisher Pill Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white shadow-md ${
            comic.publisher === 'DC' ? 'bg-blue-600' : comic.publisher === 'Marvel' ? 'bg-red-600' : 'bg-zinc-700'
          }`}>
            {comic.publisher}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm ${
            comic.source === 'megabanana' 
              ? 'bg-amber-500/80 text-black font-extrabold' 
              : 'bg-black/70 text-emerald-400'
          }`}>
            {comic.source === 'megabanana' ? '🍌 MegaBanana' : '🇪🇸 ESP'}
          </span>
        </div>

        {/* Favorite Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(comic.id);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-colors ${
            isFavorite ? 'bg-amber-500 text-white' : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90'
          }`}
          title="Guardar en Favoritos"
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} />
        </button>

        {/* Hover Read Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <BookOpen className="w-4 h-4" />
            {percent > 0 ? 'Continuar leyendo' : 'Abrir en Kindle'}
          </span>
        </div>

        {/* Progress Bar on cover bottom */}
        {percent > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      {/* Comic Metadata */}
      <div className="flex flex-col flex-1 mt-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
          <span className="font-medium text-amber-500 truncate max-w-[120px]">
            {comic.hero}
          </span>
          <span className="font-mono text-[10px] opacity-75">
            {comic.year}
          </span>
        </div>

        <h3 
          className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors cursor-pointer"
          onClick={() => onRead(comic)}
          title={comic.title}
        >
          {comic.title}
        </h3>

        {/* Bottom Reading Stats */}
        <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <Clock className="w-3 h-3 text-zinc-500" />
            {comic.totalPages} págs
          </span>
          {percent > 0 ? (
            <span className="text-amber-500 font-semibold text-[10px]">
              {percent}% leído
            </span>
          ) : (
            <span className="text-zinc-500 text-[10px]">Sin empezar</span>
          )}
        </div>
      </div>
    </div>
  );
};
