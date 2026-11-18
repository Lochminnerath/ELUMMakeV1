import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement, LineElement, Page, PathElement, TextElement } from '../api/types';
import { bounds, intersects, newPath, pathD, rotatePoint, simplifyPoints, snap, textHeight, unionBox, type Box, type Guide } from './model';
import { PageBackground, PlacedElement } from './render';

/** What a press on the page does: pick and move, place pen points, or draw freehand. */
export type Tool = 'select' | 'pen' | 'draw';

export interface PenStyle {
  stroke: string;
  strokeWidth: number;
  /** The fill a closed pen shape gets. */
  fill: string;
}

type Pt = { x: number; y: number };

/**
 * The page being edited. Everything is drawn in page pixels inside one SVG and scaled by `zoom`;
 * pointer positions are turned back into page pixels for every gesture.
 */

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: { id: Handle; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }[] = [
  { id: 'nw', dx: -1, dy: -1 },
  { id: 'n', dx: 0, dy: -1 },
  { id: 'ne', dx: 1, dy: -1 },
  { id: 'e', dx: 1, dy: 0 },
  { id: 'se', dx: 1, dy: 1 },
  { id: 's', dx: 0, dy: 1 },
  { id: 'sw', dx: -1, dy: 1 },
  { id: 'w', dx: -1, dy: 0 },
];
const MIN = 8;

type Drag =
  | { kind: 'move'; start: { x: number; y: number }; origins: Map<string, { x: number; y: number }>; box: Box; others: Box[]; moved: boolean }
  | { kind: 'resize'; handle: (typeof HANDLES)[number]; el: DesignElement }
  | { kind: 'rotate'; el: DesignElement }
  | { kind: 'line'; end: 'start' | 'end'; el: LineElement }
  | { kind: 'marquee'; start: { x: number; y: number }; additive: string[] }
  | { kind: 'draw'; points: Pt[] }
  | { kind: 'point'; el: PathElement; index: number };

export interface CanvasProps {
  page: Page;
  width: number;
  height: number;
  zoom: number;
  selection: string[];
  readOnly: boolean;
  editingId: string | null;
  onSelect(ids: string[]): void;
  onEditText(id: string | null): void;
  /** A live change during a gesture. */
  onPreview(update: (page: Page) => Page): void;
  /** The gesture ended. */
  onCommit(): void;
  onDropFiles(files: File[], at: { x: number; y: number }): void;
  /** Comment pins on this page, numbered as in the comments panel. */
  pins?: CanvasPin[];
  /** Picking a spot for a new comment: the next click on the page places it. */
  pinMode?: boolean;
  onPlacePin?(at: { x: number; y: number }): void;
  onOpenPin?(id: string): void;
  /** The pen or the brush instead of picking (select is the default). */
  tool?: Tool;
  penStyle?: PenStyle;
  /** A finished pen or brush path, to add to the page. */
  onCreate?(el: DesignElement): void;
  /** Leaves the pen or brush for picking again. */
  onToolDone?(): void;
  /** A grid, every this many page pixels, that moving snaps to. 0 or missing: no grid. */
  grid?: number;
}

export interface CanvasPin {
  id: string;
  n: number | string;
  x: number;
  y: number;
  resolved?: boolean;
  active?: boolean;
  pending?: boolean;
}

