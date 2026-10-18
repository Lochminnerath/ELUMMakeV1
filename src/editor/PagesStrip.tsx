import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import type { Page } from '../api/types';
import { Menu } from '../components/Menu';
import { PageView } from './render';

/** The design's pages in order: pick one, add, copy, reorder and delete. */
export function PagesStrip({
  pages,
  current,
  width,
  height,
  readOnly,
  onPick,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  pages: Page[];
  current: number;
  width: number;
  height: number;
  readOnly: boolean;
  onPick(index: number): void;
  onAdd(): void;
  onDuplicate(index: number): void;
  onDelete(index: number): void;
  onMove(index: number, by: 1 | -1): void;
}) {
  return (
    <nav className="pages" aria-label="Pages">
      <ol className="pages__list">
        {pages.map((p, i) => (
          <li key={p.id} className="pages__item" aria-current={i === current ? 'page' : undefined}>
            <button type="button" className="pages__thumb" onClick={() => onPick(i)} aria-label={`Page ${i + 1}`} style={{ aspectRatio: `${width} / ${height}` }}>
              <PageView page={p} width={width} height={height} className="pages__svg" />
            </button>
            <span className="pages__number" aria-hidden="true">
              {i + 1}
            </span>
            {!readOnly && (
              <Menu
                label={`Page ${i + 1}`}
                placement="right-start"
                items={[
                  { label: 'Duplicate page', icon: <Copy size={16} strokeWidth={1.75} />, onSelect: () => onDuplicate(i) },
                  { label: 'Move up', icon: <ArrowUp size={16} strokeWidth={1.75} />, disabled: i === 0, onSelect: () => onMove(i, -1) },
                  { label: 'Move down', icon: <ArrowDown size={16} strokeWidth={1.75} />, disabled: i === pages.length - 1, onSelect: () => onMove(i, 1) },
                  'separator',
                  { label: 'Delete page', icon: <Trash2 size={16} strokeWidth={1.75} />, danger: true, disabled: pages.length === 1, onSelect: () => onDelete(i) },
                ]}
                trigger={(props) => (
                  <button type="button" className="icon-btn pages__more" aria-label={`More for page ${i + 1}`} {...props}>
                    <MoreHorizontal size={14} strokeWidth={1.75} />
                  </button>
                )}
              />
            )}
          </li>
        ))}
      </ol>
      {!readOnly && (
        <button type="button" className="pages__add" onClick={onAdd} aria-label="Add a page" data-tip="Add a page">
          <Plus size={18} strokeWidth={1.75} />
        </button>
      )}
    </nav>
  );
}
