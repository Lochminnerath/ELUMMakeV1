import { ChevronLeft, ChevronRight, NotebookText, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Page } from '../api/types';
import { appearOrder } from './model';
import { PageBackground, PlacedElement } from './render';

/**
 * Presenting: one page at a time, full screen. Arrows, space, page up/down or a click move
 * through the pages; Escape ends. Speaker notes show on request.
 */
export function Present({ pages, start, width, height, onClose }: { pages: Page[]; start: number; width: number; height: number; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ index: start, step: 0, dir: 1 });
  const index = at.index;
  const [notes, setNotes] = useState(false);
  const orders = useMemo(() => pages.map(appearOrder), [pages]);
  // Forward: the next element comes in, then the next page. Back: the reverse.
  const go = useCallback(
    (by: number) =>
      setAt(({ index: i, step }) => {
        if (by > 0) {
          if (step < (orders[i]?.length ?? 0)) return { index: i, step: step + 1, dir: 1 };
          return i < pages.length - 1 ? { index: i + 1, step: 0, dir: 1 } : { index: i, step, dir: 1 };
        }
        if (step > 0) return { index: i, step: step - 1, dir: -1 };
        return i > 0 ? { index: i - 1, step: orders[i - 1]?.length ?? 0, dir: -1 } : { index: i, step, dir: -1 };
      }),
    [orders, pages.length],
  );
  const setIndex = (i: number) => setAt({ index: i, step: 0, dir: i >= index ? 1 : -1 });

  // The editor passes a new onClose on every render (and going full screen resizes the window,
  // which re-renders it). Keep the latest in a ref so full screen is entered once, not left and
  // re-entered on each render, which closed Present straight away.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.requestFullscreen?.().catch(() => undefined);
    const onFullscreen = () => {
      if (!document.fullscreenElement) close.current();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const page = pages[index];
  const shown = new Set(orders[index]?.slice(0, at.step));
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
        <svg
          key={index}
          className="present__page"
          data-transition={page.transition ?? 'none'}
          data-dir={at.dir < 0 ? 'back' : 'next'}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Page ${index + 1}`}
        >
          <PageBackground page={page} width={width} height={height} />
          {page.elements.map((el) =>
            el.appear && !el.hidden ? (
              <g key={el.id} className="appear" data-effect={el.appear} data-shown={shown.has(el.id) || undefined}>
                <PlacedElement el={el} />
              </g>
            ) : (
              <PlacedElement key={el.id} el={el} />
            ),
          )}
        </svg>
      </button>
      {notes && page.notes && <div className="present__notes">{page.notes}</div>}
      <div className="present__bar">
        <button type="button" className="icon-btn" aria-label="Previous page" onClick={() => go(-1)} disabled={index === 0 && at.step === 0}>
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="present__count">
          {index + 1} / {pages.length}
        </span>
        <button type="button" className="icon-btn" aria-label="Next page" onClick={() => go(1)} disabled={index === pages.length - 1 && at.step >= (orders[index]?.length ?? 0)}>
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
