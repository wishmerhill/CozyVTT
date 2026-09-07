// ============================================
// EditMapModal Component
// Modal for DMs to edit an existing campaign map
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Loader2, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import { api } from '@/services/api';
import mapService from '@/services/map.service';
import type { Asset, Map, UpdateMapRequest } from '@/types';
import { AssetType } from '@/types';
import AssetPicker from '@/components/assets/AssetPicker';
import { detectMapGrid, type GridDetectionResult } from '@/utils/detectMapGrid';
import { Button, Modal } from '@/components/ui';
import { extractAssetId } from '@/utils/assetUrl';
import { formatDistance, getScalePresets, type DistanceUnit } from '@/utils/measurement';

interface EditMapModalProps {
  isOpen: boolean;
  map: Map;
  campaignId: string;
  onClose: () => void;
  onUpdated: (map: Map) => void;
}

// ============================================
// MapPreviewCanvas
// Renders the map image with a grid overlay so the DM can verify
// their Width/Height/GridSize settings line up with the image.
// ============================================

const PREVIEW_PX = 280;

function MapPreviewCanvas({
  imageUrl,
  width,
  height,
  gridSize,
  zoom,
}: {
  imageUrl: string | null;
  width: number;
  height: number;
  gridSize: number;
  zoom: number;
}) {
  const { t } = useTranslation('campaign');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PREVIEW_PX, PREVIEW_PX);
    ctx.fillStyle = '#E8E0D0';
    ctx.fillRect(0, 0, PREVIEW_PX, PREVIEW_PX);

    if (!imageUrl) {
      ctx.fillStyle = '#9C8E7A';
      ctx.font = '13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('map.modal.selectImageLine1'), PREVIEW_PX / 2, PREVIEW_PX / 2 - 10);
      ctx.fillText(t('map.modal.selectImageLine2'), PREVIEW_PX / 2, PREVIEW_PX / 2 + 10);
      return;
    }

    const mapPixelW = width * gridSize;
    const mapPixelH = height * gridSize;
    const baseScale = Math.min(PREVIEW_PX / mapPixelW, PREVIEW_PX / mapPixelH);
    const scale = baseScale * zoom;

    const drawW = mapPixelW * scale;
    const drawH = mapPixelH * scale;
    const offsetX = (PREVIEW_PX - drawW) / 2;
    const offsetY = (PREVIEW_PX - drawH) / 2;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!canvasRef.current) return;
      const c = canvasRef.current;
      const cx = c.getContext('2d');
      if (!cx) return;

      cx.clearRect(0, 0, PREVIEW_PX, PREVIEW_PX);
      cx.fillStyle = '#E8E0D0';
      cx.fillRect(0, 0, PREVIEW_PX, PREVIEW_PX);
      cx.drawImage(img, offsetX, offsetY, drawW, drawH);

      // Grid overlay — clipped to the map bounds
      const cellSize = gridSize * scale;
      cx.save();
      cx.beginPath();
      cx.rect(offsetX, offsetY, drawW, drawH);
      cx.clip();

      cx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      cx.lineWidth = 1;

      for (let x = 0; x <= width; x++) {
        cx.beginPath();
        cx.moveTo(offsetX + x * cellSize, offsetY);
        cx.lineTo(offsetX + x * cellSize, offsetY + drawH);
        cx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        cx.beginPath();
        cx.moveTo(offsetX, offsetY + y * cellSize);
        cx.lineTo(offsetX + drawW, offsetY + y * cellSize);
        cx.stroke();
      }

      cx.restore();
    };
    img.src = imageUrl;
  }, [imageUrl, width, height, gridSize, zoom, t]);

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_PX}
      height={PREVIEW_PX}
      className="w-full rounded border border-moss-green/30 bg-parchment/50"
      style={{ aspectRatio: '1 / 1' }}
      aria-label={t('map.modal.gridAlignmentPreviewAria')}
    />
  );
}

// ============================================
// DimensionField
// Number input paired with a range slider for easier adjustment
// ============================================

function DimensionField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const { t } = useTranslation('campaign');
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div>
      <label className="block text-xs text-stone-gray/70 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value) || min))}
        min={min}
        max={max}
        className="input-cozy"
      />
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full mt-1.5 accent-moss-green cursor-pointer"
        aria-label={t('map.modal.sliderAria', { label })}
      />
    </div>
  );
}

// ============================================
// EditMapModal
// ============================================

