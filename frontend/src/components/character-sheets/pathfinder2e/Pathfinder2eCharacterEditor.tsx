/**
 * Pathfinder2eCharacterEditor Component
 *
 * Fully editable Pathfinder 2nd Edition character sheet with all tabs,
 * auto-calculation, validation, color customization, and token upload.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Target,
  Swords,
  Sparkles,
  Package,
  BookOpen,
  User,
  Save,
  X,
  Upload,
  Palette,
  Plus,
  Trash2,
} from 'lucide-react';
import { ProficiencyRank, calculateProficiencyBonus } from './components/ProficiencyIndicator';
import { api } from '../../../services/api';
import { AssetType } from '../../../types';
import { useServerConfigQuery } from '@/hooks/queries';
import { getUploadLimit, formatUploadLimit } from '@/utils/uploadLimits';
import NumberField from '../../ui/NumberField';
import { pf2eInitiativeBonus } from '@/utils/rules/initiative';

interface Pathfinder2eCharacterEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  character: any;
  onSave: (data: any, showToast?: boolean, tokenImageUrl?: string) => Promise<void>;
  onCancel: () => void;
}

type TabId = 'stats' | 'combat' | 'spells' | 'inventory' | 'feats' | 'bio';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

// Tab labels are looked up from `sheet.*` at render time since this is a
// module-level constant without access to `t`.
const getTabs = (t: (key: string) => string): Tab[] => [
  { id: 'stats', label: t('sheet.statsAndSkills'), icon: Target },
  { id: 'combat', label: t('sheet.combat'), icon: Swords },
  { id: 'spells', label: t('sheet.spells'), icon: Sparkles },
  { id: 'inventory', label: t('sheet.inventory'), icon: Package },
  { id: 'feats', label: t('sheet.pf2e.featsTab'), icon: BookOpen },
  { id: 'bio', label: t('sheet.bio'), icon: User },
];

// PF2e color presets for character sheets.
// `name` is also the stored value (character.data.themeColor) matched against
// on load, so it stays a stable English identifier; `labelKey` looks up the
// translated label shown in the picker UI.
const COLOR_PRESETS = [
  { name: 'Pathfinder Blue', labelKey: 'pathfinderBlue', from: 'from-blue-700', to: 'to-blue-900', accent: 'blue-700', hex: '#1d4ed8' },
  { name: 'Golden', labelKey: 'golden', from: 'from-amber-600', to: 'to-amber-800', accent: 'amber-600', hex: '#d97706' },
  { name: 'Emerald', labelKey: 'emerald', from: 'from-emerald-700', to: 'to-emerald-900', accent: 'emerald-700', hex: '#047857' },
  { name: 'Royal Purple', labelKey: 'royalPurple', from: 'from-purple-700', to: 'to-purple-900', accent: 'purple-700', hex: '#7e22ce' },
  { name: 'Crimson', labelKey: 'crimson', from: 'from-rose-700', to: 'to-rose-900', accent: 'rose-700', hex: '#be123c' },
  { name: 'Teal', labelKey: 'teal', from: 'from-teal-700', to: 'to-teal-900', accent: 'teal-700', hex: '#0f766e' },
  { name: 'Indigo', labelKey: 'indigo', from: 'from-indigo-700', to: 'to-indigo-900', accent: 'indigo-700', hex: '#4338ca' },
  { name: 'Slate', labelKey: 'slate', from: 'from-slate-700', to: 'to-slate-900', accent: 'slate-700', hex: '#334155' },
];

const PROFICIENCY_RANKS: ProficiencyRank[] = ['untrained', 'trained', 'expert', 'master', 'legendary'];

// PF2e ability name -> abbreviation key, reused against the `game-systems:dnd5e`
// namespace's `abilityAbbr`/pathfinder2e's `abilities` entries, since the
// three-letter ability abbreviations and full names are the same universal set
// D&D 5e already has translated (STR/DEX/CON/INT/WIS/CHA), avoiding a
// duplicate abbreviation subtree in game-systems.json for pf2e.
const ABILITY_ABBR: Record<string, string> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

// PF2e skill key -> translation key path. Skills shared with the generic
// `sheet.skills.*` vocabulary reuse those entries; PF2e-only skills (crafting,
// diplomacy, occultism, society, thievery) use the `sheet.pf2e.skills.*`
// subtree added for this editor.
const PF2E_SKILL_KEY: Record<string, string> = {
  acrobatics: 'sheet.skills.acrobatics',
  arcana: 'sheet.skills.arcana',
  athletics: 'sheet.skills.athletics',
  crafting: 'sheet.pf2e.skills.crafting',
  deception: 'sheet.skills.deception',
  diplomacy: 'sheet.pf2e.skills.diplomacy',
  intimidation: 'sheet.skills.intimidation',
  medicine: 'sheet.skills.medicine',
  nature: 'sheet.skills.nature',
  occultism: 'sheet.pf2e.skills.occultism',
  performance: 'sheet.skills.performance',
  religion: 'sheet.skills.religion',
  society: 'sheet.pf2e.skills.society',
  stealth: 'sheet.skills.stealth',
  survival: 'sheet.skills.survival',
  thievery: 'sheet.pf2e.skills.thievery',
};

const calculateModifier = (score: number): number => Math.floor((score - 10) / 2);
const formatModifier = (mod: number): string => mod >= 0 ? `+${mod}` : `${mod}`;

const shouldUseWhiteText = (hexColor: string): boolean => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

const calculateTotalBulk = (inventory: any[]): number => {
  return inventory.reduce((total, item) => {
    let itemBulk = 0;
    if (typeof item.bulk === 'number') itemBulk = item.bulk;
    else if (item.bulk === 'L') itemBulk = 0.1;
    else if (item.bulk === '—' || item.bulk === '-') itemBulk = 0;
    return total + (itemBulk * (item.quantity || 1));
  }, 0);
};

export const Pathfinder2eCharacterEditor: React.FC<Pathfinder2eCharacterEditorProps> = ({
  character,
  onSave,
  onCancel,
  onDirtyChange,
}) => {
  const { t } = useTranslation(['character', 'common', 'game-systems']);
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [isSaving, setIsSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: serverConfig } = useServerConfigQuery();

  const data = character.data as any;

  const [formData, setFormData] = useState<any>(() => ({
    ...data,
    attributes: data.attributes || {
      strength: { score: 10, modifier: 0 },
      dexterity: { score: 10, modifier: 0 },
      constitution: { score: 10, modifier: 0 },
      intelligence: { score: 10, modifier: 0 },
      wisdom: { score: 10, modifier: 0 },
      charisma: { score: 10, modifier: 0 },
    },
    savingThrows: data.savingThrows || {
      fortitude: { proficiencyRank: 'untrained', itemBonus: 0, bonus: 0 },
      reflex: { proficiencyRank: 'untrained', itemBonus: 0, bonus: 0 },
      will: { proficiencyRank: 'untrained', itemBonus: 0, bonus: 0 },
    },
    perception: data.perception || { proficiencyRank: 'untrained', itemBonus: 0, bonus: 0, senses: [] },
    skills: data.skills || {
      acrobatics: { attribute: 'dexterity', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      arcana: { attribute: 'intelligence', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      athletics: { attribute: 'strength', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      crafting: { attribute: 'intelligence', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      deception: { attribute: 'charisma', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      diplomacy: { attribute: 'charisma', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      intimidation: { attribute: 'charisma', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      medicine: { attribute: 'wisdom', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      nature: { attribute: 'wisdom', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      occultism: { attribute: 'intelligence', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      performance: { attribute: 'charisma', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      religion: { attribute: 'wisdom', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      society: { attribute: 'intelligence', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      stealth: { attribute: 'dexterity', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      survival: { attribute: 'wisdom', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
      thievery: { attribute: 'dexterity', proficiencyRank: 'untrained', armorPenalty: 0, itemBonus: 0, bonus: 0 },
    },
    loreSkills: data.loreSkills || [],
    armorClass: data.armorClass || { total: 10, proficiencyRank: 'untrained', capDex: null, itemBonus: 0, armorPenalty: 0 },
    classDC: data.classDC || { total: 10, keyAttribute: 'intelligence', proficiencyRank: 'untrained' },
    initiative: data.initiative || { usedStat: 'perception', bonus: 0 },
    speed: data.speed || { land: 30, other: [] },
    hp: data.hp || { maximum: 0, ancestryHp: 6, classHpPerLevel: 6, current: 0, temporary: 0, resistances: [], immunities: [], weaknesses: [] },
    deathAndDying: data.deathAndDying || { dying: 0, wounded: 0, doomed: 0 },
    conditions: data.conditions || [],
    proficiencies: data.proficiencies || {
      weapons: { simple: 'untrained', martial: 'untrained', advanced: 'untrained', unarmed: 'untrained' },
      armor: { unarmored: 'untrained', light: 'untrained', medium: 'untrained', heavy: 'untrained' },
    },
    strikes: data.strikes || [],
    currency: data.currency || { cp: 0, sp: 0, gp: 0, pp: 0 },
    inventory: data.inventory || [],
    bulk: data.bulk || { current: 0, encumbered: 5, maximum: 10 },
    languages: data.languages || [],
    feats: {
      ancestryAndHeritage: data.feats?.ancestryAndHeritage || [],
      class: data.feats?.class || [],
      skill: data.feats?.skill || [],
      general: data.feats?.general || [],
      bonus: data.feats?.bonus || [],
    },
    classFeatures: data.classFeatures || [],
    spellcasting: data.spellcasting ? {
      ...data.spellcasting,
      cantrips: data.spellcasting.cantrips || [],
      slots: data.spellcasting.slots || {},
      spells: data.spellcasting.spells || [],
      focusSpells: data.spellcasting.focusSpells || { focusPoints: { total: 0, current: 0 }, spells: [] },
      innateSpells: data.spellcasting.innateSpells || [],
      rituals: data.spellcasting.rituals || [],
    } : null,
    appearance: data.appearance || {},
    personality: data.personality || {},
    backstory: data.backstory || '',
    alliesAndOrganizations: data.alliesAndOrganizations || { name: '', description: '' },
    notes: data.notes || '',
    treasure: data.treasure || '',
  }));

  // Report the first edit up to whoever is hosting this sheet, so leaving with
  // unsaved work can be caught. One effect on the whole form rather than a call
  // in each of the ~40 field handlers: it cannot be forgotten when a field is
  // added, and it catches changes made any way at all. The initial render is
  // skipped, and the flag is reset after a successful save.
  // Two conditions, both required, because either alone gets it wrong.
  //
  // The AC, bulk and max-HP effects below call `setFormData` unconditionally
  // while the sheet is mounting, so `formData` changes identity — and often
  // value — before anyone has touched anything. Reporting on identity alone
  // marked every sheet dirty on open, and comparing values alone still did,
  // because those effects genuinely write different numbers to a sheet whose
  // stored values had drifted.
  //
  // So: until the first real interaction the baseline simply follows the form,
  // absorbing that settling. From the first interaction onwards the baseline is
  // frozen and edits are measured against it — which also means typing a value
  // and putting it back reads as clean, as it should.
  const dirtyRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const cleanSnapshotRef = useRef<string | null>(null);
  if (cleanSnapshotRef.current === null) {
    cleanSnapshotRef.current = JSON.stringify(formData);
  }
  // Always the current form state, for reading inside async callbacks.
  const latestFormDataRef = useRef(formData);
  latestFormDataRef.current = formData;

  useEffect(() => {
    if (!hasInteractedRef.current) {
      cleanSnapshotRef.current = JSON.stringify(formData);
      return;
    }
    const dirty = JSON.stringify(formData) !== cleanSnapshotRef.current;
    if (dirty !== dirtyRef.current) {
      dirtyRef.current = dirty;
      onDirtyChange?.(dirty);
    }
  }, [formData, onDirtyChange]);

  // Capture-phase, so it runs before the field's own handler updates state.
  // Pointer events are included because plenty of edits here are button
  // presses (add an item, adjust a track) rather than typing.
  const noteInteraction = () => { hasInteractedRef.current = true; };

  const [tokenImageFile, setTokenImageFile] = useState<File | null>(null);
  const [tokenImagePreview, setTokenImagePreview] = useState<string | null>(character.tokenImageUrl);
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [customColorHex, setCustomColorHex] = useState('');
  const [isCustomColor, setIsCustomColor] = useState(false);

  useEffect(() => {
    if (data.themeColor) {
      const savedColor = COLOR_PRESETS.find(c => c.name === data.themeColor);
      if (savedColor) {
        setSelectedColor(savedColor);
        setIsCustomColor(false);
      } else if (data.themeColor.startsWith('#')) {
        setCustomColorHex(data.themeColor);
        setIsCustomColor(true);
      }
    }
  }, [data.themeColor]);

  const handleCustomColorChange = (hex: string) => {
    setCustomColorHex(hex);
    setIsCustomColor(true);
  };

  const handlePresetColorSelect = (color: typeof COLOR_PRESETS[0]) => {
    setSelectedColor(color);
    setIsCustomColor(false);
    setShowColorPicker(false);
  };

  // Auto-calculate ability modifiers
  useEffect(() => {
    const updatedAttributes = { ...formData.attributes };
    let changed = false;
    ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach((ability) => {
      const score = updatedAttributes[ability]?.score || 10;
      const newModifier = calculateModifier(score);
      if (updatedAttributes[ability]?.modifier !== newModifier) {
        updatedAttributes[ability] = { ...updatedAttributes[ability], modifier: newModifier };
        changed = true;
      }
    });
    if (changed) {
      setFormData((prev: any) => ({ ...prev, attributes: updatedAttributes }));
    }
  }, [
    formData.attributes?.strength?.score,
    formData.attributes?.dexterity?.score,
    formData.attributes?.constitution?.score,
    formData.attributes?.intelligence?.score,
    formData.attributes?.wisdom?.score,
    formData.attributes?.charisma?.score,
  ]);

  // Auto-calculate saving throws
  useEffect(() => {
    if (!formData.attributes || !formData.savingThrows || !formData.level) return;
    const updatedSavingThrows = { ...formData.savingThrows };
    const saveAttributes = { fortitude: 'constitution', reflex: 'dexterity', will: 'wisdom' };
    let hasChanges = false;
    Object.entries(saveAttributes).forEach(([save, attribute]) => {
      const abilityMod = formData.attributes[attribute]?.modifier || 0;
      const profBonus = calculateProficiencyBonus(formData.level, updatedSavingThrows[save]?.proficiencyRank || 'untrained');
      const itemBonus = updatedSavingThrows[save]?.itemBonus || 0;
      const newBonus = abilityMod + profBonus + itemBonus;
      if (updatedSavingThrows[save]?.bonus !== newBonus) {
        updatedSavingThrows[save] = { ...updatedSavingThrows[save], bonus: newBonus };
        hasChanges = true;
      }
    });
    if (hasChanges) {
      setFormData((prev: any) => ({ ...prev, savingThrows: updatedSavingThrows }));
    }
  }, [formData.level, formData.attributes?.constitution?.modifier, formData.attributes?.dexterity?.modifier, formData.attributes?.wisdom?.modifier, formData.savingThrows?.fortitude?.proficiencyRank, formData.savingThrows?.fortitude?.itemBonus, formData.savingThrows?.reflex?.proficiencyRank, formData.savingThrows?.reflex?.itemBonus, formData.savingThrows?.will?.proficiencyRank, formData.savingThrows?.will?.itemBonus]);

  // Auto-calculate perception
  useEffect(() => {
    if (!formData.attributes || !formData.perception || !formData.level) return;
    const wisdomMod = formData.attributes.wisdom?.modifier || 0;
    const profBonus = calculateProficiencyBonus(formData.level, formData.perception.proficiencyRank || 'untrained');
    const itemBonus = formData.perception.itemBonus || 0;
    setFormData((prev: any) => ({ ...prev, perception: { ...prev.perception, bonus: wisdomMod + profBonus + itemBonus } }));
  }, [formData.level, formData.attributes?.wisdom?.modifier, formData.perception?.proficiencyRank, formData.perception?.itemBonus]);

  // Auto-calculate skills
  useEffect(() => {
    if (!formData.attributes || !formData.skills || !formData.level) return;
    const updatedSkills = { ...formData.skills };
    let hasChanges = false;
    Object.keys(updatedSkills).forEach((skill) => {
      if (!updatedSkills[skill]) return;
      const attribute = updatedSkills[skill].attribute;
      const abilityMod = formData.attributes[attribute]?.modifier || 0;
      const profBonus = calculateProficiencyBonus(formData.level, updatedSkills[skill].proficiencyRank || 'untrained');
      const itemBonus = updatedSkills[skill].itemBonus || 0;
      const armorPenalty = updatedSkills[skill].armorPenalty || 0;
      const newBonus = abilityMod + profBonus + itemBonus - armorPenalty;
      if (updatedSkills[skill].bonus !== newBonus) {
        updatedSkills[skill] = { ...updatedSkills[skill], bonus: newBonus };
        hasChanges = true;
      }
    });
    if (hasChanges) {
      setFormData((prev: any) => ({ ...prev, skills: updatedSkills }));
    }
  }, [
    formData.level,
    formData.attributes?.strength?.modifier,
    formData.attributes?.dexterity?.modifier,
    formData.attributes?.constitution?.modifier,
    formData.attributes?.intelligence?.modifier,
    formData.attributes?.wisdom?.modifier,
    formData.attributes?.charisma?.modifier,
    formData.skills?.acrobatics?.proficiencyRank,
    formData.skills?.acrobatics?.itemBonus,
    formData.skills?.acrobatics?.armorPenalty,
    formData.skills?.arcana?.proficiencyRank,
    formData.skills?.arcana?.itemBonus,
    formData.skills?.arcana?.armorPenalty,
    formData.skills?.athletics?.proficiencyRank,
    formData.skills?.athletics?.itemBonus,
    formData.skills?.athletics?.armorPenalty,
    formData.skills?.crafting?.proficiencyRank,
    formData.skills?.crafting?.itemBonus,
    formData.skills?.crafting?.armorPenalty,
    formData.skills?.deception?.proficiencyRank,
    formData.skills?.deception?.itemBonus,
    formData.skills?.deception?.armorPenalty,
    formData.skills?.diplomacy?.proficiencyRank,
    formData.skills?.diplomacy?.itemBonus,
    formData.skills?.diplomacy?.armorPenalty,
    formData.skills?.intimidation?.proficiencyRank,
    formData.skills?.intimidation?.itemBonus,
    formData.skills?.intimidation?.armorPenalty,
    formData.skills?.medicine?.proficiencyRank,
    formData.skills?.medicine?.itemBonus,
    formData.skills?.medicine?.armorPenalty,
    formData.skills?.nature?.proficiencyRank,
    formData.skills?.nature?.itemBonus,
    formData.skills?.nature?.armorPenalty,
    formData.skills?.occultism?.proficiencyRank,
    formData.skills?.occultism?.itemBonus,
    formData.skills?.occultism?.armorPenalty,
    formData.skills?.performance?.proficiencyRank,
    formData.skills?.performance?.itemBonus,
    formData.skills?.performance?.armorPenalty,
    formData.skills?.religion?.proficiencyRank,
    formData.skills?.religion?.itemBonus,
    formData.skills?.religion?.armorPenalty,
    formData.skills?.society?.proficiencyRank,
    formData.skills?.society?.itemBonus,
    formData.skills?.society?.armorPenalty,
    formData.skills?.stealth?.proficiencyRank,
    formData.skills?.stealth?.itemBonus,
    formData.skills?.stealth?.armorPenalty,
    formData.skills?.survival?.proficiencyRank,
    formData.skills?.survival?.itemBonus,
    formData.skills?.survival?.armorPenalty,
    formData.skills?.thievery?.proficiencyRank,
    formData.skills?.thievery?.itemBonus,
    formData.skills?.thievery?.armorPenalty,
  ]);

  // Auto-calculate lore skills
  useEffect(() => {
    if (!formData.attributes || !formData.loreSkills || !formData.level) return;
    let hasChanges = false;
    const updatedLoreSkills = formData.loreSkills.map((lore: any) => {
      const abilityMod = formData.attributes[lore.attribute]?.modifier || 0;
      const profBonus = calculateProficiencyBonus(formData.level, lore.proficiencyRank || 'untrained');
      const itemBonus = lore.itemBonus || 0;
      const newBonus = abilityMod + profBonus + itemBonus;
      if (lore.bonus !== newBonus) {
        hasChanges = true;
      }
      return { ...lore, bonus: newBonus };
    });
    if (hasChanges) {
      setFormData((prev: any) => ({ ...prev, loreSkills: updatedLoreSkills }));
    }
  }, [
    formData.level,
    formData.attributes?.strength?.modifier,
    formData.attributes?.dexterity?.modifier,
    formData.attributes?.constitution?.modifier,
    formData.attributes?.intelligence?.modifier,
    formData.attributes?.wisdom?.modifier,
    formData.attributes?.charisma?.modifier,
    // Can't easily depend on specific lore skill properties since they're dynamic
    // but the hasChanges check prevents infinite loops
    formData.loreSkills?.length,
    JSON.stringify(formData.loreSkills?.map((l: any) => ({ proficiencyRank: l.proficiencyRank, itemBonus: l.itemBonus, attribute: l.attribute }))),
  ]);

  // Auto-calculate AC
  useEffect(() => {
    if (!formData.attributes || !formData.armorClass || !formData.level) return;
    const dexMod = formData.attributes.dexterity?.modifier || 0;
    const capDex = formData.armorClass.capDex;
    const effectiveDexMod = capDex !== null && capDex !== undefined ? Math.min(dexMod, capDex) : dexMod;
    const profBonus = calculateProficiencyBonus(formData.level, formData.armorClass.proficiencyRank || 'untrained');
    const itemBonus = formData.armorClass.itemBonus || 0;
    const total = 10 + effectiveDexMod + profBonus + itemBonus;
    setFormData((prev: any) => ({ ...prev, armorClass: { ...prev.armorClass, total } }));
  }, [formData.level, formData.attributes?.dexterity?.modifier, formData.armorClass?.proficiencyRank, formData.armorClass?.itemBonus, formData.armorClass?.capDex]);

  /**
   * Auto-calculate the initiative bonus.
   *
   * Initiative in Pathfinder 2e is a Perception check, or another skill when the
   * GM calls for one — Stealth to sneak up on someone. The sheet already records
   * that choice in `initiative.usedStat` and shows the resulting bonus, but
   * nothing ever calculated it, so every character read +0 no matter how good
   * their Perception was. The bonus simply follows whichever stat is named.
   *
   * Guarded by an equality check, like the Class DC effect below, so opening a
   * sheet whose value already agrees does not queue a state change.
   */
  useEffect(() => {
    if (!formData.initiative) return;
    const bonus = pf2eInitiativeBonus(formData);
    if (formData.initiative.bonus !== bonus) {
      setFormData((prev: any) => ({ ...prev, initiative: { ...prev.initiative, bonus } }));
    }
  }, [
    formData.initiative?.usedStat,
    formData.initiative?.bonus,
    // The computed value itself, rather than a list of the stats it might come
    // from. The dropdown offers Perception and Stealth, but `usedStat` is a free
    // string in the schema, so an imported sheet can name any skill — listing
    // two by hand would leave those characters with a stale bonus.
    pf2eInitiativeBonus(formData),
  ]);

  // Auto-calculate Class DC
  useEffect(() => {
    if (!formData.attributes || !formData.classDC || !formData.level) return;
    const keyAttr = formData.classDC.keyAttribute || 'intelligence';
    const attrMod = formData.attributes[keyAttr]?.modifier || 0;
    const profBonus = calculateProficiencyBonus(formData.level, formData.classDC.proficiencyRank || 'untrained');
    const total = 10 + attrMod + profBonus;
    if (formData.classDC.total !== total) {
      setFormData((prev: any) => ({ ...prev, classDC: { ...prev.classDC, total } }));
    }
  }, [
    formData.level,
    formData.attributes?.strength?.modifier,
    formData.attributes?.dexterity?.modifier,
    formData.attributes?.constitution?.modifier,
    formData.attributes?.intelligence?.modifier,
    formData.attributes?.wisdom?.modifier,
    formData.attributes?.charisma?.modifier,
    formData.classDC?.keyAttribute,
    formData.classDC?.proficiencyRank,
  ]);

  // Auto-calculate bulk
  useEffect(() => {
    if (!formData.inventory) return;
    const currentBulk = calculateTotalBulk(formData.inventory);
    const strMod = formData.attributes?.strength?.modifier || 0;
    setFormData((prev: any) => ({ ...prev, bulk: { current: currentBulk, encumbered: 5 + strMod, maximum: 10 + strMod } }));
  }, [formData.inventory, formData.attributes?.strength?.modifier]);

  // Auto-calculate maximum HP
  useEffect(() => {
    if (!formData.level || !formData.hp) return;
    const ancestryHp = formData.hp.ancestryHp || 6;
    const classHpPerLevel = formData.hp.classHpPerLevel || 6;
    const conMod = formData.attributes?.constitution?.modifier || 0;
    const maximum = ancestryHp + (classHpPerLevel * formData.level) + (conMod * formData.level);
    setFormData((prev: any) => ({ ...prev, hp: { ...prev.hp, maximum } }));
  }, [formData.level, formData.hp?.ancestryHp, formData.hp?.classHpPerLevel, formData.attributes?.constitution?.modifier]);

  // Auto-calculate spellcasting
  useEffect(() => {
    if (!formData.spellcasting || !formData.attributes || !formData.level) return;
    const keyAttr = formData.spellcasting.keyAttribute || 'intelligence';
    const attrMod = formData.attributes[keyAttr]?.modifier || 0;
    const profBonus = calculateProficiencyBonus(formData.level, formData.spellcasting.spellAttackBonus?.proficiencyRank || 'untrained');
    const itemBonus = formData.spellcasting.spellAttackBonus?.itemBonus || 0;
    const newBonus = attrMod + profBonus + itemBonus;
    const newDC = 10 + attrMod + profBonus + itemBonus;
    if (formData.spellcasting.spellAttackBonus?.bonus !== newBonus || formData.spellcasting.spellDC?.dc !== newDC) {
      setFormData((prev: any) => ({
        ...prev,
        spellcasting: {
          ...prev.spellcasting,
          spellAttackBonus: { ...prev.spellcasting.spellAttackBonus, bonus: newBonus },
          spellDC: { ...prev.spellcasting.spellDC, dc: newDC },
        },
      }));
    }
  }, [
    formData.level,
    formData.attributes?.strength?.modifier,
    formData.attributes?.dexterity?.modifier,
    formData.attributes?.constitution?.modifier,
    formData.attributes?.intelligence?.modifier,
    formData.attributes?.wisdom?.modifier,
    formData.attributes?.charisma?.modifier,
    formData.spellcasting?.keyAttribute,
    formData.spellcasting?.spellAttackBonus?.proficiencyRank,
    formData.spellcasting?.spellAttackBonus?.itemBonus,
  ]);

  const handleTokenImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, tokenImage: t('editor.errors.invalidImageType') });
        return;
      }
      const tokenLimit = getUploadLimit(serverConfig, AssetType.TOKEN);
      if (file.size > tokenLimit) {
        setErrors({ ...errors, tokenImage: t('editor.errors.imageTooLarge', { limit: formatUploadLimit(tokenLimit) }) });
        return;
      }
      setTokenImageFile(file);
      setErrors({ ...errors, tokenImage: '' });
      const reader = new FileReader();
      reader.onloadend = () => setTokenImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateField = (path: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (Array.isArray(current[keys[i]])) {
          current[keys[i]] = [...current[keys[i]]];
        } else if (typeof current[keys[i]] === 'object' && current[keys[i]] !== null) {
          current[keys[i]] = { ...current[keys[i]] };
        } else {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.characterName || formData.characterName.trim() === '') {
      newErrors.characterName = t('editor.errors.nameRequired');
    }
    if (!formData.level || formData.level < 1 || formData.level > 20) {
      newErrors.level = t('editor.errors.levelRange');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // A completed save means nothing is pending any more.
    // Unless the sheet was edited again while the save was in flight, which the
    // recheck preserves.
    const savedSnapshot = JSON.stringify(formData);
    const markClean = () => {
      cleanSnapshotRef.current = savedSnapshot;
      const stillDirty = JSON.stringify(latestFormDataRef.current) !== savedSnapshot;
      dirtyRef.current = stillDirty;
      onDirtyChange?.(stillDirty);
    };
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const updatedData = { ...formData, themeColor: isCustomColor ? customColorHex : selectedColor.name };

      // Upload token image if a new one was selected
      let newTokenImageUrl: string | undefined = undefined;
      if (tokenImageFile) {
        try {
          const assetFormData = new FormData();
          // File last so the server can name the type if it rejects the upload
          assetFormData.append('type', 'TOKEN');
          if (character.campaignId) {
            assetFormData.append('scope', 'CAMPAIGN');
            assetFormData.append('campaignId', character.campaignId);
          } else {
            assetFormData.append('scope', 'USER');
          }
          assetFormData.append('name', `${formData.characterName || 'Character'} Token`);
          assetFormData.append('file', tokenImageFile);

          const uploadResponse = await api.uploadAsset(assetFormData);
          const assetId = uploadResponse.asset.id;

          // Store the new token URL to pass separately to onSave
          newTokenImageUrl = `/api/assets/tokens/${assetId}`;
        } catch (uploadError: any) {
          console.error('Error uploading token image:', uploadError);
          setErrors({ ...errors, tokenImage: uploadError.response?.data?.message || t('editor.errors.tokenUploadFailed') });
          setIsSaving(false);
          return;
        }
      }

      // Pass the tokenImageUrl as a separate parameter if it was uploaded
      await onSave(updatedData, true, newTokenImageUrl);
      markClean();
    } catch (error) {
      console.error('Error saving character:', error);
      setErrors({ ...errors, submit: t('editor.saveFailed') });
    } finally {
      setIsSaving(false);
    }
  };

  const renderProficiencySelector = (path: string, currentRank: ProficiencyRank) => (
    <select
      value={currentRank}
      onChange={(e) => updateField(path, e.target.value as ProficiencyRank)}
      className="px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {PROFICIENCY_RANKS.map((rank) => (
        <option key={rank} value={rank}>
          {t(`sheet.pf2e.proficiency.${rank}`)}
        </option>
      ))}
    </select>
  );

  const renderHeader = () => {
    const headerStyle = isCustomColor ? { background: `linear-gradient(to right, ${customColorHex}, ${customColorHex}dd)` } : {};
    const headerTextColor = isCustomColor ? (shouldUseWhiteText(customColorHex) ? 'text-white' : 'text-stone-900') : (shouldUseWhiteText(selectedColor.hex) ? 'text-white' : 'text-stone-900');
    const headerClasses = isCustomColor ? `${headerTextColor} p-6 rounded-t-lg relative` : `bg-gradient-to-r ${selectedColor.from} ${selectedColor.to} ${headerTextColor} p-6 rounded-t-lg relative`;

    return (
      <div className={headerClasses} style={headerStyle}>
        {/* Save and Cancel Buttons */}
        <div className="absolute top-4 right-16 flex items-center space-x-2">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? t('common:saving') : t('common:save')}</span>
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium shadow-lg"
          >
            <X className="w-4 h-4" />
            <span>{t('common:cancel')}</span>
          </button>
        </div>

        <button onClick={() => setShowColorPicker(!showColorPicker)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors" title={t('sheet.themeColor.changeTitle')}>
          <Palette className="w-5 h-5" />
        </button>

        {showColorPicker && (
          <div className="absolute top-16 right-4 bg-white text-stone-800 rounded-lg shadow-xl p-4 z-10 border-2 border-stone-200 max-w-md">
            <h4 className="font-semibold mb-3">{t('sheet.themeColor.heading')}</h4>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {COLOR_PRESETS.map((color) => (
                <button key={color.name} onClick={() => handlePresetColorSelect(color)} className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${!isCustomColor && selectedColor.name === color.name ? 'ring-2 ring-stone-400 bg-stone-100' : 'hover:bg-stone-50'}`}>
                  <div className={`w-full h-6 rounded mb-1 bg-gradient-to-r ${color.from} ${color.to}`} />
                  <div className="text-xs">{t(`sheet.pf2e.colorPresets.${color.labelKey}`)}</div>
                </button>
              ))}
            </div>
            <div className="border-t pt-4 space-y-3">
              <h5 className="text-sm font-semibold text-stone-700">{t('sheet.themeColor.customHeading')}</h5>
              <div className="flex items-center space-x-2">
                <input type="color" value={customColorHex || '#1d4ed8'} onChange={(e) => handleCustomColorChange(e.target.value)} className="w-12 h-12 rounded cursor-pointer border-2 border-stone-300" title={t('sheet.themeColor.pickerTitle')} />
                <div className="flex-1">
                  <input type="text" value={customColorHex} onChange={(e) => { const hex = e.target.value; if (hex === '' || /^#[0-9A-Fa-f]{0,6}$/.test(hex)) handleCustomColorChange(hex); }} placeholder="#1d4ed8" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="text-xs text-stone-500 mt-1">{t('sheet.themeColor.hexHint')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* pr-64 reserves the strip the absolutely-positioned Save/Cancel
            cluster and palette button occupy above. Without it the Level and
            Hero Points fields sit underneath them. */}
        <div className="flex items-start justify-between pr-64">
          {/* min-w-0 so this column can shrink. Flex children default to
              min-width:auto, which lets the character-name input push out past
              the reserved padding on a narrow window and back under the
              buttons. */}
          <div className="flex items-start space-x-4 min-w-0">
            <div className="flex-shrink-0 relative group">
              <input type="file" id="token-upload" accept="image/*" onChange={handleTokenImageChange} className="hidden" />
              <label htmlFor="token-upload" className="cursor-pointer block relative">
                {tokenImagePreview ? (
                  <img src={tokenImagePreview} alt={formData.characterName || t('sheet.unnamedCharacter')} className="w-40 h-40 rounded-full border-4 border-white/20 object-cover" />
                ) : (
                  <div className="w-40 h-40 rounded-full border-4 border-white/20 bg-stone-800 flex items-center justify-center">
                    <User className="w-20 h-20 text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-12 h-12 text-white" />
                </div>
              </label>
              {errors.tokenImage && <div className="absolute top-full mt-1 text-xs text-red-200 whitespace-nowrap">{errors.tokenImage}</div>}
              {!character.campaignId && (
                <div className="absolute top-full mt-1 text-xs text-amber-200 whitespace-nowrap">
                  {t('sheet.personalTokenNote')}
                </div>
              )}
            </div>

            <div className="space-y-2 min-w-0">
              <input type="text" value={formData.characterName || ''} onChange={(e) => updateField('characterName', e.target.value)} placeholder={t('modal.new.nameLabel')} className={`w-full text-3xl font-bold bg-white/10 border-2 ${errors.characterName ? 'border-red-300' : 'border-white/20'} rounded px-3 py-1 ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`} />
              <div className="flex items-center flex-wrap gap-2 opacity-90">
                {/* Read-only: the player name is whoever owns the character,
                    filled from their display name at creation. */}
                <span className={`text-sm ${headerTextColor}`}>{formData.playerName || '—'}</span>
              </div>
              <div className="flex items-center flex-wrap gap-2 opacity-90">
                <div className="flex items-center space-x-2">
                  <span className="text-xs">{t('sheet.level')}</span>
                  <NumberField
min={1} max={20} value={formData.level} onChange={(v: number) => updateField('level', v)} className={`w-16 bg-white/10 border ${errors.level ? 'border-red-300' : 'border-white/20'} rounded px-2 py-0.5 text-sm ${headerTextColor} focus:outline-none focus:border-white/40`} fallback={1} />
                </div>
                <input type="text" value={formData.class || ''} onChange={(e) => updateField('class', e.target.value)} placeholder={t('sheet.class')} className={`bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`} />
                <input type="text" value={formData.ancestry || ''} onChange={(e) => updateField('ancestry', e.target.value)} placeholder={t('sheet.pf2e.ancestryPlaceholder')} className={`bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`} />
                <input type="text" value={formData.heritage || ''} onChange={(e) => updateField('heritage', e.target.value)} placeholder={t('sheet.pf2e.heritagePlaceholder')} className={`bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`} />
                <input type="text" value={formData.background || ''} onChange={(e) => updateField('background', e.target.value)} placeholder={t('sheet.background')} className={`bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`} />
              </div>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="text-xs opacity-70">{t('sheet.experiencePoints')}</div>
            <NumberField
min={0} value={formData.experiencePoints} onChange={(v: number) => updateField('experiencePoints', v)} className={`w-24 text-xl font-bold bg-white/10 border border-white/20 rounded px-2 py-1 ${headerTextColor} text-right focus:outline-none focus:border-white/40`} fallback={0} />
            <div className="text-xs opacity-70 mt-2">{t('sheet.pf2e.heroPoints')}</div>
            <NumberField
min={0} max={3} value={formData.heroPoints} onChange={(v: number) => updateField('heroPoints', Math.min(v, 3))} className={`w-16 text-lg font-bold bg-white/10 border border-white/20 rounded px-2 py-1 ${headerTextColor} text-right focus:outline-none focus:border-white/40`} fallback={0} />
          </div>
        </div>
      </div>
    );
  };

  const renderTabs = () => (
    <div className="flex space-x-1 border-b-2 border-stone-200 bg-stone-50 px-4">
      {getTabs(t).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${isActive ? `text-${selectedColor.accent} border-b-2 border-${selectedColor.accent} -mb-0.5 bg-white` : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100'}`}>
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      {/* Attributes */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-4">{t('sheet.abilityScores')}</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((ability) => {
            const abilityData = formData.attributes?.[ability] || { score: 10, modifier: 0 };
            return (
              <div key={ability} className="flex flex-col items-center">
                <div className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1">{t(`game-systems:dnd5e.abilityAbbr.${ABILITY_ABBR[ability]}`)}</div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg border-2 border-blue-900">
                  <span className="text-2xl font-bold text-white">{formatModifier(abilityData.modifier)}</span>
                </div>
                <NumberField
min={1} max={30} value={abilityData.score} onChange={(v: number) => updateField(`attributes.${ability}.score`, v)} className="w-16 px-2 py-1 text-center font-semibold border-2 border-stone-300 rounded mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={10} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Saving Throws */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.savingThrows')}</h3>
        <div className="space-y-3">
          {['fortitude', 'reflex', 'will'].map((save) => {
            const saveData = formData.savingThrows?.[save] || { proficiencyRank: 'untrained', bonus: 0, itemBonus: 0 };
            return (
              <div key={save} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-stone-800 capitalize w-24">{t(`sheet.pf2e.savingThrows.${save}`)}</span>
                  {renderProficiencySelector(`savingThrows.${save}.proficiencyRank`, saveData.proficiencyRank as ProficiencyRank)}
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-stone-600">{t('sheet.pf2e.itemLabel')}</label>
                    <NumberField
value={saveData.itemBonus} onChange={(v: number) => updateField(`savingThrows.${save}.itemBonus`, v)} className="w-16 px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-700">{formatModifier(saveData.bonus)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Perception */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.skills.perception')}</h3>
        <div className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-3">
            {renderProficiencySelector('perception.proficiencyRank', formData.perception?.proficiencyRank as ProficiencyRank || 'untrained')}
            <div className="flex items-center space-x-2">
              <label className="text-xs text-stone-600">{t('sheet.pf2e.itemLabel')}</label>
              <NumberField
value={formData.perception?.itemBonus} onChange={(v: number) => updateField('perception.itemBonus', v)} className="w-16 px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
            </div>
          </div>
          <span className="text-2xl font-bold text-blue-700">{formatModifier(formData.perception?.bonus || 0)}</span>
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-700 mb-2 block">{t('sheet.pf2e.sensesLabel')}</label>
          <input type="text" value={(formData.perception?.senses || []).join(', ')} onChange={(e) => updateField('perception.senses', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="low-light vision, darkvision 60 ft." className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Skills */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.skillList')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.keys(formData.skills).map((skillName) => {
            const skillData = formData.skills[skillName];
            const displayName = t(PF2E_SKILL_KEY[skillName] || skillName);
            return (
              <div key={skillName} className="bg-white border border-stone-200 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-stone-800">{displayName}</span>
                  <span className="text-lg font-bold text-blue-700">{formatModifier(skillData.bonus)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {renderProficiencySelector(`skills.${skillName}.proficiencyRank`, skillData.proficiencyRank as ProficiencyRank)}
                  <NumberField
value={skillData.itemBonus} onChange={(v: number) => updateField(`skills.${skillName}.itemBonus`, v)} placeholder={t('sheet.pf2e.itemPlaceholder')} className="w-16 px-2 py-1 border border-stone-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
                  <NumberField
value={skillData.armorPenalty} onChange={(v: number) => updateField(`skills.${skillName}.armorPenalty`, v)} placeholder={t('sheet.pf2e.penaltyPlaceholder')} className="w-16 px-2 py-1 border border-stone-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lore Skills */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.loreSkillsHeading')}</h3>
          <button onClick={() => { const newLore = [...(formData.loreSkills || []), { name: 'New Lore', attribute: 'intelligence', proficiencyRank: 'trained', itemBonus: 0, bonus: 0 }]; updateField('loreSkills', newLore); }} className="px-3 py-1 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center space-x-1">
            <Plus className="w-4 h-4" />
            <span>{t('sheet.pf2e.addLore')}</span>
          </button>
        </div>
        <div className="space-y-2">
          {(formData.loreSkills || []).map((lore: any, index: number) => (
            <div key={index} className="bg-white border border-stone-200 rounded-lg p-2">
              <div className="flex items-center justify-between mb-2">
                <input type="text" value={lore.name} onChange={(e) => updateField(`loreSkills.${index}.name`, e.target.value)} placeholder={t('sheet.pf2e.loreNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => { const newLoreSkills = formData.loreSkills.filter((_: any, i: number) => i !== index); updateField('loreSkills', newLoreSkills); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800 font-bold">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center space-x-2">
                {renderProficiencySelector(`loreSkills.${index}.proficiencyRank`, lore.proficiencyRank as ProficiencyRank)}
                <NumberField
value={lore.itemBonus} onChange={(v: number) => updateField(`loreSkills.${index}.itemBonus`, v)} placeholder={t('sheet.pf2e.itemPlaceholder')} className="w-16 px-2 py-1 border border-stone-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
                <span className="text-lg font-bold text-blue-700 ml-auto">{formatModifier(lore.bonus)}</span>
              </div>
            </div>
          ))}
          {(!formData.loreSkills || formData.loreSkills.length === 0) && (
            <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noLoreSkills')}</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCombatTab = () => (
    <div className="space-y-6">
      {/* AC, Class DC, Initiative, Speed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.armorClass')}</h3>
          <div className="space-y-2">
            {renderProficiencySelector('armorClass.proficiencyRank', formData.armorClass?.proficiencyRank as ProficiencyRank || 'untrained')}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-stone-700 w-24">{t('sheet.pf2e.dexCapLabel')}</label>
              <input type="number" min="-1" value={formData.armorClass?.capDex === null ? '' : formData.armorClass?.capDex} onChange={(e) => updateField('armorClass.capDex', e.target.value === '' ? null : parseInt(e.target.value))} placeholder={t('common:none')} className="flex-1 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-stone-700 w-24">{t('sheet.pf2e.itemBonusLabel')}</label>
              <NumberField
value={formData.armorClass?.itemBonus} onChange={(v: number) => updateField('armorClass.itemBonus', v)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
            </div>
            <div className="text-center pt-2 border-t border-stone-300">
              <div className="text-xs text-stone-600 mb-1">{t('sheet.pf2e.totalAC')}</div>
              <div className="text-4xl font-bold text-blue-800">{formData.armorClass?.total || 10}</div>
            </div>
          </div>
        </div>

        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.classDCHeading')}</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-stone-700 w-32">{t('sheet.pf2e.keyAttributeLabel')}</label>
              <select value={formData.classDC?.keyAttribute || 'intelligence'} onChange={(e) => updateField('classDC.keyAttribute', e.target.value)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((attr) => (
                  <option key={attr} value={attr}>{t(`game-systems:pathfinder2e.abilities.${ABILITY_ABBR[attr]}`)}</option>
                ))}
              </select>
            </div>
            {renderProficiencySelector('classDC.proficiencyRank', formData.classDC?.proficiencyRank as ProficiencyRank || 'untrained')}
            <div className="text-center pt-2 border-t border-stone-300">
              <div className="text-xs text-stone-600 mb-1">{t('sheet.pf2e.totalDC')}</div>
              <div className="text-4xl font-bold text-purple-800">{formData.classDC?.total || 10}</div>
            </div>
          </div>
        </div>

        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.initiative')}</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-stone-700 w-24">{t('sheet.pf2e.usesLabel')}</label>
              <select value={formData.initiative?.usedStat || 'perception'} onChange={(e) => updateField('initiative.usedStat', e.target.value)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="perception">{t('sheet.skills.perception')}</option>
                <option value="stealth">{t('sheet.skills.stealth')}</option>
              </select>
            </div>
            <div className="text-center pt-2 border-t border-stone-300">
              <div className="text-xs text-stone-600 mb-1">{t('sheet.pf2e.initiativeBonusLabel')}</div>
              <div className="text-4xl font-bold text-amber-800">{formatModifier(formData.initiative?.bonus || 0)}</div>
            </div>
          </div>
        </div>

        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.speed')}</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-stone-700 w-24">{t('sheet.pf2e.landLabel')}</label>
              <NumberField
min={0} value={formData.speed?.land} onChange={(v: number) => updateField('speed.land', v)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={30} />
            </div>
            <div>
              <label className="text-sm text-stone-700 mb-1 block">{t('sheet.pf2e.otherSpeedLabel')}</label>
              <input type="text" value={(formData.speed?.other || []).join(', ')} onChange={(e) => updateField('speed.other', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="fly 30 ft., swim 20 ft." className="w-full px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* HP, Death/Dying */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.hitPoints')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.pf2e.ancestryHpLabel')}</label>
            <NumberField
min={0} value={formData.hp?.ancestryHp} onChange={(v: number) => updateField('hp.ancestryHp', v)} className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={6} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.pf2e.classHpPerLevelLabel')}</label>
            <NumberField
min={0} value={formData.hp?.classHpPerLevel} onChange={(v: number) => updateField('hp.classHpPerLevel', v)} className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={6} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.maximum')}</label>
            <div className="text-2xl font-bold text-red-800 text-center py-1">{formData.hp?.maximum || 0}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.current')}</label>
            <NumberField
min={0} value={formData.hp?.current} onChange={(v: number) => updateField('hp.current', v)} className="w-full px-2 py-1 border border-stone-300 rounded text-center text-red-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.temporary')}</label>
            <NumberField
min={0} value={formData.hp?.temporary} onChange={(v: number) => updateField('hp.temporary', v)} className="w-full px-2 py-1 border border-stone-300 rounded text-center text-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.pf2e.resistancesLabel')}</label>
            <input type="text" value={(formData.hp?.resistances || []).join(', ')} onChange={(e) => updateField('hp.resistances', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="fire 5" className="w-full px-2 py-1 border border-stone-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.pf2e.immunitiesLabel')}</label>
            <input type="text" value={(formData.hp?.immunities || []).join(', ')} onChange={(e) => updateField('hp.immunities', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="poison" className="w-full px-2 py-1 border border-stone-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.pf2e.weaknessesLabel')}</label>
            <input type="text" value={(formData.hp?.weaknesses || []).join(', ')} onChange={(e) => updateField('hp.weaknesses', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="cold 5" className="w-full px-2 py-1 border border-stone-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Death & Dying */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.deathAndDyingHeading')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-red-700 mb-1 block">{t('sheet.pf2e.dyingLabel')}</label>
            <NumberField
min={0} max={4} value={formData.deathAndDying?.dying} onChange={(v: number) => updateField('deathAndDying.dying', Math.min(v, 4))} className="w-full px-3 py-2 border border-stone-300 rounded text-center text-xl font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500" fallback={0} />
          </div>
          <div>
            <label className="text-sm font-semibold text-amber-700 mb-1 block">{t('sheet.pf2e.woundedLabel')}</label>
            <NumberField
min={0} value={formData.deathAndDying?.wounded} onChange={(v: number) => updateField('deathAndDying.wounded', v)} className="w-full px-3 py-2 border border-stone-300 rounded text-center text-xl font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500" fallback={0} />
          </div>
          <div>
            <label className="text-sm font-semibold text-purple-700 mb-1 block">{t('sheet.pf2e.doomedLabel')}</label>
            <NumberField
min={0} value={formData.deathAndDying?.doomed} onChange={(v: number) => updateField('deathAndDying.doomed', v)} className="w-full px-3 py-2 border border-stone-300 rounded text-center text-xl font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500" fallback={0} />
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.conditionsHeading')}</h3>
        <input type="text" value={(formData.conditions || []).join(', ')} onChange={(e) => updateField('conditions', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="frightened, sickened, etc." className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Proficiencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.weaponProficienciesHeading')}</h3>
          <div className="space-y-2">
            {['simple', 'martial', 'advanced', 'unarmed'].map((weapon) => (
              <div key={weapon} className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-800 capitalize">{t(`sheet.pf2e.weaponCategories.${weapon}`)}</span>
                {renderProficiencySelector(`proficiencies.weapons.${weapon}`, formData.proficiencies?.weapons?.[weapon] as ProficiencyRank || 'untrained')}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.armorProficienciesHeading')}</h3>
          <div className="space-y-2">
            {['unarmored', 'light', 'medium', 'heavy'].map((armor) => (
              <div key={armor} className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-800 capitalize">{t(`sheet.pf2e.armorCategories.${armor}`)}</span>
                {renderProficiencySelector(`proficiencies.armor.${armor}`, formData.proficiencies?.armor?.[armor] as ProficiencyRank || 'untrained')}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strikes */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.strikesAndAttacksHeading')}</h3>
          <button onClick={() => { const newStrikes = [...(formData.strikes || []), { name: 'New Attack', type: 'melee', attackBonus: 0, damageRoll: '1d6', damageType: 'bludgeoning', attributeModifier: 'strength', proficiencyRank: 'trained', itemBonus: 0, traits: [], range: null, notes: '' }]; updateField('strikes', newStrikes); }} className="px-3 py-1 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center space-x-1">
            <Plus className="w-4 h-4" />
            <span>{t('sheet.pf2e.addStrike')}</span>
          </button>
        </div>
        <div className="space-y-3">
          {(formData.strikes || []).map((strike: any, index: number) => (
            <div key={index} className="bg-white border border-stone-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <input type="text" value={strike.name} onChange={(e) => updateField(`strikes.${index}.name`, e.target.value)} placeholder={t('sheet.attackNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => { const newStrikes = formData.strikes.filter((_: any, i: number) => i !== index); updateField('strikes', newStrikes); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={strike.type} onChange={(e) => updateField(`strikes.${index}.type`, e.target.value)} className="px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="melee">{t('sheet.pf2e.strikeType.melee')}</option>
                  <option value="ranged">{t('sheet.pf2e.strikeType.ranged')}</option>
                </select>
                {renderProficiencySelector(`strikes.${index}.proficiencyRank`, strike.proficiencyRank as ProficiencyRank)}
                <NumberField
value={strike.attackBonus} onChange={(v: number) => updateField(`strikes.${index}.attackBonus`, v)} placeholder={t('sheet.attackBonus')} className="px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
                <input type="text" value={strike.damageRoll} onChange={(e) => updateField(`strikes.${index}.damageRoll`, e.target.value)} placeholder="1d6" className="px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" value={strike.damageType} onChange={(e) => updateField(`strikes.${index}.damageType`, e.target.value)} placeholder={t('sheet.damageType')} className="px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" min="0" value={strike.range || ''} onChange={(e) => updateField(`strikes.${index}.range`, e.target.value === '' ? null : parseInt(e.target.value))} placeholder={`${t('sheet.range')} (ft)`} className="px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <input type="text" value={(strike.traits || []).join(', ')} onChange={(e) => updateField(`strikes.${index}.traits`, e.target.value.split(',').map(t => t.trim()).filter(t => t))} placeholder={t('sheet.pf2e.traitsPlaceholder')} className="w-full px-2 py-1 mt-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={strike.notes || ''} onChange={(e) => updateField(`strikes.${index}.notes`, e.target.value)} placeholder={t('sheet.notes')} className="w-full px-2 py-1 mt-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          {(!formData.strikes || formData.strikes.length === 0) && (
            <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noStrikes')}</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSpellsTab = () => {
    if (!formData.spellcasting) {
      return (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6 text-center">
          <p className="text-amber-800 mb-4">{t('sheet.pf2e.noSpellcastingConfigured')}</p>
          <button onClick={() => updateField('spellcasting', { tradition: 'arcane', type: 'prepared', keyAttribute: 'intelligence', spellAttackBonus: { proficiencyRank: 'trained', itemBonus: 0, bonus: 0 }, spellDC: { proficiencyRank: 'trained', itemBonus: 0, dc: 10 }, cantrips: [], slots: {}, spells: [], focusSpells: { focusPoints: { total: 0, current: 0 }, spells: [] }, innateSpells: [], rituals: [] })} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800">
            {t('sheet.pf2e.enableSpellcasting')}
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Spellcasting Config */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.spellcastingConfigurationHeading')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-stone-700 mb-1 block">{t('sheet.pf2e.traditionLabel')}</label>
              <select value={formData.spellcasting.tradition} onChange={(e) => updateField('spellcasting.tradition', e.target.value)} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['arcane', 'divine', 'primal', 'occult'].map((tradition) => (
                  <option key={tradition} value={tradition}>{t(`sheet.pf2e.traditions.${tradition}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-700 mb-1 block">{t('sheet.type')}</label>
              <select value={formData.spellcasting.type} onChange={(e) => updateField('spellcasting.type', e.target.value)} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="prepared">{t('sheet.prepared')}</option>
                <option value="spontaneous">{t('sheet.pf2e.spontaneous')}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-700 mb-1 block">{t('sheet.pf2e.keyAttributeHeading')}</label>
              <select value={formData.spellcasting.keyAttribute} onChange={(e) => updateField('spellcasting.keyAttribute', e.target.value)} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['intelligence', 'wisdom', 'charisma'].map((attr) => (
                  <option key={attr} value={attr}>{t(`game-systems:pathfinder2e.abilities.${ABILITY_ABBR[attr]}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Spell Attack & DC */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.spellAttack')}</h3>
            <div className="space-y-2">
              {renderProficiencySelector('spellcasting.spellAttackBonus.proficiencyRank', formData.spellcasting.spellAttackBonus?.proficiencyRank as ProficiencyRank || 'untrained')}
              <div className="flex items-center space-x-2">
                <label className="text-sm text-stone-700">{t('sheet.pf2e.itemBonusLabel')}</label>
                <NumberField
value={formData.spellcasting.spellAttackBonus?.itemBonus} onChange={(v: number) => updateField('spellcasting.spellAttackBonus.itemBonus', v)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
              </div>
              <div className="text-center pt-2 border-t border-stone-300">
                <div className="text-xs text-stone-600 mb-1">{t('sheet.pf2e.totalAttackLabel')}</div>
                <div className="text-4xl font-bold text-purple-800">{formatModifier(formData.spellcasting.spellAttackBonus?.bonus || 0)}</div>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.spellDCHeading')}</h3>
            <div className="space-y-2">
              {renderProficiencySelector('spellcasting.spellDC.proficiencyRank', formData.spellcasting.spellDC?.proficiencyRank as ProficiencyRank || 'untrained')}
              <div className="flex items-center space-x-2">
                <label className="text-sm text-stone-700">{t('sheet.pf2e.itemBonusLabel')}</label>
                <NumberField
value={formData.spellcasting.spellDC?.itemBonus} onChange={(v: number) => updateField('spellcasting.spellDC.itemBonus', v)} className="flex-1 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
              </div>
              <div className="text-center pt-2 border-t border-stone-300">
                <div className="text-xs text-stone-600 mb-1">{t('sheet.pf2e.totalDC')}</div>
                <div className="text-4xl font-bold text-purple-800">{formData.spellcasting.spellDC?.dc || 10}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cantrips */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-800">{t('sheet.cantrips')}</h3>
            <button onClick={() => { const newCantrips = [...(formData.spellcasting.cantrips || []), { name: 'New Cantrip', tradition: formData.spellcasting.tradition }]; updateField('spellcasting.cantrips', newCantrips); }} className="px-3 py-1 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center space-x-1">
              <Plus className="w-4 h-4" />
              <span>{t('sheet.pf2e.addCantrip')}</span>
            </button>
          </div>
          <div className="space-y-2">
            {(formData.spellcasting.cantrips || []).map((cantrip: any, index: number) => (
              <div key={index} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-2">
                <input type="text" value={cantrip.name || cantrip} onChange={(e) => updateField(`spellcasting.cantrips.${index}.name`, e.target.value)} placeholder={t('sheet.pf2e.cantripNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={() => { const newCantrips = formData.spellcasting.cantrips.filter((_: any, i: number) => i !== index); updateField('spellcasting.cantrips', newCantrips); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.spellcasting.cantrips || formData.spellcasting.cantrips.length === 0) && (
              <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noCantrips')}</div>
            )}
          </div>
        </div>

        {/* Spell Slots */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.spellSlotsHeading')}</h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => {
              const slots = formData.spellcasting.slots?.[rank] || { total: 0, used: 0 };
              return (
                <div key={rank} className="bg-white border border-stone-200 rounded-lg p-2">
                  <div className="text-xs font-semibold text-center text-stone-600 mb-1">{t('sheet.pf2e.rankLabel', { rank })}</div>
                  <div className="flex flex-col space-y-1">
                    <NumberField
min={0} max={20} value={slots.total} onChange={(v: number) => updateField(`spellcasting.slots.${rank}.total`, v)} placeholder={t('sheet.total')} className="w-full px-1 py-0.5 border border-stone-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500" fallback={0} />
                    <NumberField
min={0} max={slots.total || 0} value={slots.used} onChange={(v: number) => updateField(`spellcasting.slots.${rank}.used`, Math.min(v, slots.total || 0))} placeholder={t('sheet.used')} className="w-full px-1 py-0.5 border border-purple-300 rounded text-xs text-center text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-500" fallback={0} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spells Known/Prepared */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-800">{t('sheet.spells')} {formData.spellcasting.type === 'prepared' ? t('sheet.prepared') : t('sheet.pf2e.known')}</h3>
            <button onClick={() => { const newSpells = [...(formData.spellcasting.spells || []), { name: 'New Spell', rank: 1, tradition: formData.spellcasting.tradition, prepared: formData.spellcasting.type === 'prepared' }]; updateField('spellcasting.spells', newSpells); }} className="px-3 py-1 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center space-x-1">
              <Plus className="w-4 h-4" />
              <span>{t('sheet.addSpell')}</span>
            </button>
          </div>
          <div className="space-y-2">
            {(formData.spellcasting.spells || []).map((spell: any, index: number) => (
              <div key={index} className="bg-white border border-stone-200 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <input type="text" value={spell.name} onChange={(e) => updateField(`spellcasting.spells.${index}.name`, e.target.value)} placeholder={t('sheet.spellNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <button onClick={() => { const newSpells = formData.spellcasting.spells.filter((_: any, i: number) => i !== index); updateField('spellcasting.spells', newSpells); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <select value={spell.rank} onChange={(e) => updateField(`spellcasting.spells.${index}.rank`, parseInt(e.target.value))} className="px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                      <option key={r} value={r}>{t('sheet.pf2e.rankLabel', { rank: r })}</option>
                    ))}
                  </select>
                  {formData.spellcasting.type === 'prepared' && (
                    <label className="flex items-center text-sm">
                      <input type="checkbox" checked={spell.prepared || false} onChange={(e) => updateField(`spellcasting.spells.${index}.prepared`, e.target.checked)} className="mr-1" />
                      {t('sheet.prepared')}
                    </label>
                  )}
                </div>
              </div>
            ))}
            {(!formData.spellcasting.spells || formData.spellcasting.spells.length === 0) && (
              <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.noSpellsAdded')}</div>
            )}
          </div>
        </div>

        {/* Focus Spells */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.focusSpellsHeading')}</h3>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-semibold text-stone-700">{t('sheet.pf2e.focusPointsLabel')}</label>
                <NumberField
min={0} max={3} value={formData.spellcasting.focusSpells?.focusPoints?.current} onChange={(v: number) => updateField('spellcasting.focusSpells.focusPoints.current', Math.min(v, 3))} className="w-12 px-2 py-1 border border-stone-300 rounded text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-500" fallback={0} />
                <span className="text-sm text-stone-600">/ 3</span>
              </div>
              <button onClick={() => { const newFocusSpells = [...(formData.spellcasting.focusSpells?.spells || []), { name: 'New Focus Spell', tradition: formData.spellcasting.tradition }]; updateField('spellcasting.focusSpells.spells', newFocusSpells); updateField('spellcasting.focusSpells.focusPoints.total', 3); }} className="px-3 py-1 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center space-x-1">
                <Plus className="w-4 h-4" />
                <span>{t('sheet.pf2e.addFocusSpell')}</span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {(formData.spellcasting.focusSpells?.spells || []).map((spell: any, index: number) => (
              <div key={index} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-2">
                <input type="text" value={spell.name} onChange={(e) => updateField(`spellcasting.focusSpells.spells.${index}.name`, e.target.value)} placeholder={t('sheet.pf2e.focusSpellNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={() => { const newFocusSpells = formData.spellcasting.focusSpells.spells.filter((_: any, i: number) => i !== index); updateField('spellcasting.focusSpells.spells', newFocusSpells); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.spellcasting.focusSpells?.spells || formData.spellcasting.focusSpells.spells.length === 0) && (
              <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noFocusSpells')}</div>
            )}
          </div>
        </div>

        {/* Innate Spells */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.innateSpellsHeading')}</h3>
            <button onClick={() => { const newInnateSpells = [...(formData.spellcasting.innateSpells || []), { name: 'New Innate Spell', tradition: formData.spellcasting.tradition, frequency: 'at will' }]; updateField('spellcasting.innateSpells', newInnateSpells); }} className="px-3 py-1 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center space-x-1">
              <Plus className="w-4 h-4" />
              <span>{t('sheet.pf2e.addInnateSpell')}</span>
            </button>
          </div>
          <div className="space-y-2">
            {(formData.spellcasting.innateSpells || []).map((spell: any, index: number) => (
              <div key={index} className="bg-white border border-stone-200 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <input type="text" value={spell.name} onChange={(e) => updateField(`spellcasting.innateSpells.${index}.name`, e.target.value)} placeholder={t('sheet.pf2e.innateSpellNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <button onClick={() => { const newInnateSpells = formData.spellcasting.innateSpells.filter((_: any, i: number) => i !== index); updateField('spellcasting.innateSpells', newInnateSpells); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input type="text" value={spell.frequency} onChange={(e) => updateField(`spellcasting.innateSpells.${index}.frequency`, e.target.value)} placeholder={t('sheet.pf2e.frequencyPlaceholder')} className="w-full px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            ))}
            {(!formData.spellcasting.innateSpells || formData.spellcasting.innateSpells.length === 0) && (
              <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noInnateSpells')}</div>
            )}
          </div>
        </div>

        {/* Rituals */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.ritualsHeading')}</h3>
            <button onClick={() => { const newRituals = [...(formData.spellcasting.rituals || []), { name: 'New Ritual', rank: 1 }]; updateField('spellcasting.rituals', newRituals); }} className="px-3 py-1 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors flex items-center space-x-1">
              <Plus className="w-4 h-4" />
              <span>{t('sheet.pf2e.addRitual')}</span>
            </button>
          </div>
          <div className="space-y-2">
            {(formData.spellcasting.rituals || []).map((ritual: any, index: number) => (
              <div key={index} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-2">
                <input type="text" value={ritual.name} onChange={(e) => updateField(`spellcasting.rituals.${index}.name`, e.target.value)} placeholder={t('sheet.pf2e.ritualNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <select value={ritual.rank} onChange={(e) => updateField(`spellcasting.rituals.${index}.rank`, parseInt(e.target.value))} className="ml-2 px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                    <option key={r} value={r}>{t('sheet.pf2e.rankLabel', { rank: r })}</option>
                  ))}
                </select>
                <button onClick={() => { const newRituals = formData.spellcasting.rituals.filter((_: any, i: number) => i !== index); updateField('spellcasting.rituals', newRituals); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.spellcasting.rituals || formData.spellcasting.rituals.length === 0) && (
              <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noRituals')}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryTab = () => (
    <div className="space-y-6">
      {/* Currency */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.currency')}</h3>
        <div className="grid grid-cols-4 gap-4">
          {[{ key: 'pp', label: t('sheet.currencyLabels.platinum') }, { key: 'gp', label: t('sheet.currencyLabels.gold') }, { key: 'sp', label: t('sheet.currencyLabels.silver') }, { key: 'cp', label: t('sheet.currencyLabels.copper') }].map((currency) => (
            <div key={currency.key}>
              <label className="text-sm font-semibold text-stone-700 mb-1 block">{currency.label}</label>
              <NumberField
min={0} value={formData.currency?.[currency.key]} onChange={(v: number) => updateField(`currency.${currency.key}`, v)} className="w-full px-2 py-2 border border-stone-300 rounded text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Summary */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
        <h3 className="text-lg font-bold text-blue-800 mb-2">{t('sheet.pf2e.bulkSummaryHeading')}</h3>
        <div className="text-sm text-blue-700">
          <span className="font-semibold">{formData.bulk?.current?.toFixed(1) || 0}</span> / {t('sheet.pf2e.encumberedThreshold', { value: formData.bulk?.encumbered || 5 })} / {t('sheet.pf2e.maxThreshold', { value: formData.bulk?.maximum || 10 })}
        </div>
      </div>

      {/* Inventory Items */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.inventoryItemsHeading')}</h3>
          <button onClick={() => { const newInventory = [...(formData.inventory || []), { name: 'New Item', quantity: 1, bulk: 'L', equippable: false, equipped: false, requiresAttunement: false, attuned: false, invested: false, value: 0, notes: '' }]; updateField('inventory', newInventory); }} className="px-3 py-1 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center space-x-1">
            <Plus className="w-4 h-4" />
            <span>{t('sheet.addItem')}</span>
          </button>
        </div>
        <div className="space-y-3">
          {(formData.inventory || []).map((item: any, index: number) => (
            <div key={index} className="bg-white border border-stone-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <input type="text" value={item.name} onChange={(e) => updateField(`inventory.${index}.name`, e.target.value)} placeholder={t('sheet.itemNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => { const newInventory = formData.inventory.filter((_: any, i: number) => i !== index); updateField('inventory', newInventory); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NumberField
min={1} value={item.quantity} onChange={(v: number) => updateField(`inventory.${index}.quantity`, v)} placeholder={t('sheet.qty')} className="px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={1} />
                <input type="text" value={item.bulk} onChange={(e) => updateField(`inventory.${index}.bulk`, e.target.value)} placeholder={t('sheet.pf2e.bulk')} className="px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <NumberField
min={0} value={item.value} onChange={(v: number) => updateField(`inventory.${index}.value`, v)} placeholder={t('sheet.value')} className="px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={0} />
                <div className="flex items-center space-x-1 text-xs">
                  <label className="flex items-center">
                    <input type="checkbox" checked={item.equipped || false} onChange={(e) => updateField(`inventory.${index}.equipped`, e.target.checked)} className="mr-1" />
                    {t('sheet.pf2e.equipShort')}
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" checked={item.invested || false} onChange={(e) => updateField(`inventory.${index}.invested`, e.target.checked)} className="mr-1" />
                    {t('sheet.pf2e.investShort')}
                  </label>
                </div>
              </div>
              <input type="text" value={item.notes || ''} onChange={(e) => updateField(`inventory.${index}.notes`, e.target.value)} placeholder={t('sheet.notes')} className="w-full px-2 py-1 mt-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          {(!formData.inventory || formData.inventory.length === 0) && (
            <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.noItems')}</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFeatsTab = () => {
    const featCategories: { key: string; label: string; color: string }[] = [
      { key: 'ancestryAndHeritage', label: t('sheet.pf2e.featCategories.ancestryAndHeritage'), color: 'green' },
      { key: 'class', label: t('sheet.pf2e.featCategories.class'), color: 'blue' },
      { key: 'skill', label: t('sheet.pf2e.featCategories.skill'), color: 'amber' },
      { key: 'general', label: t('sheet.pf2e.featCategories.general'), color: 'purple' },
      { key: 'bonus', label: t('sheet.pf2e.featCategories.bonus'), color: 'rose' },
    ];

    return (
      <div className="space-y-6">
        {/* Class Features */}
        <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-800">{t('sheet.pf2e.classFeaturesHeading')}</h3>
            <button onClick={() => { const newFeatures = [...(formData.classFeatures || []), 'New Class Feature']; updateField('classFeatures', newFeatures); }} className="px-3 py-1 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors flex items-center space-x-1">
              <Plus className="w-4 h-4" />
              <span>{t('sheet.pf2e.addFeature')}</span>
            </button>
          </div>
          <div className="space-y-2">
            {(formData.classFeatures || []).map((feature: string, index: number) => (
              <div key={index} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg p-2">
                <input type="text" value={feature} onChange={(e) => updateField(`classFeatures.${index}`, e.target.value)} placeholder={t('sheet.pf2e.classFeatureNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => { const newFeatures = formData.classFeatures.filter((_: string, i: number) => i !== index); updateField('classFeatures', newFeatures); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.classFeatures || formData.classFeatures.length === 0) && (
              <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noClassFeatures')}</div>
            )}
          </div>
        </div>

        {/* Feats by Category */}
        {featCategories.map(({ key, label, color }) => (
          <div key={key} className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-stone-800">{label}</h3>
              <button onClick={() => { const currentFeats = formData.feats?.[key] || []; const newFeats = [...currentFeats, { name: 'New Feat', level: formData.level || 1, description: '' }]; updateField(`feats.${key}`, newFeats); }} className={`px-3 py-1 text-sm font-medium text-white bg-${color}-700 hover:bg-${color}-800 rounded-lg transition-colors flex items-center space-x-1`}>
                <Plus className="w-4 h-4" />
                <span>{t('sheet.pf2e.addFeat')}</span>
              </button>
            </div>
            <div className="space-y-3">
              {(formData.feats?.[key] || []).map((feat: any, index: number) => (
                <div key={index} className="bg-white border border-stone-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <input type="text" value={feat.name} onChange={(e) => updateField(`feats.${key}.${index}.name`, e.target.value)} placeholder={t('sheet.pf2e.featNamePlaceholder')} className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="flex items-center space-x-2 ml-2">
                      <label className="text-xs text-stone-600">{t('sheet.pf2e.levelColonLabel')}</label>
                      <NumberField
min={1} max={20} value={feat.level} onChange={(v: number) => updateField(`feats.${key}.${index}.level`, v)} className="w-16 px-2 py-1 border border-stone-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" fallback={1} />
                    </div>
                    <button onClick={() => { const newFeats = formData.feats[key].filter((_: any, i: number) => i !== index); updateField(`feats.${key}`, newFeats); }} className="ml-2 px-2 py-1 text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea value={feat.description || ''} onChange={(e) => updateField(`feats.${key}.${index}.description`, e.target.value)} placeholder={t('sheet.pf2e.featDescriptionPlaceholder')} rows={2} className="w-full px-2 py-1 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              {(!formData.feats?.[key] || formData.feats[key].length === 0) && (
                <div className="text-sm text-stone-500 italic text-center py-4">{t('sheet.pf2e.noFeatsInCategory', { category: label.toLowerCase() })}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderBioTab = () => (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.appearance')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">{t('sheet.age')}</label>
            <input type="text" value={formData.appearance?.age || ''} onChange={(e) => updateField('appearance.age', e.target.value)} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {['height', 'weight', 'eyes', 'skin', 'hair'].map((field) => (
            <div key={field}>
              <label className="text-xs font-semibold text-stone-600 mb-1 block capitalize">{t(`sheet.${field}`)}</label>
              <input type="text" value={formData.appearance?.[field] || ''} onChange={(e) => updateField(`appearance.${field}`, e.target.value)} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Personality */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.personality')}</h3>
        <div className="space-y-3">
          {['traits', 'ideals', 'bonds', 'flaws'].map((field) => (
            <div key={field}>
              <label className="text-sm font-semibold text-stone-700 mb-1 block capitalize">{t(`sheet.${field}`)}</label>
              <textarea value={formData.personality?.[field] || ''} onChange={(e) => updateField(`personality.${field}`, e.target.value)} rows={2} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.pf2e.languagesHeading')}</h3>
        <input type="text" value={(formData.languages || []).join(', ')} onChange={(e) => updateField('languages', e.target.value.split(',').map(l => l.trim()).filter(l => l))} placeholder="Common, Elven, Draconic" className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Backstory */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.backstory')}</h3>
        <textarea value={formData.backstory || ''} onChange={(e) => updateField('backstory', e.target.value)} rows={6} placeholder={t('sheet.backstoryPlaceholder')} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Allies & Organizations */}
      <div className="bg-stone-50 border-2 border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-bold text-stone-800 mb-3">{t('sheet.alliesAndOrganizations')}</h3>
        <div className="space-y-2">
          <input type="text" value={formData.alliesAndOrganizations?.name || ''} onChange={(e) => updateField('alliesAndOrganizations.name', e.target.value)} placeholder={t('sheet.pf2e.organizationNamePlaceholder')} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea value={formData.alliesAndOrganizations?.description || ''} onChange={(e) => updateField('alliesAndOrganizations.description', e.target.value)} rows={3} placeholder={t('sheet.pf2e.allyDescriptionPlaceholder')} className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Notes & Treasure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <h3 className="text-md font-bold text-stone-800 mb-2">{t('sheet.notes')}</h3>
          <textarea value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={4} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <h3 className="text-md font-bold text-stone-800 mb-2">{t('sheet.treasure')}</h3>
          <textarea value={formData.treasure || ''} onChange={(e) => updateField('treasure', e.target.value)} rows={4} className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="bg-white border-2 border-stone-200 rounded-lg overflow-hidden shadow-lg"
      onInputCapture={noteInteraction}
      onChangeCapture={noteInteraction}
      onPointerDownCapture={noteInteraction}
    >
      {renderHeader()}
      {renderTabs()}
      <div className="p-6">
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'combat' && renderCombatTab()}
        {activeTab === 'spells' && renderSpellsTab()}
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'feats' && renderFeatsTab()}
        {activeTab === 'bio' && renderBioTab()}
      </div>
      {errors.submit && (
        <div className="px-6 pb-4 text-sm text-red-600">{errors.submit}</div>
      )}
    </div>
  );
};

export default Pathfinder2eCharacterEditor;
