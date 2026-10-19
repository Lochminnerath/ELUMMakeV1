import { ChevronDown, ChevronUp, Image, Minus, Shapes, Type } from 'lucide-react';
import { HiddenIcon, PrivateIcon, UnlockedIcon, VisibleIcon } from '../components/icons/ElumIcons';
import type { DesignElement, Page } from '../api/types';
import { labelFor } from './Inspector';

/** Everything on the page, top layer first: pick, hide, lock and reorder. */
export function LayersPanel({
  page,
  selection,
  readOnly,
  onSelect,
  onToggle,
  onMove,
}: {
  page: Page;
  selection: string[];
  readOnly: boolean;
  onSelect(ids: string[]): void;
  onToggle(id: string, key: 'hidden' | 'locked'): void;
  onMove(id: string, by: 1 | -1): void;
}) {
  const layers = [...page.elements].reverse();
  if (!layers.length) return <p className="layers__empty muted">Nothing on this page yet. Add text, shapes or pictures from the bar above.</p>;
  return (
    <ul className="layers" aria-label="Layers">
      {layers.map((el, i) => (
        <li key={el.id} className="layer" aria-current={selection.includes(el.id) || undefined} data-hidden={el.hidden || undefined}>
          <button
            type="button"
            className="layer__pick"
            onClick={(e) => onSelect(e.shiftKey ? (selection.includes(el.id) ? selection.filter((x) => x !== el.id) : [...selection, el.id]) : [el.id])}
          >
            <LayerIcon el={el} />
            <span className="layer__name">{labelFor(el)}</span>
          </button>
          {!readOnly && (
            <span className="layer__tools">
              <button type="button" className="icon-btn" aria-label="Move up" data-tip="Move up" disabled={i === 0} onClick={() => onMove(el.id, 1)}>
                <ChevronUp size={14} strokeWidth={1.75} />
              </button>
              <button type="button" className="icon-btn" aria-label="Move down" data-tip="Move down" disabled={i === layers.length - 1} onClick={() => onMove(el.id, -1)}>
                <ChevronDown size={14} strokeWidth={1.75} />
              </button>
              <button type="button" className="icon-btn" aria-label={el.hidden ? 'Show' : 'Hide'} data-tip={el.hidden ? 'Show' : 'Hide'} aria-pressed={!!el.hidden} onClick={() => onToggle(el.id, 'hidden')}>
                {el.hidden ? <HiddenIcon size={14} strokeWidth={1.75} /> : <VisibleIcon size={14} strokeWidth={1.75} />}
              </button>
              <button type="button" className="icon-btn" aria-label={el.locked ? 'Unlock' : 'Lock'} data-tip={el.locked ? 'Unlock' : 'Lock'} aria-pressed={!!el.locked} onClick={() => onToggle(el.id, 'locked')}>
                {el.locked ? <PrivateIcon size={14} strokeWidth={1.75} /> : <UnlockedIcon size={14} strokeWidth={1.75} />}
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function LayerIcon({ el }: { el: DesignElement }) {
  const props = { size: 14, strokeWidth: 1.75, 'aria-hidden': true } as const;
  if (el.type === 'text') return <Type {...props} />;
  if (el.type === 'image') return <Image {...props} />;
  if (el.type === 'line') return <Minus {...props} />;
  return <Shapes {...props} />;
}
