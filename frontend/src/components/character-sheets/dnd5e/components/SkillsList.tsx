/**
 * SkillsList Component
 *
 * Displays all D&D 5e skills with proficiency/expertise indicators and bonuses.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, CheckCircle2, CircleDot, Dices } from 'lucide-react';

interface Skill {
  proficient: boolean;
  expertise: boolean;
  bonus: number;
}

interface SkillsListProps {
  skills: {
    acrobatics: Skill;
    animalHandling: Skill;
    arcana: Skill;
    athletics: Skill;
    deception: Skill;
    history: Skill;
    insight: Skill;
    intimidation: Skill;
    investigation: Skill;
    medicine: Skill;
    nature: Skill;
    perception: Skill;
    performance: Skill;
    persuasion: Skill;
    religion: Skill;
    sleightOfHand: Skill;
    stealth: Skill;
    survival: Skill;
  };
  passivePerception?: number;
  /** Left-click to roll. Omit outside campaign context. */
  onRoll?: (expression: string, purpose: string) => void;
  /** Right-click for Advantage / Disadvantage popup. */
  onRollContext?: (e: React.MouseEvent, expression: string, purpose: string) => void;
}

// Skill display name keys (translated via t())
const SKILL_NAMES: Record<string, string> = {
  acrobatics: 'sheet.skills.acrobatics',
  animalHandling: 'sheet.skills.animalHandling',
  arcana: 'sheet.skills.arcana',
  athletics: 'sheet.skills.athletics',
  deception: 'sheet.skills.deception',
  history: 'sheet.skills.history',
  insight: 'sheet.skills.insight',
  intimidation: 'sheet.skills.intimidation',
  investigation: 'sheet.skills.investigation',
  medicine: 'sheet.skills.medicine',
  nature: 'sheet.skills.nature',
  perception: 'sheet.skills.perception',
  performance: 'sheet.skills.performance',
  persuasion: 'sheet.skills.persuasion',
  religion: 'sheet.skills.religion',
  sleightOfHand: 'sheet.skills.sleightOfHand',
  stealth: 'sheet.skills.stealth',
  survival: 'sheet.skills.survival',
};

/**
 * SkillRow - Single skill display with proficiency indicator
 */
const SkillRow: React.FC<{
  nameKey: string;
  skill: Skill;
  onRoll?: (expression: string, purpose: string) => void;
  onRollContext?: (e: React.MouseEvent, expression: string, purpose: string) => void;
}> = ({ nameKey, skill, onRoll, onRollContext }) => {
  const { t } = useTranslation('character');
  const formatBonus = (bonus: number): string => {
    return bonus >= 0 ? `+${bonus}` : `${bonus}`;
  };

  const getProficiencyIcon = () => {
    if (skill.expertise) {
      return <CircleDot className="w-4 h-4 text-red-700" />;
    } else if (skill.proficient) {
      return <CheckCircle2 className="w-4 h-4 text-red-700" />;
    } else {
      return <Circle className="w-4 h-4 text-stone-500" />;
    }
  };

  const displayName = t(nameKey);
  const expression = `1d20${formatBonus(skill.bonus)}`;
  const purpose = t('sheet.skills.rollPurpose', { skill: displayName });
  const isClickable = !!onRoll;

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 rounded group ${
        isClickable ? 'cursor-pointer hover:bg-red-50 select-none' : 'hover:bg-stone-50'
      }`}
      onClick={isClickable ? () => onRoll(expression, purpose) : undefined}
      onContextMenu={onRollContext ? (e) => { e.preventDefault(); onRollContext(e, expression, purpose); } : undefined}
      title={isClickable ? t('sheet.skills.rollHint') : undefined}
    >
      <div className="flex items-center space-x-2">
        {getProficiencyIcon()}
        <span className="text-sm text-stone-700">{displayName}</span>
      </div>
      <div className="flex items-center gap-1">
        {isClickable && (
          <Dices className="w-3 h-3 text-red-700 opacity-0 group-hover:opacity-60 transition-opacity" />
        )}
        <span className="text-sm font-semibold text-stone-900 min-w-[3rem] text-right">
          {formatBonus(skill.bonus)}
        </span>
      </div>
    </div>
  );
};

/**
 * SkillsList - Displays all skills with proficiency indicators
 */
export const SkillsList: React.FC<SkillsListProps> = ({ skills, passivePerception, onRoll, onRollContext }) => {
  const { t } = useTranslation('character');
  return (
    <div className="space-y-2">
      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        {Object.entries(skills).map(([key, skill]) => (
          <SkillRow key={key} nameKey={SKILL_NAMES[key]} skill={skill} onRoll={onRoll} onRollContext={onRollContext} />
        ))}
      </div>

      {/* Passive Perception */}
      {passivePerception !== undefined && (
        <div className="mt-4 pt-3 border-t border-stone-200">
          <div className="flex items-center justify-between px-2 py-1 bg-red-50 rounded">
            <span className="text-sm font-semibold text-stone-700">
              {t('sheet.passivePerception')}
            </span>
            <span className="text-lg font-bold text-red-700">
              {passivePerception}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-stone-200">
        <div className="flex flex-wrap gap-4 text-xs text-stone-600">
          <div className="flex items-center space-x-1">
            <Circle className="w-3 h-3 text-stone-500" />
            <span>{t('sheet.skills.notProficient')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-red-700" />
            <span>{t('sheet.skills.proficient')}</span>
          </div>
          <div className="flex items-center space-x-1">
            <CircleDot className="w-3 h-3 text-red-700" />
            <span>{t('sheet.skills.expertise')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};