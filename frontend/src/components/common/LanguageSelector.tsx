// ============================================
// Language Selector
// Toggle between supported UI languages (it / en).
// Persists the choice to localStorage via i18next's LanguageDetector cache.
// ============================================

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/i18n';
import { cn } from '@/utils/cn';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  it: 'Italiano',
  en: 'English',
};

interface LanguageSelectorProps {
  /** Compact renders as an icon + short code, e.g. for tight header spaces. */
  variant?: 'default' | 'compact';
  className?: string;
}

export default function LanguageSelector({ variant = 'default', className }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation('common');
  const current = (i18n.resolvedLanguage ?? i18n.language) as SupportedLanguage;

  const handleSelect = (lng: SupportedLanguage) => {
    if (lng === current) return;
    void i18n.changeLanguage(lng);
  };

  return (
    <div
      role="group"
      aria-label={t('language.selectAria')}
      className={cn(
        'inline-flex items-center gap-1 rounded-cozy border border-ink/20 bg-surface p-1',
        className
      )}
    >
      {variant === 'default' && (
        <Globe className="w-4 h-4 text-ink-muted ml-1.5 mr-0.5" aria-hidden="true" />
      )}
      {SUPPORTED_LANGUAGES.map((lng) => {
        const isActive = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => handleSelect(lng)}
            aria-pressed={isActive}
            className={cn(
              'px-2.5 py-1 rounded-cozy text-xs font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-text'
                : 'text-ink-secondary hover:text-ink hover:bg-ink/5'
            )}
          >
            {variant === 'compact' ? lng.toUpperCase() : LANGUAGE_LABELS[lng]}
          </button>
        );
      })}
    </div>
  );
}
