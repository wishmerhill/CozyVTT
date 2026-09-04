/**
 * Flexible Character Sheet Section Templates
 */

import type {
  SectionTemplate,
  StatsSection,
  ListSection,
  TextSection,
  TableSection,
} from '../../../../types/flexible-character-sheet';
import { generateId } from './section-helpers';

/**
 * All available section templates.
 * name/description hold i18n keys (character namespace), not display text — translate with t() at render time.
 */
export const SECTION_TEMPLATES: SectionTemplate[] = [
  // Common Templates
  {
    id: 'attributes',
    name: 'sheet.flexible.templates.attributes.name',
    description: 'sheet.flexible.templates.attributes.description',
    icon: 'Target',
    create: (): StatsSection => ({
      id: generateId(),
      title: 'Attributes',
      type: 'stats',
      fields: [
        { id: generateId(), name: 'Strength', value: 10, modifier: 0 },
        { id: generateId(), name: 'Dexterity', value: 10, modifier: 0 },
        { id: generateId(), name: 'Constitution', value: 10, modifier: 0 },
        { id: generateId(), name: 'Intelligence', value: 10, modifier: 0 },
        { id: generateId(), name: 'Wisdom', value: 10, modifier: 0 },
        { id: generateId(), name: 'Charisma', value: 10, modifier: 0 },
      ],
    }),
  },
  {
    id: 'skills',
    name: 'sheet.flexible.templates.skills.name',
    description: 'sheet.flexible.templates.skills.description',
    icon: 'Target',
    create: (): StatsSection => ({
      id: generateId(),
      title: 'Skills',
      type: 'stats',
      fields: [],
    }),
  },
  {
    id: 'inventory',
    name: 'sheet.flexible.templates.inventory.name',
    description: 'sheet.flexible.templates.inventory.description',
    icon: 'Package',
    create: (): ListSection => ({
      id: generateId(),
      title: 'Inventory',
      type: 'list',
      items: [],
    }),
  },
  {
    id: 'spells',
    name: 'sheet.flexible.templates.spells.name',
    description: 'sheet.flexible.templates.spells.description',
    icon: 'Sparkles',
    create: (): ListSection => ({
      id: generateId(),
      title: 'Spells',
      type: 'list',
      items: [],
    }),
  },
  {
    id: 'equipment',
    name: 'sheet.flexible.templates.equipment.name',
    description: 'sheet.flexible.templates.equipment.description',
    icon: 'Sword',
    create: (): TableSection => ({
      id: generateId(),
      title: 'Equipment',
      type: 'table',
      columns: [
        { id: generateId(), name: 'Item', width: '30%' },
        { id: generateId(), name: 'Type', width: '20%' },
        { id: generateId(), name: 'Damage/AC', width: '20%' },
        { id: generateId(), name: 'Notes', width: '30%' },
      ],
      rows: [],
    }),
  },
  {
    id: 'background',
    name: 'sheet.flexible.templates.background.name',
    description: 'sheet.flexible.templates.background.description',
    icon: 'BookOpen',
    create: (): TextSection => ({
      id: generateId(),
      title: 'Background',
      type: 'text',
      value: '',
    }),
  },
  {
    id: 'notes',
    name: 'sheet.flexible.templates.notes.name',
    description: 'sheet.flexible.templates.notes.description',
    icon: 'FileText',
    create: (): TextSection => ({
      id: generateId(),
      title: 'Notes',
      type: 'text',
      value: '',
    }),
  },

  // Blank Templates
  {
    id: 'blank-stats',
    name: 'sheet.flexible.templates.blankStats.name',
    description: 'sheet.flexible.templates.blankStats.description',
    icon: 'Hash',
    create: (): StatsSection => ({
      id: generateId(),
      title: 'New Stats',
      type: 'stats',
      fields: [],
    }),
  },
  {
    id: 'blank-list',
    name: 'sheet.flexible.templates.blankList.name',
    description: 'sheet.flexible.templates.blankList.description',
    icon: 'List',
    create: (): ListSection => ({
      id: generateId(),
      title: 'New List',
      type: 'list',
      items: [],
    }),
  },
  {
    id: 'blank-text',
    name: 'sheet.flexible.templates.blankText.name',
    description: 'sheet.flexible.templates.blankText.description',
    icon: 'FileText',
    create: (): TextSection => ({
      id: generateId(),
      title: 'New Text',
      type: 'text',
      value: '',
    }),
  },
  {
    id: 'blank-table',
    name: 'sheet.flexible.templates.blankTable.name',
    description: 'sheet.flexible.templates.blankTable.description',
    icon: 'Table',
    create: (): TableSection => ({
      id: generateId(),
      title: 'New Table',
      type: 'table',
      columns: [
        { id: generateId(), name: 'Column 1', width: '50%' },
        { id: generateId(), name: 'Column 2', width: '50%' },
      ],
      rows: [],
    }),
  },
];

/**
 * Get template by ID
 */
export const getTemplate = (id: string): SectionTemplate | undefined => {
  return SECTION_TEMPLATES.find((t) => t.id === id);
};

/**
 * Get templates by category
 */
export const getCommonTemplates = (): SectionTemplate[] => {
  return SECTION_TEMPLATES.filter((t) => !t.id.startsWith('blank'));
};

export const getBlankTemplates = (): SectionTemplate[] => {
  return SECTION_TEMPLATES.filter((t) => t.id.startsWith('blank'));
};
