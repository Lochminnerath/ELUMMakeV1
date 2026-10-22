import { ArrowLeft, ArrowRight, Circle, History, Image as ImageIcon, Layers, LayoutTemplate, MessageCircle, Minus, MoreHorizontal, MoveRight, Palette, PanelRight, Redo2, SlidersHorizontal, Slash, Square, Star, Triangle, Type, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { OfflineIcon, PresentIcon } from '../components/icons/ElumIcons';
import { DownloadIcon } from '../components/icons/ElumIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, errorMessage, isApiError, type BrandKit, type Comment, type Design, type DesignContent, type DesignElement, type DesignVersion, type Page } from '../api';
import { DesignIcon } from '../components/Brand';
import { Loader } from '../components/Loader';
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
import { alignElements, applyKitToPage, cloneElement, clonePage, copyStyle, distributeElements, expandGroups, groupElements, isOneGroup, newImage, newLine, newPage, newShape, newText, normalizeContent, pasteStyle, ungroupElements, type Style } from './model';
import { BrandPanel } from './BrandPanel';
import { CommentsPanel, numberPins, type PinSpot } from './CommentsPanel';
import { HistoryPanel } from './HistoryPanel';
import { KitContext, rememberedKit, rememberKit, toActiveKit } from './kit';
import { SaveTemplateDialog } from './SaveTemplateDialog';
import { PagesStrip } from './PagesStrip';
import { Present } from './Present';
import { ShareDialog } from './ShareDialog';
import { ShareIcon } from '../components/ShareIcon';
import './editor.css';
import { ElumLauncher } from '../components/ElumLauncher';
import { useFavicon } from '../lib/favicon';
import { SupportLinks } from '../components/SupportLink';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'offline';
const SAVE_DELAY = 900;
const ICON = { size: 18, strokeWidth: 1.75 };

type PanelId = 'design' | 'layers' | 'comments' | 'history' | 'brand';
const PANELS: { id: PanelId; label: string; icon: typeof Layers }[] = [
  { id: 'design', label: 'Edit', icon: SlidersHorizontal },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'brand', label: 'Brand', icon: Palette },
];

