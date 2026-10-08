import { useCallback, useSyncExternalStore } from 'react';
import { I18nManager, Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LANGUAGE,
  getLanguage,
  isLanguageCode,
  LANGUAGES,
  matchLocale,
  type Language,
  type LanguageCode,
} from './languages';
import { en, type Dictionary, type TranslationKey } from './locales/en';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { de } from './locales/de';
import { es } from './locales/es';
import { ptBR } from './locales/ptBR';
import { tr } from './locales/tr';
import { pl } from './locales/pl';
import { id } from './locales/id';
import { ar } from './locales/ar';

export {
  DEFAULT_LANGUAGE,
  getLanguage,
  isLanguageCode,
  LANGUAGES,
  matchLocale,
  type Language,
  type LanguageCode,
  type Dictionary,
  type TranslationKey,
};

export const DICTIONARIES: Record<LanguageCode, Dictionary> = {
  en,
  fr,
  it,
  de,
  es,
  'pt-BR': ptBR,
  tr,
  pl,
  id,
  ar,
};

const LANGUAGE_PROMPT_KEY = '@duoorb:language-prompt:v1';
const LANGUAGE_STORAGE_KEY = '@duoorb:language:v1';

let currentLanguage: LanguageCode = DEFAULT_LANGUAGE;
const languageListeners = new Set<() => void>();

function emitLanguageChange(): void {
  languageListeners.forEach((fn) => fn());
}

export function subscribeLanguage(fn: () => void): () => void {
  languageListeners.add(fn);
  return () => {
    languageListeners.delete(fn);
  };
}

export function getCurrentLanguage(): LanguageCode {
  return currentLanguage;
}

/**
 * Detect the device locale on first launch.
 */
export function getDeviceLanguage(): LanguageCode {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.language) {
      return matchLocale(navigator.language);
    }
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) {
      return matchLocale(resolved);
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Universal storage access matching onboarding.ts
 */
function webGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function webSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

/**
 * Checks whether user has already completed the first-time language selection.
 */
export async function hasCompletedLanguagePrompt(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return webGet(LANGUAGE_PROMPT_KEY) === '1';
    }
    const val = await AsyncStorage.getItem(LANGUAGE_PROMPT_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

export async function markLanguagePromptCompleted(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      webSet(LANGUAGE_PROMPT_KEY, '1');
    } else {
      await AsyncStorage.setItem(LANGUAGE_PROMPT_KEY, '1');
    }
  } catch {
    // ignore
  }
}

/**
 * Hydrates stored language from AsyncStorage / localStorage or falls back to device locale.
 */
export async function hydrateLanguage(): Promise<LanguageCode> {
  try {
    let stored: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      stored = webGet(LANGUAGE_STORAGE_KEY);
    } else {
      stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    }

    if (stored && isLanguageCode(stored)) {
      currentLanguage = stored;
      emitLanguageChange();
      return currentLanguage;
    }

    // First time: set device language as initial current language
    const deviceLang = getDeviceLanguage();
    currentLanguage = deviceLang;
    emitLanguageChange();
    return currentLanguage;
  } catch {
    return currentLanguage;
  }
}

/**
 * Sets the active language, persists it, and handles RTL layout switching if needed.
 */
export async function setLanguage(
  code: LanguageCode,
  options?: { reloadIfRTLChanged?: boolean }
): Promise<{ rtlChanged: boolean }> {
  if (!isLanguageCode(code)) return { rtlChanged: false };

  const prev = currentLanguage;
  currentLanguage = code;
  emitLanguageChange();

  // Persist
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      webSet(LANGUAGE_STORAGE_KEY, code);
    } else {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    }
  } catch {
    // ignore
  }

  const prevLang = getLanguage(prev);
  const nextLang = getLanguage(code);
  const rtlChanged = prevLang.rtl !== nextLang.rtl;

  if (rtlChanged) {
    I18nManager.allowRTL(nextLang.rtl);
    I18nManager.forceRTL(nextLang.rtl);

    if (options?.reloadIfRTLChanged !== false) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          if (document?.documentElement) {
            document.documentElement.dir = nextLang.rtl ? 'rtl' : 'ltr';
          }
          window.location.reload();
        } catch {
          // ignore
        }
      } else {
        try {
          const Updates = await import('expo-updates');
          await Updates.reloadAsync();
        } catch {
          // Dev client or Expo Go might not support reloadAsync
        }
      }
    }
  }

  return { rtlChanged };
}

/**
 * Translates a key with optional interpolation: {name}, {count}, etc.
 */
export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale: LanguageCode = currentLanguage
): string {
  const dict = DICTIONARIES[locale] || DICTIONARIES.en;
  let text = dict[key] ?? DICTIONARIES.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

/**
 * Static translate helper.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(key, params, currentLanguage);
}

/**
 * Reactive hook for React components. Updates automatically when language changes.
 */
export function useLanguage(): LanguageCode {
  return useSyncExternalStore(subscribeLanguage, () => currentLanguage, () => DEFAULT_LANGUAGE);
}

export function useTranslation() {
  const lang = useLanguage();
  const translateFn = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      return translate(key, params, lang);
    },
    [lang]
  );

  return {
    t: translateFn,
    language: lang,
    currentLanguage: getLanguage(lang),
  };
}
