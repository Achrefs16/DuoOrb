/**
 * Supported app languages.
 *
 * Order here is the order of the picker (first launch + Settings). `flag`
 * is a regional-indicator emoji: it renders as a full-colour flag on
 * Android/iOS with no assets. `nativeName` is always shown in its own
 * language so a player can find theirs whatever is currently selected.
 */
export const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', nativeName: 'English', englishName: 'English', rtl: false },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français', englishName: 'French', rtl: false },
  { code: 'it', flag: '🇮🇹', nativeName: 'Italiano', englishName: 'Italian', rtl: false },
  { code: 'de', flag: '🇩🇪', nativeName: 'Deutsch', englishName: 'German', rtl: false },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español', englishName: 'Spanish', rtl: false },
  { code: 'pt-BR', flag: '🇧🇷', nativeName: 'Português (Brasil)', englishName: 'Brazilian Portuguese', rtl: false },
  { code: 'tr', flag: '🇹🇷', nativeName: 'Türkçe', englishName: 'Turkish', rtl: false },
  { code: 'pl', flag: '🇵🇱', nativeName: 'Polski', englishName: 'Polish', rtl: false },
  { code: 'id', flag: '🇮🇩', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', rtl: false },
  { code: 'ar', flag: '🇸🇦', nativeName: 'العربية', englishName: 'Arabic', rtl: true },
] as const;

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && LANGUAGES.some((l) => l.code === value);
}

export function getLanguage(code: LanguageCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/**
 * Best-effort match of a BCP-47 device locale ("fr-CA", "pt_BR", "ar-MA")
 * to a supported language. Any Portuguese maps to Brazilian Portuguese —
 * the only Portuguese we ship. Unknown locales fall back to English.
 */
export function matchLocale(locale: string | null | undefined): LanguageCode {
  if (!locale) return DEFAULT_LANGUAGE;
  const base = locale.replace('_', '-').split('-')[0].toLowerCase();
  if (base === 'pt') return 'pt-BR';
  const hit = LANGUAGES.find((l) => l.code === base);
  return hit ? hit.code : DEFAULT_LANGUAGE;
}
