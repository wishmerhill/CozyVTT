/**
 * DmFogControls
 * DM-only fog of war controls panel.
 * The DM reveals or hides regions by dragging a box over the map — the
 * selection snaps to whole grid squares — plus bulk reveal/hide actions.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';

export type FogToolMode = 'fog-reveal' | 'fog-hide' | null;

interface DmFogControlsProps {
  fogMode: FogToolMode;
  onFogModeChange: (mode: FogToolMode) => void;
  onRevealAll: () => void;
  onHideAll: () => void;
}

export default function DmFogControls({
  fogMode,
  onFogModeChange,
  onRevealAll,
  onHideAll,
}: DmFogControlsProps) {
  const { t } = useTranslation('campaign');
  const [confirmRevealAll, setConfirmRevealAll] = useState(false);
  const [confirmHideAll, setConfirmHideAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleRevealAll = () => {
    if (!confirmRevealAll) { setConfirmRevealAll(true); return; }
    setConfirmRevealAll(false);
    onRevealAll();
  };

  const handleHideAll = () => {
    if (!confirmHideAll) { setConfirmHideAll(true); return; }
    setConfirmHideAll(false);
    onHideAll();
  };

  return (
    <div className="flex flex-col gap-0 bg-stone-800/90 rounded-lg border border-warm-amber/20 min-w-[160px] overflow-hidden">
      {/* Header with collapse toggle */}
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-stone-700/50 select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-xs text-warm-amber/70 font-medium uppercase tracking-wide">{t('fog.title')}</span>
        <span className="text-stone-400 text-xs">{collapsed ? '▶' : '▼'}</span>
      </div>
    {!collapsed && (
      <div className="flex flex-col gap-2 p-2 pt-1">

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => onFogModeChange(fogMode === 'fog-reveal' ? null : 'fog-reveal')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            fogMode === 'fog-reveal'
              ? 'bg-lime-600/30 text-lime-400 border border-lime-500/50'
              : 'bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-stone-700'
          }`}
          title={t('fog.revealTool')}
          aria-label={t('fog.revealTool')}
        >
          <Eye className="w-3.5 h-3.5" />
          {t('fog.reveal')}
        </button>
        <button
          onClick={() => onFogModeChange(fogMode === 'fog-hide' ? null : 'fog-hide')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            fogMode === 'fog-hide'
              ? 'bg-warning/30 text-warning-ink border border-warning/50'
              : 'bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-stone-700'
          }`}
          title={t('fog.hideTool')}
          aria-label={t('fog.hideTool')}
        >
          <EyeOff className="w-3.5 h-3.5" />
          {t('fog.hide')}
        </button>
      </div>

      {/* How-to hint — only while a mode is armed */}
      {fogMode && (
        <p className="px-1 text-[11px] leading-snug text-stone-400">
          {t('fog.dragHint', { mode: fogMode === 'fog-reveal' ? t('fog.reveal').toLowerCase() : t('fog.hide').toLowerCase() })}
          <span className="block mt-0.5 text-stone-500">{t('fog.escHint')}</span>
        </p>
      )}

      {/* Bulk actions */}
      <div className="flex gap-1 pt-1 border-t border-stone-700/50">
        <button
          onClick={handleRevealAll}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            confirmRevealAll
              ? 'bg-lime-500 text-white animate-pulse'
              : 'bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-lime-700/30 hover:text-lime-400'
          }`}
          title={confirmRevealAll ? t('fog.confirmRevealAll') : t('fog.revealAllDesc')}
          aria-label={t('fog.revealAll')}
          onBlur={() => setConfirmRevealAll(false)}
        >
          {confirmRevealAll ? t('fog.confirmQuestion') : t('fog.revealAll')}
        </button>
        <button
          onClick={handleHideAll}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            confirmHideAll
              ? 'bg-warning text-white animate-pulse'
              : 'bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-warning/30 hover:text-warning-ink'
          }`}
          title={confirmHideAll ? t('fog.confirmHideAll') : t('fog.hideAllDesc')}
          aria-label={t('fog.hideAll')}
          onBlur={() => setConfirmHideAll(false)}
        >
          {confirmHideAll ? t('fog.confirmQuestion') : t('fog.hideAll')}
        </button>
      </div>
    </div>
    )}
    </div>
  );
}