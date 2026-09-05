/**
 * SpellcastingBlock Component
 *
 * Displays spellcasting ability, spell slots, cantrips, and spell lists by level.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, CircleDot, BookOpen, Zap } from 'lucide-react';
import { dnd5eSpellSaveDC, dnd5eSpellAttackBonus } from '@/utils/rules/dnd5e';

interface SpellSlot {
  total: number;
  expended: number;
}

interface Spell {
  level: number;
  name: string;
  prepared: boolean;
  ritual: boolean;
  concentration: boolean;
}

interface Spellcasting {
  class: string;
  ability: string;
  spellSaveDC: number;
  spellAttackBonus: number;
  cantrips: string[];
  slots: {
    '1': SpellSlot;
    '2': SpellSlot;
    '3': SpellSlot;
    '4': SpellSlot;
    '5': SpellSlot;
    '6': SpellSlot;
    '7': SpellSlot;
    '8': SpellSlot;
    '9': SpellSlot;
  };
  spells: Spell[];
}

interface SpellcastingBlockProps {
  spellcasting: Spellcasting;
  /**
   * The whole sheet, so the save DC and attack bonus can be derived rather than
   * read from the stored copy. Both used to be typed in by hand and could sit
   * out of step with the proficiency bonus and ability that define them.
   */
  character?: unknown;
}

/**
 * SpellSlotIndicator - Visual representation of spell slots
 */
const SpellSlotIndicator: React.FC<{ slot: SpellSlot }> = ({ slot }) => {
  const { t } = useTranslation('character');
  const filled = slot.expended;
  const remaining = slot.total - slot.expended;
  const dots = Math.max(slot.total, 1);

  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border ${
            i < filled
              ? 'bg-blue-500 border-blue-600'
              : 'bg-white border-stone-300'
          }`}
          title={t('sheet.spellSlotsRemaining', { remaining, total: slot.total })}
        />
      ))}
    </div>
  );
};

/**
 * SpellRow - Single spell display
 */
const SpellRow: React.FC<{ spell: Spell }> = ({ spell }) => {
  const { t } = useTranslation('character');
  return (
    <div className="flex items-center justify-between py-1 px-2 hover:bg-stone-50 rounded">
      <div className="flex items-center space-x-2">
        {spell.prepared ? (
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
        <span className="text-sm text-stone-700">{spell.name}</span>
      </div>
      <div className="flex items-center space-x-3 text-xs">
        {spell.ritual && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
            {t('sheet.ritual')}
          </span>
        )}
        {spell.concentration && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
            {t('sheet.concentration')}
          </span>
        )}
        {spell.ritual && spell.concentration && (
          <span title={t('sheet.concentration')}>
            <Zap className="w-3 h-3 text-stone-400" />
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * SpellcastingBlock - Full spellcasting display
 */
export const SpellcastingBlock: React.FC<SpellcastingBlockProps> = ({
  spellcasting,
  character,
}) => {
  const { t } = useTranslation('character');
  const formatBonus = (bonus: number): string => {
    return bonus >= 0 ? `+${bonus}` : `${bonus}`;
  };

  // Derived where the whole sheet is available, so the numbers cannot drift
  // from the proficiency bonus and ability that define them. Falls back to the
  // stored copy for the few callers that pass only the spellcasting block.
  const saveDC = character ? dnd5eSpellSaveDC(character) : spellcasting.spellSaveDC;
  const attackBonus = character
    ? dnd5eSpellAttackBonus(character)
    : spellcasting.spellAttackBonus;

  // Group spells by level
  const spellsByLevel: Record<number, Spell[]> = {};
  if (spellcasting.spells) {
    spellcasting.spells.forEach((spell) => {
      if (!spellsByLevel[spell.level]) {
        spellsByLevel[spell.level] = [];
      }
      spellsByLevel[spell.level].push(spell);
    });
  }

  return (
    <div className="space-y-6">
      {/* Spellcasting Ability Header */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-stone-800">
            {/* Without a class recorded this used to render " Spellcasting"
                with a leading gap — or, from the templates, "Wizard" on a sheet
                belonging to anything but a wizard. */}
            {spellcasting.class ? t('sheet.spellcastingClassHeading', { class: spellcasting.class }) : t('sheet.spellcasting')}
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-stone-500">{t('sheet.spellcastingAbility')}</div>
            <div className="font-semibold text-stone-800">{spellcasting.ability}</div>
          </div>
          <div>
            <div className="text-xs text-stone-500">{t('sheet.spellSaveDC')}</div>
            <div className="text-lg font-bold text-blue-700">{saveDC}</div>
          </div>
          <div>
            <div className="text-xs text-stone-500">{t('sheet.spellAttack')}</div>
            <div className="text-lg font-bold text-blue-700">
              {formatBonus(attackBonus)}
            </div>
          </div>
        </div>
      </div>

      {/* Cantrips */}
      {spellcasting.cantrips && spellcasting.cantrips.length > 0 && (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <h4 className="text-base font-semibold text-stone-800 mb-3">{t('sheet.cantrips')}</h4>
          <div className="flex flex-wrap gap-2">
            {spellcasting.cantrips.map((cantrip, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-white border border-stone-300 rounded-lg text-sm text-stone-700"
              >
                {cantrip}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Spell Slots */}
      {spellcasting.slots && (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <h4 className="text-base font-semibold text-stone-800 mb-3">{t('sheet.spellSlots')}</h4>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(spellcasting.slots).map(([level, slot]) => (
              <div key={level} className="space-y-1">
                <div className="text-xs font-semibold text-stone-600">{t('sheet.level')} {level}</div>
                <SpellSlotIndicator slot={slot} />
                <div className="text-xs text-stone-500">
                  {slot.total - slot.expended}/{slot.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spells by Level */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
        <div className="p-3 bg-stone-100 border-b border-stone-200">
          <h5 className="font-semibold text-stone-800">{t('sheet.spellList')}</h5>
        </div>
        <div className="divide-y divide-stone-100">
          {Object.keys(spellsByLevel)
            .map(Number)
            .sort((a, b) => a - b)
            .map((level) => (
              <div key={level} className="p-3">
                <h6 className="text-sm font-semibold text-stone-700 mb-2">
                  {level === 0 ? t('sheet.cantrips') : `${t('sheet.level')} ${level}`}
                </h6>
                <div className="space-y-1">
                  {spellsByLevel[level].map((spell, idx) => (
                    <SpellRow key={idx} spell={spell} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-stone-600 space-y-1 px-2">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-3 h-3 text-blue-600" />
          <span>{t('sheet.preparedSpell')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <CircleDot className="w-3 h-3 text-blue-500" />
          <span>{t('sheet.ritual')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Zap className="w-3 h-3 text-amber-500" />
          <span>{t('sheet.concentration')}</span>
        </div>
      </div>
    </div>
  );
};