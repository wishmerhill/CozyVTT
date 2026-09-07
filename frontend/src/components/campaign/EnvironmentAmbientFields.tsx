// ============================================
// EnvironmentAmbientFields
// Shared Environment Type + Ambient Light Preset controls used by
// CreateMapModal and EditMapModal. Color/opacity pickers only apply to the
// "custom" and "night" presets — the others carry fixed values.
// ============================================

import { useTranslation } from 'react-i18next';
import {
  AMBIENT_LIGHT_PRESETS,
  AMBIENT_PRESET_DEFAULTS,
  ADJUSTABLE_AMBIENT_PRESETS,
  type EnvironmentType,
  type AmbientLightPreset,
} from '@/types/ambientLighting';

const PRESET_LABEL_KEYS: Record<AmbientLightPreset, string> = {
  day: 'map.modal.ambientPresetDay',
  dusk: 'map.modal.ambientPresetDusk',
  night: 'map.modal.ambientPresetNight',
  pitch_black: 'map.modal.ambientPresetPitchBlack',
  custom: 'map.modal.ambientPresetCustom',
};

interface EnvironmentAmbientFieldsProps {
  environmentType: EnvironmentType;
  onEnvironmentTypeChange: (v: EnvironmentType) => void;
  ambientLightPreset: AmbientLightPreset;
  ambientColor: string;
  ambientOpacity: number;
  /** Fired for both preset switches and color/opacity picker edits. */
  onAmbientChange: (preset: AmbientLightPreset, color: string, opacity: number) => void;
}

export default function EnvironmentAmbientFields({
  environmentType,
  onEnvironmentTypeChange,
  ambientLightPreset,
  ambientColor,
  ambientOpacity,
  onAmbientChange,
}: EnvironmentAmbientFieldsProps) {
  const { t } = useTranslation('campaign');
  const isAdjustable = ADJUSTABLE_AMBIENT_PRESETS.includes(ambientLightPreset);

  const handlePresetClick = (preset: AmbientLightPreset) => {
    const defaults = AMBIENT_PRESET_DEFAULTS[preset];
    onAmbientChange(preset, defaults.color, defaults.opacity);
  };

  return (
    <div className="border border-moss-green/20 rounded-lg p-4 space-y-4 bg-moss-green/5">
      <h3 className="text-sm font-medium text-brand-ink">{t('map.modal.environmentSectionTitle')}</h3>

      {/* Environment Type */}
      <div>
        <label className="block text-xs font-medium text-stone-gray mb-2">{t('map.modal.environmentTypeLabel')}</label>
        <div className="flex gap-2">
          {(['indoor', 'outdoor'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onEnvironmentTypeChange(type)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                environmentType === type
                  ? 'bg-moss-green text-paper-white border-moss-green'
                  : 'bg-paper-white text-stone-gray border-moss-green/30 hover:border-moss-green/60'
              }`}
            >
              {type === 'indoor' ? t('map.modal.environmentIndoor') : t('map.modal.environmentOutdoor')}
            </button>
          ))}
        </div>
      </div>

      {/* Ambient Light Preset */}
      <div>
        <label className="block text-xs font-medium text-stone-gray mb-2">{t('map.modal.ambientPresetLabel')}</label>
        <div className="flex gap-2 flex-wrap">
          {AMBIENT_LIGHT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                ambientLightPreset === preset
                  ? 'bg-moss-green text-paper-white border-moss-green'
                  : 'bg-paper-white text-stone-gray border-moss-green/30 hover:border-moss-green/60'
              }`}
            >
              {t(PRESET_LABEL_KEYS[preset])}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-gray/50 mt-1">{t('map.modal.environmentAmbientHint')}</p>
      </div>

      {/* Color + Opacity — only for "custom" and "night" */}
      {isAdjustable && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-stone-gray">{t('map.modal.ambientColorLabel')}</label>
            <input
              type="color"
              value={ambientColor}
              onChange={(e) => onAmbientChange(ambientLightPreset, e.target.value, ambientOpacity)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-0.5">
              <label className="text-xs font-medium text-stone-gray">{t('map.modal.ambientOpacityLabel')}</label>
              <span className="text-xs text-stone-gray/70 tabular-nums">{Math.round(ambientOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ambientOpacity}
              onChange={(e) => onAmbientChange(ambientLightPreset, ambientColor, parseFloat(e.target.value))}
              className="w-full accent-moss-green cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
