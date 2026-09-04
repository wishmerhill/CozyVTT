/**
 * WeaponsList Component
 *
 * Displays CoC-style weapons table with skill, damage, range, attacks, ammo, and malfunction.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Swords, Plus, Trash2, Dices } from 'lucide-react';
import Button from '@/components/ui/Button';

interface Weapon {
  name: string;
  skill: string;
  skillValue: number;
  damage: string;
  range: string;
  attacks: number;
  ammo: number | null;
  malfunction: number | null;
  notes?: string;
}

interface WeaponsListProps {
  /** Array of weapons from character data */
  weapons: Weapon[];

  /** Edit mode */
  editable?: boolean;

  /** onChange handler for edit mode */
  onChange?: (weapons: Weapon[]) => void;

  /** Click to roll. Omit outside campaign context. */
  onRoll?: (expression: string, purpose: string) => void;
}

/**
 * WeaponsList - CoC-style weapons table
 */
export const WeaponsList: React.FC<WeaponsListProps> = ({
  weapons,
  editable = false,
  onChange,
  onRoll,
}) => {
  const { t } = useTranslation('character');

  const handleWeaponChange = (index: number, field: keyof Weapon, value: any) => {
    if (!onChange) return;
    const updated = [...weapons];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddWeapon = () => {
    if (!onChange) return;
    const newWeapon: Weapon = {
      name: t('sheet.coc7e.weapons.newWeaponName'),
      skill: t('sheet.coc7e.skillNames.fightingBrawl'),
      skillValue: 25,
      damage: '1d3',
      range: t('sheet.coc7e.weapons.rangeTouch'),
      attacks: 1,
      ammo: null,
      malfunction: null,
      notes: '',
    };
    onChange([...weapons, newWeapon]);
  };

  const handleDeleteWeapon = (index: number) => {
    if (!onChange) return;
    const updated = weapons.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Swords className="w-5 h-5 text-sepia-700" />
          <h3 className="text-lg font-bold text-sepia-900">{t('sheet.coc7e.weapons.heading')}</h3>
        </div>
        {editable && (
          <Button
            onClick={handleAddWeapon}
            variant="secondary" className="text-sm py-1 px-3 flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sheet.coc7e.weapons.addButton')}</span>
          </Button>
        )}
      </div>

      {/* Weapons Table */}
      {weapons.length === 0 ? (
        <div className="text-center py-8 text-sepia-600">
          <Swords className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('sheet.coc7e.weapons.noneEquipped')}</p>
          {editable && (
            <p className="text-sm mt-1">{t('sheet.coc7e.weapons.addHint')}</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sepia-200 border-b-2 border-sepia-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderWeapon')}</th>
                <th className="px-3 py-2 text-left font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderSkill')}</th>
                <th className="px-3 py-2 text-center font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderValue')}</th>
                <th className="px-3 py-2 text-center font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderDamage')}</th>
                <th className="px-3 py-2 text-center font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderRange')}</th>
                <th className="px-3 py-2 text-center font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderAtks')}</th>
                <th className="px-3 py-2 text-center font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderAmmo')}</th>
                <th className="px-3 py-2 text-center font-semibold text-sepia-900">{t('sheet.coc7e.weapons.tableHeaderMalf')}</th>
                {editable && <th className="px-3 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {weapons.map((weapon, index) => {
                const isClickable = !!onRoll && !editable;
                const skillPurpose = t('sheet.coc7e.weapons.skillRollPurpose', { name: weapon.name, skill: weapon.skill, value: weapon.skillValue });
                return (
                <tr
                  key={index}
                  className={`border-b border-sepia-300 group ${isClickable ? 'cursor-pointer hover:bg-sepia-100/50 select-none' : 'hover:bg-parchment-light/30'}`}
                  onClick={isClickable ? () => onRoll!('1d100', skillPurpose) : undefined}
                  title={isClickable ? t('sheet.coc7e.weapons.skillRollTitle', { skill: weapon.skill, value: weapon.skillValue }) : undefined}
                >
                  {/* Name */}
                  <td className="px-3 py-2">
                    {editable ? (
                      <input
                        type="text"
                        value={weapon.name}
                        onChange={(e) => handleWeaponChange(index, 'name', e.target.value)}
                        className="w-full bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sepia-500"
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-sepia-900">{weapon.name}</span>
                        {isClickable && <Dices className="w-3 h-3 text-sepia-600 opacity-0 group-hover:opacity-60 transition-opacity" />}
                      </div>
                    )}
                  </td>

                  {/* Skill */}
                  <td className="px-3 py-2">
                    {editable ? (
                      <input
                        type="text"
                        value={weapon.skill}
                        onChange={(e) => handleWeaponChange(index, 'skill', e.target.value)}
                        className="w-full bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sepia-500"
                      />
                    ) : (
                      <span className="text-sepia-700">{weapon.skill}</span>
                    )}
                  </td>

                  {/* Skill Value */}
                  <td className="px-3 py-2 text-center">
                    {editable ? (
                      <input
                        type="number"
                        value={weapon.skillValue}
                        onChange={(e) => handleWeaponChange(index, 'skillValue', parseInt(e.target.value) || 0)}
                        className="w-16 bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sepia-500"
                        min={0}
                        max={99}
                      />
                    ) : (
                      <span className="font-semibold text-sepia-900">{weapon.skillValue}%</span>
                    )}
                  </td>

                  {/* Damage — click to roll damage separately */}
                  <td
                    className={`px-3 py-2 text-center ${isClickable && weapon.damage ? 'cursor-pointer hover:text-red-700 font-semibold' : ''}`}
                    onClick={isClickable && weapon.damage ? (e) => { e.stopPropagation(); onRoll!(weapon.damage, t('sheet.coc7e.weapons.damageRollLabel', { name: weapon.name })); } : undefined}
                    title={isClickable && weapon.damage ? t('sheet.coc7e.weapons.damageRollTitle', { damage: weapon.damage }) : undefined}
                  >
                    {editable ? (
                      <input
                        type="text"
                        value={weapon.damage}
                        onChange={(e) => handleWeaponChange(index, 'damage', e.target.value)}
                        className="w-20 bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sepia-500"
                        placeholder="1d6"
                      />
                    ) : (
                      <span className="text-sepia-900">{weapon.damage}</span>
                    )}
                  </td>

                  {/* Range */}
                  <td className="px-3 py-2 text-center">
                    {editable ? (
                      <input
                        type="text"
                        value={weapon.range}
                        onChange={(e) => handleWeaponChange(index, 'range', e.target.value)}
                        className="w-20 bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sepia-500"
                        placeholder={t('sheet.coc7e.weapons.rangeTouch')}
                      />
                    ) : (
                      <span className="text-sepia-700">{weapon.range}</span>
                    )}
                  </td>

                  {/* Attacks */}
                  <td className="px-3 py-2 text-center">
                    {editable ? (
                      <input
                        type="number"
                        value={weapon.attacks}
                        onChange={(e) => handleWeaponChange(index, 'attacks', parseInt(e.target.value) || 1)}
                        className="w-12 bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sepia-500"
                        min={1}
                      />
                    ) : (
                      <span className="text-sepia-900">{weapon.attacks}</span>
                    )}
                  </td>

                  {/* Ammo */}
                  <td className="px-3 py-2 text-center">
                    {editable ? (
                      <input
                        type="number"
                        value={weapon.ammo || ''}
                        onChange={(e) => handleWeaponChange(index, 'ammo', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-12 bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sepia-500"
                        placeholder="—"
                        min={0}
                      />
                    ) : (
                      <span className="text-sepia-700">{weapon.ammo ?? '—'}</span>
                    )}
                  </td>

                  {/* Malfunction */}
                  <td className="px-3 py-2 text-center">
                    {editable ? (
                      <input
                        type="number"
                        value={weapon.malfunction || ''}
                        onChange={(e) => handleWeaponChange(index, 'malfunction', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-12 bg-white/50 border border-sepia-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sepia-500"
                        placeholder="—"
                        min={1}
                        max={100}
                      />
                    ) : (
                      <span className="text-sepia-700">{weapon.malfunction ?? '—'}</span>
                    )}
                  </td>

                  {/* Delete */}
                  {editable && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDeleteWeapon(index)}
                        className="p-1 hover:bg-red-100 rounded text-red-600 hover:text-red-700 transition-colors"
                        title={t('sheet.coc7e.weapons.deleteTitle')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes/Legend */}
      <div className="bg-sepia-100/50 rounded-md p-3">
        <div className="text-xs text-sepia-700 space-y-1">
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderSkill')}:</strong> {t('sheet.coc7e.weapons.legendSkill')}</div>
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderValue')}:</strong> {t('sheet.coc7e.weapons.legendValue')}</div>
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderDamage')}:</strong> {t('sheet.coc7e.weapons.legendDamage')}</div>
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderRange')}:</strong> {t('sheet.coc7e.weapons.legendRange')}</div>
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderAtks')}:</strong> {t('sheet.coc7e.weapons.legendAtks')}</div>
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderAmmo')}:</strong> {t('sheet.coc7e.weapons.legendAmmo')}</div>
          <div><strong>{t('sheet.coc7e.weapons.tableHeaderMalf')}:</strong> {t('sheet.coc7e.weapons.legendMalf')}</div>
        </div>
      </div>
    </div>
  );
};

export default WeaponsList;
