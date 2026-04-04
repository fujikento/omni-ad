export type Locale = 'ja' | 'en' | 'zh' | 'ko';

export type TranslationDictionary = Record<string, string>;

export const LOCALE_CONFIG: Record<Locale, { label: string; flag: string }> = {
  ja: { label: '日本語', flag: '🇯🇵' },
  en: { label: 'English', flag: '🇺🇸' },
  zh: { label: '中文', flag: '🇨🇳' },
  ko: { label: '한국어', flag: '🇰🇷' },
} as const;

export const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko'] as const;

export const DEFAULT_LOCALE: Locale = 'ja';

export const STORAGE_KEY = 'omni-ad-locale';
