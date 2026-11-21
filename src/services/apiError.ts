/**
 * Error de puente API.
 *
 * Los servicios lanzan esto en vez de devolver `[]` en silencio: la biblioteca
 * necesita poder distinguir «no hay resultados» de «la fuente no respondió»,
 * que son dos mensajes muy distintos para quien está mirando la pantalla.
 */
export class ApiError extends Error {
  readonly source: string;
  readonly status?: number;

  constructor(source: string, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.source = source;
    this.status = status;
  }
}

export async function fetchJson<T>(source: string, url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(source, `No se pudo contactar con ${source}. Revisa tu conexión.`);
  }

  if (res.status === 404) {
    throw new ApiError(source, `El puente de ${source} no está disponible en esta dirección.`, 404);
  }
  if (!res.ok) {
    throw new ApiError(source, `${source} respondió con un error (HTTP ${res.status}).`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(source, `${source} devolvió una respuesta ilegible.`);
  }
}
