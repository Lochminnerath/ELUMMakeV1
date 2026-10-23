import { History, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api, errorMessage, type DesignVersion } from '../api';
import { Avatar } from '../components/Avatar';
import { Dialog } from '../components/Dialog';
import { formatFull, formatWhen } from '../lib/time';
import { normalizeContent } from './model';
import { PageView } from './render';

/** Earlier versions of the design: look through them and put one back. */
export function HistoryPanel({
  designId,
  width,
  height,
  readOnly,
  currentVersion,
  onRestore,
}: {
  designId: string;
  width: number;
  height: number;
  readOnly: boolean;
  /** The version open now; the list loads again when it changes. */
  currentVersion: number;
  /** Puts this version back. Resolves once it is open in the editor. */
  onRestore(version: DesignVersion): Promise<void>;
}) {
  const [versions, setVersions] = useState<DesignVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<DesignVersion | null>(null);
  const [confirming, setConfirming] = useState<DesignVersion | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await api.versionHistory(designId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [designId]);

  useEffect(() => {
    void load();
  }, [load, currentVersion]);

  const restore = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await onRestore(confirming);
      setConfirming(null);
      setPicked(null);
      void load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="side-panel">
      <div className="side-panel__head">
        <h3 className="side-panel__title">Version history</h3>
        <p className="side-panel__sub muted">A version is kept every couple of minutes while you work, the newest 50.</p>
      </div>

      {error ? (
        <div className="side-panel__empty" role="alert">
          <p>{error}</p>
          <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : versions === null ? (
        <ul className="versions" aria-busy="true" aria-label="Loading versions">
          {[0, 1, 2].map((i) => (
            <li key={i} className="version version--skeleton">
              <span className="version__thumb skeleton" style={{ aspectRatio: `${width} / ${height}` }} />
              <span className="version__text">
                <span className="skeleton skeleton--line" />
                <span className="skeleton skeleton--line skeleton--short" />
              </span>
            </li>
          ))}
        </ul>
      ) : versions.length === 0 ? (
        <div className="side-panel__empty">
          <History size={32} strokeWidth={1.5} aria-hidden="true" />
          <p>No earlier versions yet. Keep working and they will start to appear here.</p>
        </div>
      ) : (
        <ul className="versions">
          <li className="version version--now">
            <span className="version__now-dot" aria-hidden="true" />
            <span className="version__text">
              <span className="version__when">
                Now <span className="version__badge">Current</span>
              </span>
              <span className="version__who muted">What is on the page, saved as you work</span>
            </span>
          </li>
          {versions.map((v, i) => {
            const open = picked?.version === v.version;
            return (
              <li key={v.version} className="version stagger" style={{ '--i': i } as CSSProperties} data-open={open || undefined}>
                <button type="button" className="version__pick" aria-expanded={open} onClick={() => setPicked(open ? null : v)}>
                  <span className="version__thumb" style={{ aspectRatio: `${width} / ${height}` }}>
                    {v.preview ? <PageView page={normalizeContent({ pages: [v.preview] }).pages[0]} width={width} height={height} className="version__svg" /> : null}
                  </span>
                  <span className="version__text">
                    <span className="version__when" title={formatFull(v.savedAt)}>
                      {formatWhen(v.savedAt)}
                    </span>
                    <span className="version__who muted">
                      {v.savedBy && <Avatar user={v.savedBy} size={16} />}
                      {v.savedBy?.name ?? 'Someone'}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="version__detail">
                    <span className="version__preview" style={{ aspectRatio: `${width} / ${height}` }}>
                      {v.preview && <PageView page={normalizeContent({ pages: [v.preview] }).pages[0]} width={width} height={height} className="version__svg" label={`First page of the version from ${formatFull(v.savedAt)}`} />}
                    </span>
                    <p className="muted version__note">“{v.title}”, as saved {formatFull(v.savedAt)}. The preview shows its first page.</p>
                    {!readOnly && (
                      <button type="button" className="elum-btn elum-btn--primary elum-btn--sm" onClick={() => setConfirming(v)}>
                        <RotateCcw size={15} strokeWidth={1.75} /> Restore this version
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!confirming}
        onClose={() => !busy && setConfirming(null)}
        title="Restore this version?"
        description={
          confirming
            ? `The design goes back to how it was ${formatWhen(confirming.savedAt).toLowerCase() === 'just now' ? 'just now' : `on ${formatFull(confirming.savedAt)}`}. Nothing is lost: what you have now stays in the history, and you can undo straight after.`
            : undefined
        }
        width={440}
        footer={
          <>
            <button type="button" className="elum-btn elum-btn--secondary" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="elum-btn elum-btn--primary" onClick={() => void restore()} disabled={busy}>
              {busy ? 'Restoring…' : 'Restore'}
            </button>
          </>
        }
      />
    </div>
  );
}
