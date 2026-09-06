/**
 * i18next configuration for CozyVTT
 *
 * Translations are imported directly at build time via Vite's JSON import support.
 * No HTTP backend is used — all resources are bundled.
 * Preferred language is read from localStorage ('i18nextLng'), falling back to
 * the browser language when supported, then to Italian.
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
import setupIt from '../../public/locales/it/setup.json';
import dashboardIt from '../../public/locales/it/dashboard.json';
import assetsIt from '../../public/locales/it/assets.json';

// Import all English translation resources
import commonEn from '../../public/locales/en/common.json';
import authEn from '../../public/locales/en/auth.json';
import campaignEn from '../../public/locales/en/campaign.json';
import characterEn from '../../public/locales/en/character.json';
import adminEn from '../../public/locales/en/admin.json';
import gameSystemsEn from '../../public/locales/en/game-systems.json';
import errorsEn from '../../public/locales/en/errors.json';
import validationEn from '../../public/locales/en/validation.json';
import setupEn from '../../public/locales/en/setup.json';
import dashboardEn from '../../public/locales/en/dashboard.json';
import assetsEn from '../../public/locales/en/assets.json';

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
  'setup',
  'dashboard',
  'assets',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** Default namespace used when none is specified. */
export const DEFAULT_NS: Namespace = 'common';

/** Supported languages. */
export const SUPPORTED_LANGUAGES = ['it', 'en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** localStorage key used to persist the user's chosen language. */
export const LANGUAGE_STORAGE_KEY = 'i18nextLng';

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
    setup: setupIt,
    dashboard: dashboardIt,
    assets: assetsIt,
  },
  en: {
    common: commonEn,
    auth: authEn,
    campaign: campaignEn,
    character: characterEn,
    admin: adminEn,
    'game-systems': gameSystemsEn,
    errors: errorsEn,
    validation: validationEn,
    setup: setupEn,
    dashboard: dashboardEn,
    assets: assetsEn,
  },
} as const;

// Initialize synchronously — no async backend. LanguageDetector reads a cached
// choice from localStorage (key 'i18nextLng'); with none cached, it falls back
// to the browser's language when supported, otherwise fallbackLng ('it').
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'it',
    supportedLngs: SUPPORTED_LANGUAGES,
    load: 'languageOnly',
    returnNull: false,
    returnEmptyString: false,
    defaultNS: DEFAULT_NS,
    ns: NAMESPACES,
    resources: resources as Record<string, Record<string, object>>,
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    react: {
      useSuspense: false,
    },
  });

declare global {
  interface Window {
    i18next?: typeof i18n;
  }
}

// Expose on window for dev debugging
if (typeof window !== 'undefined') {
  window.i18next = i18n;
}

export default i18n;
