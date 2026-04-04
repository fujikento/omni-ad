'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Locale, TranslationDictionary } from './types';
import { DEFAULT_LOCALE, STORAGE_KEY } from './types';
import { ja } from './dictionaries/ja';
import { en } from './dictionaries/en';
import { zh } from './dictionaries/zh';
import { ko } from './dictionaries/ko';

const DICTIONARIES: Record<Locale, TranslationDictionary> = {
  ja,
  en,
  zh,
  ko,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ja' || stored === 'en' || stored === 'zh' || stored === 'ko') {
    return stored;
  }
  return DEFAULT_LOCALE;
}

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps): React.ReactElement {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((newLocale: Locale): void => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = DICTIONARIES[locale][key];

      // Fallback to Japanese if key is missing in current locale
      if (value === undefined) {
        value = DICTIONARIES[DEFAULT_LOCALE][key];
      }

      // Return key itself if not found anywhere
      if (value === undefined) {
        return key;
      }

      // Interpolate params: {count} -> value
      if (params) {
        return Object.entries(params).reduce<string>(
          (result, [paramKey, paramValue]) =>
            result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue)),
          value,
        );
      }

      return value;
    },
    [locale],
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <I18nContext value={contextValue}>
      {children}
    </I18nContext>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
