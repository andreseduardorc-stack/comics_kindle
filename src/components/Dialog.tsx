import React, { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Id del elemento que da nombre al diálogo (normalmente su título). */
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Diálogo modal con el comportamiento que la gente da por hecho:
 * cierra con Esc, cierra al pulsar fuera, atrapa el foco dentro mientras está
 * abierto y lo devuelve al control que lo abrió al cerrarse.
 *
 * Antes cada modal era un `<div>` sobre un fondo oscuro: con el teclado se
 * podía tabular por detrás, Esc no hacía nada y pulsar fuera tampoco cerraba,
 * que es justo lo primero que todo el mundo intenta.
 */
export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, labelledBy, className = '', children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // El foco entra en el panel, no en su primer botón: así un lector de
    // pantalla anuncia el título del diálogo antes que una acción suelta.
    panelRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onMouseDown={e => {
        // mousedown y no click: si el usuario empieza a seleccionar texto
        // dentro y suelta fuera, el diálogo no debe cerrarse.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`dialog-scroll focus:outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
};
