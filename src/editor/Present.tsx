import { ChevronLeft, ChevronRight, NotebookText, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '../api/types';
import { PageView } from './render';

/**
 * Presenting: one page at a time, full screen. Arrows, space, page up/down or a click move
 * through the pages; Escape ends. Speaker notes show on request.
 */
export function Present({ pages, start, width, height, onClose }: { pages: Page[]; start: number; width: number; height: number; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [notes, setNotes] = useState(false);
  const go = useCallback((by: number) => setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + by))), [pages.length]);

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.requestFullscreen?.().catch(() => undefined);
    const onFullscreen = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  const page = pages[index];
  return (
    <div
      ref={ref}
      className="present"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting, page ${index + 1} of ${pages.length}`}
      onKeyDown={(e) => {
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
          e.preventDefault();
          go(1);
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
          e.preventDefault();
          go(-1);
        } else if (e.key === 'Home') setIndex(0);
        else if (e.key === 'End') setIndex(pages.length - 1);
        else if (e.key === 'Escape') onClose();
        else if (e.key === 'n') setNotes((n) => !n);
      }}
    >
      <button type="button" className="present__stage" onClick={() => go(1)} aria-label="Next page">
        <PageView page={page} width={width} height={height} className="present__page" label={`Page ${index + 1}`} />
      </button>
      {notes && page.notes && <div className="present__notes">{page.notes}</div>}
      <div className="present__bar">
        <button type="button" className="icon-btn" aria-label="Previous page" onClick={() => go(-1)} disabled={index === 0}>
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="present__count">
          {index + 1} / {pages.length}
        </span>
        <button type="button" className="icon-btn" aria-label="Next page" onClick={() => go(1)} disabled={index === pages.length - 1}>
          <ChevronRight size={20} strokeWidth={1.75} />
        </button>
        <button type="button" className="icon-btn" aria-label="Speaker notes (N)" aria-pressed={notes} onClick={() => setNotes((n) => !n)} disabled={!page.notes}>
          <NotebookText size={18} strokeWidth={1.75} />
        </button>
        <button type="button" className="icon-btn" aria-label="Stop presenting (Esc)" onClick={onClose}>
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
