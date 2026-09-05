// ============================================
// SpiritLayerControls
// DM slide-over panel for spirit layer management
// Spirit Layer Implementation
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Ghost, Layers, X, Loader2 } from 'lucide-react';
import { useCampaign } from '@/contexts/CampaignContext';
import { useTokenListIgnoringMovement } from '@/stores/gameStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import campaignService from '@/services/campaign.service';
import type { Token } from '@/types';
import Button from '@/components/ui/Button';

// ============================================
// Spirit Layer Style Options
// ============================================

const SPIRIT_STYLES = [
  {
    id: 'wispy',
    previewColor: 'rgba(180, 210, 230, 0.5)',
    overlayClass: 'spirit-overlay-wispy',
  },
  {
    id: 'ethereal',
    previewColor: 'rgba(100, 220, 200, 0.5)',
    overlayClass: 'spirit-overlay-ethereal',
  },
  {
    id: 'shadow',
    previewColor: 'rgba(30, 10, 60, 0.6)',
    overlayClass: 'spirit-overlay-shadow',
  },
  {
    id: 'dream',
    previewColor: 'rgba(140, 80, 220, 0.5)',
    overlayClass: 'spirit-overlay-dream',
  },
  {
    id: 'custom',
    previewColor: '',
    overlayClass: 'spirit-overlay-custom',
  },
] as const;

type SpiritStyleId = (typeof SPIRIT_STYLES)[number]['id'];

/** Effect animation types available for the Custom style */
type CustomEffectId = 'wispy' | 'ethereal' | 'shadow' | 'dream';

const CUSTOM_EFFECTS: { id: CustomEffectId }[] = [
  { id: 'wispy' },
  { id: 'ethereal' },
  { id: 'shadow' },
  { id: 'dream' },
];

const VALID_CUSTOM_EFFECTS: CustomEffectId[] = ['wispy', 'ethereal', 'shadow', 'dream'];

// ============================================
// Helpers
// ============================================

/**
 * Parse style string.
 * Named style:  "wispy" | "ethereal" | "shadow" | "dream"
 * Custom style: "custom:#hexcolor" (legacy) or "custom:#hexcolor:effectId"
 */
function parseStyle(raw: string): { styleId: SpiritStyleId; customColor: string; customEffect: CustomEffectId } {
  if (raw.startsWith('custom:')) {
    const rest = raw.slice(7); // e.g. "#7c3aed" or "#7c3aed:wispy"
    const lastColon = rest.lastIndexOf(':');
    if (lastColon !== -1) {
      const color  = rest.slice(0, lastColon);
      const effect = rest.slice(lastColon + 1) as CustomEffectId;
      return {
        styleId: 'custom',
        customColor: color,
        customEffect: VALID_CUSTOM_EFFECTS.includes(effect) ? effect : 'wispy',
      };
    }
    return { styleId: 'custom', customColor: rest, customEffect: 'wispy' };
  }
  const known = SPIRIT_STYLES.map((s) => s.id) as string[];
  return {
    styleId: known.includes(raw) ? (raw as SpiritStyleId) : 'wispy',
    customColor: '#9370DB',
    customEffect: 'wispy',
  };
}

function encodeStyle(styleId: SpiritStyleId, customColor: string, customEffect: CustomEffectId = 'wispy'): string {
  return styleId === 'custom' ? `custom:${customColor}:${customEffect}` : styleId;
}

// ============================================
// Component
// ============================================

