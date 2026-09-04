/**
 * Shadowrun 6e Character Sheet
 */

import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { CharacterSheetProps } from '../types';

export const Shadowrun6eCharacterSheet: React.FC<CharacterSheetProps> = () => {
  const { t } = useTranslation('character');

  return (
    <div className="glass-panel p-6">
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="p-4 rounded-full bg-purple-100">
          <AlertCircle className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-xl font-semibold text-warm-gray">
          {t('editor.shadowrunViewTitle')}
        </h3>
        <p className="text-stone-gray text-center max-w-md">
          {t('editor.shadowrunViewNotImplemented')}
        </p>
        <p className="text-sm text-stone-gray/70">
          {t('editor.shadowrunRoadmapNote')}
        </p>
      </div>
    </div>
  );
};

export default Shadowrun6eCharacterSheet;
