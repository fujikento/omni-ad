'use client';

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NoteCellProps {
  /** YYYY-MM — passed back to onSave so the parent can keyed mutate. */
  month: string;
  /** Initial value from the listNotes query. */
  initialText: string;
  /** Called after 500ms of idle on blur or after an explicit commit. */
  onSave: (month: string, text: string) => void;
  /** When true, shows a subtle saving indicator. */
  saving?: boolean;
}

const DEBOUNCE_MS = 500;

/**
 * Inline contentEditable note cell. We intentionally avoid a heavier
 * rich-text control — analysts only need a single-line annotation per month.
 * Saving is debounced onInput and also triggered on blur.
 */
function NoteCellImpl({
  month,
  initialText,
  onSave,
  saving = false,
}: NoteCellProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Keep DOM in sync when the server value changes (but don't clobber edits).
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current === document.activeElement) return;
    if (ref.current.innerText !== initialText) {
      ref.current.innerText = initialText;
    }
  }, [initialText]);

  // Flash a "saved" tick after the mutation resolves.
  useEffect(() => {
    if (saving) return;
    if (!dirty) return;
    setJustSaved(true);
    setDirty(false);
    const t = setTimeout(() => setJustSaved(false), 1200);
    return () => clearTimeout(t);
  }, [saving, dirty]);

  const commit = useCallback(
    (text: string): void => {
      setDirty(true);
      onSave(month, text);
    },
    [month, onSave],
  );

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>): void => {
      if (timer.current) clearTimeout(timer.current);
      const text = e.currentTarget.innerText;
      timer.current = setTimeout(() => commit(text), DEBOUNCE_MS);
    },
    [commit],
  );

  const handleBlur = useCallback((): void => {
    if (timer.current) clearTimeout(timer.current);
    if (!ref.current) return;
    commit(ref.current.innerText);
  }, [commit]);

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <div
        ref={ref}
        role="textbox"
        aria-label={`Note for ${month}`}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        spellCheck={false}
        className={cn(
          'min-w-[8rem] max-w-[16rem] overflow-hidden truncate rounded px-1.5 py-0.5 text-xs text-foreground',
          'focus:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-ring',
        )}
      />
      {saving ? (
        <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : justSaved ? (
        <Check aria-hidden="true" className="h-3 w-3 text-success" />
      ) : null}
    </div>
  );
}

export const NoteCell = memo(NoteCellImpl);
NoteCell.displayName = 'NoteCell';
