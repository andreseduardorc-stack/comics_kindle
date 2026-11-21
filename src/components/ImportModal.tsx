import React, { useRef, useState } from 'react';
import { Upload, Link2, X, AlertCircle, FileArchive, Loader2, Sparkles } from 'lucide-react';
import type { Comic } from '../types/comic';
import { processCbzFile, saveCustomComicMeta } from '../services/localComicService';
import { fetchComicDetails, detectPublisherAndHero } from '../services/archiveService';
import { resolveMegaBananaComic } from '../services/megabananaService';
import { ApiError } from '../services/apiError';
import { Dialog } from './Dialog';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComicLoaded: (comic: Comic) => void;
}

const ACCEPTED = ['.cbz', '.zip'];

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onComicLoaded }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const urlInputRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!ACCEPTED.some(ext => name.endsWith(ext))) {
      setErrorMessage('Ese archivo no es un CBZ ni un ZIP. Elige uno con imágenes dentro.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Descomprimiendo el cómic…');

    try {
      const comic = await processCbzFile(file, (done, total) => {
        setProgressStatus(`Preparando página ${done} de ${total}…`);
      });
      saveCustomComicMeta(comic);
      setIsProcessing(false);
      onComicLoaded(comic);
      onClose();
    } catch (err) {
      setIsProcessing(false);
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo leer el archivo CBZ/ZIP. Comprueba que no esté dañado.'
      );
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importFile(file);
    e.target.value = '';
  };

  // El texto prometía «arrastra o selecciona» pero solo funcionaba el clic.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importFile(file);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Buscando el cómic…');

    try {
      let identifier = urlInput.trim();

      if (identifier.includes('megabanana.mx')) {
        setProgressStatus('Resolviendo el enlace de MegaBanana…');
        const mbComic = await resolveMegaBananaComic(identifier);
        if (mbComic) {
          saveCustomComicMeta(mbComic);
          setIsProcessing(false);
          onComicLoaded(mbComic);
          onClose();
          return;
        }
        throw new Error('MegaBanana no reconoce ese enlace. Comprueba que esté completo.');
      }

      if (identifier.includes('archive.org/details/')) {
        identifier = identifier.split('archive.org/details/')[1].split('/')[0].split('?')[0];
      }

      setProgressStatus('Obteniendo los datos del cómic en Archive.org…');
      const details = await fetchComicDetails(identifier);
      const { publisher, hero } = detectPublisherAndHero(identifier);

      const comic: Comic = {
        id: identifier,
        identifier,
        title: identifier.replace(/[-_]/g, ' '),
        publisher,
        hero,
        year: 'Digital',
        language: 'Español',
        coverUrl: `https://archive.org/services/img/${identifier}`,
        description: `Cómic importado desde Archive.org (${identifier}).`,
        source: 'archive',
        totalPages: details.totalPages,
        pages: details.pageUrls,
        pdfUrl: details.pdfUrl,
        cbzUrl: details.cbzUrl
      };

      saveCustomComicMeta(comic);
      setIsProcessing(false);
      onComicLoaded(comic);
      onClose();
    } catch (err) {
      setIsProcessing(false);
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'No se encontró ningún cómic con ese identificador o enlace.';
      setErrorMessage(`${message} Revisa el identificador y vuelve a intentarlo.`);
      urlInputRef.current?.focus();
    }
  };

  const examples = [
    ['https://megabanana.mx/leer-the-batman-who-laughs-el-batman-que-rie-online-en-espanol/', 'El Batman que ríe (MegaBanana)'],
    ['atlantis-ataca-spiderman', 'Spider-Man: Atlantis ataca'],
    ['deadpool-wolverine-wwiii-01', 'Deadpool & Wolverine WWIII'],
    ['batman-the-long-halloween', 'Batman: The Long Halloween']
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="import-modal-title"
      className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-200 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 flex-shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="import-modal-title" className="text-base font-bold text-white">
              Importar un cómic
            </h2>
            <p className="text-xs text-zinc-400">Desde un archivo CBZ o desde un enlace</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar la ventana de importación"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex bg-zinc-950 p-1 rounded-xl mt-4 border border-zinc-800/80" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upload'}
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'upload' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          Subir CBZ o ZIP
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'url'}
          onClick={() => setActiveTab('url')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'url' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Link2 className="w-4 h-4" aria-hidden="true" />
          Abrir un enlace
        </button>
      </div>

      <div className="py-5">
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
            <span className="break-words">{errorMessage}</span>
          </div>
        )}

        {isProcessing ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center" aria-live="polite">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium text-zinc-200">{progressStatus}</p>
            <p className="text-xs text-zinc-500">El cómic se guarda en este navegador, no se sube a ningún sitio.</p>
          </div>
        ) : activeTab === 'upload' ? (
          <div>
            <label
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-2xl cursor-pointer transition-colors p-6 group focus-within:border-amber-500 ${
                isDragging ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-700 hover:border-amber-500 bg-zinc-950/50'
              }`}
            >
              <FileArchive
                className="w-10 h-10 text-zinc-500 group-hover:text-amber-500 mb-2 transition-colors"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-zinc-200 text-center">
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo .cbz o .zip, o pulsa para elegirlo'}
              </span>
              <span className="text-xs text-zinc-500 mt-1 text-center">Con imágenes JPEG, PNG o WEBP dentro</span>
              <input
                type="file"
                name="comic-file"
                accept=".cbz,.zip"
                onChange={handleFileInput}
                className="sr-only"
              />
            </label>

            <div className="mt-4 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/50 text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-200">¿Dónde conseguir cómics en español?</span>
              <p className="mt-1">
                Archive.org y las colecciones de aficionados publican muchos títulos en .cbz. Descárgalos y ábrelos
                aquí: se guardan en este navegador y se pueden leer sin conexión.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="comic-url" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Identificador de Archive.org o enlace de MegaBanana
              </label>
              <input
                id="comic-url"
                ref={urlInputRef}
                type="text"
                name="comic-url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="batman-the-long-halloween…"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/50 text-[11px] text-zinc-400 flex flex-col gap-1.5">
              <span className="font-semibold text-zinc-200">Ejemplos listos para probar:</span>
              {examples.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUrlInput(value)}
                  className="text-left text-amber-400 hover:underline text-[11px] truncate"
                >
                  • {label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors shadow-md mt-2"
            >
              Abrir en el lector
            </button>
          </form>
        )}
      </div>
    </Dialog>
  );
};
