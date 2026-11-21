import { useCallback, useEffect, useState } from 'react';

/**
 * `useState` que recuerda el valor entre sesiones.
 *
 * El tema del lector, el modo de página y la vista de la biblioteca volvían a
 * su valor por defecto en cada apertura: tener que reelegir el sepia cada vez
 * era la fricción más repetida de toda la aplicación.
 *
 * `isValid` descarta lo que haya guardado si ya no es un valor admitido (una
 * versión anterior, una edición a mano, almacenamiento corrupto).
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Modo privado o cuota llena: la app sigue funcionando en memoria. */
    }
  }, [key, value]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue(next);
  }, []);

  return [value, update];
}

/** Crea un validador para un conjunto cerrado de cadenas. */
export function oneOf<T extends string>(...allowed: T[]): (value: unknown) => value is T {
  return (value): value is T => typeof value === 'string' && (allowed as string[]).includes(value);
}
