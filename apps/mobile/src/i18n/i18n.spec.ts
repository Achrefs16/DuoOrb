import { describe, expect, it } from 'vitest';
import {
  DICTIONARIES,
  LANGUAGES,
  getLanguage,
  isLanguageCode,
  matchLocale,
  t,
  translate,
  type LanguageCode,
} from './index';
import { en } from './locales/en';

describe('i18n System', () => {
  it('includes all 10 requested languages with flags', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toEqual([
      'en',
      'fr',
      'it',
      'de',
      'es',
      'pt-BR',
      'tr',
      'pl',
      'id',
      'ar',
    ]);

    for (const lang of LANGUAGES) {
      expect(lang.flag).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
      expect(lang.englishName).toBeTruthy();
      if (lang.code === 'ar') {
        expect(lang.rtl).toBe(true);
      } else {
        expect(lang.rtl).toBe(false);
      }
    }
  });

  it('correctly maps locale strings to language codes', () => {
    expect(matchLocale('fr-FR')).toBe('fr');
    expect(matchLocale('es_ES')).toBe('es');
    expect(matchLocale('pt-BR')).toBe('pt-BR');
    expect(matchLocale('pt_PT')).toBe('pt-BR');
    expect(matchLocale('ar-SA')).toBe('ar');
    expect(matchLocale('de')).toBe('de');
    expect(matchLocale('it')).toBe('it');
    expect(matchLocale('tr')).toBe('tr');
    expect(matchLocale('pl')).toBe('pl');
    expect(matchLocale('id')).toBe('id');
    expect(matchLocale('unknown-LOCALE')).toBe('en');
    expect(matchLocale(null)).toBe('en');
  });

  it('has complete dictionaries for all 10 languages with identical keys', () => {
    const requiredKeys = Object.keys(en) as (keyof typeof en)[];

    for (const [code, dict] of Object.entries(DICTIONARIES) as [LanguageCode, typeof en][]) {
      const dictKeys = Object.keys(dict);
      for (const key of requiredKeys) {
        expect(dict[key], `Missing key "${key}" in language "${code}"`).toBeDefined();
        expect(typeof dict[key]).toBe('string');
        expect(dict[key].trim().length).toBeGreaterThan(0);
      }
      expect(dictKeys.length).toBe(requiredKeys.length);
    }
  });

  it('preserves all interpolation placeholders in all languages', () => {
    const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;

    for (const [key, enText] of Object.entries(en)) {
      const enPlaceholders = Array.from(enText.matchAll(placeholderRegex), (m) => m[1]).sort();
      if (enPlaceholders.length === 0) continue;

      for (const [code, dict] of Object.entries(DICTIONARIES) as [LanguageCode, typeof en][]) {
        const text = dict[key as keyof typeof en];
        const placeholders = Array.from(text.matchAll(placeholderRegex), (m) => m[1]).sort();
        expect(placeholders, `Mismatched placeholders for key "${key}" in locale "${code}"`).toEqual(
          enPlaceholders
        );
      }
    }
  });

  it('interpolates parameters correctly', () => {
    expect(translate('username.available', { name: 'orbital' }, 'en')).toBe('@orbital is available');
    expect(translate('username.available', { name: 'orbital' }, 'fr')).toBe('@orbital est disponible');
    expect(translate('username.available', { name: 'orbital' }, 'ar')).toBe('@orbital متاح');
    expect(translate('home.playersOnlineMany', { count: 42 }, 'en')).toBe('42 players online');
    expect(translate('home.playersOnlineMany', { count: 42 }, 'de')).toBe('42 Spieler online');
  });
});
