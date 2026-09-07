/**
 * DmAmbientControls
 * DM-only quick controller for switching a map's environment type and
 * ambient light preset (Day / Dusk / Night / Pitch Black / Custom) during a
 * live session, without reopening the full Edit Map modal.
 */

import { useState } from 'react';
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

interface DmAmbientControlsProps {
  environmentType: EnvironmentType;
  ambientLightPreset: AmbientLightPreset;
  ambientColor: string;
  ambientOpacity: number;
  onChange: (changes: {
    environmentType?: EnvironmentType;
    ambientLightPreset?: AmbientLightPreset;
    ambientColor?: string;
    ambientOpacity?: number;
  }) => void;
  onCollapse?: () => void;
}

export default function DmAmbientControls({
  environmentType,
  ambientLightPreset,
  ambientColor,
  ambientOpacity,
  onChange,
  onCollapse,
}: DmAmbientControlsProps) {
  const { t } = useTranslation('campaign');
  const [collapsed, setCollapsed] = useState(true);
  const isAdjustable = ADJUSTABLE_AMBIENT_PRESETS.includes(ambientLightPreset);

  const handlePresetClick = (preset: AmbientLightPreset) => {
    const defaults = AMBIENT_PRESET_DEFAULTS[preset];
    onChange({ ambientLightPreset: preset, ambientColor: defaults.color, ambientOpacity: defaults.opacity });
  };

  return (
    <div className="flex flex-col gap-0 bg-stone-800/90 rounded-lg border border-amber-400/20 min-w-[200px] overflow-hidden">
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-stone-700/50 select-none"
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          if (next) onCollapse?.();
        }}
      >
        <span className="text-xs text-amber-400/70 font-medium uppercase tracking-wide">
          {t('lighting.ambientControlsTitle')}
        </span>
        <span className="text-stone-400 text-xs">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2 p-2 pt-1">
          {/* Environment Type */}
          <div className="flex gap-1">
            {(['indoor', 'outdoor'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ environmentType: type })}
                className={`flex-1 text-[11px] py-1.5 rounded transition-colors ${
                  environmentType === type
                    ? 'bg-amber-400/30 text-amber-300 border border-amber-400/50'
                    : 'bg-stone-700/60 text-stone-300 border border-stone-600/50 hover:bg-stone-700'
                }`}
              >
                {type === 'indoor' ? t('map.modal.environmentIndoor') : t('map.modal.environmentOutdoor')}
              </button>
            ))}
          </div>

          {/* Ambient Presets */}
          <div className="flex flex-wrap gap-1">
            {AMBIENT_LIGHT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  ambientLightPreset === preset
                    ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40'
                    : 'bg-stone-700/60 text-stone-400 border border-stone-600/40 hover:text-stone-300 hover:bg-stone-700'
                }`}
              >
                {t(PRESET_LABEL_KEYS[preset])}
              </button>
            ))}
          </div>

          {/* Color + Opacity — only for "custom" and "night" */}
          {isAdjustable && (
            <div className="flex flex-col gap-1.5 bg-stone-700/40 rounded p-2 border border-stone-600/40">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-stone-400">{t('map.modal.ambientColorLabel')}</span>
                <input
                  type="color"
                  value={ambientColor}
                  onChange={(e) => onChange({ ambientColor: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-stone-400">{t('map.modal.ambientOpacityLabel')}</span>
                  <span className="text-[10px] text-stone-300">{Math.round(ambientOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ambientOpacity}
                  onChange={(e) => onChange({ ambientOpacity: parseFloat(e.target.value) })}
                  className="w-full h-1 accent-amber-400"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
