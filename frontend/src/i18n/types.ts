/**
 * Type augmentation for i18next — provides autocompletion for translation keys.
 *
 * This module augments the i18next `CustomTypeOptions` interface so that
 * `t()` calls are type-checked against the actual Italian translation files.
 *
 * When adding new keys to any JSON file, update the corresponding type here
 * to keep autocompletion in sync.
 */

import type common from '../../public/locales/it/common.json';
import type auth from '../../public/locales/it/auth.json';
import type campaign from '../../public/locales/it/campaign.json';
import type character from '../../public/locales/it/character.json';
import type admin from '../../public/locales/it/admin.json';
import type gameSystems from '../../public/locales/it/game-systems.json';
import type errors from '../../public/locales/it/errors.json';
import type validation from '../../public/locales/it/validation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      campaign: typeof campaign;
      character: typeof character;
      admin: typeof admin;
      'game-systems': typeof gameSystems;
      errors: typeof errors;
      validation: typeof validation;
    };
  }
}