export function Canvas({
  page,
  width,
  height,
  zoom,
  selection,
  readOnly,
  editingId,
  onSelect,
  onEditText,
  onPreview,
  onCommit,
  onDropFiles,
  pins = [],
  pinMode = false,
  onPlacePin,
  onOpenPin,
  tool = 'select',
  penStyle = { stroke: '#141a2e', strokeWidth: 4, fill: '#bacafc' },
  onCreate,
  onToolDone,
  grid = 0,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  // The second press of a double-click on a text. The page holds the pointer while dragging, so the
  // browser's dblclick lands on the page, not the text: it is told apart here instead.
  const lastPress = useRef<{ id: string; at: number } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [dropping, setDropping] = useState(false);
  // The pen's points so far, and where the pointer is, for the line still to be placed.
  const [pen, setPen] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const [stroke2, setStroke2] = useState<Pt[] | null>(null);

  const toPage = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };

  const selected = page.elements.filter((el) => selection.includes(el.id));
  const single = selected.length === 1 ? selected[0] : null;
  const box = unionBox(selected.filter((el) => !el.hidden).map(bounds));
  const handleSize = 10 / zoom;
  const stroke = 1.5 / zoom;

  const updateElements = (fn: (el: DesignElement) => DesignElement) => onPreview((p) => ({ ...p, elements: p.elements.map(fn) }));

  // ------------------------------------------------------------- starting gestures

  const startOnElement = (e: ReactPointerEvent, el: DesignElement) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingId === el.id) return;
    const previous = lastPress.current;
    lastPress.current = { id: el.id, at: e.timeStamp };
    if (previous?.id === el.id && e.timeStamp - previous.at < 450 && !e.shiftKey && !readOnly && (el.type === 'text' || el.type === 'path') && !el.locked) {
      lastPress.current = null;
      onSelect([el.id]);
      onEditText(el.id);
      return;
    }
    const ids = e.shiftKey ? (selection.includes(el.id) ? selection.filter((id) => id !== el.id) : [...selection, el.id]) : selection.includes(el.id) ? selection : [el.id];
    onSelect(ids);
    if (readOnly || e.shiftKey) return;
    const moving = page.elements.filter((x) => ids.includes(x.id) && !x.locked);
    if (!moving.length) return;
    svgRef.current!.setPointerCapture(e.pointerId);
    drag.current = {
      kind: 'move',
      start: toPage(e),
      origins: new Map(moving.map((x) => [x.id, { x: x.x, y: x.y }])),
      box: unionBox(moving.map(bounds))!,
      others: page.elements.filter((x) => !ids.includes(x.id) && !x.hidden).map(bounds),
      moved: false,
    };
  };

  const startOnBackground = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (editingId) onEditText(null);
    svgRef.current!.setPointerCapture(e.pointerId);
    const additive = e.shiftKey ? selection : [];
    if (!e.shiftKey) onSelect([]);
    drag.current = { kind: 'marquee', start: toPage(e), additive };
  };

  const startHandle = (e: ReactPointerEvent, next: Drag) => {
    e.stopPropagation();
    if (e.button !== 0 || readOnly) return;
    svgRef.current!.setPointerCapture(e.pointerId);
    drag.current = next;
  };

  // ------------------------------------------------------------- following the pointer

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toPage(e);

    if (d.kind === 'draw') {
      const last = d.points[d.points.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) * zoom >= 2) {
        d.points.push(p);
        setStroke2([...d.points]);
      }
      return;
    }

    if (d.kind === 'point') {
      // One point of a path, moved; the box grows or shrinks to fit the points again.
      const abs = d.el.points.map(([px, py]) => ({ x: d.el.x + px * d.el.w, y: d.el.y + py * d.el.h }));
      abs[d.index] = p;
      const next = newPath(abs, d.el);
      updateElements((el) => (el.id === d.el.id ? { ...d.el, x: next.x, y: next.y, w: next.w, h: next.h, points: next.points } : el));
      return;
    }

    if (d.kind === 'marquee') {
      const rect = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
      setMarquee(rect);
      const hit = page.elements.filter((el) => !el.hidden && !el.locked && intersects(rect, bounds(el))).map((el) => el.id);
      onSelect([...new Set([...d.additive, ...hit])]);
      return;
    }

    if (d.kind === 'move') {
      let dx = p.x - d.start.x;
      let dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * zoom < 3) return;
      d.moved = true;
      if (e.shiftKey) {
        // Straight lines only: whichever direction moved more.
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      let found: Guide[] = [];
      if (grid > 0 && !e.altKey) {
        // On the grid: the moving box's top-left corner lands on the nearest grid point.
        dx = Math.round((d.box.x + dx) / grid) * grid - d.box.x;
        dy = Math.round((d.box.y + dy) / grid) * grid - d.box.y;
      } else if (!e.altKey) {
        const s = snap({ ...d.box, x: d.box.x + dx, y: d.box.y + dy }, d.others, { width, height }, 6 / zoom);
        dx += s.dx;
        dy += s.dy;
        found = s.guides;
      }
      setGuides(found);
      updateElements((el) => {
        const o = d.origins.get(el.id);
        return o ? { ...el, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : el;
      });
      return;
    }

    if (d.kind === 'rotate') {
      const cx = d.el.x + d.el.w / 2;
      const cy = d.el.y + d.el.h / 2;
      let angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      angle = ((angle % 360) + 360) % 360;
      if (e.shiftKey) angle = Math.round(angle / 15) * 15;
      else {
        const nearest = Math.round(angle / 45) * 45;
        if (Math.abs(angle - nearest) < 3) angle = nearest;
      }
      angle = Math.round(angle) % 360;
      updateElements((el) => (el.id === d.el.id ? { ...el, rotation: angle } : el));
      return;
    }

    if (d.kind === 'line') {
      const sx = d.el.x;
      const sy = d.el.y;
      const ex = d.el.x + d.el.w;
      const ey = d.el.y + d.el.h;
      const anchor = d.end === 'start' ? { x: ex, y: ey } : { x: sx, y: sy };
      let tx = p.x;
      let ty = p.y;
      if (e.shiftKey) {
        // Lock to 45° steps.
        const a = Math.round(Math.atan2(ty - anchor.y, tx - anchor.x) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(tx - anchor.x, ty - anchor.y);
        tx = anchor.x + Math.cos(a) * len;
        ty = anchor.y + Math.sin(a) * len;
      }
      updateElements((el) => {
        if (el.id !== d.el.id) return el;
        return d.end === 'start'
          ? { ...el, x: Math.round(tx), y: Math.round(ty), w: Math.round(ex - tx), h: Math.round(ey - ty) }
          : { ...el, w: Math.round(tx - sx), h: Math.round(ty - sy) };
      });
      return;
    }

    // Resize, in the element's own (rotated) frame.
    const { el, handle } = d;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const local = rotatePoint(p.x, p.y, cx, cy, -el.rotation);
    const lx = local.x - cx;
    const ly = local.y - cy;
    const fx = -handle.dx * (el.w / 2);
    const fy = -handle.dy * (el.h / 2);
    let w = handle.dx ? Math.max(MIN, (lx - fx) * handle.dx) : el.w;
    let h = handle.dy ? Math.max(MIN, (ly - fy) * handle.dy) : el.h;
    const corner = handle.dx !== 0 && handle.dy !== 0;
    const keepRatio = corner && (el.type === 'image' || el.type === 'text' ? !e.shiftKey : e.shiftKey);
    if (keepRatio) {
      const s = Math.max(w / el.w, h / el.h);
      w = el.w * s;
      h = el.h * s;
    }
    let next: DesignElement = { ...el, w: Math.round(w), h: Math.round(h) };
    if (el.type === 'text') {
      // Corners scale the type; sides change the width and the text rewraps.
      const t = el as TextElement;
      const scaled: TextElement = corner ? { ...t, w: Math.round(w), fontSize: Math.max(4, Math.round(t.fontSize * (w / t.w) * 10) / 10) } : { ...t, w: Math.round(w) };
      next = { ...scaled, h: textHeight(scaled) };
      h = next.h;
      w = next.w;
    }
    const ncx = handle.dx ? fx + handle.dx * (w / 2) : 0;
    const ncy = handle.dy || el.type === 'text' ? (handle.dy ? fy + handle.dy * (h / 2) : -el.h / 2 + h / 2) : 0;
    const world = rotatePoint(cx + ncx, cy + ncy, cx, cy, el.rotation);
    next = { ...next, x: Math.round(world.x - w / 2), y: Math.round(world.y - h / 2) };
    updateElements((x) => (x.id === el.id ? next : x));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setGuides([]);
    setMarquee(null);
    if (d?.kind === 'draw') {
      setStroke2(null);
      const pts = simplifyPoints(d.points, 1.2 / zoom);
      if (pts.length >= 2) onCreate?.(newPath(pts, { closed: false, smooth: true, stroke: penStyle.stroke, strokeWidth: penStyle.strokeWidth, fill: 'none' }));
      return;
    }
    if (d && d.kind !== 'marquee' && (d.kind !== 'move' || d.moved)) onCommit();
  };

  // ------------------------------------------------------------- the pen

  const finishPen = (closed: boolean, points = pen) => {
    setPen([]);
    setHover(null);
    if (points.length >= 2) {
      onCreate?.(newPath(points, { closed, smooth: false, stroke: penStyle.stroke, strokeWidth: penStyle.strokeWidth, fill: closed ? penStyle.fill : 'none' }));
    }
  };

  const startTool = (e: ReactPointerEvent) => {
    if (e.button !== 0 || readOnly) return;
    e.stopPropagation();
    const p = toPage(e);
    if (tool === 'draw') {
      svgRef.current!.setPointerCapture(e.pointerId);
      drag.current = { kind: 'draw', points: [p] };
      setStroke2([p]);
      return;
    }
    // The pen: a click places a point; a click on the first point closes the shape; a double
    // click (or Enter) ends an open line.
    const first = pen[0];
    if (first && pen.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) * zoom < 12) {
      finishPen(true);
      return;
    }
    let at = p;
    if (e.shiftKey && pen.length) {
      const prev = pen[pen.length - 1];
      const a = Math.round(Math.atan2(p.y - prev.y, p.x - prev.x) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(p.x - prev.x, p.y - prev.y);
      at = { x: prev.x + Math.cos(a) * len, y: prev.y + Math.sin(a) * len };
    }
    const prev = pen[pen.length - 1];
    if (prev && e.detail >= 2 && Math.hypot(at.x - prev.x, at.y - prev.y) * zoom < 6) {
      finishPen(false);
      return;
    }
    setPen((list) => [...list, at]);
  };

  // Enter ends the pen's line, Escape ends it too (or leaves the tool when nothing is placed).
  useEffect(() => {
    if (tool === 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (tool === 'pen' && pen.length >= 2) finishPen(e.key === 'Enter' ? false : false);
      else {
        setPen([]);
        onToolDone?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Changing tools drops a half-placed pen line.
  useEffect(() => {
    setPen([]);
    setHover(null);
  }, [tool]);

  const editingPath = editingId ? (page.elements.find((el) => el.id === editingId && el.type === 'path') as PathElement | undefined) : undefined;
  const pointEditable = editingPath && !editingPath.rotation && !editingPath.flipX && !editingPath.flipY;

  // ------------------------------------------------------------- pictures dropped in

  useEffect(() => {
    if (!dropping) return;
    const stop = () => setDropping(false);
    window.addEventListener('dragend', stop);
    return () => window.removeEventListener('dragend', stop);
  }, [dropping]);

  const editing = editingId ? (page.elements.find((el) => el.id === editingId && el.type === 'text') as TextElement | undefined) : undefined;

  return (
    <div
      className="stage"
      style={{ width: width * zoom, height: height * zoom }}
      data-dropping={dropping || undefined}
      onDragOver={(e) => {
        if (readOnly || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        setDropping(false);
        if (readOnly) return;
        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        onDropFiles(files, toPage(e));
      }}
    >
      <svg
        ref={svgRef}
        className="stage__svg"
        width={width * zoom}
        height={height * zoom}
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={startOnBackground}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label="Page"
      >
        <PageBackground page={page} width={width} height={height} />
        {grid > 0 && (
          <g className="stage__grid" aria-hidden="true">
            {Array.from({ length: Math.floor(width / grid) }, (_, i) => (
              <line key={`gx${i}`} x1={(i + 1) * grid} x2={(i + 1) * grid} y1={0} y2={height} strokeWidth={stroke * 0.7} />
            ))}
            {Array.from({ length: Math.floor(height / grid) }, (_, i) => (
              <line key={`gy${i}`} x1={0} x2={width} y1={(i + 1) * grid} y2={(i + 1) * grid} strokeWidth={stroke * 0.7} />
            ))}
          </g>
        )}
        {page.elements.map((el) => (
          <g
            key={el.id}
            data-id={el.id}
            className="stage__el"
            data-locked={el.locked || undefined}
            onPointerDown={(e) => !el.hidden && startOnElement(e, el)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!readOnly && el.type === 'text' && !el.locked) onEditText(el.id);
            }}
          >
            <PlacedElement el={el} hideText={el.id === editingId} />
            {/* A thin line is hard to grab: a wider invisible line takes the pointer. */}
            {el.type === 'line' && !el.hidden && (
              <line x1={el.x} y1={el.y} x2={el.x + el.w} y2={el.y + el.h} stroke="transparent" strokeWidth={Math.max(el.strokeWidth, 16 / zoom)} />
            )}
          </g>
        ))}

        {/* Selection, handles and guides, drawn over the page. */}
        {selected
          .filter((el) => !el.hidden)
          .map((el) =>
            el.type === 'line' ? null : (
              <rect
                key={`sel-${el.id}`}
                className="stage__outline"
                x={el.x}
                y={el.y}
                width={el.w}
                height={el.h}
                transform={el.rotation ? `rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})` : undefined}
                strokeWidth={stroke}
                data-locked={el.locked || undefined}
              />
            ),
          )}
        {box && selected.length > 1 && (
          <rect className="stage__group" x={box.x} y={box.y} width={box.w} height={box.h} strokeWidth={stroke} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
        )}
        {single && !single.locked && !single.hidden && !readOnly && editingId !== single.id && (
          single.type === 'line' ? (
            <g>
              {(['start', 'end'] as const).map((end) => (
                <circle
                  key={end}
                  className="stage__handle"
                  cx={end === 'start' ? single.x : single.x + single.w}
                  cy={end === 'start' ? single.y : single.y + single.h}
                  r={handleSize / 1.6}
                  strokeWidth={stroke}
                  onPointerDown={(e) => startHandle(e, { kind: 'line', end, el: single as LineElement })}
                  aria-label={`Drag the ${end} of the line`}
                />
              ))}
            </g>
          ) : (
            <g transform={single.rotation ? `rotate(${single.rotation} ${single.x + single.w / 2} ${single.y + single.h / 2})` : undefined}>
              <line
                className="stage__rotate-stem"
                x1={single.x + single.w / 2}
                y1={single.y}
                x2={single.x + single.w / 2}
                y2={single.y - 28 / zoom}
                strokeWidth={stroke}
              />
              <circle
                className="stage__handle stage__handle--rotate"
                cx={single.x + single.w / 2}
                cy={single.y - 28 / zoom}
                r={handleSize / 1.6}
                strokeWidth={stroke}
                onPointerDown={(e) => startHandle(e, { kind: 'rotate', el: single })}
              />
              {HANDLES.filter((h) => single.type !== 'text' || h.dy === 0 || h.dx !== 0).map((h) => (
                <rect
                  key={h.id}
                  className="stage__handle"
                  data-handle={h.id}
                  x={single.x + ((h.dx + 1) / 2) * single.w - handleSize / 2}
                  y={single.y + ((h.dy + 1) / 2) * single.h - handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  rx={2 / zoom}
                  strokeWidth={stroke}
                  style={{ cursor: cursorFor(h.id, single.rotation) }}
                  onPointerDown={(e) => startHandle(e, { kind: 'resize', handle: h, el: single })}
                />
              ))}
            </g>
          )
        )}
        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <line key={i} className="stage__guide" x1={g.at} x2={g.at} y1={g.from} y2={g.to} strokeWidth={stroke} />
          ) : (
            <line key={i} className="stage__guide" x1={g.from} x2={g.to} y1={g.at} y2={g.at} strokeWidth={stroke} />
          ),
        )}
        {marquee && <rect className="stage__marquee" x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} strokeWidth={stroke} />}

        {/* Editing a path's points: each point is a handle to drag. */}
        {editingPath && pointEditable && !readOnly && (
          <g>
            <path
              className="stage__path-edit"
              d={pathD(editingPath)}
              transform={`translate(${editingPath.x} ${editingPath.y})`}
              strokeWidth={stroke}
              fill="none"
            />
            {editingPath.points.map(([px, py], i) => (
              <circle
                key={i}
                className="stage__handle stage__handle--point"
                cx={editingPath.x + px * editingPath.w}
                cy={editingPath.y + py * editingPath.h}
                r={handleSize / 1.5}
                strokeWidth={stroke}
                onPointerDown={(e) => startHandle(e, { kind: 'point', el: editingPath, index: i })}
              />
            ))}
          </g>
        )}

        {/* The pen's line so far, the brush's stroke so far, and a layer that takes the presses. */}
        {pen.length > 0 && (
          <g className="stage__pen" pointerEvents="none">
            <polyline points={[...pen, ...(hover ? [hover] : [])].map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke={penStyle.stroke} strokeWidth={Math.max(penStyle.strokeWidth, stroke)} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
            {pen.map((q, i) => (
              <circle key={i} className="stage__pen-point" data-first={i === 0 || undefined} cx={q.x} cy={q.y} r={(i === 0 ? 6 : 4.5) / zoom} strokeWidth={stroke} />
            ))}
          </g>
        )}
        {stroke2 && stroke2.length > 1 && (
          <polyline pointerEvents="none" points={stroke2.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke={penStyle.stroke} strokeWidth={penStyle.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {tool !== 'select' && !readOnly && (
          <rect
            className="stage__tool-layer"
            data-tool={tool}
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={startTool}
            onPointerMove={(e) => tool === 'pen' && pen.length > 0 && setHover(toPage(e))}
            aria-label={tool === 'pen' ? 'Click to place points. Click the first point to close the shape, or press Enter to finish.' : 'Draw with the pointer'}
          />
        )}
      </svg>

      {pins.map((p) => (
        <button
          key={p.id}
          type="button"
          className="pin"
          data-resolved={p.resolved || undefined}
          data-active={p.active || undefined}
          data-pending={p.pending || undefined}
          style={{ left: p.x * zoom, top: p.y * zoom }}
          aria-label={p.pending ? 'New comment here' : `Comment ${p.n}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => !p.pending && onOpenPin?.(p.id)}
        >
          <span>{p.n}</span>
        </button>
      ))}
      {pinMode && (
        <div
          className="stage__pin-layer"
          role="button"
          tabIndex={-1}
          aria-label="Click where the comment goes"
          onPointerDown={(e) => {
            e.stopPropagation();
            const at = toPage(e);
            onPlacePin?.({ x: Math.round(Math.max(0, Math.min(width, at.x))), y: Math.round(Math.max(0, Math.min(height, at.y))) });
          }}
        />
      )}

      {editing && (
        <TextEditor
          el={editing}
          zoom={zoom}
          onChange={(text) =>
            onPreview((p) => ({
              ...p,
              elements: p.elements.map((x) => (x.id === editing.id && x.type === 'text' ? { ...x, text, h: textHeight({ ...x, text }) } : x)),
            }))
          }
          onDone={() => {
            onCommit();
            onEditText(null);
          }}
        />
      )}
    </div>
  );
}

/** Typing straight onto the page: a textarea laid exactly over the text it edits. */
function TextEditor({ el, zoom, onChange, onDone }: { el: TextElement; zoom: number; onChange(text: string): void; onDone(): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="stage__text-editor"
      aria-label="Text"
      value={el.text}
      spellCheck
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.w * zoom,
        height: Math.max(el.h, el.fontSize * el.lineHeight) * zoom,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        fontFamily: `"${el.fontFamily}", Manrope, system-ui, sans-serif`,
        fontSize: el.fontSize * zoom,
        fontWeight: el.fontWeight,
        fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: el.underline ? 'underline' : 'none',
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing * zoom,
        textAlign: el.align,
        color: el.color,
      }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
      }}
    />
  );
}

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
const ANGLES: Record<Handle, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

/** The resize cursor that points the right way, even on a rotated element. */
function cursorFor(handle: Handle, rotation: number) {
  const a = (((ANGLES[handle] + rotation) % 180) + 180) % 180;
  return CURSORS[Math.round(a / 45) % 4];
}
