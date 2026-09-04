/**
 * DnD5eCharacterEditor Component
 *
 * Editable D&D 5e character sheet with auto-calculation, validation,
 * color customization, and token upload functionality.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Swords,
  Package,
  Sparkles,
  User,
  BookOpen,
  Target,
  Save,
  X,
  Upload,
  Palette,
} from 'lucide-react';
import { Character, AssetType } from '../../../types';
import { api } from '../../../services/api';
import { useServerConfigQuery } from '@/hooks/queries';
import { getUploadLimit, formatUploadLimit } from '@/utils/uploadLimits';
import NumberField from '../../ui/NumberField';
import { passiveScore } from '@/utils/rules/dnd5e';
import {
  dnd5eInitiativeModifier,
  dnd5eBackfilledInitiativeBonus,
} from '@/utils/rules/initiative';

interface DnD5eCharacterEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  character: Character;
  onSave: (data: any, showToast?: boolean, tokenImageUrl?: string) => Promise<void>;
  onCancel: () => void;
}

type TabId = 'stats' | 'combat' | 'spells' | 'inventory' | 'features' | 'bio';

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
  { id: 'features', label: t('sheet.features'), icon: BookOpen },
  { id: 'bio', label: t('sheet.bio'), icon: User },
];

// D&D 5e color presets for character sheets.
// `name` is also the stored value (character.data.themeColor) matched against
// on load, so it stays a stable English identifier; `labelKey` looks up the
// translated label shown in the picker UI.
const COLOR_PRESETS = [
  { name: 'Classic Red', labelKey: 'classicRed', from: 'from-red-700', to: 'to-red-900', accent: 'red-700', hex: '#b91c1c' },
  { name: 'Royal Blue', labelKey: 'royalBlue', from: 'from-blue-700', to: 'to-blue-900', accent: 'blue-700', hex: '#1d4ed8' },
  { name: 'Forest Green', labelKey: 'forestGreen', from: 'from-green-700', to: 'to-green-900', accent: 'green-700', hex: '#15803d' },
  { name: 'Deep Purple', labelKey: 'deepPurple', from: 'from-purple-700', to: 'to-purple-900', accent: 'purple-700', hex: '#7e22ce' },
  { name: 'Amber Gold', labelKey: 'amberGold', from: 'from-amber-600', to: 'to-amber-800', accent: 'amber-600', hex: '#d97706' },
  { name: 'Slate Gray', labelKey: 'slateGray', from: 'from-slate-700', to: 'to-slate-900', accent: 'slate-700', hex: '#334155' },
  { name: 'Crimson', labelKey: 'crimson', from: 'from-rose-700', to: 'to-rose-900', accent: 'rose-700', hex: '#be123c' },
  { name: 'Teal', labelKey: 'teal', from: 'from-teal-700', to: 'to-teal-900', accent: 'teal-700', hex: '#0f766e' },
  { name: 'Indigo', labelKey: 'indigo', from: 'from-indigo-700', to: 'to-indigo-900', accent: 'indigo-700', hex: '#4338ca' },
  { name: 'Emerald', labelKey: 'emerald', from: 'from-emerald-700', to: 'to-emerald-900', accent: 'emerald-700', hex: '#047857' },
  { name: 'Orange', labelKey: 'orange', from: 'from-orange-700', to: 'to-orange-900', accent: 'orange-700', hex: '#c2410c' },
  { name: 'Pink', labelKey: 'pink', from: 'from-pink-700', to: 'to-pink-900', accent: 'pink-700', hex: '#be185d' },
];

// D&D 5e ability name -> abbreviation key used to look up translated ability
// names/abbreviations from the `game-systems` namespace.
const ABILITY_ABBR: Record<string, string> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

/**
 * Calculate ability modifier from ability score
 */
const calculateModifier = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

/**
 * Format modifier for display (+3, -1, etc.)
 */