export default function EditorPage() {
  const { designId = '' } = useParams();
  useFavicon('/favicons/design.svg');
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
        <SupportLinks app="make" code="open-failed" message={error} />
      </div>
    );
  }
  if (!design) return <EditorSkeleton />;
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
  const [panel, setPanel] = useState<PanelId>(() => {
    const asked = new URLSearchParams(window.location.search).get('panel');
    return PANELS.some((p) => p.id === asked) ? (asked as PanelId) : 'design';
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [fitZoom, setFitZoom] = useState(0.4);
  const [presenting, setPresenting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [exporting, setExporting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(initial.version);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<PinSpot | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [kitsError, setKitsError] = useState<string | null>(null);
  const [kitId, setKitId] = useState<string | null>(rememberedKit);
  const [styleClip, setStyleClip] = useState<Style | null>(null);
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

  /** Selecting part of a group selects the whole group; letting go of part lets go of all of it. */
  const select = (ids: string[]) => {
    const removed = new Set(page.elements.filter((el) => selection.includes(el.id) && !ids.includes(el.id) && el.groupId).map((el) => el.groupId));
    const kept = ids.filter((id) => {
      const el = page.elements.find((x) => x.id === id);
      return !el?.groupId || !removed.has(el.groupId);
    });
    setSelection(expandGroups(page.elements, kept));
  };
  const grouped = isOneGroup(page.elements, selection);

  // ------------------------------------------------------------------ comments, kits

  const loadComments = useCallback(async () => {
    try {
      setComments(await api.comments(initial.id));
      setCommentsError(null);
    } catch (e) {
      setCommentsError(errorMessage(e));
    }
  }, [initial.id]);
  useEffect(() => {
    void loadComments();
    // Others' comments arrive while the panel is open.
    if (panel !== 'comments') return;
    const t = window.setInterval(() => void loadComments(), 30_000);
    return () => window.clearInterval(t);
  }, [loadComments, panel]);

  const loadKits = useCallback(async () => {
    try {
      setKits(await api.brandKits());
      setKitsError(null);
    } catch (e) {
      setKits([]);
      setKitsError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void loadKits();
  }, [loadKits]);
  const kit = useMemo(() => {
    const k = kits?.find((x) => x.id === kitId);
    return k ? toActiveKit(k) : null;
  }, [kits, kitId]);
  const pickKit = (id: string | null) => {
    setKitId(id);
    rememberKit(id);
  };

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
      toast(errorMessage(e), { tone: 'error', cause: e, code: 'design-failed' });
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

  const replaceSelected = (next: DesignElement[]) => {
    const byId = new Map(next.map((el) => [el.id, el]));
    changePage((p) => ({ ...p, elements: p.elements.map((el) => byId.get(el.id) ?? el) }));
  };
  const align = (how: Align) => replaceSelected(alignElements(selected, how, size));
  const distribute = (axis: 'x' | 'y') => replaceSelected(distributeElements(selected, axis));

  const group = () => {
    if (readOnly || selection.length < 2) return;
    changePage((p) => groupElements(p, selection));
  };
  const ungroup = () => {
    if (readOnly) return;
    changePage((p) => ungroupElements(p, selection));
  };
  const takeStyle = () => {
    if (!selected[0]) return;
    setStyleClip(copyStyle(selected[0]));
    toast('Style copied. Select something and paste it on.');
  };
  const putStyle = () => {
    if (!styleClip || readOnly || !selected.length) return;
    changeElements(selection, (el) => (el.locked ? el : pasteStyle(el, styleClip)));
  };
  const applyKit = () => {
    if (!kit || readOnly) return;
    changePage((p) => applyKitToPage(p, kit));
    toast(`${kit.name} applied to this page. Undo puts it back.`, { action: { label: 'Undo', onClick: () => historyRef.current.undo() } });
  };

  const nudge = (dx: number, dy: number) => changeElements(selected.filter((el) => !el.locked).map((el) => el.id), (el) => ({ ...el, x: el.x + dx, y: el.y + dy }));

  // ------------------------------------------------------------------ restoring a version

  const restoreVersion = async (v: DesignVersion) => {
    // Keep what is on screen first, so it is the version restoring replaces.
    await save();
    const before = version.current;
    try {
      await api.restoreVersion(initial.id, v.version);
      await reload();
      toast('That version is back. What you had is kept in the history.', {
        tone: 'success',
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () =>
            void api
              .restoreVersion(initial.id, before)
              .then(reload)
              .catch((e) => toast(errorMessage(e), { tone: 'error', cause: e, code: 'design-failed' })),
        },
      });
    } catch (e) {
      toast(errorMessage(e), { tone: 'error', cause: e, code: 'design-failed' });
      throw e;
    }
  };

  const reload = async () => {
    const latest = await api.getDesign(initial.id);
    const fresh = normalizeContent(latest.content);
    version.current = latest.version;
    savedContent.current = fresh;
    history.reset(fresh);
    setCurrentVersion(latest.version);
    setSize({ width: latest.width, height: latest.height });
    setTitle(latest.title);
    setSelection([]);
    setSaveState('saved');
  };

  // ------------------------------------------------------------------ comments

  const addComment = async (body: string, parentId?: string, position?: PinSpot) => {
    const made = await api.addComment(initial.id, body, parentId, position);
    if (position) {
      setPendingPin(null);
      setOpenComment(made.id);
    }
    await loadComments();
  };
  const resolveComment = async (id: string, resolved: boolean) => {
    try {
      await api.resolveComment(id, resolved);
      setComments((list) => list?.map((c) => (c.id === id ? { ...c, resolved } : c)) ?? null);
      if (resolved) toast('Resolved. You will find it under Resolved.', { action: { label: 'Reopen', onClick: () => void resolveComment(id, false) } });
    } catch (e) {
      toast(errorMessage(e), { tone: 'error', cause: e, code: 'design-failed' });
    }
  };
  const pinNumbers = useMemo(() => numberPins(comments ?? []), [comments]);
  const pins = useMemo(() => {
    const list = (comments ?? [])
      .filter((c) => c.position && c.position.page === pageIndex && (!c.resolved || c.id === openComment))
      .map((c) => ({ id: c.id, n: pinNumbers.get(c.id) ?? '', x: c.position!.x, y: c.position!.y, resolved: c.resolved, active: c.id === openComment }));
    if (pendingPin && pendingPin.page === pageIndex) list.push({ id: 'pending', n: '+', x: pendingPin.x, y: pendingPin.y, resolved: false, active: true, pending: true } as (typeof list)[number]);
    return list;
  }, [comments, pageIndex, openComment, pendingPin, pinNumbers]);
  const openPanel = (id: PanelId) => {
    setPanel(id);
    if (narrow) setPanelOpen(true);
  };

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
      toast(errorMessage(e), { tone: 'error', cause: e, code: 'design-failed' });
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
        toast(errorMessage(e), { tone: 'error', cause: e, code: 'design-failed' });
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
      } else if (mod && k === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroup();
        else group();
      } else if (mod && e.altKey && k === 'c') {
        e.preventDefault();
        takeStyle();
      } else if (mod && e.altKey && k === 'v') {
        e.preventDefault();
        putStyle();
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
        if (pinMode || pendingPin) {
          setPinMode(false);
          setPendingPin(null);
        } else setSelection([]);
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
      <div className="editor__tabs" role="tablist" aria-label="Panel">
        {PANELS.map(({ id, label, icon: Icon }) => {
          const count = id === 'comments' ? (comments ?? []).filter((c) => !c.resolved).length : 0;
          return (
            <button key={id} type="button" role="tab" className="editor__tab" aria-selected={panel === id} data-tip={id === 'design' && !selected.length ? 'Page' : label} onClick={() => setPanel(id)}>
              <Icon size={17} strokeWidth={1.75} />
              <span className="editor__tab-label">{id === 'design' && !selected.length ? 'Page' : label}</span>
              {count > 0 && <span className="editor__tab-count">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="editor__panel" key={panel}>
      {panel === 'comments' ? (
        <CommentsPanel
          comments={comments}
          error={commentsError}
          pinMode={pinMode}
          pendingPin={pendingPin}
          openId={openComment}
          onPinMode={(on) => {
            setPinMode(on);
            if (on && narrow) setPanelOpen(false);
          }}
          onCancelPin={() => setPendingPin(null)}
          onOpen={(id) => {
            setOpenComment(id);
            const c = comments?.find((x) => x.id === id);
            if (c?.position && c.position.page !== pageIndex && c.position.page < content.pages.length) setPageIndex(c.position.page);
          }}
          onAdd={addComment}
          onResolve={resolveComment}
          onRetry={() => void loadComments()}
        />
      ) : panel === 'history' ? (
        <HistoryPanel designId={initial.id} width={size.width} height={size.height} readOnly={readOnly} currentVersion={currentVersion} onRestore={restoreVersion} />
      ) : panel === 'brand' ? (
        <BrandPanel
          kits={kits}
          error={kitsError}
          activeId={kit?.id ?? null}
          designId={initial.id}
          readOnly={readOnly}
          onPick={pickKit}
          onApply={applyKit}
          onAddLogo={(src) => {
            const img = new Image();
            const place = (w: number, h: number) => {
              const el = newImage(size, src, { width: w, height: h });
              const scale = Math.min(1, (size.width * 0.18) / el.w);
              add({ ...el, w: Math.round(el.w * scale), h: Math.round(el.h * scale), x: Math.round(size.width * 0.05), y: Math.round(size.height * 0.05), fit: 'contain', name: 'Logo' });
            };
            void api.imageUrl(src).then((url) => {
              img.onload = () => place(img.naturalWidth || 400, img.naturalHeight || 200);
              img.onerror = () => place(400, 200);
              img.src = url;
            });
          }}
          onSaved={(k) => {
            setKits((list) => [k, ...(list ?? []).filter((x) => x.id !== k.id)]);
            pickKit(k.id);
          }}
          onRetry={() => void loadKits()}
        />
      ) : panel === 'design' ? (
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
          grouped={grouped}
          onGroup={group}
          onUngroup={ungroup}
          onCopyStyle={takeStyle}
          onPasteStyle={styleClip ? putStyle : undefined}
        />
      ) : (
        <LayersPanel
          page={page}
          selection={selection}
          readOnly={readOnly}
          onSelect={select}
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
      </div>
    </aside>
  );

  return (
    <KitContext.Provider value={kit}>
    <div className="editor route-in">
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
              <OfflineIcon size={14} strokeWidth={1.75} aria-hidden="true" /> Not saved, retrying
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
                <DownloadIcon {...ICON} />
              </button>
            )}
          />
          <Menu
            label="More"
            placement="bottom-end"
            items={[
              { label: 'Comments', icon: <MessageCircle size={16} strokeWidth={1.75} />, onSelect: () => openPanel('comments') },
              { label: 'Version history', icon: <History size={16} strokeWidth={1.75} />, onSelect: () => openPanel('history') },
              { label: 'Brand kits', icon: <Palette size={16} strokeWidth={1.75} />, onSelect: () => openPanel('brand') },
              'separator',
              { label: 'Save as a template…', icon: <LayoutTemplate size={16} strokeWidth={1.75} />, onSelect: () => {
                void save();
                setSavingTemplate(true);
              } },
            ]}
            trigger={(props) => (
              <button type="button" className="icon-btn" aria-label="More" data-tip="More" {...props}>
                <MoreHorizontal {...ICON} />
              </button>
            )}
          />
          <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm editor__present" onClick={() => setPresenting(true)}>
            <PresentIcon size={16} strokeWidth={1.75} /> <span>Present</span>
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
              onSelect={select}
              onEditText={setEditingId}
              onPreview={(fn) => history.preview(mapPage(fn))}
              onCommit={history.commit}
              onDropFiles={(files, at) => void insertImages(files, at)}
              pins={pins}
              pinMode={pinMode}
              onPlacePin={(at) => {
                setPinMode(false);
                setPendingPin({ page: pageIndex, ...at });
                openPanel('comments');
              }}
              onOpenPin={(id) => {
                setOpenComment(id);
                openPanel('comments');
              }}
            />
            {pinMode && (
              <div className="editor__pin-hint" role="status">
                Click the page where your comment goes.{' '}
                <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" onClick={() => setPinMode(false)}>
                  Cancel
                </button>
              </div>
            )}
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
      <SaveTemplateDialog
        design={savingTemplate ? { id: initial.id, title } : null}
        onClose={() => setSavingTemplate(false)}
        onSaved={(t) => toast(`Saved “${t.title}” to your templates. Find it on the home page.`, { tone: 'success' })}
      />
      <ShareDialog open={sharing} onClose={() => setSharing(false)} designId={initial.id} title={title} role={initial.role} owner={initial.owner} />
      {exporting && (
        <div className="editor__exporting" role="status">
          Preparing your download…
        </div>
      )}
      {/* Never leave a stale title in the tab. */}
      <TitleSync title={title} />
    </div>
    </KitContext.Provider>
  );
}

/** The editor's shape while the design opens, so the page does not jump when it arrives. */
function EditorSkeleton() {
  return (
    <div className="editor editor--loading" aria-busy="true">
      <header className="editor__bar">
        <span className="skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <span className="skeleton skeleton--line" style={{ width: 180 }} />
      </header>
      <div className="editor__body">
        <div className="editor__skeleton-strip">
          {[0, 1, 2].map((i) => (
            <span key={i} className="skeleton" style={{ aspectRatio: '16 / 10' }} />
          ))}
        </div>
        <main className="editor__main">
          <div className="editor__area">
            <div className="editor__skeleton-page skeleton">
              <Loader size={44} label="Opening your design" />
            </div>
          </div>
        </main>
      </div>
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
