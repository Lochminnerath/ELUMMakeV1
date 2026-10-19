import {
  ArrowLeft,
  ArrowRight,
  Circle,
  CloudOff,
  Download,
  Image as ImageIcon,
  Layers,
  Minus,
  MoveRight,
  PanelRight,
  Play,
  Redo2,
  Slash,
  Square,
  Star,
  Triangle,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, errorMessage, isApiError, type Design, type DesignContent, type DesignElement, type Page } from '../api';
import { DesignIcon } from '../components/Brand';
import { FullPageLoader } from '../components/Loader';
import { Menu } from '../components/Menu';
import { NotificationBell } from '../components/NotificationBell';
import { useToast } from '../components/Toast';
import { UserMenu } from '../components/UserMenu';
import { useMediaQuery } from '../lib/hooks';
import { Canvas } from './Canvas';
import { exportPdf, exportPng, safeFilename } from './export';
import { useHistory } from './history';
import { Inspector, type Align, type Arrange } from './Inspector';
import { LayersPanel } from './LayersPanel';
import { bounds, cloneElement, clonePage, newImage, newLine, newPage, newShape, newText, normalizeContent, unionBox } from './model';
import { PagesStrip } from './PagesStrip';
import { Present } from './Present';
import { ShareDialog } from './ShareDialog';
import { ShareIcon } from '../components/ShareIcon';
import './editor.css';
import { ElumLauncher } from '../components/ElumLauncher';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'offline';
const SAVE_DELAY = 900;
const ICON = { size: 18, strokeWidth: 1.75 };

export default function EditorPage() {
  const { designId = '' } = useParams();
  const [design, setDesign] = useState<Design | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setDesign(null);
    setError(null);
    api.getDesign(designId).then(
      (d) => live && setDesign({ ...d, content: normalizeContent(d.content) }),
      (e) => live && setError(errorMessage(e)),
    );
    return () => {
      live = false;
    };
  }, [designId]);

  if (error) {
    return (
      <div className="empty-state" style={{ minHeight: '100%', justifyContent: 'center' }}>
        <DesignIcon size={64} />
        <h2>We could not open this design</h2>
        <p>{error}</p>
        <Link to="/" className="elum-btn elum-btn--primary">
          Go to your designs
        </Link>
      </div>
    );
  }
  if (!design) return <FullPageLoader label="Opening your design" />;
  return <Editor key={design.id} initial={design} />;
}

