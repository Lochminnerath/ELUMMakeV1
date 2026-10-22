import { Check, MapPin, MessageCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { errorMessage, type Comment } from '../api';
import { Avatar } from '../components/Avatar';
import { formatFull, formatWhen } from '../lib/time';

export type PinSpot = { page: number; x: number; y: number };

/** Conversations about the design: threads, replies, resolving, and pins on the page. */
export function CommentsPanel({
  comments,
  error,
  pinMode,
  pendingPin,
  openId,
  onPinMode,
  onCancelPin,
  onOpen,
  onAdd,
  onResolve,
  onRetry,
}: {
  comments: Comment[] | null;
  error: string | null;
  pinMode: boolean;
  /** A spot picked on the page, waiting for its comment. */
  pendingPin: PinSpot | null;
  openId: string | null;
  onPinMode(on: boolean): void;
  onCancelPin(): void;
  onOpen(id: string | null): void;
  onAdd(body: string, parentId?: string, position?: PinSpot): Promise<void>;
  onResolve(id: string, resolved: boolean): Promise<void>;
  onRetry(): void;
}) {
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const list = (comments ?? []).filter((c) => (show === 'open' ? !c.resolved : c.resolved));
  const openCount = (comments ?? []).filter((c) => !c.resolved).length;
  const resolvedCount = (comments ?? []).length - openCount;
  const pins = numberPins(comments ?? []);

  useEffect(() => {
    // Opening a thread from a pin shows it, even when it is resolved.
    const c = comments?.find((x) => x.id === openId);
    if (c) setShow(c.resolved ? 'resolved' : 'open');
  }, [openId, comments]);

  return (
    <div className="side-panel">
      <div className="side-panel__head">
        <h3 className="side-panel__title">Comments</h3>
        <Composer
          key={pendingPin ? `${pendingPin.page}:${pendingPin.x}:${pendingPin.y}` : 'new'}
          placeholder={pendingPin ? `Comment on this spot on page ${pendingPin.page + 1}` : 'Add a comment'}
          autoFocus={!!pendingPin}
          submitLabel="Comment"
          onSubmit={(body) => onAdd(body, undefined, pendingPin ?? undefined)}
          onCancel={pendingPin ? onCancelPin : undefined}
          extra={
            !pendingPin && (
              <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" aria-pressed={pinMode} onClick={() => onPinMode(!pinMode)}>
                <MapPin size={15} strokeWidth={1.75} /> {pinMode ? 'Click the page…' : 'Pin to a spot'}
              </button>
            )
          }
        />
        <div className="segmented" role="group" aria-label="Show comments">
          <button type="button" aria-pressed={show === 'open'} onClick={() => setShow('open')}>
            Open{openCount ? ` · ${openCount}` : ''}
          </button>
          <button type="button" aria-pressed={show === 'resolved'} onClick={() => setShow('resolved')}>
            Resolved{resolvedCount ? ` · ${resolvedCount}` : ''}
          </button>
        </div>
      </div>

      {error ? (
        <div className="side-panel__empty" role="alert">
          <p>{error}</p>
          <button type="button" className="elum-btn elum-btn--secondary elum-btn--sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : comments === null ? (
        <div className="threads" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="thread thread--skeleton">
              <span className="skeleton skeleton--line skeleton--short" />
              <span className="skeleton skeleton--line" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="side-panel__empty">
          <MessageCircle size={32} strokeWidth={1.5} aria-hidden="true" />
          <p>{show === 'open' ? 'No open comments. Start a conversation above, or pin one to a spot on the page.' : 'Nothing resolved yet.'}</p>
        </div>
      ) : (
        <ol className="threads">
          {list.map((c, i) => (
            <Thread key={c.id} comment={c} index={i} pin={pins.get(c.id)} open={openId === c.id} onOpen={onOpen} onAdd={onAdd} onResolve={onResolve} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** Pins numbered in the order they were made, so the number on the page matches the panel. */
export function numberPins(comments: Comment[]): Map<string, number> {
  const pinned = comments.filter((c) => c.position).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return new Map(pinned.map((c, i) => [c.id, i + 1]));
}

function Thread({
  comment,
  index,
  pin,
  open,
  onOpen,
  onAdd,
  onResolve,
}: {
  comment: Comment;
  index: number;
  pin?: number;
  open: boolean;
  onOpen(id: string | null): void;
  onAdd(body: string, parentId?: string): Promise<void>;
  onResolve(id: string, resolved: boolean): Promise<void>;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [replying, setReplying] = useState(false);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [open]);
  return (
    <li ref={ref} className="thread stagger" style={{ '--i': index } as CSSProperties} data-open={open || undefined} data-resolved={comment.resolved || undefined} onClick={() => onOpen(comment.id)}>
      <Message c={comment} pin={pin} />
      {comment.replies.map((r) => (
        <Message key={r.id} c={r} reply />
      ))}
      {replying ? (
        <Composer
          placeholder="Reply"
          autoFocus
          submitLabel="Reply"
          onSubmit={async (body) => {
            await onAdd(body, comment.id);
            setReplying(false);
          }}
          onCancel={() => setReplying(false)}
        />
      ) : (
        <div className="thread__actions">
          <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" onClick={() => setReplying(true)}>
            Reply
          </button>
          <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" onClick={() => void onResolve(comment.id, !comment.resolved)}>
            {comment.resolved ? (
              <>
                <RotateCcw size={14} strokeWidth={1.75} /> Reopen
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={1.75} /> Resolve
              </>
            )}
          </button>
        </div>
      )}
    </li>
  );
}

function Message({ c, pin, reply = false }: { c: Comment; pin?: number; reply?: boolean }) {
  return (
    <div className="message" data-reply={reply || undefined}>
      <Avatar user={c.user} size={reply ? 22 : 26} />
      <div className="message__main">
        <div className="message__head">
          <strong>{c.user.name}</strong>
          <span className="muted" title={formatFull(c.createdAt)}>
            {formatWhen(c.createdAt)}
          </span>
          {pin !== undefined && c.position && (
            <span className="message__pin" title={`Pinned on page ${c.position.page + 1}`}>
              <MapPin size={12} strokeWidth={2} /> {pin} · page {c.position.page + 1}
            </span>
          )}
        </div>
        <p className="message__body">{c.body}</p>
      </div>
    </div>
  );
}

function Composer({
  placeholder,
  submitLabel,
  autoFocus,
  onSubmit,
  onCancel,
  extra,
}: {
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit(body: string): Promise<void>;
  onCancel?: () => void;
  extra?: ReactNode;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      setBody('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="composer"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        className="textarea composer__input"
        rows={2}
        placeholder={placeholder}
        aria-label={placeholder}
        value={body}
        maxLength={4000}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape' && onCancel) onCancel();
        }}
      />
      {error && <span className="field-error">{error}</span>}
      <div className="composer__row">
        {extra}
        <span className="composer__gap" />
        {onCancel && (
          <button type="button" className="elum-btn elum-btn--quiet elum-btn--sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="elum-btn elum-btn--primary elum-btn--sm" disabled={!body.trim() || busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
