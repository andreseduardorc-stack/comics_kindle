import React from 'react';
import { BookOpen, Star, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import type { Comic } from '../types/comic';

interface ComicCardProps {
  comic: Comic;
  progressPage?: number;
  isFavorite?: boolean;
  viewMode?: 'grid' | 'list';
  onRead: (comic: Comic) => void;
  onToggleFavorite: (comicId: string) => void;
  onRemove?: (comic: Comic) => void;
}

/** Portada de reserva cuando un cómic local perdió sus páginas guardadas. */
const MISSING_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#1c1c1c"/><text x="100" y="155" font-family="sans-serif" font-size="14" fill="#6b6b6b" text-anchor="middle">Sin portada</text></svg>'
  );

export const ComicCard: React.FC<ComicCardProps> = ({
  comic,
  progressPage = 0,
  isFavorite = false,
  viewMode = 'grid',
  onRead,
  onToggleFavorite,
  onRemove
}) => {
  const percent =
    comic.totalPages && progressPage > 0
      ? Math.min(100, Math.round((progressPage / comic.totalPages) * 100))
      : 0;

  const needsReimport = comic.needsReimport === true;
  const coverUrl = comic.coverUrl || MISSING_COVER;

  const favoriteLabel = isFavorite
    ? `Quitar ${comic.title} de favoritos`
    : `Añadir ${comic.title} a favoritos`;

  const readLabel = needsReimport
    ? `${comic.title}: vuelve a importar el archivo`
    : percent > 0
      ? `Continuar leyendo ${comic.title}, página ${progressPage} de ${comic.totalPages}`
      : `Leer ${comic.title}`;

  /* ---------------------------------------------------------------- *
   * Vista lista
   * ---------------------------------------------------------------- */
  if (viewMode === 'list') {
    return (
      <div className="card-cv-list group flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 rounded-xl transition-colors hover:border-zinc-700">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative w-14 h-20 flex-shrink-0 overflow-hidden rounded-md bg-zinc-950 shadow-md">
            <img
              src={coverUrl}
              alt=""
              width={140}
              height={200}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <span
              className={`absolute top-1 left-1 text-[9px] font-black px-1 py-0.5 rounded ${
                comic.publisher === 'DC' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {comic.publisher}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {comic.hero}
              </span>
              <span className="text-[11px] text-zinc-400 nums">{comic.year || 'Edición clásica'}</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {comic.language}
              </span>
              {needsReimport && (
                <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  Vuelve a importarlo
                </span>
              )}
            </div>

            <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-amber-400 transition-colors">
              {comic.title}
            </h3>

            <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5 break-words">{comic.description}</p>

            {percent > 0 && (
              <div className="flex items-center gap-2 mt-2 max-w-xs">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[11px] text-zinc-400 nums">
                  {percent}% (pág. {progressPage}/{comic.totalPages})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {onRemove && comic.source === 'local' && (
            <button
              type="button"
              onClick={() => onRemove(comic)}
              aria-label={`Eliminar ${comic.title} de la biblioteca`}
              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(comic.id)}
            aria-label={favoriteLabel}
            aria-pressed={isFavorite}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onRead(comic)}
            aria-label={readLabel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{needsReimport ? 'Reimportar' : percent > 0 ? 'Continuar' : 'Leer'}</span>
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- *
   * Vista cuadrícula (estantería)
   * ---------------------------------------------------------------- */
  return (
    <div className="card-cv group relative flex flex-col bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-3 transition-colors duration-200 focus-within:border-amber-500/60">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-950 shadow-lg">
        {/* Un botón de verdad sobre la portada: antes era un <div onClick>, así
            que con el teclado la tarjeta entera era inalcanzable. */}
        <button
          type="button"
          onClick={() => onRead(comic)}
          aria-label={readLabel}
          className="absolute inset-0 z-10 w-full h-full cursor-pointer rounded-xl"
        >
          <span className="sr-only">{readLabel}</span>
        </button>

        <img
          src={coverUrl}
          alt=""
          width={400}
          height={600}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

        <div className="absolute top-2 left-2 flex items-center gap-1 pointer-events-none">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white shadow-md ${
              comic.publisher === 'DC'
                ? 'bg-blue-600'
                : comic.publisher === 'Marvel'
                  ? 'bg-red-600'
                  : 'bg-zinc-700'
            }`}
          >
            {comic.publisher}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm ${
              comic.source === 'megabanana'
                ? 'bg-amber-500/80 text-black font-extrabold'
                : 'bg-black/70 text-emerald-400'
            }`}
          >
            {comic.source === 'megabanana' ? 'MegaBanana' : 'ESP'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorite(comic.id)}
          aria-label={favoriteLabel}
          aria-pressed={isFavorite}
          className={`absolute top-2 right-2 z-20 p-1.5 rounded-full backdrop-blur-md transition-colors ${
            isFavorite ? 'bg-amber-500 text-white' : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} aria-hidden="true" />
        </button>

        {needsReimport && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-1 bg-amber-950/90 px-2 py-1 text-[10px] font-semibold text-amber-200 pointer-events-none">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Vuelve a importar el archivo</span>
          </div>
        )}

        <div
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] pointer-events-none"
          aria-hidden="true"
        >
          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-lg">
            <BookOpen className="w-4 h-4" />
            {needsReimport ? 'Reimportar' : percent > 0 ? 'Continuar leyendo' : 'Abrir en el lector'}
          </span>
        </div>

        {percent > 0 && !needsReimport && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60 pointer-events-none">
            <div className="h-full bg-amber-500" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 mt-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1 gap-2">
          <span className="font-medium text-amber-500 truncate min-w-0">{comic.hero}</span>
          <span className="nums text-[10px] opacity-75 flex-shrink-0">{comic.year || '—'}</span>
        </div>

        <h3
          className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors break-words"
          title={comic.title}
        >
          {comic.title}
        </h3>

        <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-zinc-400 gap-2">
          <span className="flex items-center gap-1 nums text-[10px]">
            <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
            {comic.totalPages} págs
          </span>
          {percent > 0 ? (
            <span className="text-amber-500 font-semibold text-[10px] nums">{percent}% leído</span>
          ) : (
            <span className="text-zinc-500 text-[10px]">Sin empezar</span>
          )}
        </div>
      </div>
    </div>
  );
};
