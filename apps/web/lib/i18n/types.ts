export type Locale = 'ja' | 'en' | 'zh' | 'ko';

export type TranslationDictionary = Record<string, string>;

export const LOCALE_CONFIG: Record<Locale, { label: string; code: string }> = {
  ja: { label: '日本語', code: 'JA' },
  en: { label: 'English', code: 'EN' },
  zh: { label: '中文', code: 'ZH' },
  ko: { label: '한국어', code: 'KO' },
} as const;

export const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko'] as const;

export const DEFAULT_LOCALE: Locale = 'ja';

export const STORAGE_KEY = 'omni-ad-locale';
