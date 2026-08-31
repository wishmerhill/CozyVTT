/**
 * i18next configuration for CozyVTT
 *
 * Uses i18next-browser-languagedetector to detect the user's preferred language
 * from the browser, and falls back to Italian (it) as the default.
 *
 * Translation resources are imported directly at build time via Vite's JSON
 * import support, so no HTTP backend is needed.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all Italian translation resources
import commonIt from '../../public/locales/it/common.json';
import authIt from '../../public/locales/it/auth.json';
import campaignIt from '../../public/locales/it/campaign.json';
import characterIt from '../../public/locales/it/character.json';
import adminIt from '../../public/locales/it/admin.json';
import gameSystemsIt from '../../public/locales/it/game-systems.json';
import errorsIt from '../../public/locales/it/errors.json';
import validationIt from '../../public/locales/it/validation.json';

/** All available namespace keys — must match the JSON files in public/locales/. */
export const NAMESPACES = [
  'common',
  'auth',
  'campaign',
  'character',
  'admin',
  'game-systems',
  'errors',
  'validation',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** Default namespace used when none is specified. */
export const DEFAULT_NS: Namespace = 'common';

/** Supported languages. Currently only Italian is fully supported. */
export const SUPPORTED_LANGUAGES = ['it'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Translation resources keyed by language and namespace. */
const resources = {
  it: {
    common: commonIt,
    auth: authIt,
    campaign: campaignIt,
    character: characterIt,
    admin: adminIt,
    'game-systems': gameSystemsIt,
    errors: errorsIt,
    validation: validationIt,
  },
} as const;

void i18n
  .use(LanguageDetector) // detects language from browser settings
  .use(initReactI18next) // passes i18n instance to react-i18next
  .init({
    // Italian is the default language
    fallbackLng: 'it',
    // If a translation key is missing, show the key itself as a fallback
    // (rather than showing nothing or throwing)
    returnNull: false,
    returnEmptyString: false,
    // Namespace configuration
    defaultNS: DEFAULT_NS,
    ns: NAMESPACES,
    // Inline resources — no HTTP backend needed
    resources: resources as Record<string, Record<string, object>>,
    // Enable debug in development
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    // Language detection options
    detection: {
      // Order of language detection methods
      order: ['navigator', 'htmlTag', 'path', 'subdomain'],
      // Cache language in localStorage
      caches: ['localStorage'],
      // Convert 'it-IT' to 'it'
      convertDetectedLanguage: (lng: string) => {
        const supported = ['it'];
        const base = lng.split('-')[0];
        return supported.includes(base) ? base : 'it';
      },
    },
    // React options
    react: {
      useSuspense: false,
    },
  });

export default i18n;