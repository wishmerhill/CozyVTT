// Extend Vitest's expect with jest-dom matchers (toBeInTheDocument, etc.)
import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import character from '../../public/locales/it/character.json';
import common from '../../public/locales/it/common.json';
import campaign from '../../public/locales/it/campaign.json';
import gameSystems from '../../public/locales/it/game-systems.json';
import auth from '../../public/locales/it/auth.json';
import admin from '../../public/locales/it/admin.json';
import errors from '../../public/locales/it/errors.json';
import validation from '../../public/locales/it/validation.json';
import setup from '../../public/locales/it/setup.json';

// Initialize i18n for all tests
i18n.use(initReactI18next).init({
  lng: 'it',
  fallbackLng: 'it',
  resources: {
    it: {
      character,
      common,
      campaign,
      'game-systems': gameSystems,
      auth,
      admin,
      errors,
      validation,
      setup,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});