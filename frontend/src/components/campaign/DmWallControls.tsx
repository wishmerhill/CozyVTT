/**
 * DmWallControls
 * DM-only wall segment drawing tool controls panel.
 * Supports wall type selection, snap-to-grid, delete mode,
 * custom wall color, split mode, erase brush, brush paint tool,
 * and inline type picker for selected segments.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WallType } from '@/types/walls';

export type WallToolMode = 'wall-draw' | 'wall-select' | 'wall-split' | 'wall-erase' | 'wall-polygon' | 'wall-brush' | null;

export const WALL_PRESET_COLORS = [
  { labelKey: 'walls.orange', value: '#f97316' },
  { labelKey: 'walls.white', value: '#ffffff' },
  { labelKey: 'walls.yellow', value: '#facc15' },
  { labelKey: 'walls.cyan', value: '#22d3ee' },
  { labelKey: 'walls.red', value: '#ef4444' },
  { labelKey: 'walls.green', value: '#4ade80' },
];

interface DmWallControlsProps {
  wallMode: WallToolMode;
  onWallModeChange: (mode: WallToolMode) => void;
  onCollapse?: () => void;
  wallType: WallType;
  onWallTypeChange: (type: WallType) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (snap: boolean) => void;
  snapToEndpoint: boolean;
  onSnapToEndpointChange: (snap: boolean) => void;
  wallCount: number;
  onClearAll: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  wallColor: string;
  onWallColorChange: (color: string) => void;
  selectedSegmentType?: WallType | null;
  onSelectedTypeChange?: (type: WallType) => void;
  onDeleteSelected?: () => void;
  selectedEndpoint?: { x: number; y: number } | null;
  onMergeEndpoint?: () => void;
  brushSize?: number;
  onBrushSizeChange?: (v: number) => void;
}

const WALL_TYPE_COLORS: Record<WallType, string> = {
  'wall':        'bg-orange-500/20 text-orange-400 border-orange-500/50',
  'door-closed': 'bg-violet-500/20 text-violet-400 border-violet-500/50',
  'door-open':   'bg-green-500/20 text-green-400 border-green-500/50',
  'door-locked': 'bg-red-500/20 text-red-400 border-red-500/50',
  'window':      'bg-blue-400/20 text-blue-300 border-blue-400/50',
};

const ALL_WALL_TYPES: WallType[] = ['wall', 'door-closed', 'door-open', 'door-locked', 'window'];

export default function DmWallControls({
  wallMode,
  onWallModeChange,
  wallType,
  onWallTypeChange,
  snapToGrid,
  onSnapToGridChange,
  snapToEndpoint,
  onSnapToEndpointChange,
  wallCount,
  onClearAll,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  wallColor,
  onWallColorChange,
  selectedSegmentType,
  onSelectedTypeChange,
  onDeleteSelected,
  selectedEndpoint,
  onMergeEndpoint,
  brushSize = 20,
  onBrushSizeChange,
  onCollapse,
}: DmWallControlsProps) {
  const { t } = useTranslation('campaign');
  const [confirmClear, setConfirmClear] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleClearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    onClearAll();
  };

  const toggleMode = (mode: WallToolMode) => {
    onWallModeChange(wallMode === mode ? null : mode);
  };

  return (
    <div className="flex flex-col gap-0 bg-stone-800/90 rounded-lg border border-warm-amber/20 min-w-[200px] overflow-hidden">
      {/* Header with collapse toggle */}
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-stone-700/50 select-none"
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          if (next) onCollapse?.();
        }}
      >
        <span className="text-xs text-warm-amber/70 font-medium uppercase tracking-wide">
          {t('walls.title')}
          {wallCount > 0 && (
            <span className="ml-1 text-stone-400 normal-case">({wallCount})</span>
          )}
        </span>
        <span className="text-stone-400 text-xs">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2 p-2 pt-1">
          {/* Mode buttons: Draw / Select / Split / Erase */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => toggleMode('wall-draw')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
                wallMode === 'wall-draw'
                  ? 'bg-orange-600/30 text-orange-400 border-orange-500/50'
                  : 'bg-stone-700/50 text-stone-300 border-stone-600/50 hover:bg-stone-700'
              }`}
              title={t('walls.drawTool')}
              aria-label={t('walls.drawTool')}
            >
              ✏️ {t('walls.drawTool')}
            </button>
            <button
              onClick={() => toggleMode('wall-select')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
                wallMode === 'wall-select'
                  ? 'bg-sky-600/30 text-sky-400 border-sky-500/50'
                  : 'bg-stone-700/50 text-stone-300 border-stone-600/50 hover:bg-stone-700'
              }`}
              title={t('walls.selectTool')}
              aria-label={t('walls.selectTool')}
            >
              ↗ {t('walls.selectTool')}
            </button>
            <button
              onClick={() => toggleMode('wall-split')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
                wallMode === 'wall-split'
                  ? 'bg-yellow-600/30 text-yellow-400 border-yellow-500/50'
                  : 'bg-stone-700/50 text-stone-300 border-stone-600/50 hover:bg-stone-700'
              }`}
              title={t('walls.splitTool')}
              aria-label={t('walls.splitTool')}
            >
              ✂ {t('walls.splitTool')}
            </button>
            <button
              onClick={() => toggleMode('wall-erase')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
                wallMode === 'wall-erase'
                  ? 'bg-red-600/30 text-red-400 border-red-500/50'
                  : 'bg-stone-700/50 text-stone-300 border-stone-600/50 hover:bg-stone-700'
              }`}
              title={t('walls.eraseTool')}
              aria-label={t('walls.eraseTool')}
            >
              🗑 {t('walls.eraseTool')}
            </button>
          </div>
          {/* Polygon + Brush mode */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => toggleMode('wall-polygon')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
                wallMode === 'wall-polygon'
                  ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/50'
                  : 'bg-stone-700/50 text-stone-300 border-stone-600/50 hover:bg-stone-700'
              }`}
              title={t('walls.polygonTool')}
              aria-label={t('walls.polygonTool')}
            >
              ⬡ {t('walls.polygonTool')}
            </button>
            <button
              onClick={() => toggleMode('wall-brush')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
                wallMode === 'wall-brush'
                  ? 'bg-teal-600/30 text-teal-400 border-teal-500/50'
                  : 'bg-stone-700/50 text-stone-300 border-stone-600/50 hover:bg-stone-700'
              }`}
              title={t('walls.brushTool')}
              aria-label={t('walls.brushTool')}
            >
              🖌 {t('walls.brushTool')}
            </button>
          </div>

          {/* Brush size slider (brush mode) */}
          {wallMode === 'wall-brush' && onBrushSizeChange && (
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-xs text-stone-400 px-1">
                <span>{t('walls.brushSize')}</span>
                <span>{brushSize}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={60}
                step={2}
                value={brushSize}
                onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                className="w-full accent-teal-500"
                aria-label={t('walls.brushSize')}
              />
            </div>
          )}

          {/* Selected segment type picker (wall-select mode with a segment chosen) */}
          {wallMode === 'wall-select' && selectedSegmentType != null && (
            <div className="flex flex-col gap-1 pt-1 border-t border-sky-500/30">
              <span className="text-xs text-sky-300 px-1">{t('walls.changeType')}</span>
              <div className="grid grid-cols-2 gap-1">
                {ALL_WALL_TYPES.map((wt) => (
                  <button
                    key={wt}
                    onClick={() => onSelectedTypeChange?.(wt)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                      selectedSegmentType === wt
                        ? WALL_TYPE_COLORS[wt]
                        : 'bg-stone-700/50 text-stone-400 border-stone-600/50 hover:bg-stone-700'
                    }`}
                    aria-label={`${t('walls.changeType')}: ${t(`walls.${wt}`)}`}
                  >
                    {t(`walls.${wt}`)}
                  </button>
                ))}
              </div>
              <button
                onClick={onDeleteSelected}
                className="w-full px-2 py-1 mt-0.5 rounded text-xs font-medium bg-red-700/30 text-red-400 border border-red-500/40 hover:bg-red-700/50 transition-colors"
                aria-label={t('walls.deleteSegment')}
              >
                {t('walls.deleteSegment')}
              </button>
            </div>
          )}

          {/* Selected endpoint — merge option (wall-select mode, endpoint clicked) */}
          {wallMode === 'wall-select' && selectedEndpoint != null && selectedSegmentType == null && (
            <div className="flex flex-col gap-1 pt-1 border-t border-sky-500/30">
              <span className="text-xs text-sky-300 px-1">{t('walls.selectedPoint')}</span>
              <button
                onClick={onMergeEndpoint}
                className="w-full px-2 py-1 rounded text-xs font-medium bg-sky-700/30 text-sky-300 border border-sky-500/40 hover:bg-sky-700/50 transition-colors"
                aria-label={t('walls.mergePoint')}
              >
                {t('walls.mergePoint')}
              </button>
              <span className="text-[10px] text-stone-300 px-1">{t('walls.mergePointDesc')}</span>
            </div>
          )}

          {/* Wall type selector (draw, polygon, brush modes) */}
          {(wallMode === 'wall-draw' || wallMode === 'wall-polygon' || wallMode === 'wall-brush') && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-stone-400 px-1">{t('walls.drawType')}</span>
              <div className="grid grid-cols-2 gap-1">
                {ALL_WALL_TYPES.map((wt) => (
                  <button
                    key={wt}
                    onClick={() => onWallTypeChange(wt)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                      wallType === wt
                        ? WALL_TYPE_COLORS[wt]
                        : 'bg-stone-700/50 text-stone-400 border-stone-600/50 hover:bg-stone-700'
                    }`}
                    aria-label={`${t('walls.drawType')}: ${t(`walls.${wt}`)}`}
                  >
                    {t(`walls.${wt}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Undo / Redo buttons */}
          {(onUndo || onRedo) && (
            <div className="flex gap-1">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="flex-1 px-2 py-1 rounded text-xs font-medium bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={t('walls.undo')}
                aria-label={t('walls.undo')}
              >
                ↩ {t('walls.undo')}
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="flex-1 px-2 py-1 rounded text-xs font-medium bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={t('walls.redo')}
                aria-label={t('walls.redo')}
              >
                ↪ {t('walls.redo')}
              </button>
            </div>
          )}

          {/* Wall color picker */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-stone-400 px-1">{t('walls.wallColor')}</span>
            <div className="flex gap-1 flex-wrap px-1">
              {WALL_PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => onWallColorChange(c.value)}
                  title={t(c.labelKey)}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: wallColor === c.value ? '#fff' : 'transparent',
                  }}
                  aria-label={t(c.labelKey)}
                />
              ))}
              <input
                type="color"
                value={wallColor}
                onChange={(e) => onWallColorChange(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                title={t('walls.customColor')}
                aria-label={t('walls.customColor')}
              />
            </div>
          </div>

          {/* Snap to grid */}
          <label className="flex items-center gap-2 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => {
                onSnapToGridChange(e.target.checked);
                if (e.target.checked) onSnapToEndpointChange(false);
              }}
              className="accent-warm-amber"
              aria-label={t('walls.snapToGrid')}
            />
            <span className="text-xs text-stone-300">{t('walls.snapToGrid')}</span>
          </label>

          {/* Snap to nearest endpoint — only available when grid snap is off */}
          <label className={`flex items-center gap-2 px-1 ${snapToGrid ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={snapToEndpoint}
              disabled={snapToGrid}
              onChange={(e) => onSnapToEndpointChange(e.target.checked)}
              className="accent-warm-amber"
              aria-label={t('walls.snapToEndpoint')}
            />
            <span className="text-xs text-stone-300">{t('walls.snapToEndpoint')}</span>
          </label>

          {/* Clear all */}
          {wallCount > 0 && (
            <div className="pt-1 border-t border-stone-700/50">
              <button
                onClick={handleClearAll}
                className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors ${
                  confirmClear
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-stone-700/50 text-stone-300 border border-stone-600/50 hover:bg-red-700/30 hover:text-red-400'
                }`}
                title={confirmClear ? t('walls.confirmClearAll') : t('walls.clearAllDesc')}
                aria-label={t('walls.clearAllDesc')}
                onBlur={() => setConfirmClear(false)}
              >
                {confirmClear ? t('walls.confirmClearAll') : t('walls.clearAll', { count: wallCount })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}