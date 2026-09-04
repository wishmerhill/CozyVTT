/**
 * Loading spinner for lazy-loaded character sheets
 */

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const CharacterSheetLoadingSpinner: React.FC = () => {
  const { t } = useTranslation('character');

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
      <p className="text-sm text-stone-gray">{t('editor.loadingCharacterSheet')}</p>
    </div>
  );
};
