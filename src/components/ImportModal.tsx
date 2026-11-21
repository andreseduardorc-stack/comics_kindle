import React, { useState } from 'react';
import { Upload, Link2, X, AlertCircle, FileArchive, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Comic } from '../types/comic';
import { processCbzFile, saveCustomComicMeta } from '../services/localComicService';
import { fetchComicDetails, detectPublisherAndHero } from '../services/archiveService';
import { resolveMegaBananaComic } from '../services/megabananaService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComicLoaded: (comic: Comic) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onComicLoaded
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Descomprimiendo cómic y preparando páginas...');

    try {
      const comic = await processCbzFile(file);
      saveCustomComicMeta(comic);
      setIsProcessing(false);
      onComicLoaded(comic);
      onClose();
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Error al procesar el archivo CBZ/ZIP.');
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('Conectando con el repositorio y obteniendo metadatos...');

    try {
      let identifier = urlInput.trim();

      // Check if it's a MegaBanana link
      if (identifier.includes('megabanana.mx')) {
        setProgressStatus('Conectando con MegaBanana y resolviendo cómic...');
        const mbComic = await resolveMegaBananaComic(identifier);
        if (mbComic) {
          saveCustomComicMeta(mbComic);
          setIsProcessing(false);
          onComicLoaded(mbComic);
          onClose();
          return;
        }
      }

      // If user pasted full archive.org URL like https://archive.org/details/batman-the-long-halloween
      if (identifier.includes('archive.org/details/')) {
        identifier = identifier.split('archive.org/details/')[1].split('/')[0].split('?')[0];
      }

      const details = await fetchComicDetails(identifier);
      const { publisher, hero } = detectPublisherAndHero(identifier);

      const comic: Comic = {
        id: identifier,
        identifier,
        title: identifier.replace(/[-_]/g, ' ').toUpperCase(),
        publisher,
        hero,
        year: 'Digital',
        language: 'Español',
        coverUrl: `https://archive.org/services/img/${identifier}`,
        description: `Cómic importado desde la web (${identifier}).`,
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
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      setErrorMessage('No se pudo encontrar o cargar el cómic desde ese identificador o enlace.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importar Cómic a tu Kindle</h2>
              <p className="text-xs text-zinc-400">Lee cualquier cómic DC o Marvel en español</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded-xl mt-4 border border-zinc-800/80">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'upload' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            Subir CBZ / ZIP
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'url' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Abrir Enlace Web
          </button>
        </div>

        {/* Body Content */}
        <div className="py-5">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProcessing ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm font-medium text-zinc-200">{progressStatus}</p>
              <p className="text-xs text-zinc-500">Un momento, procesando las páginas en memoria...</p>
            </div>
          ) : activeTab === 'upload' ? (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-2xl cursor-pointer bg-zinc-950/50 hover:bg-zinc-950 transition-colors p-6 group">
                <FileArchive className="w-10 h-10 text-zinc-500 group-hover:text-amber-500 mb-2 transition-colors" />
                <span className="text-sm font-semibold text-zinc-200">
                  Arrastra o selecciona un archivo .CBZ o .ZIP
                </span>
                <span className="text-xs text-zinc-500 mt-1">
                  Formatos soportados: CBZ, ZIP (con imágenes JPEG, PNG, WEBP)
                </span>
                <input
                  type="file"
                  accept=".cbz,.zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="mt-4 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/50 text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-200">💡 ¿Dónde conseguir cómics en español?</span>
                <p className="mt-1">
                  Puedes descargar cómics en español en formato .CBZ de colecciones de internet (Archive.org, foros de cómics en español como CRG, Novelmex, etc.) y abrirlos directamente aquí.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Identificador o URL de Archive.org:
                </label>
                <input
                  type="text"
                  placeholder="Ej: batman-the-long-halloween o https://archive.org/details/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/50 text-[11px] text-zinc-400 flex flex-col gap-1">
                <span className="font-semibold text-zinc-200">Ejemplos listos para probar:</span>
                <button
                  type="button"
                  onClick={() => setUrlInput('https://megabanana.mx/leer-the-batman-who-laughs-el-batman-que-rie-online-en-espanol/')}
                  className="text-left text-amber-400 hover:underline font-mono text-[10px]"
                >
                  • https://megabanana.mx/... (The Batman Who Laughs)
                </button>
                <button
                  type="button"
                  onClick={() => setUrlInput('atlantis-ataca-spiderman')}
                  className="text-left text-amber-500 hover:underline font-mono text-[10px]"
                >
                  • atlantis-ataca-spiderman (Spider-Man Atlantis Ataca)
                </button>
                <button
                  type="button"
                  onClick={() => setUrlInput('deadpool-wolverine-wwiii-01')}
                  className="text-left text-amber-500 hover:underline font-mono text-[10px]"
                >
                  • deadpool-wolverine-wwiii-01 (Deadpool & Wolverine WWIII)
                </button>
                <button
                  type="button"
                  onClick={() => setUrlInput('batman-the-long-halloween')}
                  className="text-left text-amber-500 hover:underline font-mono text-[10px]"
                >
                  • batman-the-long-halloween (Batman The Long Halloween)
                </button>
              </div>

              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-md mt-2"
              >
                Cargar y Abrir en Lector Kindle
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