function Editor({ initial }: { initial: Design }) {
  const toast = useToast();
  const narrow = useMediaQuery('(max-width: 900px)');
  const history = useHistory<DesignContent>(initial.content);
  const content = history.value;
  const [title, setTitle] = useState(initial.title);
  const [size, setSize] = useState({ width: initial.width, height: initial.height });
  const [pageIndex, setPageIndex] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'design' | 'layers'>('design');
  const [panelOpen, setPanelOpen] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [fitZoom, setFitZoom] = useState(0.4);
  const [presenting, setPresenting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [exporting, setExporting] = useState(false);
  const readOnly = initial.role === 'viewer';
  const areaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<string | null>(null);
  const clipboard = useRef<DesignElement[]>([]);
  const version = useRef(initial.version);
  const savedContent = useRef(initial.content);

  const page = content.pages[Math.min(pageIndex, content.pages.length - 1)];
  const zoom = zoomMode === 'fit' ? fitZoom : zoomMode;
  const selected = useMemo(() => page.elements.filter((el) => selection.includes(el.id)), [page, selection]);

  // Keep the page index and selection valid as pages and elements change (undo, deletes).
  useEffect(() => {
    if (pageIndex > content.pages.length - 1) setPageIndex(content.pages.length - 1);
  }, [content.pages.length, pageIndex]);
  useEffect(() => {
    setSelection((sel) => {
      const kept = sel.filter((id) => page.elements.some((el) => el.id === id));
      return kept.length === sel.length ? sel : kept;
    });
  }, [page]);

  // ------------------------------------------------------------------ zoom to fit

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () => {
      const pad = narrow ? 24 : 64;
      const z = Math.min((area.clientWidth - pad) / size.width, (area.clientHeight - pad) / size.height);
      setFitZoom(Math.max(0.05, Math.min(z, 2)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    return () => ro.disconnect();
  }, [size, narrow]);

  // ------------------------------------------------------------------ saving

  const historyRef = useRef(history);
  historyRef.current = history;
  const saving = useRef(false);
  const save = useCallback(async () => {
    if (readOnly || saving.current) return;
    const toSave = historyRef.current.value;
    if (toSave === savedContent.current) {
      setSaveState('saved');
      return;
    }
    saving.current = true;
    setSaveState('saving');
    try {
      const result = await api.saveDesign(initial.id, version.current, toSave);
      version.current = result.version;
      savedContent.current = toSave;
      setSaveState(historyRef.current.value === toSave ? 'saved' : 'unsaved');
    } catch (e) {
      if (isApiError(e, 'conflict')) {
        // Someone else saved first: show their version. The undo history starts again from it.
        const latest = await api.getDesign(initial.id).catch(() => null);
        if (latest) {
          const fresh = normalizeContent(latest.content);
          version.current = latest.version;
          savedContent.current = fresh;
          history.reset(fresh);
          setSize({ width: latest.width, height: latest.height });
          setTitle(latest.title);
          setSaveState('saved');
          toast(`${latest.updatedBy?.name ?? 'Someone'} changed this design, so it was updated to their latest version.`);
        }
      } else if (isApiError(e, 'unauthorized')) {
        setSaveState('offline');
        toast('Your session ended. Sign in again to keep saving; your changes stay here until then.', { tone: 'error' });
      } else {
        setSaveState('offline');
      }
    } finally {
      saving.current = false;
    }
  }, [initial.id, readOnly, history, toast]);

  useEffect(() => {
    if (readOnly || content === savedContent.current) return;
    setSaveState((s) => (s === 'offline' ? s : 'unsaved'));
    const t = window.setTimeout(() => void save(), SAVE_DELAY);
    return () => window.clearTimeout(t);
  }, [content, readOnly, save]);

  // Offline or failed: keep retrying quietly.
  useEffect(() => {
    if (saveState !== 'offline') return;
    const t = window.setInterval(() => void save(), 5000);
    return () => window.clearInterval(t);
  }, [saveState, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (historyRef.current.value !== savedContent.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const commitTitle = async () => {
    const next = title.trim();
    if (!next || next === initial.title) {
      if (!next) setTitle(initial.title);
      return;
    }
    try {
      await api.renameDesign(initial.id, next);
      initial.title = next;
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  // ------------------------------------------------------------------ changing the page

  const mapPage = useCallback(
    (fn: (p: Page) => Page) => (c: DesignContent) => ({ ...c, pages: c.pages.map((p) => (p.id === page.id ? fn(p) : p)) }),
    [page.id],
  );
  const changePage = (fn: (p: Page) => Page) => history.change(mapPage(fn));

  const changeElements = (ids: string[], changes: Partial<DesignElement> | ((el: DesignElement) => DesignElement)) =>
    changePage((p) => ({
      ...p,
      elements: p.elements.map((el) => (ids.includes(el.id) ? (typeof changes === 'function' ? changes(el) : ({ ...el, ...changes } as DesignElement)) : el)),
    }));

  const add = (el: DesignElement) => {
    if (readOnly) return;
    changePage((p) => ({ ...p, elements: [...p.elements, el] }));
    setSelection([el.id]);
    if (narrow) setPanelOpen(false);
  };

  const remove = () => {
    if (!selection.length || readOnly) return;
    const removable = selected.filter((el) => !el.locked).map((el) => el.id);
    if (!removable.length) return;
    changePage((p) => ({ ...p, elements: p.elements.filter((el) => !removable.includes(el.id)) }));
    setSelection([]);
  };

  const duplicate = () => {
    if (!selected.length || readOnly) return;
    const copies = selected.map((el) => cloneElement(el, 24));
    changePage((p) => ({ ...p, elements: [...p.elements, ...copies] }));
    setSelection(copies.map((c) => c.id));
  };

  const paste = () => {
    if (!clipboard.current.length || readOnly) return;
    const copies = clipboard.current.map((el) => cloneElement(el, 24));
    clipboard.current = copies;
    changePage((p) => ({ ...p, elements: [...p.elements, ...copies] }));
    setSelection(copies.map((c) => c.id));
  };

  const arrange = (how: Arrange) =>
    changePage((p) => {
      const els = [...p.elements];
      const ids = new Set(selection);
      if (how === 'front') return { ...p, elements: [...els.filter((e) => !ids.has(e.id)), ...els.filter((e) => ids.has(e.id))] };
      if (how === 'back') return { ...p, elements: [...els.filter((e) => ids.has(e.id)), ...els.filter((e) => !ids.has(e.id))] };
      const order = how === 'forward' ? [...els.keys()].reverse() : [...els.keys()];
      for (const i of order) {
        const j = how === 'forward' ? i + 1 : i - 1;
        if (ids.has(els[i].id) && j >= 0 && j < els.length && !ids.has(els[j].id)) [els[i], els[j]] = [els[j], els[i]];
      }
      return { ...p, elements: els };
    });

  const align = (how: Align) => {
    const target = selected.length > 1 ? unionBox(selected.map(bounds))! : { x: 0, y: 0, w: size.width, h: size.height };
    changeElements(
      selected.filter((el) => !el.locked).map((el) => el.id),
      (el) => {
        const b = bounds(el);
        const dx = how === 'left' ? target.x - b.x : how === 'right' ? target.x + target.w - (b.x + b.w) : how === 'hcenter' ? target.x + target.w / 2 - (b.x + b.w / 2) : 0;
        const dy = how === 'top' ? target.y - b.y : how === 'bottom' ? target.y + target.h - (b.y + b.h) : how === 'vcenter' ? target.y + target.h / 2 - (b.y + b.h / 2) : 0;
        return { ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) };
      },
    );
  };

  const distribute = (axis: 'x' | 'y') => {
    const items = selected.filter((el) => !el.locked).map((el) => ({ el, b: bounds(el) }));
    if (items.length < 3) return;
    items.sort((a, b) => (axis === 'x' ? a.b.x - b.b.x : a.b.y - b.b.y));
    const first = items[0].b;
    const last = items[items.length - 1].b;
    const total = items.reduce((s, i) => s + (axis === 'x' ? i.b.w : i.b.h), 0);
    const span = axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y;
    const gap = (span - total) / (items.length - 1);
    let at = axis === 'x' ? first.x : first.y;
    const moves = new Map<string, number>();
    for (const i of items) {
      moves.set(i.el.id, at - (axis === 'x' ? i.b.x : i.b.y));
      at += (axis === 'x' ? i.b.w : i.b.h) + gap;
    }
    changeElements([...moves.keys()], (el) => (axis === 'x' ? { ...el, x: Math.round(el.x + moves.get(el.id)!) } : { ...el, y: Math.round(el.y + moves.get(el.id)!) }));
  };

  const nudge = (dx: number, dy: number) => changeElements(selected.filter((el) => !el.locked).map((el) => el.id), (el) => ({ ...el, x: el.x + dx, y: el.y + dy }));

  // ------------------------------------------------------------------ pages

  const addPage = () => {
    const p = newPage(page.background);
    history.change((c) => ({ ...c, pages: [...c.pages.slice(0, pageIndex + 1), p, ...c.pages.slice(pageIndex + 1)] }));
    setPageIndex(pageIndex + 1);
    setSelection([]);
  };
  const duplicatePage = (i: number) => {
    history.change((c) => ({ ...c, pages: [...c.pages.slice(0, i + 1), clonePage(c.pages[i]), ...c.pages.slice(i + 1)] }));
    setPageIndex(i + 1);
  };
  const deletePage = (i: number) => {
    if (content.pages.length === 1) return;
    history.change((c) => ({ ...c, pages: c.pages.filter((_, j) => j !== i) }));
    setPageIndex(Math.max(0, i - (i <= pageIndex ? 1 : 0)));
    setSelection([]);
  };
  const movePage = (i: number, by: 1 | -1) => {
    const j = i + by;
    if (j < 0 || j >= content.pages.length) return;
    history.change((c) => {
      const pages = [...c.pages];
      [pages[i], pages[j]] = [pages[j], pages[i]];
      return { ...c, pages };
    });
    if (pageIndex === i) setPageIndex(j);
  };

  const resize = async (width: number, height: number) => {
    try {
      await api.resizeDesign(initial.id, width, height);
      setSize({ width, height });
      setZoomMode('fit');
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  // ------------------------------------------------------------------ pictures

  const imageSize = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve({ width: 800, height: 600 });
      img.src = url;
    });

  const insertImages = async (files: File[], at?: { x: number; y: number }) => {
    for (const file of files) {
      try {
        const [src, natural] = await Promise.all([api.uploadImage(initial.id, file), imageSize(file)]);
        if (replaceRef.current) {
          const id = replaceRef.current;
          replaceRef.current = null;
          changeElements([id], (el) => (el.type === 'image' ? { ...el, src } : el));
          continue;
        }
        const el = newImage(size, src, natural);
        if (at) {
          el.x = Math.round(at.x - el.w / 2);
          el.y = Math.round(at.y - el.h / 2);
        }
        add(el);
      } catch (e) {
        toast(errorMessage(e), { tone: 'error' });
      }
    }
  };

  // Pasting a picture from the clipboard puts it on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (readOnly || (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        void insertImages(files);
      } else if (clipboard.current.length) {
        e.preventDefault();
        paste();
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // ------------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (presenting || editingId) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], dialog[open]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        history.redo();
      } else if (mod && k === 'a') {
        e.preventDefault();
        setSelection(page.elements.filter((el) => !el.locked && !el.hidden).map((el) => el.id));
      } else if (mod && k === 'c') {
        if (selected.length) clipboard.current = selected.map((el) => structuredClone(el));
      } else if (mod && k === 'x') {
        if (selected.length) {
          clipboard.current = selected.map((el) => structuredClone(el));
          remove();
        }
      } else if (mod && k === 'd') {
        e.preventDefault();
        duplicate();
      } else if (mod && k === 's') {
        e.preventDefault();
        void save();
      } else if (k === 'delete' || k === 'backspace') {
        if (selected.length) {
          e.preventDefault();
          remove();
        }
      } else if (k === 'escape') {
        setSelection([]);
      } else if (k === 'enter' && selected.length === 1 && selected[0].type === 'text' && !readOnly) {
        e.preventDefault();
        setEditingId(selected[0].id);
      } else if (k.startsWith('arrow') && selected.length && !readOnly) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0);
      } else if (k === 't' && !mod && !readOnly) {
        add(newText(size));
      } else if (k === 'r' && !mod && !readOnly) {
        add(newShape(size, 'rect'));
      } else if (k === 'o' && !mod && !readOnly) {
        add(newShape(size, 'ellipse'));
      } else if (k === 'l' && !mod && !readOnly) {
        add(newLine(size));
      } else if (k === 'pagedown' || (k === ']' && mod)) {
        setPageIndex((i) => Math.min(content.pages.length - 1, i + 1));
      } else if (k === 'pageup' || (k === '[' && mod)) {
        setPageIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------------ exports

  const runExport = async (kind: 'png' | 'pdf') => {
    setExporting(true);
    try {
      if (kind === 'png') await exportPng(page, size.width, size.height, `${safeFilename(title)}${content.pages.length > 1 ? ` - page ${pageIndex + 1}` : ''}`);
      else await exportPdf(content.pages, size.width, size.height, safeFilename(title));
    } catch {
      toast('That export did not work. Try again, or try a smaller design.', { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  // ------------------------------------------------------------------ layout

  const insertTools = (
    <div className="editor__insert" role="toolbar" aria-label="Add to the page">
      <Menu
        label="Add text"
        items={[
          { label: 'Title', labelStyle: { fontWeight: 700, fontSize: 18 }, onSelect: () => add(newText(size, 'title')) },
          { label: 'Heading', labelStyle: { fontWeight: 700 }, onSelect: () => add(newText(size, 'heading')) },
          { label: 'Body text', shortcut: 'T', onSelect: () => add(newText(size, 'body')) },
        ]}
        trigger={(props) => (
          <button type="button" className="tool" data-tip="Text" disabled={readOnly} {...props}>
            <Type {...ICON} />
            <span className="tool__label">Text</span>
          </button>
        )}
      />
      <Menu
        label="Add a shape"
        items={[
          { label: 'Rectangle', shortcut: 'R', icon: <Square size={16} strokeWidth={1.75} />, onSelect: () => add(newShape(size, 'rect')) },
          { label: 'Circle', shortcut: 'O', icon: <Circle size={16} strokeWidth={1.75} />, onSelect: () => add(newShape(size, 'ellipse')) },
          { label: 'Triangle', icon: <Triangle size={16} strokeWidth={1.75} />, onSelect: () => add(newShape(size, 'triangle')) },
          { label: 'Star', icon: <Star size={16} strokeWidth={1.75} />, onSelect: () => add(newShape(size, 'star')) },
          'separator',
          { label: 'Line', shortcut: 'L', icon: <Slash size={16} strokeWidth={1.75} />, onSelect: () => add(newLine(size)) },
          { label: 'Arrow', icon: <MoveRight size={16} strokeWidth={1.75} />, onSelect: () => add(newLine(size, true)) },
        ]}
        trigger={(props) => (
          <button type="button" className="tool" data-tip="Shapes" disabled={readOnly} {...props}>
            <Square {...ICON} />
            <span className="tool__label">Shapes</span>
          </button>
        )}
      />
      <button type="button" className="tool" data-tip="Picture" disabled={readOnly} onClick={() => fileRef.current?.click()}>
        <ImageIcon {...ICON} />
        <span className="tool__label">Picture</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void insertImages(files);
        }}
      />
    </div>
  );

  const side = (
    <aside className="editor__side" data-open={panelOpen || undefined} aria-label="Design panel">
      <div className="segmented editor__tabs" role="group" aria-label="Panel">
        <button type="button" aria-pressed={panel === 'design'} onClick={() => setPanel('design')}>
          {selected.length ? 'Edit' : 'Page'}
        </button>
        <button type="button" aria-pressed={panel === 'layers'} onClick={() => setPanel('layers')}>
          <Layers size={14} strokeWidth={1.75} /> Layers
        </button>
      </div>
      {panel === 'design' ? (
        <Inspector
          page={page}
          width={size.width}
          height={size.height}
          selected={selected}
          readOnly={readOnly}
          onChange={changeElements}
          onPage={(changes) => changePage((p) => ({ ...p, ...changes }))}
          onResize={(w, h) => void resize(w, h)}
          onArrange={arrange}
          onAlign={align}
          onDistribute={distribute}
          onDuplicate={duplicate}
          onDelete={remove}
          onReplaceImage={() => {
            replaceRef.current = selected[0]?.id ?? null;
            fileRef.current?.click();
          }}
        />
      ) : (
        <LayersPanel
          page={page}
          selection={selection}
          readOnly={readOnly}
          onSelect={setSelection}
          onToggle={(id, key) => changeElements([id], (el) => ({ ...el, [key]: !el[key] }))}
          onMove={(id, by) =>
            changePage((p) => {
              const els = [...p.elements];
              const i = els.findIndex((e) => e.id === id);
              const j = i + by;
              if (i < 0 || j < 0 || j >= els.length) return p;
              [els[i], els[j]] = [els[j], els[i]];
              return { ...p, elements: els };
            })
          }
        />
      )}
    </aside>
  );

  return (
    <div className="editor">
      <header className="editor__bar">
        <Link to="/" className="icon-btn" aria-label="Your designs" data-tip="Your designs">
          <ArrowLeft {...ICON} />
        </Link>
        <DesignIcon size={26} />
        <input
          className="editor__title"
          aria-label="Design name"
          value={title}
          maxLength={200}
          readOnly={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="editor__status" data-state={saveState} aria-live="polite">
          {readOnly ? 'View only' : saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Edited' : saveState === 'offline' ? (
            <>
              <CloudOff size={14} strokeWidth={1.75} aria-hidden="true" /> Not saved, retrying
            </>
          ) : 'Saved'}
        </span>
        {!narrow && insertTools}
        <div className="editor__bar-end">
          <button type="button" className="icon-btn" aria-label="Undo (Ctrl+Z)" data-tip="Undo" disabled={!history.canUndo || readOnly} onClick={history.undo}>
            <Undo2 {...ICON} />
          </button>
          <button type="button" className="icon-btn" aria-label="Redo (Ctrl+Shift+Z)" data-tip="Redo" disabled={!history.canRedo || readOnly} onClick={history.redo}>
            <Redo2 {...ICON} />
          </button>
          <Menu
            label="Download"
            placement="bottom-end"
            items={[
              { label: 'This page as PNG', onSelect: () => void runExport('png') },
              { label: `All ${content.pages.length} ${content.pages.length === 1 ? 'page' : 'pages'} as PDF`, onSelect: () => void runExport('pdf') },
            ]}
            trigger={(props) => (
              <button type="button" className="icon-btn" aria-label="Download" data-tip="Download" disabled={exporting} {...props}>
                <Download {...ICON} />
              </button>
            )}
          />
          <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm editor__present" onClick={() => setPresenting(true)}>
            <Play size={16} strokeWidth={1.75} /> <span>Present</span>
          </button>
          <button type="button" className="elum-btn elum-btn--primary elum-btn--sm" onClick={() => setSharing(true)}>
            <ShareIcon size={17} strokeWidth={1.85} /> <span className="editor__share-label">Share</span>
          </button>
          {!narrow && <ElumLauncher />}
          {!narrow && <NotificationBell />}
          <UserMenu />
        </div>
      </header>

      <div className="editor__body">
        {!narrow && (
          <PagesStrip
            pages={content.pages}
            current={pageIndex}
            width={size.width}
            height={size.height}
            readOnly={readOnly}
            onPick={(i) => {
              setPageIndex(i);
              setSelection([]);
            }}
            onAdd={addPage}
            onDuplicate={duplicatePage}
            onDelete={deletePage}
            onMove={movePage}
          />
        )}

        <main className="editor__main">
          <div className="editor__area" ref={areaRef} onPointerDown={(e) => e.target === e.currentTarget && setSelection([])}>
            <Canvas
              page={page}
              width={size.width}
              height={size.height}
              zoom={zoom}
              selection={selection}
              readOnly={readOnly}
              editingId={editingId}
              onSelect={setSelection}
              onEditText={setEditingId}
              onPreview={(fn) => history.preview(mapPage(fn))}
              onCommit={history.commit}
              onDropFiles={(files, at) => void insertImages(files, at)}
            />
          </div>
          <div className="editor__foot">
            {narrow ? (
              <>
                <button type="button" className="icon-btn" aria-label="Previous page" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>
                  <ArrowLeft {...ICON} />
                </button>
                <span className="editor__page-count">
                  {pageIndex + 1} / {content.pages.length}
                </span>
                <button type="button" className="icon-btn" aria-label="Next page" disabled={pageIndex === content.pages.length - 1} onClick={() => setPageIndex(pageIndex + 1)}>
                  <ArrowRight {...ICON} />
                </button>
                {!readOnly && (
                  <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" onClick={addPage}>
                    Add page
                  </button>
                )}
              </>
            ) : (
              <span className="muted editor__hint">
                {selected.length === 1 && selected[0].type === 'text' ? 'Double-click or press Enter to type. ' : ''}Shift keeps lines straight; hold Alt to move without snapping.
              </span>
            )}
            <span className="editor__zoom">
              <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => setZoomMode(Math.max(0.05, Math.round((zoom / 1.25) * 100) / 100))}>
                <ZoomOut size={16} strokeWidth={1.75} />
              </button>
              <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" aria-label="Fit the page" onClick={() => setZoomMode('fit')} aria-pressed={zoomMode === 'fit'}>
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => setZoomMode(Math.min(4, Math.round(zoom * 1.25 * 100) / 100))}>
                <ZoomIn size={16} strokeWidth={1.75} />
              </button>
            </span>
          </div>
        </main>

        {(!narrow || panelOpen) && side}
      </div>

      {narrow && (
        <nav className="editor__dock" aria-label="Tools">
          {insertTools}
          <button type="button" className="tool" aria-pressed={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
            <PanelRight {...ICON} />
            <span className="tool__label">{selected.length ? 'Edit' : 'Page'}</span>
          </button>
          {selected.length > 0 && !readOnly && (
            <button type="button" className="tool" onClick={remove}>
              <Minus {...ICON} />
              <span className="tool__label">Delete</span>
            </button>
          )}
        </nav>
      )}

      {presenting && <Present pages={content.pages} start={pageIndex} width={size.width} height={size.height} onClose={() => setPresenting(false)} />}
      <ShareDialog open={sharing} onClose={() => setSharing(false)} designId={initial.id} title={title} role={initial.role} owner={initial.owner} />
      {exporting && (
        <div className="editor__exporting" role="status">
          Preparing your download…
        </div>
      )}
      {/* Never leave a stale title in the tab. */}
      <TitleSync title={title} />
    </div>
  );
}

function TitleSync({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title || 'Untitled design'} · ELUM Make`;
    return () => {
      document.title = 'ELUM Make';
    };
  }, [title]);
  return null;
}
