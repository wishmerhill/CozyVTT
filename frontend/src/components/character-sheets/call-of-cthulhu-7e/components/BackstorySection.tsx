/**
 * BackstorySection Component
 *
 * Rich text fields for investigator background, personality, and history.
 * These fields are central to Call of Cthulhu character development.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookText, User, Heart, MapPin, Package, Sparkles, Activity, Ghost } from 'lucide-react';

interface BackstoryData {
  description?: string;
  personalDescription?: string;
  ideology?: string;
  significantPeople?: string;
  meaningfulLocations?: string;
  treasuredPossessions?: string;
  traits?: string;
  injuriesAndScars?: string;
  phobiasAndManias?: string;
  arcaneTomesAndSpells?: string;
  encountersWithStrangeEntities?: string;
}

interface BackstorySectionProps {
  /** Backstory data from character */
  backstory: BackstoryData;

  /** Edit mode */
  editable?: boolean;

  /** onChange handler for edit mode */
  onChange?: (field: keyof BackstoryData, value: string) => void;
}

interface BackstoryField {
  key: keyof BackstoryData;
  labelKey: string;
  placeholderKey: string;
  icon: React.ElementType;
  rows?: number;
}

const BACKSTORY_FIELDS: BackstoryField[] = [
  {
    key: 'description',
    labelKey: 'sheet.coc7e.backstory.description',
    icon: BookText,
    placeholderKey: 'sheet.coc7e.backstory.descriptionPlaceholder',
    rows: 4,
  },
  {
    key: 'personalDescription',
    labelKey: 'sheet.coc7e.backstory.personalDescription',
    icon: User,
    placeholderKey: 'sheet.coc7e.backstory.personalDescriptionPlaceholder',
    rows: 2,
  },
  {
    key: 'ideology',
    labelKey: 'sheet.coc7e.backstory.ideology',
    icon: Heart,
    placeholderKey: 'sheet.coc7e.backstory.ideologyPlaceholder',
    rows: 2,
  },
  {
    key: 'significantPeople',
    labelKey: 'sheet.coc7e.backstory.significantPeople',
    icon: User,
    placeholderKey: 'sheet.coc7e.backstory.significantPeoplePlaceholder',
    rows: 2,
  },
  {
    key: 'meaningfulLocations',
    labelKey: 'sheet.coc7e.backstory.meaningfulLocations',
    icon: MapPin,
    placeholderKey: 'sheet.coc7e.backstory.meaningfulLocationsPlaceholder',
    rows: 2,
  },
  {
    key: 'treasuredPossessions',
    labelKey: 'sheet.coc7e.backstory.treasuredPossessions',
    icon: Package,
    placeholderKey: 'sheet.coc7e.backstory.treasuredPossessionsPlaceholder',
    rows: 2,
  },
  {
    key: 'traits',
    labelKey: 'sheet.coc7e.backstory.traits',
    icon: Sparkles,
    placeholderKey: 'sheet.coc7e.backstory.traitsPlaceholder',
    rows: 2,
  },
  {
    key: 'injuriesAndScars',
    labelKey: 'sheet.coc7e.backstory.injuriesAndScars',
    icon: Activity,
    placeholderKey: 'sheet.coc7e.backstory.injuriesAndScarsPlaceholder',
    rows: 2,
  },
  {
    key: 'phobiasAndManias',
    labelKey: 'sheet.coc7e.backstory.phobiasAndManias',
    icon: Ghost,
    placeholderKey: 'sheet.coc7e.backstory.phobiasAndManiasPlaceholder',
    rows: 2,
  },
  {
    key: 'arcaneTomesAndSpells',
    labelKey: 'sheet.coc7e.backstory.arcaneTomes',
    icon: BookText,
    placeholderKey: 'sheet.coc7e.backstory.arcaneTomesPlaceholder',
    rows: 2,
  },
  {
    key: 'encountersWithStrangeEntities',
    labelKey: 'sheet.coc7e.backstory.strangeEncounters',
    icon: Ghost,
    placeholderKey: 'sheet.coc7e.backstory.strangeEncountersPlaceholder',
    rows: 3,
  },
];

/**
 * BackstorySection - Rich text fields for investigator background
 */
export const BackstorySection: React.FC<BackstorySectionProps> = ({
  backstory,
  editable = false,
  onChange,
}) => {
  const { t } = useTranslation('character');
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2 pb-2 border-b-2 border-sepia-400">
        <BookText className="w-5 h-5 text-sepia-700" />
        <h3 className="text-lg font-bold text-sepia-900">{t('sheet.coc7e.backstory.title')}</h3>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {BACKSTORY_FIELDS.map((field) => {
          const Icon = field.icon;
          const value = backstory[field.key] || '';

          return (
            <div key={field.key} className="space-y-2">
              {/* Field Label */}
              <div className="flex items-center space-x-2">
                <Icon className="w-4 h-4 text-sepia-600" />
                <label className="text-sm font-semibold text-sepia-900">
                  {t(field.labelKey)}
                </label>
              </div>

              {/* Field Input/Display */}
              {editable ? (
                <textarea
                  value={value}
                  onChange={(e) => onChange?.(field.key, e.target.value)}
                  placeholder={t(field.placeholderKey)}
                  rows={field.rows || 3}
                  className="w-full bg-white/50 border border-sepia-400 rounded-md px-3 py-2 text-sm text-sepia-900 placeholder:text-sepia-400 focus:outline-none focus:ring-2 focus:ring-sepia-500 resize-y"
                />
              ) : (
                <div className="bg-parchment-light/50 border border-sepia-300 rounded-md px-3 py-2 min-h-[60px]">
                  {value ? (
                    <p className="text-sm text-sepia-900 whitespace-pre-wrap">{value}</p>
                  ) : (
                    <p className="text-sm text-sepia-500 italic">{t('sheet.coc7e.backstory.noInfo')}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Keeper Notes */}
      <div className="bg-amber-50 border border-amber-300 rounded-md p-4">
        <h4 className="text-sm font-semibold text-amber-900 mb-2">{t('sheet.coc7e.backstory.keeperNote')}</h4>
        <p className="text-xs text-amber-800 leading-relaxed">
          {t('sheet.coc7e.backstory.keeperNoteBody')}
        </p>
      </div>
    </div>
  );
};

export default BackstorySection;