export default function EditMapModal({
  isOpen,
  map,
  campaignId,
  onClose,
  onUpdated,
}: EditMapModalProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const [mapAssetId, setMapAssetId] = useState<string | null>(null);
  const [spiritAssetId, setSpiritAssetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(20);
  const [gridSize, setGridSize] = useState(50);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('ft');
  const [scalePreset, setScalePreset] = useState<number | 'custom'>(5);
  const [customScale, setCustomScale] = useState(5);
  const [diagonalRule, setDiagonalRule] = useState<'flat' | 'alternating'>('flat');
  const [lightingEnabled, setLightingEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview zoom (1 = fit-to-preview, higher zooms in)
  const [previewZoom, setPreviewZoom] = useState(1);

  // Auto-detected grid suggestion (only offered when the DM switches to a different image)
  const [detectedGrid, setDetectedGrid] = useState<GridDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const distancePerSquare = scalePreset === 'custom' ? customScale : scalePreset;

  /** Switching unit invalidates the previous preset — it's a value from the other scale. */
  const handleUnitChange = (unit: DistanceUnit) => {
    setDistanceUnit(unit);
    const [firstPreset] = getScalePresets(unit);
    setScalePreset(firstPreset);
    setCustomScale(firstPreset);
  };

  // Pre-fill fields from map prop whenever the modal opens
  useEffect(() => {
    if (isOpen && map) {
      setName(map.name);
      setWidth(map.width);
      setHeight(map.height);
      setGridSize(map.gridSize);
      setMapAssetId(extractAssetId(map.imageUrl));
      setSpiritAssetId(extractAssetId(map.spiritLayerUrl));
      const unit = map.distanceUnit ?? 'ft';
      const dps = map.distancePerSquare ?? map.feetPerSquare ?? 5;
      setDistanceUnit(unit);
      if (getScalePresets(unit).includes(dps)) setScalePreset(dps);
      else { setScalePreset('custom'); setCustomScale(dps); }
      setDiagonalRule((map.diagonalRule as 'flat' | 'alternating') ?? 'flat');
      setLightingEnabled(map.lightingEnabled ?? false);
      setPreviewZoom(1);
      setDetectedGrid(null);
      setIsDetecting(false);
      setError(null);
    }
  }, [isOpen, map]);

  // When the map image is swapped to a different one, attempt auto-detection
  // (Don't run on initial open — the existing settings are already correct)
  const initialAssetId = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) { initialAssetId.current = null; return; }
    if (initialAssetId.current === null) {
      initialAssetId.current = mapAssetId; // record the pre-filled ID
      return;
    }
    if (!mapAssetId || mapAssetId === initialAssetId.current) {
      setDetectedGrid(null);
      return;
    }
    let cancelled = false;
    setIsDetecting(true);
    setDetectedGrid(null);
    detectMapGrid(api.getAssetUrl(mapAssetId, 'maps'))
      .then((result) => { if (!cancelled) setDetectedGrid(result); })
      .catch(() => { /* non-fatal */ })
      .finally(() => { if (!cancelled) setIsDetecting(false); });
    return () => { cancelled = true; };
  }, [mapAssetId, isOpen]);

  const handleMapAssetSelect = (asset: Asset | null) => {
    setMapAssetId(asset?.id ?? null);
    setPreviewZoom(1); // reset zoom when switching images
  };

  const applyDetectedGrid = () => {
    if (!detectedGrid) return;
    setWidth(detectedGrid.width);
    setHeight(detectedGrid.height);
    setGridSize(detectedGrid.gridSize);
    setDetectedGrid(null);
  };

  const handleSpiritAssetSelect = (asset: Asset | null) => {
    setSpiritAssetId(asset?.id ?? null);
  };

  const canSubmit = !!mapAssetId && name.trim().length > 0 && !isSubmitting;

  const handleClose = useCallback(() => onClose(), [onClose]);

  const handleSubmit = async () => {
    if (!canSubmit || !mapAssetId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const data: UpdateMapRequest = {
        name: name.trim(),
        imageUrl: mapAssetId,
        width,
        height,
        gridSize,
        distancePerSquare,
        distanceUnit,
        diagonalRule,
        spiritLayerUrl: spiritAssetId ?? null,
        lightingEnabled,
      };
      const updatedMap = await mapService.updateMap(campaignId, map.id, data);
      onUpdated(updatedMap);
      onClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
          t('map.modal.updateFailedError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // URL for the preview canvas — derived from the selected asset ID
  const previewImageUrl = mapAssetId ? api.getAssetUrl(mapAssetId, 'maps') : null;

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={handleClose} title={t('map.edit')} icon={MapPin} size="xl" closeDisabled={isSubmitting}>
            {/* Body */}
            <div className="space-y-6">
              <p className="text-xs text-ink-muted -mt-4 truncate">{map.name}</p>
              {error && (
                <div role="alert" className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger-ink text-sm">
                  {error}
                </div>
              )}

              <AssetPicker
                label={t('map.modal.mapImageLabel')}
                required
                type={AssetType.MAP}
                allowUpload={false}
                searchPlaceholder={t('map.modal.searchMapsPlaceholder')}
                emptyMessage={t('map.modal.noMapAssetsEditHint')}
                selectedAssetId={mapAssetId}
                onSelect={handleMapAssetSelect}
              />

              <AssetPicker
                label={t('map.modal.spiritLayerImageLabel')}
                type={AssetType.MAP}
                allowUpload={false}
                searchPlaceholder={t('map.modal.searchMapsPlaceholder')}
                emptyMessage={t('map.modal.noMapAssetsEditHint')}
                selectedAssetId={spiritAssetId}
                onSelect={handleSpiritAssetSelect}
              />

              <div>
                <label className="block text-sm font-medium text-stone-gray mb-1">
                  {t('map.name')} <span className="text-danger-ink">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('map.modal.namePlaceholderEdit')}
                  className="input-cozy"
                  maxLength={100}
                />
              </div>

              {/* Two-column section: controls (left) + grid preview (right) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">

                {/* ── Left: Dimensions + Grid Settings ── */}
                <div className="space-y-6">

                  {/* Map Dimensions */}
                  <div>
                    <label className="block text-sm font-medium text-stone-gray mb-3">
                      {t('map.modal.dimensionsLabel')}
                    </label>
                    <div className="space-y-3">
                      <DimensionField
                        label={t('map.modal.widthLabel')}
                        value={width}
                        onChange={setWidth}
                        min={1}
                        max={500}
                      />
                      <DimensionField
                        label={t('map.modal.heightLabel')}
                        value={height}
                        onChange={setHeight}
                        min={1}
                        max={500}
                      />
                      <DimensionField
                        label={t('map.modal.gridSizePxLabel')}
                        value={gridSize}
                        onChange={setGridSize}
                        min={10}
                        max={500}
                      />
                    </div>
                    <p className="text-xs text-stone-gray/50 mt-2">
                      {t('map.modal.canvasSizeHint', { width: width * gridSize, height: height * gridSize })}
                    </p>
                  </div>

                  {/* Grid Settings */}
                  <div className="border border-moss-green/20 rounded-lg p-4 space-y-4 bg-moss-green/5">
                    <h3 className="text-sm font-medium text-brand-ink">{t('map.modal.gridSettingsTitle')}</h3>

                    {/* Distance Unit */}
                    <div>
                      <label className="block text-xs font-medium text-stone-gray mb-2">{t('map.modal.unitLabel')}</label>
                      <div className="flex gap-2">
                        {(['ft', 'm'] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => handleUnitChange(unit)}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                              distanceUnit === unit
                                ? 'bg-moss-green text-paper-white border-moss-green'
                                : 'bg-paper-white text-stone-gray border-moss-green/30 hover:border-moss-green/60'
                            }`}
                          >
                            {unit === 'ft' ? t('map.modal.unitImperial') : t('map.modal.unitMetric')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grid Scale */}
                    <div>
                      <label className="block text-xs font-medium text-stone-gray mb-2">{t('map.modal.gridScaleLabel')}</label>
                      <div className="flex gap-2 flex-wrap">
                        {getScalePresets(distanceUnit).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setScalePreset(v)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                              scalePreset === v
                                ? 'bg-moss-green text-paper-white border-moss-green'
                                : 'bg-paper-white text-stone-gray border-moss-green/30 hover:border-moss-green/60'
                            }`}
                          >
                            {formatDistance(v, distanceUnit)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setScalePreset('custom')}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                            scalePreset === 'custom'
                              ? 'bg-moss-green text-paper-white border-moss-green'
                              : 'bg-paper-white text-stone-gray border-moss-green/30 hover:border-moss-green/60'
                          }`}
                        >
                          {t('map.modal.customLabel')}
                        </button>
                        {scalePreset === 'custom' && (
                          <input
                            type="number"
                            value={customScale}
                            onChange={(e) => setCustomScale(Math.max(0.1, Math.min(100, parseFloat(e.target.value) || 0.1)))}
                            min={0.1}
                            max={100}
                            step={distanceUnit === 'm' ? 0.5 : 1}
                            className="input-cozy w-20"
                            placeholder={distanceUnit}
                          />
                        )}
                      </div>
                      <p className="text-xs text-stone-gray/50 mt-1">{t('map.modal.feetPerSquareHint')}</p>
                    </div>

                    {/* Diagonal Movement */}
                    <div>
                      <label className="block text-xs font-medium text-stone-gray mb-2">{t('map.modal.diagonalMovementLabel')}</label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="diagonalRule-edit"
                            value="flat"
                            checked={diagonalRule === 'flat'}
                            onChange={() => setDiagonalRule('flat')}
                            className="mt-0.5 accent-moss-green"
                          />
                          <div>
                            <span className="text-sm text-stone-gray group-hover:text-brand-ink transition-colors">
                              {t('map.modal.diagonalFlatDesc')}
                            </span>
                            <p className="text-xs text-stone-gray/50">{t('map.modal.diagonalFlatHint')}</p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="diagonalRule-edit"
                            value="alternating"
                            checked={diagonalRule === 'alternating'}
                            onChange={() => setDiagonalRule('alternating')}
                            className="mt-0.5 accent-moss-green"
                          />
                          <div>
                            <span className="text-sm text-stone-gray group-hover:text-brand-ink transition-colors">
                              {t('map.modal.diagonalAlternatingDesc')}
                            </span>
                            <p className="text-xs text-stone-gray/50">{t('map.modal.diagonalAlternatingHint')}</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Lighting */}
                <div className="mt-3 pt-3 border-t border-stone-gray/20">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={lightingEnabled}
                      onChange={(e) => setLightingEnabled(e.target.checked)}
                      className="w-4 h-4 accent-moss-green"
                      aria-label={t('lighting.enable')}
                    />
                    <div>
                      <span className="text-sm text-stone-gray group-hover:text-brand-ink transition-colors">
                        {t('lighting.enable')}
                      </span>
                      <p className="text-xs text-stone-gray/50">{t('map.modal.dynamicLightingHint')}</p>
                    </div>
                  </label>
                </div>

                {/* ── Right: Grid Preview + Zoom ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-stone-gray">{t('map.modal.gridPreviewLabel')}</label>
                    <div className="flex items-center gap-2">
                      {isDetecting && (
                        <span className="flex items-center gap-1 text-xs text-stone-gray/50">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {t('map.modal.analysing')}
                        </span>
                      )}
                      <span className="text-xs text-stone-gray/50 tabular-nums">{previewZoom.toFixed(2)}×</span>
                    </div>
                  </div>

                  <MapPreviewCanvas
                    imageUrl={previewImageUrl}
                    width={width}
                    height={height}
                    gridSize={gridSize}
                    zoom={previewZoom}
                  />

                  {/* Zoom control */}
                  <div className="flex items-center gap-2">
                    <ZoomOut className="w-4 h-4 text-stone-gray/50 flex-shrink-0" />
                    <input
                      type="range"
                      min="0.1"
                      max="4"
                      step="0.05"
                      value={previewZoom}
                      onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
                      className="flex-1 accent-moss-green cursor-pointer"
                      aria-label={t('map.modal.previewZoomLevelAria')}
                    />
                    <ZoomIn className="w-4 h-4 text-stone-gray/50 flex-shrink-0" />
                  </div>

                  {/* Auto-detect suggestion banner — only shown when image is changed */}
                  {detectedGrid && (
                    <div className="flex items-start gap-2 p-2.5 bg-warning/10 border border-warning/30 rounded-lg">
                      <Sparkles className="w-4 h-4 text-warning-ink flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-warning-ink">{t('map.modal.gridDetectedLabel')}</p>
                        <p className="text-xs text-warning-ink mt-0.5">
                          {t('map.modal.gridDetectedInfo', { width: detectedGrid.width, height: detectedGrid.height, gridSize: detectedGrid.gridSize })}
                          <span className="text-warning-ink ml-1">
                            {t('map.modal.gridDetectedConfidence', { confidence: Math.round(detectedGrid.confidence * 100) })}
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={applyDetectedGrid}
                          className="text-xs px-2 py-1 bg-warning text-white rounded hover:bg-warning transition-colors"
                        >
                          {t('map.modal.applyGrid')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetectedGrid(null)}
                          className="text-xs px-2 py-1 text-warning-ink hover:text-warning-ink transition-colors"
                          aria-label={t('map.modal.dismissSuggestionAria')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-stone-gray/50 text-center leading-relaxed">
                    {t('map.modal.zoomVerifyLine1')}<br />{t('map.modal.zoomVerifyLine2')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-parchment/80 backdrop-blur-sm border-t border-moss-green/20 px-6 py-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                disabled={isSubmitting}
              >
                {t('common:cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common:saveChanges')}
              </Button>
            </div>
    </Modal>
  );
}
