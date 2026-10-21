import { DesignIcon } from '../components/Brand';
import { Link2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage, type PublicUser, type Role, type Share, type ShareRole } from '../api';
import { Avatar } from '../components/Avatar';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toast';

/** Who can see and change a design, and adding people by their ELUM email. */
export function ShareDialog({ open, onClose, designId, title, role, owner }: { open: boolean; onClose(): void; designId: string; title: string; role: Role; owner: PublicUser | null }) {
  const toast = useToast();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<ShareRole>('editor');
  const [suggestions, setSuggestions] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canShare = role !== 'viewer';

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.listShares(designId).then(setShares, (e) => setError(errorMessage(e)));
  }, [open, designId]);

  useEffect(() => {
    const q = email.trim();
    if (!open || q.length < 2 || q.includes('@')) {
      setSuggestions([]);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => api.findPeople(q).then((p) => live && setSuggestions(p), () => undefined), 200);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [email, open]);

  const add = async (address = email) => {
    setBusy(true);
    setError(null);
    try {
      const share = await api.share(designId, address, newRole);
      setShares((list) => [...(list ?? []).filter((s) => s.id !== share.id), share]);
      setEmail('');
      setSuggestions([]);
      toast(`${share.name} can now ${share.role === 'viewer' ? 'view' : 'edit'} “${title}”.`, { tone: 'success' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const change = async (s: Share, next: ShareRole | 'remove') => {
    try {
      if (next === 'remove') {
        await api.unshare(designId, s.id);
        setShares((list) => list?.filter((x) => x.id !== s.id) ?? null);
      } else {
        const updated = await api.share(designId, s.email, next);
        setShares((list) => list?.map((x) => (x.id === s.id ? updated : x)) ?? null);
      }
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    }
  };

  const copyLink = async () => {
    const link = `${location.origin}/m/${designId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied. People need access to open it.', { tone: 'success' });
    } catch {
      toast(link);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share “${title}”`}
      icon={<DesignIcon size={26} />}
      description="People you add get a notification in every ELUM app, and the design appears in their Make."
      width={520}
      footer={
        <>
          <button type="button" className="elum-btn elum-btn--secondary" onClick={() => void copyLink()}>
            <Link2 size={16} strokeWidth={1.75} /> Copy link
          </button>
          <button type="button" className="elum-btn elum-btn--primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      {canShare && (
        <form
          className="share__add"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) void add();
          }}
        >
          <div className="share__field">
            <label htmlFor="share-email" className="visually-hidden">
              Email or name
            </label>
            <input
              id="share-email"
              className="input"
              placeholder="Add people by email or name"
              value={email}
              autoComplete="off"
              aria-invalid={!!error}
              onChange={(e) => setEmail(e.target.value)}
            />
            {suggestions.length > 0 && (
              <ul className="share__suggestions" role="listbox" aria-label="People">
                {suggestions.map((p) => (
                  <li key={p.id}>
                    <button type="button" role="option" aria-selected={false} className="share__suggestion" onClick={() => void add(p.email)}>
                      <Avatar user={p} size={24} />
                      <span>
                        {p.name} <span className="muted">{p.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select className="select share__role" aria-label="They can" value={newRole} onChange={(e) => setNewRole(e.target.value as ShareRole)}>
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button type="submit" className="elum-btn elum-btn--primary" disabled={busy || !email.trim()}>
            Share
          </button>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <ul className="share__people">
        {owner && (
          <li className="share__person">
            <Avatar user={owner} size={32} />
            <span className="share__who">
              <span className="share__name">{owner.name}</span>
              <span className="muted share__email">{owner.email}</span>
            </span>
            <span className="muted">Owner</span>
          </li>
        )}
        {shares === null && !error && <li className="muted">Loading…</li>}
        {shares?.map((s) => (
          <li key={s.id} className="share__person">
            <Avatar user={s} size={32} />
            <span className="share__who">
              <span className="share__name">{s.name}</span>
              <span className="muted share__email">{s.email}</span>
            </span>
            {canShare ? (
              <>
                <select className="select select--sm" aria-label={`What ${s.name} can do`} value={s.role} onChange={(e) => void change(s, e.target.value as ShareRole)}>
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button type="button" className="icon-btn" aria-label={`Remove ${s.name}`} data-tip="Remove" onClick={() => void change(s, 'remove')}>
                  <X size={16} strokeWidth={1.75} />
                </button>
              </>
            ) : (
              <span className="muted">{s.role === 'editor' ? 'Can edit' : 'Can view'}</span>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
