/**
 * Almacén de páginas de cómics importados (CBZ/ZIP) en IndexedDB.
 *
 * Antes las páginas eran blob URLs guardadas solo en memoria: al recargar la
 * página la tarjeta seguía en la biblioteca pero su portada y todas sus
 * páginas apuntaban a blobs muertos, así que el lector mostraba la misma
 * imagen rota 40 veces. `localStorage` no sirve para esto (son megas de
 * binario), de ahí IndexedDB.
 */
const DB_NAME = 'kindlecomics';
const DB_VERSION = 1;
const STORE = 'pages';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Este navegador no permite guardar cómics importados.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Error de IndexedDB.'));
      })
  );
}

interface StoredComic {
  id: string;
  blobs: Blob[];
  savedAt: number;
}

/** URLs vivas de esta sesión, para poder revocarlas y no crearlas dos veces. */
const objectUrlCache = new Map<string, string[]>();

export async function savePages(id: string, blobs: Blob[]): Promise<void> {
  const record: StoredComic = { id, blobs, savedAt: Date.now() };
  await tx('readwrite', store => store.put(record) as IDBRequest<IDBValidKey>);
}

/**
 * Devuelve las páginas como URLs utilizables por `<img>`, o `null` si ese
 * cómic ya no está guardado (otro navegador, almacenamiento limpiado…).
 */
export async function loadPageUrls(id: string): Promise<string[] | null> {
  const cached = objectUrlCache.get(id);
  if (cached) return cached;

  try {
    const record = await tx<StoredComic | undefined>('readonly', store => store.get(id));
    if (!record || !record.blobs?.length) return null;

    const urls = record.blobs.map(blob => URL.createObjectURL(blob));
    objectUrlCache.set(id, urls);
    return urls;
  } catch {
    return null;
  }
}

export async function deletePages(id: string): Promise<void> {
  releasePageUrls(id);
  try {
    await tx('readwrite', store => store.delete(id) as unknown as IDBRequest<undefined>);
  } catch {
    /* Si no se puede borrar, no hay nada que el usuario pueda hacer al respecto. */
  }
}

export async function hasPages(id: string): Promise<boolean> {
  if (objectUrlCache.has(id)) return true;
  try {
    const record = await tx<StoredComic | undefined>('readonly', store => store.get(id));
    return Boolean(record?.blobs?.length);
  } catch {
    return false;
  }
}

export function releasePageUrls(id: string): void {
  const urls = objectUrlCache.get(id);
  if (!urls) return;
  urls.forEach(url => URL.revokeObjectURL(url));
  objectUrlCache.delete(id);
}
