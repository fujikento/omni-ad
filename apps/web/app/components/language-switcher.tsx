'use client';

import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n, LOCALE_CONFIG, LOCALES } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

export function LanguageSwitcher(): React.ReactElement {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(e: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  function handleSelect(newLocale: Locale): void {
    setLocale(newLocale);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const currentConfig = LOCALE_CONFIG[locale];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label={t('header.language')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{currentConfig.label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          role="listbox"
          aria-label={t('header.language')}
        >
          {LOCALES.map((loc) => {
            const config = LOCALE_CONFIG[loc];
            const isSelected = loc === locale;
            return (
              <button
                key={loc}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(loc)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted',
                  isSelected && 'bg-primary/5 font-medium text-primary',
                  !isSelected && 'text-foreground',
                )}
              >
                <span className="inline-flex h-5 w-7 items-center justify-center rounded-sm bg-muted text-[10px] font-bold text-muted-foreground">{config.code}</span>
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