const formatModifier = (mod: number): string => {
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

/**
 * Calculate luminance of a hex color to determine if text should be white or black
 * Returns true if text should be white (dark background), false if text should be black (light background)
 */
const shouldUseWhiteText = (hexColor: string): boolean => {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true for white text if luminance is less than 0.5 (dark background)
  return luminance < 0.5;
};

/**
 * DnD5eCharacterEditor - Editable D&D 5e character sheet
 */
export const DnD5eCharacterEditor: React.FC<DnD5eCharacterEditorProps> = ({
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

  // Type assertion for D&D 5e character data
  const data = character.data as any;

  // Form state - initialize with character data
  const [formData, setFormData] = useState<any>(() => ({
    ...data,
    // Ensure nested objects exist
    stats: data.stats || {},
    savingThrows: data.savingThrows || {},
    skills: data.skills || {},
    hp: data.hp || { maximum: 0, current: 0, temporary: 0 },
    deathSaves: data.deathSaves || { successes: 0, failures: 0 },
    spellcasting: data.spellcasting || {
      ability: '',
      spellSaveDC: 0,
      spellAttackBonus: 0,
      cantrips: [],
      slots: {},
      spells: [],
    },
    currency: data.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    inventory: data.inventory || [],
    attacks: data.attacks || [],
    hitDice: data.hitDice || [],
    conditions: data.conditions || [],
    proficienciesAndLanguages: data.proficienciesAndLanguages || [],
    // Always use a structured object for proficiencies so the textarea fields work correctly.
    // If legacy data stored proficiencies as an array, ignore it and start with empty strings.
    proficiencies: (data.proficiencies && !Array.isArray(data.proficiencies))
      ? { armor: '', weapons: '', tools: '', languages: '', ...data.proficiencies }
      : { armor: '', weapons: '', tools: '', languages: '' },
    featuresAndTraits: data.featuresAndTraits || [],
    appearance: data.appearance || {},
    personality: data.personality || {},
    alliesAndOrganizations: data.alliesAndOrganizations || { name: '', description: '' },
  }));

  // Report unsaved work up to whoever is hosting this sheet, so leaving with
  // pending edits can be caught. One effect over the whole form rather than a
  // call in each of the ~40 field handlers: it cannot be forgotten when a field
  // is added, and it catches changes made any way at all.
  //
  // Two conditions, both required, because either alone gets it wrong.
  //
  // These editors recompute derived values from effects that run as the sheet
  // mounts, so `formData` changes identity — and often value — before anyone
  // has touched anything. Reporting on identity alone marked every sheet dirty
  // on open, and comparing values alone still did, because those effects
  // genuinely write different numbers to a sheet whose stored values had
  // drifted.
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

  // Token image state (file will be uploaded on save)
  const [tokenImageFile, setTokenImageFile] = useState<File | null>(null);
  const [tokenImagePreview, setTokenImagePreview] = useState<string | null>(
    character.tokenImageUrl
  );

  // Color customization state
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]); // Default to Classic Red
  const [customColorHex, setCustomColorHex] = useState('');
  const [isCustomColor, setIsCustomColor] = useState(false);

  // Load saved color preference from character metadata
  useEffect(() => {
    if (data.themeColor) {
      const savedColor = COLOR_PRESETS.find(c => c.name === data.themeColor);
      if (savedColor) {
        setSelectedColor(savedColor);
        setIsCustomColor(false);
      } else if (data.themeColor.startsWith('#')) {
        // Custom hex color
        setCustomColorHex(data.themeColor);
        setIsCustomColor(true);
      }
    }
  }, [data.themeColor]);

  // Handle custom color change
  const handleCustomColorChange = (hex: string) => {
    setCustomColorHex(hex);
    setIsCustomColor(true);
  };

  // Handle preset color selection
  const handlePresetColorSelect = (color: typeof COLOR_PRESETS[0]) => {
    setSelectedColor(color);
    setIsCustomColor(false);
    setShowColorPicker(false);
  };

  // Auto-calculate modifiers when ability scores change
  useEffect(() => {
    if (formData.stats) {
      const updatedStats = { ...formData.stats };
      let hasChanges = false;

      Object.keys(updatedStats).forEach(ability => {
        const score = updatedStats[ability].score;
        const newModifier = calculateModifier(score);
        if (updatedStats[ability].modifier !== newModifier) {
          updatedStats[ability].modifier = newModifier;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setFormData((prev: any) => ({ ...prev, stats: updatedStats }));
      }
    }
  }, [
    formData.stats?.strength?.score,
    formData.stats?.dexterity?.score,
    formData.stats?.constitution?.score,
    formData.stats?.intelligence?.score,
    formData.stats?.wisdom?.score,
    formData.stats?.charisma?.score,
  ]);

  // Auto-calculate saving throws when proficiency or stats change
  useEffect(() => {
    if (formData.stats && formData.savingThrows && formData.proficiencyBonus !== undefined) {
      const updatedSavingThrows = { ...formData.savingThrows };
      let hasChanges = false;

      Object.keys(updatedSavingThrows).forEach(ability => {
        const abilityMod = formData.stats[ability]?.modifier || 0;
        const proficient = updatedSavingThrows[ability].proficient;
        const newBonus = abilityMod + (proficient ? formData.proficiencyBonus : 0);

        if (updatedSavingThrows[ability].bonus !== newBonus) {
          updatedSavingThrows[ability].bonus = newBonus;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setFormData((prev: any) => ({ ...prev, savingThrows: updatedSavingThrows }));
      }
    }
  }, [
    formData.proficiencyBonus,
    formData.stats?.strength?.modifier,
    formData.stats?.dexterity?.modifier,
    formData.stats?.constitution?.modifier,
    formData.stats?.intelligence?.modifier,
    formData.stats?.wisdom?.modifier,
    formData.stats?.charisma?.modifier,
    formData.savingThrows?.strength?.proficient,
    formData.savingThrows?.dexterity?.proficient,
    formData.savingThrows?.constitution?.proficient,
    formData.savingThrows?.intelligence?.proficient,
    formData.savingThrows?.wisdom?.proficient,
    formData.savingThrows?.charisma?.proficient,
  ]);

  // Skill-to-ability mapping
  const skillAbilities: Record<string, string> = {
    acrobatics: 'dexterity',
    animalHandling: 'wisdom',
    arcana: 'intelligence',
    athletics: 'strength',
    deception: 'charisma',
    history: 'intelligence',
    insight: 'wisdom',
    intimidation: 'charisma',
    investigation: 'intelligence',
    medicine: 'wisdom',
    nature: 'intelligence',
    perception: 'wisdom',
    performance: 'charisma',
    persuasion: 'charisma',
    religion: 'intelligence',
    sleightOfHand: 'dexterity',
    stealth: 'dexterity',
    survival: 'wisdom',
  };

  // Initialize skills if they don't exist
  useEffect(() => {
    if (formData.skills) {
      const updatedSkills = { ...formData.skills };
      let needsUpdate = false;

      Object.keys(skillAbilities).forEach((skill) => {
        if (!updatedSkills[skill]) {
          updatedSkills[skill] = { proficient: false, expertise: false, bonus: 0 };
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        setFormData((prev: any) => ({ ...prev, skills: updatedSkills }));
      }
    }
  }, []); // Run once on mount

  // Auto-calculate skill bonuses when ability scores, proficiency, or expertise change
  useEffect(() => {
    if (formData.stats && formData.skills && formData.proficiencyBonus !== undefined) {
      const updatedSkills = { ...formData.skills };
      let hasChanges = false;

      Object.keys(updatedSkills).forEach(skill => {
        const ability = skillAbilities[skill];
        const abilityMod = formData.stats[ability]?.modifier || 0;
        const proficient = updatedSkills[skill].proficient;
        const expertise = updatedSkills[skill].expertise;

        let newBonus = abilityMod;
        if (expertise) {
          newBonus += formData.proficiencyBonus * 2; // Expertise = double proficiency
        } else if (proficient) {
          newBonus += formData.proficiencyBonus;
        }

        if (updatedSkills[skill].bonus !== newBonus) {
          updatedSkills[skill].bonus = newBonus;
          hasChanges = true;
        }
      });

      // Keep the stored passive Perception in step with the Perception bonus.
      // Both sheets now *display* a derived value, so this is not what makes
      // them agree — but the field is part of the saved character and is read
      // by exports and by anything else consuming the blob, so leaving it at a
      // stale number would just move the same lie somewhere less visible.
      //
      // A sheet that carries a total but no `passivePerceptionBonus` predates
      // that field, so the difference is read back as the bonus. Without this a
      // character imported with the Observant feat would silently lose its +5
      // the first time the sheet was saved.
      const perceptionBonus = updatedSkills.perception?.bonus ?? 0;
      const storedTotal = formData.passivePerception;
      const backfilledPassiveBonus =
        formData.passivePerceptionBonus === undefined || formData.passivePerceptionBonus === null
          ? (typeof storedTotal === 'number' && Number.isFinite(storedTotal)
              ? storedTotal - passiveScore(perceptionBonus)
              : 0)
          : null;
      const passiveBonus = backfilledPassiveBonus ?? formData.passivePerceptionBonus ?? 0;
      const newPassivePerception = passiveScore(perceptionBonus + passiveBonus);

      const passiveChanged =
        formData.passivePerception !== newPassivePerception || backfilledPassiveBonus !== null;

      if (hasChanges || passiveChanged) {
        setFormData((prev: any) => ({
          ...prev,
          skills: updatedSkills,
          passivePerceptionBonus: passiveBonus,
          passivePerception: newPassivePerception,
        }));
      }
    }
  }, [
    formData.proficiencyBonus,
    formData.stats?.strength?.modifier,
    formData.stats?.dexterity?.modifier,
    formData.stats?.constitution?.modifier,
    formData.stats?.intelligence?.modifier,
    formData.stats?.wisdom?.modifier,
    formData.stats?.charisma?.modifier,
    // Explicitly depend on each skill's proficient and expertise flags
    ...Object.keys(skillAbilities).flatMap(skill => [
      formData.skills?.[skill]?.proficient,
      formData.skills?.[skill]?.expertise,
    ]),
  ]);

  /**
   * The initiative modifier shown on the sheet: Dexterity plus the manual bonus.
   * Derived on every render rather than read from storage, so what is displayed
   * is always what will be rolled.
   */
  const initiativeModifier = dnd5eInitiativeModifier(formData);

  /**
   * Convert a character saved before `initiativeBonus` existed, and keep the
   * stored total in step afterwards.
   *
   * Initiative used to be one hand-typed number. Someone with the Alert feat and
   * Dexterity 14 typed `7`; now that the total is derived, that has to be read
   * back as "Dexterity +2, other +5" or their character would quietly lose five
   * points. The conversion runs once, only where the new field is absent.
   *
   * The stored `initiative` is then maintained as the derived total. Nothing
   * displays it any more, but it is part of the saved character and is read by
   * exports, so leaving it stale would just hide the same inconsistency
   * somewhere less visible.
   */
  useEffect(() => {
    const backfilled = dnd5eBackfilledInitiativeBonus(formData);
    const bonus = backfilled ?? formData.initiativeBonus ?? 0;
    const total = dnd5eInitiativeModifier({ ...formData, initiativeBonus: bonus });

    const needsBonus = backfilled !== null;
    const needsTotal = formData.initiative !== total;
    if (!needsBonus && !needsTotal) return;

    setFormData((prev: any) => ({
      ...prev,
      ...(needsBonus ? { initiativeBonus: bonus } : {}),
      initiative: total,
    }));
  }, [
    formData.stats?.dexterity?.score,
    formData.stats?.dexterity?.modifier,
    formData.initiativeBonus,
    formData.initiative,
  ]);

  // Handle token image upload
  const handleTokenImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, tokenImage: t('editor.errors.invalidImageType') });
        return;
      }
      // Validate file size against the server's token limit
      const tokenLimit = getUploadLimit(serverConfig, AssetType.TOKEN);
      if (file.size > tokenLimit) {
        setErrors({ ...errors, tokenImage: t('editor.errors.imageTooLarge', { limit: formatUploadLimit(tokenLimit) }) });
        return;
      }
      setTokenImageFile(file);
      setErrors({ ...errors, tokenImage: '' });
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setTokenImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate level (1-20)
    if (!formData.level || formData.level < 1 || formData.level > 20) {
      newErrors.level = t('editor.errors.levelRange');
    }

    // Validate ability scores (1-30)
    if (formData.stats) {
      Object.entries(formData.stats).forEach(([ability, data]: [string, any]) => {
        if (!data.score || data.score < 1 || data.score > 30) {
          newErrors[`stats.${ability}`] = t('editor.errors.abilityScoreRange');
        }
      });
    }

    // Validate character name
    if (!formData.characterName || formData.characterName.trim() === '') {
      newErrors.characterName = t('editor.errors.nameRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Parse comma-separated string into array
  const parseCommaSeparated = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'string') return [];
    return value.split(',').map(i => i.trim()).filter(i => i);
  };

  // Handle form submission
  const handleSubmit = async () => {
    // A completed save means nothing is pending any more — unless the sheet was
    // edited again while the save was in flight, which the recheck preserves.
    const savedSnapshot = JSON.stringify(formData);
    const markClean = () => {
      cleanSnapshotRef.current = savedSnapshot;
      const stillDirty = JSON.stringify(latestFormDataRef.current) !== savedSnapshot;
      dirtyRef.current = stillDirty;
      onDirtyChange?.(stillDirty);
    };
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      // Include color customization in saved data
      const updatedData = {
        ...formData,
        themeColor: isCustomColor ? customColorHex : selectedColor.name,
      };

      // Parse comma-separated strings into arrays for storage
      // Proficiencies
      if (updatedData.proficiencies && typeof updatedData.proficiencies === 'object') {
        const armorArray = parseCommaSeparated(updatedData.proficiencies.armor);
        const weaponsArray = parseCommaSeparated(updatedData.proficiencies.weapons);
        const toolsArray = parseCommaSeparated(updatedData.proficiencies.tools);
        const languagesArray = parseCommaSeparated(updatedData.proficiencies.languages);

        // Flatten to backwards-compatible array
        updatedData.proficienciesAndLanguages = [
          ...armorArray,
          ...weaponsArray,
          ...toolsArray,
          ...languagesArray,
        ];
      }

      // Features & Traits
      updatedData.featuresAndTraits = parseCommaSeparated(updatedData.featuresAndTraits);

      // Cantrips
      if (updatedData.spellcasting) {
        updatedData.spellcasting.cantrips = parseCommaSeparated(updatedData.spellcasting.cantrips);
      }

      // Upload token image if a new one was selected
      let newTokenImageUrl: string | undefined = undefined;
      if (tokenImageFile) {
        try {
          // File last: multer parses parts in order, so the server knows the
          // asset type even if it aborts an oversize file mid-stream.
          const assetFormData = new FormData();
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

  // Update form field
  const updateField = (path: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        // CRITICAL: Preserve array types when cloning nested structures
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

  // Render character header with token upload and color picker
  const renderHeader = () => {
    // Determine the current background style
    const headerStyle = isCustomColor
      ? { background: `linear-gradient(to right, ${customColorHex}, ${customColorHex}dd)` }
      : {};

    // Determine text color based on background luminance
    const headerTextColor = isCustomColor
      ? (shouldUseWhiteText(customColorHex) ? 'text-white' : 'text-stone-900')
      : (shouldUseWhiteText(selectedColor.hex) ? 'text-white' : 'text-stone-900');

    const headerClasses = isCustomColor
      ? `${headerTextColor} p-6 rounded-t-lg relative`
      : `bg-gradient-to-r ${selectedColor.from} ${selectedColor.to} ${headerTextColor} p-6 rounded-t-lg relative`;

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

        {/* Color Picker Button */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          title={t('sheet.themeColor.changeTitle')}
        >
          <Palette className="w-5 h-5" />
        </button>

        {/* Color Picker Dropdown */}
        {showColorPicker && (
          <div className="absolute top-16 right-4 bg-white text-stone-800 rounded-lg shadow-xl p-4 z-10 border-2 border-stone-200 max-w-md">
            <h4 className="font-semibold mb-3">{t('sheet.themeColor.heading')}</h4>

            {/* Preset Colors */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => handlePresetColorSelect(color)}
                  className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    !isCustomColor && selectedColor.name === color.name
                      ? 'ring-2 ring-stone-400 bg-stone-100'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <div className={`w-full h-6 rounded mb-1 bg-gradient-to-r ${color.from} ${color.to}`} />
                  <div className="text-xs">{t(`sheet.colorPresets.${color.labelKey}`)}</div>
                </button>
              ))}
            </div>

            {/* Custom Color Section */}
            <div className="border-t pt-4 space-y-3">
              <h5 className="text-sm font-semibold text-stone-700">{t('sheet.themeColor.customHeading')}</h5>

              <div className="flex items-center space-x-2">
                {/* Native Color Picker */}
                <input
                  type="color"
                  value={customColorHex || '#b91c1c'}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="w-12 h-12 rounded cursor-pointer border-2 border-stone-300"
                  title={t('sheet.themeColor.pickerTitle')}
                />

                {/* Hex Code Input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={customColorHex}
                    onChange={(e) => {
                      const hex = e.target.value;
                      // Validate hex format
                      if (hex === '' || /^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
                        handleCustomColorChange(hex);
                      }
                    }}
                    placeholder="#b91c1c"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-xs text-stone-500 mt-1">{t('sheet.themeColor.hexHint')}</div>
                </div>
              </div>

              {/* Custom Color Preview */}
              {isCustomColor && customColorHex && /^#[0-9A-Fa-f]{6}$/.test(customColorHex) && (
                <div className="flex items-center space-x-2 p-2 bg-stone-50 rounded">
                  <div
                    className="w-8 h-8 rounded"
                    style={{ background: `linear-gradient(to right, ${customColorHex}, ${customColorHex}dd)` }}
                  />
                  <span className="text-sm font-medium">{t('sheet.themeColor.customLabel', { hex: customColorHex })}</span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* pr-64 reserves the strip the absolutely-positioned Save/Cancel cluster
          and palette button occupy above. Without it the Experience Points
          field sits underneath them. */}
      <div className="flex items-start justify-between pr-64">
        {/* min-w-0 so this column can shrink. Flex children default to
            min-width:auto, which lets the character-name input push out past
            the reserved padding on a narrow window and back under the
            buttons. */}
        <div className="flex items-start space-x-4 min-w-0">
          {/* Token Image Upload */}
          <div className="flex-shrink-0 relative group">
            <input
              type="file"
              id="token-upload"
              accept="image/*"
              onChange={handleTokenImageChange}
              className="hidden"
            />
            <label
              htmlFor="token-upload"
              className="cursor-pointer block relative"
            >
              {tokenImagePreview ? (
                <img
                  src={tokenImagePreview}
                  alt={formData.characterName || t('sheet.unnamedCharacter')}
                  className="w-40 h-40 rounded-full border-4 border-white/20 object-cover"
                />
              ) : (
                <div className="w-40 h-40 rounded-full border-4 border-white/20 bg-stone-800 flex items-center justify-center">
                  <User className="w-20 h-20 text-white/40" />
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-12 h-12 text-white" />
              </div>
            </label>
            {errors.tokenImage && (
              <div className="absolute top-full mt-1 text-xs text-red-200 whitespace-nowrap">
                {errors.tokenImage}
              </div>
            )}
            {!character.campaignId && (
              <div className="absolute top-full mt-1 text-xs text-amber-200 whitespace-nowrap">
                {t('sheet.personalTokenNote')}
              </div>
            )}
          </div>

          {/* Character Info */}
          <div className="space-y-2 min-w-0">
            <input
              type="text"
              value={formData.characterName || ''}
              onChange={(e) => updateField('characterName', e.target.value)}
              placeholder={t('modal.new.nameLabel')}
              className={`w-full text-3xl font-bold bg-white/10 border-2 ${
                errors.characterName ? 'border-red-300' : 'border-white/20'
              } rounded px-3 py-1 ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`}
            />
            {/* Player name is who owns this character, not free text — it is
                filled from their display name when the character is created
                and is shown rather than edited. */}
            <div className={`flex items-center space-x-3 opacity-80`}>
              <span className={`text-sm ${headerTextColor}`}>
                {formData.playerName || '—'}
              </span>
            </div>
            <div className={`flex items-center flex-wrap gap-2 opacity-80`}>
              <div className="flex items-center space-x-2">
                <span className="text-xs">{t('sheet.level')}</span>
                <NumberField
min={1}
                  max={20}
                  value={formData.level}
                  onChange={(v: number) => updateField('level', v)}
                  className={`w-16 bg-white/10 border ${
                    errors.level ? 'border-red-300' : 'border-white/20'
                  } rounded px-2 py-0.5 text-sm ${headerTextColor} focus:outline-none focus:border-white/40`}
                fallback={1}
                />
              </div>
              <input
                type="text"
                value={formData.race || ''}
                onChange={(e) => updateField('race', e.target.value)}
                placeholder={t('sheet.race')}
                className={`bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`}
              />
              <input
                type="text"
                value={formData.class || ''}
                onChange={(e) => updateField('class', e.target.value)}
                placeholder={t('sheet.class')}
                className={`bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm ${headerTextColor} placeholder-current/50 focus:outline-none focus:border-white/40`}
              />
            </div>
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className={`text-xs opacity-70`}>{t('sheet.experiencePoints')}</div>
          <NumberField
min={0}
            value={formData.experiencePoints}
            onChange={(v: number) => updateField('experiencePoints', v)}
            className={`w-24 text-xl font-bold bg-white/10 border border-white/20 rounded px-2 py-1 ${headerTextColor} text-right focus:outline-none focus:border-white/40`}
          fallback={0}
          />
        </div>
      </div>
    </div>
    );
  };

  // Render tabs
  const renderTabs = () => (
    <div className="flex space-x-1 border-b-2 border-stone-200 bg-stone-50 px-4">
      {getTabs(t).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center space-x-2 px-4 py-3 font-medium transition-colors
              ${isActive
                ? `text-${selectedColor.accent} border-b-2 border-${selectedColor.accent} -mb-0.5 bg-white`
                : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  // Render Stats & Skills tab
  const renderStatsTab = () => (
    <div className="space-y-6">
      {/* Character Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.alignment')}</label>
          <input
            type="text"
            value={formData.alignment || ''}
            onChange={(e) => updateField('alignment', e.target.value)}
            placeholder={t('sheet.alignmentPlaceholder')}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.background')}</label>
          <input
            type="text"
            value={formData.background || ''}
            onChange={(e) => updateField('background', e.target.value)}
            placeholder={t('sheet.backgroundPlaceholder')}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Proficiency Bonus and Inspiration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.proficiencyBonus')}</label>
          <NumberField
min={2}
            max={6}
            value={formData.proficiencyBonus}
            onChange={(v: number) => updateField('proficiencyBonus', v)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          fallback={2}
          />
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="inspiration"
            checked={formData.inspiration || false}
            onChange={(e) => updateField('inspiration', e.target.checked)}
            className="w-5 h-5 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
          />
          <label htmlFor="inspiration" className="text-sm font-semibold text-stone-700">
            {t('sheet.inspiration')}
          </label>
        </div>
      </div>

      {/* Ability Scores */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('sheet.abilityScores')}</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((ability) => {
            const abilityData = formData.stats?.[ability] || { score: 10, modifier: 0 };
            const error = errors[`stats.${ability}`];

            // Determine circle style and text color
            const circleStyle = isCustomColor
              ? { background: `linear-gradient(to bottom right, ${customColorHex}, ${customColorHex}dd)` }
              : {};
            const circleClasses = isCustomColor
              ? 'w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2'
              : `w-12 h-12 rounded-full bg-gradient-to-br ${selectedColor.from} ${selectedColor.to} flex items-center justify-center shadow-lg border-2`;

            // Determine border color based on theme
            const borderColor = isCustomColor ? customColorHex : selectedColor.hex;
            const borderStyle = { borderColor: borderColor };

            // Determine text color based on background luminance
            const textColor = isCustomColor
              ? (shouldUseWhiteText(customColorHex) ? 'text-white' : 'text-stone-900')
              : 'text-white';

            return (
              <div key={ability} className="flex flex-col items-center space-y-1">
                <div className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                  {t(`game-systems:dnd5e.abilityAbbr.${ABILITY_ABBR[ability]}`)}
                </div>
                <div className={circleClasses} style={{ ...circleStyle, ...borderStyle }}>
                  <span className={`text-xl font-bold ${textColor}`}>
                    {formatModifier(abilityData.modifier)}
                  </span>
                </div>
                <NumberField
min={1}
                  max={30}
                  value={abilityData.score}
                  onChange={(v: number) => updateField(`stats.${ability}.score`, v)
                  }
                  className={`w-16 px-2 py-1 text-center font-semibold border-2 ${
                    error ? 'border-red-500' : 'border-stone-300'
                  } rounded focus:outline-none focus:ring-2 focus:ring-red-500`}
                fallback={10}
                />
                {error && <div className="text-xs text-red-600">{error}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Saving Throws */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.savingThrows')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((ability) => {
            const saveData = formData.savingThrows?.[ability] || { proficient: false, bonus: 0 };
            return (
              <div key={ability} className="flex items-center justify-between p-2 hover:bg-stone-100 rounded">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`save-${ability}`}
                    checked={saveData.proficient}
                    onChange={(e) =>
                      updateField(`savingThrows.${ability}.proficient`, e.target.checked)
                    }
                    className="w-4 h-4 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
                  />
                  <label htmlFor={`save-${ability}`} className="text-sm font-medium text-stone-800 capitalize">
                    {t(`game-systems:dnd5e.abilities.${ABILITY_ABBR[ability]}`)}
                  </label>
                </div>
                <span className={`text-sm font-semibold ${saveData.proficient ? 'text-red-700' : 'text-stone-600'}`}>
                  {formatModifier(saveData.bonus)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.skillList')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {Object.keys(skillAbilities).map((skill) => {
            const skillData = formData.skills?.[skill] || { proficient: false, expertise: false, bonus: 0 };
            const skillLabel = t(`sheet.skills.${skill}`);
            const ability = skillAbilities[skill];
            const abilityAbbr = t(`game-systems:dnd5e.abilityAbbr.${ABILITY_ABBR[ability]}`);

            return (
              <div key={skill} className="flex items-center justify-between p-2 hover:bg-stone-100 rounded">
                <div className="flex items-center space-x-2">
                  {/* Proficiency Checkbox */}
                  <input
                    type="checkbox"
                    id={`skill-prof-${skill}`}
                    checked={skillData.proficient}
                    onChange={(e) => {
                      updateField(`skills.${skill}.proficient`, e.target.checked);
                      // If unchecking proficiency, also uncheck expertise
                      if (!e.target.checked) {
                        updateField(`skills.${skill}.expertise`, false);
                      }
                    }}
                    className="w-4 h-4 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
                  />
                  {/* Expertise Checkbox (double circle) */}
                  <input
                    type="checkbox"
                    id={`skill-exp-${skill}`}
                    checked={skillData.expertise}
                    disabled={!skillData.proficient}
                    onChange={(e) => updateField(`skills.${skill}.expertise`, e.target.checked)}
                    className="w-4 h-4 text-red-700 border-stone-300 rounded-full focus:ring-2 focus:ring-red-500 disabled:opacity-30"
                    title={t('sheet.skills.expertiseHint')}
                  />
                  <label
                    htmlFor={`skill-prof-${skill}`}
                    className="text-sm font-medium text-stone-800 cursor-pointer"
                  >
                    {skillLabel}
                    <span className="text-xs text-stone-500 ml-1">({abilityAbbr})</span>
                  </label>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    skillData.expertise
                      ? 'text-purple-700'
                      : skillData.proficient
                      ? 'text-red-700'
                      : 'text-stone-600'
                  }`}
                >
                  {formatModifier(skillData.bonus)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Passive Perception — derived from the Perception bonus plus anything
          that is not the skill itself, never from the stored field, so this
          matches the view exactly. */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-2">{t('sheet.passivePerception')}</h3>
        <div className="flex items-end gap-4">
          <div className="text-2xl font-bold text-stone-800">
            {passiveScore(
              (formData.skills?.perception?.bonus ?? 0) + (formData.passivePerceptionBonus ?? 0)
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              {t('sheet.otherBonus')}
            </label>
            <NumberField
              value={formData.passivePerceptionBonus ?? 0}
              onChange={(v: number) => updateField('passivePerceptionBonus', v)}
              className="w-20 px-2 py-1 border border-stone-300 rounded text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              fallback={0}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {t('sheet.passivePerceptionHint')}
        </p>
      </div>
    </div>
  );

  // D&D 5e conditions list
  const conditions = [
    'Blinded', 'Charmed', 'Deafened', 'Exhausted', 'Frightened', 'Grappled',
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
    'Prone', 'Restrained', 'Stunned', 'Unconscious'
  ];

  // Render Combat tab
  const renderCombatTab = () => (
    <div className="space-y-6">
      {/* Combat Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.armorClass')}</label>
          <NumberField
min={0}
            value={formData.armorClass}
            onChange={(v: number) => updateField('armorClass', v)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
          fallback={10}
          />
        </div>
        <div>
          {/* Derived, not typed. Initiative is the Dexterity modifier plus the
              "Other bonus" below — it used to be a single hand-typed number
              that nothing kept in step with Dexterity, and that the roll then
              ignored entirely. */}
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.initiative')}</label>
          <div
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-xl font-bold bg-stone-100 text-stone-800"
            title={`${t('sheet.initiativeTooltip', { mod: formatModifier(formData.stats?.dexterity?.modifier ?? 0) })}${
              formData.initiativeBonus ? t('sheet.initiativeTooltipOther', { mod: formatModifier(formData.initiativeBonus) }) : ''
            }`}
          >
            {formatModifier(initiativeModifier)}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.speed')} (ft)</label>
          <NumberField
min={0}
            value={formData.speed}
            onChange={(v: number) => updateField('speed', v)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
          fallback={30}
          />
        </div>
      </div>

      {/* Everything that is not Dexterity. Kept as one box rather than a list of
          toggles because the sources are open-ended — the Alert feat's +5, Jack
          of All Trades and Remarkable Athlete's share of the proficiency bonus,
          subclasses that swap in Wisdom or Intelligence. */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">
            {t('sheet.initiativeOtherBonusLabel')}
          </label>
          <NumberField
            value={formData.initiativeBonus ?? 0}
            onChange={(v: number) => updateField('initiativeBonus', v)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
            fallback={0}
          />
          <p className="mt-1 text-xs text-stone-500">
            {t('sheet.initiativeOtherBonusHint')}
          </p>
        </div>
      </div>

      {/* Hit Points */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.hitPoints')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.maximum')}</label>
            <NumberField
min={0}
              value={formData.hp?.maximum}
              onChange={(v: number) => updateField('hp.maximum', v)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
            fallback={0}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.current')}</label>
            <NumberField
min={0}
              value={formData.hp?.current}
              onChange={(v: number) => updateField('hp.current', v)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-lg font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            fallback={0}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1 capitalize">{t('sheet.temporary')}</label>
            <NumberField
min={0}
              value={formData.hp?.temporary}
              onChange={(v: number) => updateField('hp.temporary', v)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-lg font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            fallback={0}
            />
          </div>
        </div>
      </div>

      {/* Hit Dice */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-stone-800">{t('sheet.hitDice')}</h3>
          <button
            onClick={() => {
              const newHitDice = [
                ...(formData.hitDice || []),
                { class: '', total: '1d6', remaining: 1 },
              ];
              updateField('hitDice', newHitDice);
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
          >
            {t('sheet.addHitDie')}
          </button>
        </div>
        <div className="space-y-2">
          {(formData.hitDice || []).map((die: any, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={die.class || ''}
                onChange={(e) => updateField(`hitDice.${index}.class`, e.target.value)}
                placeholder={t('sheet.class')}
                className="flex-1 px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input
                type="text"
                value={die.total || ''}
                onChange={(e) => updateField(`hitDice.${index}.total`, e.target.value)}
                placeholder="e.g., 5d8"
                className="w-24 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <NumberField
min={0}
                value={die.remaining}
                onChange={(v: number) => updateField(`hitDice.${index}.remaining`, v)}
                placeholder={t('sheet.remaining')}
                className="w-20 px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
              fallback={0}
              />
              <button
                onClick={() => {
                  const newHitDice = formData.hitDice.filter((_: any, i: number) => i !== index);
                  updateField('hitDice', newHitDice);
                }}
                className="px-2 py-1 text-red-600 hover:text-red-800 font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {(!formData.hitDice || formData.hitDice.length === 0) && (
            <div className="text-sm text-stone-500 italic">{t('sheet.noHitDice')}</div>
          )}
        </div>
      </div>

      {/* Death Saves */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.deathSaves')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-green-700 mb-2">{t('sheet.successes')}</label>
            <div className="flex space-x-2">
              {[1, 2, 3].map((i) => (
                <input
                  key={`success-${i}`}
                  type="checkbox"
                  checked={(formData.deathSaves?.successes || 0) >= i}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateField('deathSaves.successes', i);
                    } else {
                      updateField('deathSaves.successes', i - 1);
                    }
                  }}
                  className="w-6 h-6 text-green-700 border-stone-300 rounded focus:ring-2 focus:ring-green-500"
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-red-700 mb-2">{t('sheet.failures')}</label>
            <div className="flex space-x-2">
              {[1, 2, 3].map((i) => (
                <input
                  key={`failure-${i}`}
                  type="checkbox"
                  checked={(formData.deathSaves?.failures || 0) >= i}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateField('deathSaves.failures', i);
                    } else {
                      updateField('deathSaves.failures', i - 1);
                    }
                  }}
                  className="w-6 h-6 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.conditions')}</h3>
        <div className="grid grid-cols-3 gap-2">
          {conditions.map((condition) => (
            <label key={condition} className="flex items-center space-x-2 cursor-pointer hover:bg-stone-100 p-1 rounded">
              <input
                type="checkbox"
                checked={(formData.conditions || []).includes(condition.toLowerCase())}
                onChange={(e) => {
                  const currentConditions = formData.conditions || [];
                  if (e.target.checked) {
                    updateField('conditions', [...currentConditions, condition.toLowerCase()]);
                  } else {
                    updateField('conditions', currentConditions.filter((c: string) => c !== condition.toLowerCase()));
                  }
                }}
                className="w-4 h-4 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
              />
              <span className="text-sm text-stone-700">{condition}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Attacks */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-stone-800">{t('sheet.attacksAndSpellcasting')}</h3>
          <button
            onClick={() => {
              const newAttacks = [
                ...(formData.attacks || []),
                { name: '', attackBonus: 0, damageRoll: '', damageType: '', range: 0, properties: [], notes: '' },
              ];
              updateField('attacks', newAttacks);
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
          >
            {t('sheet.addAttack')}
          </button>
        </div>
        <div className="space-y-4">
          {(formData.attacks || []).map((attack: any, index: number) => (
            <div key={index} className="bg-white border border-stone-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <input
                  type="text"
                  value={attack.name || ''}
                  onChange={(e) => updateField(`attacks.${index}.name`, e.target.value)}
                  placeholder={t('sheet.attackNamePlaceholder')}
                  className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={() => {
                    const newAttacks = formData.attacks.filter((_: any, i: number) => i !== index);
                    updateField('attacks', newAttacks);
                  }}
                  className="ml-2 px-2 py-1 text-red-600 hover:text-red-800 font-bold"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.attackBonus')}</label>
                  <NumberField
value={attack.attackBonus}
                    onChange={(v: number) => updateField(`attacks.${index}.attackBonus`, v)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  fallback={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.damageRoll')}</label>
                  <input
                    type="text"
                    value={attack.damageRoll || ''}
                    onChange={(e) => updateField(`attacks.${index}.damageRoll`, e.target.value)}
                    placeholder="e.g., 1d8+3"
                    className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.damageType')}</label>
                  <input
                    type="text"
                    value={attack.damageType || ''}
                    onChange={(e) => updateField(`attacks.${index}.damageType`, e.target.value)}
                    placeholder={t('sheet.damageTypePlaceholder')}
                    className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.range')} (ft)</label>
                  <NumberField
min={0}
                    value={attack.range}
                    onChange={(v: number) => updateField(`attacks.${index}.range`, v)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  fallback={0}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.propertiesNotes')}</label>
                <input
                  type="text"
                  value={attack.notes || ''}
                  onChange={(e) => updateField(`attacks.${index}.notes`, e.target.value)}
                  placeholder={t('sheet.weaponPropertiesPlaceholder')}
                  className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          ))}
          {(!formData.attacks || formData.attacks.length === 0) && (
            <div className="text-sm text-stone-500 italic">{t('sheet.noAttacksAdded')}</div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Spells tab
  const renderSpellsTab = () => (
    <div className="space-y-6">
      {/* Spellcasting Ability */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.spellcastingAbility')}</label>
          <input
            type="text"
            value={formData.spellcasting?.ability || ''}
            onChange={(e) => updateField('spellcasting.ability', e.target.value)}
            placeholder={t('sheet.spellcastingAbilityPlaceholder')}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.spellSaveDC')}</label>
          <NumberField
min={0}
            value={formData.spellcasting?.spellSaveDC}
            onChange={(v: number) => updateField('spellcasting.spellSaveDC', v)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
          fallback={0}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.spellAttackBonus')}</label>
          <NumberField
value={formData.spellcasting?.spellAttackBonus}
            onChange={(v: number) => updateField('spellcasting.spellAttackBonus', v)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
          fallback={0}
          />
        </div>
      </div>

      {/* Cantrips */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.cantrips')}</h3>
        <textarea
          value={typeof formData.spellcasting?.cantrips === 'string'
            ? formData.spellcasting.cantrips
            : (formData.spellcasting?.cantrips || []).join(', ')}
          onChange={(e) => updateField('spellcasting.cantrips', e.target.value)}
          placeholder={t('sheet.cantripsPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Spell Slots */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.spellSlots')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
            const slotData = formData.spellcasting?.slots?.[level] || { total: 0, expended: 0 };
            return (
              <div key={level} className="bg-white border border-stone-300 rounded-lg p-3">
                <div className="text-sm font-semibold text-stone-700 mb-2 text-center">{t('sheet.level')} {level}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">{t('sheet.total')}</label>
                    <NumberField
min={0}
                      value={slotData.total}
                      onChange={(v: number) => updateField(`spellcasting.slots.${level}.total`, v)}
                      className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                    fallback={0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">{t('sheet.used')}</label>
                    <NumberField
min={0}
                      value={slotData.expended}
                      onChange={(v: number) => updateField(`spellcasting.slots.${level}.expended`, v)}
                      className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                    fallback={0}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spells List */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-stone-800">{t('sheet.spells')}</h3>
          <button
            onClick={() => {
              const newSpells = [
                ...(formData.spellcasting?.spells || []),
                { level: 1, name: '', prepared: false, ritual: false, concentration: false },
              ];
              updateField('spellcasting.spells', newSpells);
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
          >
            {t('sheet.addSpell')}
          </button>
        </div>
        <div className="space-y-2">
          {(formData.spellcasting?.spells || []).map((spell: any, index: number) => (
            <div key={index} className="bg-white border border-stone-300 rounded-lg p-3 flex items-center space-x-3">
              <NumberField
min={1}
                max={9}
                value={spell.level}
                onChange={(v: number) => updateField(`spellcasting.spells.${index}.level`, v)}
                className="w-14 px-2 py-1 border border-stone-300 rounded text-center font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                title={t('sheet.spellLevel')}
              fallback={1}
              />
              <input
                type="text"
                value={spell.name || ''}
                onChange={(e) => updateField(`spellcasting.spells.${index}.name`, e.target.value)}
                placeholder={t('sheet.spellNamePlaceholder')}
                className="flex-1 px-2 py-1 border border-stone-300 rounded font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <label className="flex items-center space-x-1 cursor-pointer" title={t('sheet.prepared')}>
                <input
                  type="checkbox"
                  checked={spell.prepared || false}
                  onChange={(e) => updateField(`spellcasting.spells.${index}.prepared`, e.target.checked)}
                  className="w-4 h-4 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
                />
                <span className="text-xs text-stone-600">{t('sheet.prepAbbr')}</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer" title={t('sheet.ritual')}>
                <input
                  type="checkbox"
                  checked={spell.ritual || false}
                  onChange={(e) => updateField(`spellcasting.spells.${index}.ritual`, e.target.checked)}
                  className="w-4 h-4 text-blue-700 border-stone-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-stone-600">{t('sheet.ritAbbr')}</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer" title={t('sheet.concentration')}>
                <input
                  type="checkbox"
                  checked={spell.concentration || false}
                  onChange={(e) => updateField(`spellcasting.spells.${index}.concentration`, e.target.checked)}
                  className="w-4 h-4 text-purple-700 border-stone-300 rounded focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-xs text-stone-600">{t('sheet.conAbbr')}</span>
              </label>
              <button
                onClick={() => {
                  const newSpells = formData.spellcasting.spells.filter((_: any, i: number) => i !== index);
                  updateField('spellcasting.spells', newSpells);
                }}
                className="px-2 py-1 text-red-600 hover:text-red-800 font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {(!formData.spellcasting?.spells || formData.spellcasting.spells.length === 0) && (
            <div className="text-sm text-stone-500 italic">{t('sheet.noSpellsAdded')}</div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Inventory tab
  const renderInventoryTab = () => (
    <div className="space-y-6">
      {/* Currency */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.currency')}</h3>
        <div className="grid grid-cols-5 gap-3">
          {[
            { key: 'cp', label: t('sheet.currencyLabels.copper'), color: 'text-amber-700' },
            { key: 'sp', label: t('sheet.currencyLabels.silver'), color: 'text-stone-500' },
            { key: 'ep', label: t('sheet.currencyLabels.electrum'), color: 'text-green-600' },
            { key: 'gp', label: t('sheet.currencyLabels.gold'), color: 'text-yellow-600' },
            { key: 'pp', label: t('sheet.currencyLabels.platinum'), color: 'text-slate-300' },
          ].map((currency) => (
            <div key={currency.key}>
              <label className={`block text-xs font-semibold ${currency.color} mb-1`}>
                {currency.label}
              </label>
              <NumberField
min={0}
                value={formData.currency?.[currency.key]}
                onChange={(v: number) => updateField(`currency.${currency.key}`, v)}
                className="w-full px-2 py-2 border border-stone-300 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              fallback={0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Inventory Items */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-stone-800">{t('sheet.inventory')}</h3>
          <button
            onClick={() => {
              const newInventory = [
                ...(formData.inventory || []),
                {
                  name: '',
                  quantity: 1,
                  weight: 0,
                  notes: '',
                  equippable: false,
                  equipped: false,
                  requiresAttunement: false,
                  attuned: false,
                  value: 0,
                },
              ];
              updateField('inventory', newInventory);
            }}
            className="px-3 py-1 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
          >
            {t('sheet.addItem')}
          </button>
        </div>
        <div className="space-y-3">
          {(formData.inventory || []).map((item: any, index: number) => (
            <div key={index} className="bg-white border border-stone-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <input
                  type="text"
                  value={item.name || ''}
                  onChange={(e) => updateField(`inventory.${index}.name`, e.target.value)}
                  placeholder={t('sheet.itemNamePlaceholder')}
                  className="flex-1 px-2 py-1 border border-stone-300 rounded font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={() => {
                    const newInventory = formData.inventory.filter((_: any, i: number) => i !== index);
                    updateField('inventory', newInventory);
                  }}
                  className="ml-2 px-2 py-1 text-red-600 hover:text-red-800 font-bold"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.quantity')}</label>
                  <NumberField
min={0}
                    value={item.quantity}
                    onChange={(v: number) => updateField(`inventory.${index}.quantity`, v)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  fallback={1}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.weight')} (lb)</label>
                  <NumberField
min={0}
                    step="0.1"
                    // The one genuinely fractional field on the sheet: half a
                    // pound of rations is a real weight.
                    integer={false}
                    value={item.weight}
                    onChange={(v: number) => updateField(`inventory.${index}.weight`, v)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  fallback={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.value')} (gp)</label>
                  <NumberField
min={0}
                    value={item.value}
                    onChange={(v: number) => updateField(`inventory.${index}.value`, v)}
                    className="w-full px-2 py-1 border border-stone-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  fallback={0}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.notes')}</label>
                <input
                  type="text"
                  value={item.notes || ''}
                  onChange={(e) => updateField(`inventory.${index}.notes`, e.target.value)}
                  placeholder={t('sheet.itemNotesPlaceholder')}
                  className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.equipped || false}
                    onChange={(e) => updateField(`inventory.${index}.equipped`, e.target.checked)}
                    className="w-4 h-4 text-red-700 border-stone-300 rounded focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-stone-700">{t('sheet.equipped')}</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.requiresAttunement || false}
                    onChange={(e) => updateField(`inventory.${index}.requiresAttunement`, e.target.checked)}
                    className="w-4 h-4 text-purple-700 border-stone-300 rounded focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-stone-700">{t('sheet.requiresAttunement')}</span>
                </label>
                {item.requiresAttunement && (
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.attuned || false}
                      onChange={(e) => updateField(`inventory.${index}.attuned`, e.target.checked)}
                      className="w-4 h-4 text-purple-700 border-stone-300 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-stone-700">{t('sheet.attuned')}</span>
                  </label>
                )}
              </div>
            </div>
          ))}
          {(!formData.inventory || formData.inventory.length === 0) && (
            <div className="text-sm text-stone-500 italic">{t('sheet.noItems')}</div>
          )}
        </div>
      </div>
    </div>
  );

  // Helper to get proficiencies by category from flat array (backwards compatibility)
  const getProficienciesByCategory = () => {
    // If using new structured format with strings (not arrays)
    if (formData.proficiencies && typeof formData.proficiencies === 'object' && !Array.isArray(formData.proficiencies)) {
      return {
        armor: formData.proficiencies.armor || '',
        weapons: formData.proficiencies.weapons || '',
        tools: formData.proficiencies.tools || '',
        languages: formData.proficiencies.languages || '',
      };
    }

    // Backwards compatibility: parse from flat array
    const all = formData.proficienciesAndLanguages || [];
    const languages = ['Common', 'Elvish', 'Dwarvish', 'Draconic', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'];
    const armorKeywords = ['Armor', 'Shield'];
    const toolKeywords = ['Tools', 'Supplies', 'Kit', 'Instruments', 'Vehicles', 'Vehicle'];

    const armorList = all.filter((p: string) => armorKeywords.some(k => p.includes(k)));
    const weaponsList = all.filter((p: string) => !armorKeywords.some(k => p.includes(k)) && !toolKeywords.some(k => p.includes(k)) && !languages.includes(p) && (p.includes('Weapon') || ['Dagger', 'Sword', 'Bow', 'Axe', 'Mace', 'Staff', 'Crossbow', 'Spear', 'Hammer'].some(w => p.includes(w))));
    const toolsList = all.filter((p: string) => toolKeywords.some(k => p.includes(k)));
    const languagesList = all.filter((p: string) => languages.includes(p));

    return {
      armor: armorList.join(', '),
      weapons: weaponsList.join(', '),
      tools: toolsList.join(', '),
      languages: languagesList.join(', '),
    };
  };

  // Render Features tab
  const renderFeaturesTab = () => {
    const profs = getProficienciesByCategory();

    return (
      <div className="space-y-6">
        {/* Proficiencies */}
        <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-stone-800 mb-4">{t('sheet.proficienciesAndTraining')}</h3>

          <div className="space-y-4">
            {/* Armor */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">{t('sheet.armor')}</label>
              <textarea
                value={profs.armor}
                onChange={(e) => updateField('proficiencies.armor', e.target.value)}
                placeholder={t('sheet.armorProficienciesPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            {/* Weapons */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">{t('sheet.weapons')}</label>
              <textarea
                value={profs.weapons}
                onChange={(e) => updateField('proficiencies.weapons', e.target.value)}
                placeholder={t('sheet.weaponProficienciesPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            {/* Tools */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">{t('sheet.tools')}</label>
              <textarea
                value={profs.tools}
                onChange={(e) => updateField('proficiencies.tools', e.target.value)}
                placeholder={t('sheet.toolProficienciesPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">{t('sheet.languages')}</label>
              <textarea
                value={profs.languages}
                onChange={(e) => updateField('proficiencies.languages', e.target.value)}
                placeholder={t('sheet.languageProficienciesPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Features & Traits */}
        <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.featuresAndTraits')}</h3>
          <p className="text-xs text-stone-600 mb-3">{t('sheet.featuresHint')}</p>
          <textarea
            value={typeof formData.featuresAndTraits === 'string'
              ? formData.featuresAndTraits
              : (formData.featuresAndTraits || []).join(', ')}
            onChange={(e) => updateField('featuresAndTraits', e.target.value)}
            placeholder={t('sheet.featuresPlaceholder')}
            rows={5}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Additional Features & Traits */}
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.additionalFeaturesAndTraits')}</h3>
          <p className="text-xs text-stone-600 mb-3">{t('sheet.additionalFeaturesHint')}</p>
          <textarea
            value={formData.additionalFeaturesAndTraits || ''}
            onChange={(e) => updateField('additionalFeaturesAndTraits', e.target.value)}
            placeholder={t('sheet.additionalFeaturesPlaceholder')}
            rows={8}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>
    );
  };

  // Render Biography tab
  const renderBiographyTab = () => (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.appearance')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.age')}</label>
            <input
              type="text"
              value={formData.appearance?.age || ''}
              onChange={(e) => updateField('appearance.age', e.target.value)}
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.height')}</label>
            <input
              type="text"
              value={formData.appearance?.height || ''}
              onChange={(e) => updateField('appearance.height', e.target.value)}
              placeholder="e.g., 5'7&quot;"
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.weight')}</label>
            <input
              type="text"
              value={formData.appearance?.weight || ''}
              onChange={(e) => updateField('appearance.weight', e.target.value)}
              placeholder="e.g., 130 lbs"
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.eyes')}</label>
            <input
              type="text"
              value={formData.appearance?.eyes || ''}
              onChange={(e) => updateField('appearance.eyes', e.target.value)}
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.skin')}</label>
            <input
              type="text"
              value={formData.appearance?.skin || ''}
              onChange={(e) => updateField('appearance.skin', e.target.value)}
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.hair')}</label>
            <input
              type="text"
              value={formData.appearance?.hair || ''}
              onChange={(e) => updateField('appearance.hair', e.target.value)}
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Personality */}
      <div className="bg-stone-50 border-2 border-stone-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.personality')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.personalityTraits')}</label>
            <textarea
              value={formData.personality?.traits || ''}
              onChange={(e) => updateField('personality.traits', e.target.value)}
              placeholder={t('sheet.personalityTraitsPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.ideals')}</label>
            <textarea
              value={formData.personality?.ideals || ''}
              onChange={(e) => updateField('personality.ideals', e.target.value)}
              placeholder={t('sheet.idealsPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.bonds')}</label>
            <textarea
              value={formData.personality?.bonds || ''}
              onChange={(e) => updateField('personality.bonds', e.target.value)}
              placeholder={t('sheet.bondsPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">{t('sheet.flaws')}</label>
            <textarea
              value={formData.personality?.flaws || ''}
              onChange={(e) => updateField('personality.flaws', e.target.value)}
              placeholder={t('sheet.flawsPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Backstory */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.backstory')}</h3>
        <textarea
          value={formData.backstory || ''}
          onChange={(e) => updateField('backstory', e.target.value)}
          placeholder={t('sheet.backstoryPlaceholder')}
          rows={6}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Allies & Organizations */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.alliesAndOrganizations')}</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('sheet.name')}</label>
            <input
              type="text"
              value={formData.alliesAndOrganizations?.name || ''}
              onChange={(e) => updateField('alliesAndOrganizations.name', e.target.value)}
              placeholder={t('sheet.alliesNamePlaceholder')}
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">{t('modal.import.descriptionLabel')}</label>
            <textarea
              value={formData.alliesAndOrganizations?.description || ''}
              onChange={(e) => updateField('alliesAndOrganizations.description', e.target.value)}
              placeholder={t('sheet.alliesDescriptionPlaceholder')}
              rows={3}
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Treasure */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-stone-800 mb-3">{t('sheet.treasureAndNotes')}</h3>
        <textarea
          value={formData.treasure || ''}
          onChange={(e) => updateField('treasure', e.target.value)}
          placeholder={t('sheet.treasurePlaceholder')}
          rows={4}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
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
        {activeTab === 'features' && renderFeaturesTab()}
        {activeTab === 'bio' && renderBiographyTab()}
      </div>
      {errors.submit && (
        <div className="px-6 pb-4 text-sm text-red-600">{errors.submit}</div>
      )}
    </div>
  );
};

export default DnD5eCharacterEditor;
