/**
 * I18nProvider — wraps the app with i18next initialization.
 *
 * This provider ensures i18next is fully initialized before rendering children,
 * preventing any flash of untranslated content.
 */
import { type ReactNode, useEffect, useState } from 'react';
import i18n from './i18n';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (!ready) {
      // i18next initializes synchronously in our config (no backend),
      // but we keep this as a safety net for future async backends.
      i18n.init().then(() => setReady(true)).catch(() => setReady(true));
    }
  }, [ready]);

  // Show nothing until i18next is ready — avoids untranslated flashes.
  if (!ready) {
    return null;
  }

  return <>{children}</>;
}