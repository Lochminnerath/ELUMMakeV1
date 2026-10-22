import { useEffect, useState } from 'react';
import { api, errorMessage, type DesignTemplate } from '../api';
import { Dialog } from '../components/Dialog';

/** Saves a design as one of your templates, to start new designs from. */
export function SaveTemplateDialog({ design, onClose, onSaved }: { design: { id: string; title: string } | null; onClose(): void; onSaved(t: DesignTemplate): void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (design) {
      setTitle(design.title);
      setDescription('');
      setError(null);
    }
  }, [design]);
  const save = async () => {
    if (!design || !title.trim()) return;
    setBusy(true);
    try {
      onSaved(await api.saveAsTemplate(design.id, title.trim(), description.trim() || undefined));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!design}
      onClose={() => !busy && onClose()}
      title="Save as a template"
      description="A copy of the design as it is now. It shows under Your templates on the home page, ready to start something new from."
      width={440}
      footer={
        <>
          <button type="button" className="elum-btn elum-btn--secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="save-template" className="elum-btn elum-btn--primary" disabled={busy || !title.trim()}>
            Save template
          </button>
        </>
      }
    >
      <form
        id="save-template"
        className="kit-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <label htmlFor="template-title">Name</label>
          <input id="template-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="template-description">What it is for (optional)</label>
          <input id="template-description" className="input" value={description} maxLength={300} placeholder="Like “Monthly update deck”" onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <span className="field-error">{error}</span>}
      </form>
    </Dialog>
  );
}