interface SpiritLayerControlsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpiritLayerControls({ isOpen, onClose }: SpiritLayerControlsProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const { campaign, currentMap, updateCampaignSpiritLayer, dmViewBothPlanes, setDmViewBothPlanes } = useCampaign();
  // Lists spirit tokens by name — no need to re-render on token movement.
  const tokens = useTokenListIgnoringMovement();
  const { socket } = useWebSocket();

  // Derived state from campaign
  const enabled = campaign?.spiritLayerEnabled ?? false;
  const { styleId: initialStyleId, customColor: initialColor, customEffect: initialEffect } = parseStyle(
    campaign?.spiritLayerStyle ?? 'wispy'
  );

  // Local UI state
  const [selectedStyle, setSelectedStyle] = useState<SpiritStyleId>(initialStyleId);
  const [customColor, setCustomColor] = useState(initialColor);
  const [customEffect, setCustomEffect] = useState<CustomEffectId>(initialEffect);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [isTogglingLayer, setIsTogglingLayer] = useState(false);
  const [tokenTogglingIds, setTokenTogglingIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync style state when campaign changes (including real-time WS updates)
  useEffect(() => {
    if (!campaign) return;
    const { styleId, customColor: color, customEffect: effect } = parseStyle(campaign.spiritLayerStyle);
    setSelectedStyle(styleId);
    setCustomColor(color);
    setCustomEffect(effect);
  }, [campaign?.spiritLayerStyle]);

  // Spirit layer tokens from current map
  const spiritTokens: Token[] = tokens.filter((t) => t.layer === 'spirit');

  // ============================================
  // Spirit Layer Toggle
  // ============================================

  const handleToggleLayer = useCallback(async () => {
    if (!socket || !campaign) return;
    setIsTogglingLayer(true);
    setErrorMsg(null);

    const newVisible = !enabled;

    try {
      socket.emitSpiritLayerToggle({ visible: newVisible });
      // Optimistic update — the WS broadcast will also arrive and confirm
      updateCampaignSpiritLayer(newVisible);
    } catch {
      setErrorMsg(t('spiritLayer.errors.toggleLayer'));
    } finally {
      setIsTogglingLayer(false);
    }
  }, [socket, campaign, enabled, updateCampaignSpiritLayer, t]);

  // ============================================
  // Style Selector
  // ============================================

  const handleStyleSelect = async (styleId: SpiritStyleId) => {
    if (!campaign) return;
    setSelectedStyle(styleId);

    const encoded = encodeStyle(styleId, customColor, customEffect);
    setIsSavingStyle(true);
    setErrorMsg(null);
    try {
      await campaignService.updateCampaign(campaign.id, { spiritLayerStyle: encoded });
      updateCampaignSpiritLayer(enabled, encoded);
      socket?.emitSpiritLayerStyleChange(encoded);
    } catch {
      setErrorMsg(t('spiritLayer.errors.saveStyle'));
    } finally {
      setIsSavingStyle(false);
    }
  };

  const handleCustomColorChange = async (color: string) => {
    if (!campaign) return;
    setCustomColor(color);

    const encoded = encodeStyle('custom', color, customEffect);
    setIsSavingStyle(true);
    setErrorMsg(null);
    try {
      await campaignService.updateCampaign(campaign.id, { spiritLayerStyle: encoded });
      updateCampaignSpiritLayer(enabled, encoded);
      socket?.emitSpiritLayerStyleChange(encoded);
    } catch {
      setErrorMsg(t('spiritLayer.errors.saveColor'));
    } finally {
      setIsSavingStyle(false);
    }
  };

  const handleCustomEffectChange = async (effect: CustomEffectId) => {
    if (!campaign) return;
    setCustomEffect(effect);

    const encoded = encodeStyle('custom', customColor, effect);
    setIsSavingStyle(true);
    setErrorMsg(null);
    try {
      await campaignService.updateCampaign(campaign.id, { spiritLayerStyle: encoded });
      updateCampaignSpiritLayer(enabled, encoded);
      socket?.emitSpiritLayerStyleChange(encoded);
    } catch {
      setErrorMsg(t('spiritLayer.errors.saveEffect'));
    } finally {
      setIsSavingStyle(false);
    }
  };

  // ============================================
  // Per-Token Visibility Toggle
  // ============================================

  const handleTokenVisibilityToggle = useCallback(
    async (token: Token) => {
      if (!socket || !currentMap) return;
      setTokenTogglingIds((prev) => new Set(prev).add(token.id));
      setErrorMsg(null);

      try {
        socket.emitSpiritLayerTokenToggle(currentMap.id, token.id, !token.visible);
      } catch {
        setErrorMsg(t('spiritLayer.errors.toggleTokenVisibility'));
      } finally {
        setTokenTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(token.id);
          return next;
        });
      }
    },
    [socket, currentMap, t]
  );

  // ============================================
  // Render
  // ============================================

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="spirit-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="spirit-panel"
            className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-paper-white shadow-2xl overflow-y-auto flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-moss-green/20 bg-parchment/60 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Ghost className="w-5 h-5 text-spirit-purple" />
                <h2 className="text-lg font-bold text-brand-ink">{t('spiritLayer.title')}</h2>
              </div>
              <Button
                onClick={onClose}
                variant="secondary" className="p-1.5"
                title={t('common:close')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Error */}
              {errorMsg && (
                <div className="px-4 py-3 bg-danger/10 border border-danger/20 text-danger-ink text-sm rounded-cozy">
                  {errorMsg}
                </div>
              )}

              {/* Section 1: Spirit Realm Access Toggle */}
              <section>
                <h3 className="text-sm font-semibold text-stone-gray uppercase tracking-wide mb-3">
                  {t('spiritLayer.realmAccessTitle')}
                </h3>
                <div className="glass-panel p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-charcoal">
                      {enabled
                        ? t('spiritLayer.realmRevealed')
                        : t('spiritLayer.realmHidden')}
                    </p>
                    <p className="text-xs text-stone-gray mt-0.5">
                      {t('spiritLayer.dmAlwaysSeesHint')}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleLayer}
                    disabled={isTogglingLayer}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-cozy font-medium text-sm transition-colors ${
                      enabled
                        ? 'bg-spirit-purple text-white hover:bg-spirit-purple/80'
                        : 'bg-transparent border border-brand text-brand-ink hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2'
                    }`}
                    title={enabled ? t('spiritLayer.closeVeil') : t('spiritLayer.openVeil')}
                  >
                    {isTogglingLayer ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : enabled ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                    {enabled ? t('spiritLayer.openState') : t('spiritLayer.closedState')}
                  </button>
                </div>

                {/* DM View Mode toggle */}
                <div className="glass-panel p-4 flex items-center justify-between mt-3">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{t('spiritLayer.dmViewModeTitle')}</p>
                    <p className="text-xs text-stone-gray mt-0.5">
                      {dmViewBothPlanes
                        ? t('spiritLayer.viewBothPlanesHint')
                        : t('spiritLayer.viewSinglePlaneHint')}
                    </p>
                  </div>
                  <button
                    onClick={() => setDmViewBothPlanes(!dmViewBothPlanes)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-cozy font-medium text-sm transition-colors ${
                      dmViewBothPlanes
                        ? 'bg-spirit-purple/20 text-spirit-purple hover:bg-spirit-purple/30'
                        : 'bg-transparent border border-brand text-brand-ink hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2'
                    }`}
                    title={dmViewBothPlanes ? t('spiritLayer.switchToSingleView') : t('spiritLayer.switchToDualView')}
                  >
                    <Layers className="w-4 h-4" />
                    {dmViewBothPlanes ? t('spiritLayer.dualPlane') : t('spiritLayer.singlePlane')}
                  </button>
                </div>
              </section>

              {/* Section 2: Style Selector — the atmosphere of the spirit realm */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-stone-gray uppercase tracking-wide">
                    {t('spiritLayer.realmAtmosphereTitle')}
                  </h3>
                  {isSavingStyle && (
                    <Loader2 className="w-4 h-4 text-stone-gray animate-spin" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SPIRIT_STYLES.map((style) => {
                    const isSelected = selectedStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => handleStyleSelect(style.id as SpiritStyleId)}
                        className={`text-left p-3 rounded-cozy border-2 transition-all ${
                          isSelected
                            ? 'border-spirit-purple bg-spirit-purple/10'
                            : 'border-moss-green/20 hover:border-moss-green/40 bg-parchment/40'
                        }`}
                      >
                        {/* Colour preview swatch */}
                        <div
                          className="w-full h-8 rounded mb-2"
                          style={{
                            background:
                              style.id === 'custom'
                                ? customColor
                                : style.previewColor,
                          }}
                        />
                        <p className="text-xs font-semibold text-charcoal">{t(`spiritLayer.${style.id}`)}</p>
                        <p className="text-[10px] text-stone-gray leading-tight mt-0.5">
                          {t(`spiritLayer.descriptions.${style.id}`)}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom colour + effect pickers */}
                {selectedStyle === 'custom' && (
                  <div className="mt-3 space-y-2">
                    {/* Colour picker */}
                    <div className="glass-panel p-3 flex items-center gap-3">
                      <label className="text-sm text-stone-gray font-medium" htmlFor="spirit-hue">
                        {t('spiritLayer.hueLabel')}
                      </label>
                      <input
                        id="spirit-hue"
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        onBlur={(e) => handleCustomColorChange(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer border-none bg-transparent"
                      />
                      <span className="text-xs text-stone-gray font-mono">{customColor}</span>
                    </div>

                    {/* Effect type picker */}
                    <div className="glass-panel p-3 space-y-2">
                      <p className="text-xs font-semibold text-stone-gray uppercase tracking-wide">
                        {t('spiritLayer.effectLabel')}
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {CUSTOM_EFFECTS.map((eff) => (
                          <button
                            key={eff.id}
                            onClick={() => handleCustomEffectChange(eff.id)}
                            className={`p-2 rounded-cozy border transition-all text-center ${
                              customEffect === eff.id
                                ? 'border-spirit-purple bg-spirit-purple/10 text-spirit-purple'
                                : 'border-moss-green/20 hover:border-moss-green/40 bg-parchment/40 text-stone-gray'
                            }`}
                          >
                            <p className="text-[11px] font-semibold">{t(`spiritLayer.customEffects.${eff.id}.label`)}</p>
                            <p className="text-[9px] leading-tight mt-0.5 opacity-70">{t(`spiritLayer.customEffects.${eff.id}.description`)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Section 3: Entities in the Spirit Realm */}
              <section>
                <h3 className="text-sm font-semibold text-stone-gray uppercase tracking-wide mb-1">
                  {t('spiritLayer.spiritsInRealmTitle')}
                  {spiritTokens.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-stone-gray/70 normal-case">
                      {t('spiritLayer.presentCount', { count: spiritTokens.length })}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-stone-gray/70 mb-3">
                  {t('spiritLayer.tokensHint')}
                </p>

                {!currentMap ? (
                  <p className="text-sm text-stone-gray/70 italic">{t('spiritLayer.noMapLoaded')}</p>
                ) : spiritTokens.length === 0 ? (
                  <p className="text-sm text-stone-gray/70 italic">
                    {t('spiritLayer.noTokensInRealm')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {spiritTokens.map((token) => {
                      const isToggling = tokenTogglingIds.has(token.id);
                      return (
                        <div
                          key={token.id}
                          className="glass-panel flex items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Token avatar */}
                            {token.imageUrl ? (
                              <img
                                src={token.imageUrl}
                                alt={token.name}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-spirit-purple/30"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-spirit-purple/20 flex items-center justify-center flex-shrink-0">
                                <Ghost className="w-4 h-4 text-spirit-purple" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-charcoal truncate">
                                {token.name}
                              </p>
                              <p className="text-[10px] text-stone-gray">
                                ({token.position.x}, {token.position.y})
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleTokenVisibilityToggle(token)}
                            disabled={isToggling}
                            className={`flex-shrink-0 p-2 rounded-cozy transition-colors ${
                              token.visible
                                ? 'text-brand-ink hover:bg-moss-green/10'
                                : 'text-stone-gray/50 hover:bg-stone-gray/10'
                            }`}
                            title={token.visible ? t('spiritLayer.hideToken') : t('spiritLayer.showToken')}
                          >
                            {isToggling ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : token.visible ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Info note */}
              <div className="glass-panel px-4 py-3 bg-spirit-purple/5 border-spirit-purple/20 rounded-cozy">
                <p className="text-xs text-stone-gray leading-relaxed">
                  {t('spiritLayer.infoNote')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
