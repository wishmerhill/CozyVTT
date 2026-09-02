/**
 * i18next configuration for CozyVTT
 *
 * Translations are imported directly at build time via Vite's JSON import support.
 * No HTTP backend is used — all resources are bundled.
 * Italian is the only supported language; no language detector is needed.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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
    setup: setupIt,
    dashboard: dashboardIt,
    assets: assetsIt,
  },
} as const;

// Initialize synchronously — no async backend, no language detector.
i18n.use(initReactI18next).init({
  lng: 'it',
  fallbackLng: 'it',
  returnNull: false,
  returnEmptyString: false,
  defaultNS: DEFAULT_NS,
  ns: NAMESPACES,
  resources: resources as Record<string, Record<string, object>>,
  debug: import.meta.env.DEV,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,  },
});

// Expose on window for dev debugging
if (typeof window !== 'undefined') {
  (window as any).i18next = i18n;
}

export default i18n;