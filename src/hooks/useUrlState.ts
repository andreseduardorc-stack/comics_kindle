import { useEffect, useRef } from 'react';

/**
 * Refleja el estado de la biblioteca en la barra de direcciones.
 *
 * Sirve para compartir «Marvel, vista lista, buscando Daredevil», para que el
 * botón Atrás signifique algo y para que una recarga no deje la pantalla en
 * blanco con todos los filtros perdidos.
 *
 * Se usa `replaceState`: cambiar un filtro no debe llenar el historial de
 * entradas que el usuario tendría que deshacer una a una.
 */
export function readUrlState(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/** Lee un parámetro y lo valida contra un conjunto cerrado de valores. */
export function readUrlEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = readUrlState().get(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function useSyncUrlState(params: Record<string, string>, defaults: Record<string, string>): void {
  // La primera pasada no debe tocar la URL: ya viene con lo que el usuario abrió.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== defaults[key]) search.set(key, value);
    });

    const query = search.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [params, defaults]);
}
