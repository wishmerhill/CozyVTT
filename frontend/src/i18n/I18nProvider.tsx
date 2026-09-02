/**
 * I18nProvider — wraps the app with i18next context.
 *
 * Uses I18nextProvider from react-i18next to properly bind the i18n instance
 * to the React component tree, ensuring translations are available everywhere.
 */
import { type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}