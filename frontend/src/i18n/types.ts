/**
 * Minimal type augmentation for i18next.
 *
 * We only set the default namespace here. Full resource type checking is
 * intentionally omitted because namespace-prefixed keys (e.g. "character:sheet.edit")
 * are not supported by i18next's type helpers.
 */

import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
  }
}