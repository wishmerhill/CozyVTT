// ============================================
// PcTokenEditor
// Quick vision + light-source editor for Player Character tokens.
// Unlike NpcQuickEditor (DM-only), this panel is opened for the DM *or*
// for the player who controls the token — see the isDM || isOwnToken
// gate at the call sites in MapCanvas/TokenRoster.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import api from '@/services/api';
import type { Token } from '@/types';
import type { TokenLightEmit } from '@/types/walls';
import Button from '@/components/ui/Button';
import { LIGHT_PRESETS, LIGHT_COLOR_PRESETS } from './DmLightControls';

interface PcTokenEditorProps {
  token: Token;
  campaignId: string;
  mapId: string;
  onClose: () => void;
  onTokenUpdate: (updated: Token) => void;
}

const DEFAULT_LIGHT_EMIT: TokenLightEmit = { enabled: true, brightRadius: 4, dimRadius: 8, color: '#ffcc66' };

export default function PcTokenEditor({ token, campaignId, mapId, onClose, onTokenUpdate }: PcTokenEditorProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const { socket } = useWebSocket();

  const [lightEmit, setLightEmit] = useState<TokenLightEmit | null>(token.lightEmit ?? null);
  const [sightRadius, setSightRadius] = useState<string>(
    token.sightRadius !== undefined && token.sightRadius !== null ? String(token.sightRadius) : ''
  );
  const [darkvisionRadius, setDarkvisionRadius] = useState<string>(
    token.darkvisionRadius !== undefined && token.darkvisionRadius !== null ? String(token.darkvisionRadius) : ''
  );
  const lightSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (lightSaveTimer.current) clearTimeout(lightSaveTimer.current); };
  }, []);

  const isSaving = useRef(false);

  // ── Generic update helper ──
  const saveUpdate = useCallback(async (changes: Partial<Token>) => {
    if (isSaving.current) return;
    try {
      const result = await api.updateToken(campaignId, mapId, token.id, changes as Parameters<typeof api.updateToken>[3]);
      onTokenUpdate(result.token);
      socket?.emitMapChange(mapId);
    } catch (err) {
      console.error('PcTokenEditor: failed to update token', err);
    }
  }, [campaignId, mapId, token.id, onTokenUpdate, socket]);

  // ── Vision (sight radius / darkvision) ──
  const handleSightRadiusBlur = useCallback(async () => {
    const parsed = sightRadius !== '' ? Number(sightRadius) : null;
    const current = token.sightRadius ?? null;
    if (parsed !== current && (parsed === null || !Number.isNaN(parsed))) {
      await saveUpdate({ sightRadius: parsed } as Partial<Token>);
    }
  }, [sightRadius, token.sightRadius, saveUpdate]);

  const handleDarkvisionRadiusBlur = useCallback(async () => {
    const parsed = darkvisionRadius !== '' ? Number(darkvisionRadius) : null;
    const current = token.darkvisionRadius ?? null;
    if (parsed !== current && (parsed === null || !Number.isNaN(parsed))) {
      await saveUpdate({ darkvisionRadius: parsed } as Partial<Token>);
    }
  }, [darkvisionRadius, token.darkvisionRadius, saveUpdate]);

  // ── Light source (torch/lantern carried by the token) ──
  // Toggling off keeps the configured radii/color, same as a standalone
  // LightSource — an extinguished torch, not a deleted one.
  const toggleLightEmit = useCallback(async () => {
    const next: TokenLightEmit = lightEmit
      ? { ...lightEmit, enabled: !lightEmit.enabled }
      : { ...DEFAULT_LIGHT_EMIT };
    setLightEmit(next);
    await saveUpdate({ lightEmit: next } as Partial<Token>);
  }, [lightEmit, saveUpdate]);

  // Debounced so dragging a radius slider doesn't fire a save (and the map's
  // raycast recompute) on every tick — mirrors DmLightControls' slider handling.
  const updateLightEmit = useCallback((changes: Partial<TokenLightEmit>) => {
    setLightEmit((prev) => {
      const next = { ...(prev ?? DEFAULT_LIGHT_EMIT), ...changes };
      if (lightSaveTimer.current) clearTimeout(lightSaveTimer.current);
      lightSaveTimer.current = setTimeout(() => {
        saveUpdate({ lightEmit: next } as Partial<Token>);
      }, 80);
      return next;
    });
  }, [saveUpdate]);

  // Sync local state when the parent hands us a different (or freshly saved) token
  useEffect(() => {
    setLightEmit(token.lightEmit ?? null);
    setSightRadius(token.sightRadius !== undefined && token.sightRadius !== null ? String(token.sightRadius) : '');
    setDarkvisionRadius(token.darkvisionRadius !== undefined && token.darkvisionRadius !== null ? String(token.darkvisionRadius) : '');
  }, [token.id]);

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          key="pc-editor-backdrop"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          key="pc-editor-panel"
          className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-paper-white shadow-2xl overflow-y-auto flex flex-col"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-moss-green/20 bg-parchment/60 sticky top-0 z-10">
            {token.imageUrl ? (
              <img
                src={token.imageUrl}
                alt={token.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-moss-green/30 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-stone-gray/10 border border-dashed border-stone-gray/30 flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-brand-ink truncate">{token.name}</p>
              <span className="text-[10px] font-semibold text-brand-ink/70 uppercase tracking-wide">
                {t('token.player')}
              </span>
            </div>

            <Button onClick={onClose} variant="secondary" className="p-1.5 flex-shrink-0" title={t('common:close')}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* ── Vision ── */}
            <section>
              <h3 className="text-xs font-semibold text-stone-gray uppercase tracking-wide mb-2">
                {t('npcEditor.vision.title')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-stone-gray block mb-0.5">
                    {t('npcEditor.vision.sightRadius')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={sightRadius}
                    onChange={(e) => setSightRadius(e.target.value)}
                    onBlur={handleSightRadiusBlur}
                    placeholder="3"
                    className="input-cozy input-cozy-number w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-gray block mb-0.5">
                    {t('npcEditor.vision.darkvisionRadius')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={darkvisionRadius}
                    onChange={(e) => setDarkvisionRadius(e.target.value)}
                    onBlur={handleDarkvisionRadiusBlur}
                    placeholder={t('common:none')}
                    className="input-cozy input-cozy-number w-full text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-stone-gray/60 mt-1">
                {t('npcEditor.vision.hint')}
              </p>
            </section>

            {/* ── Light Source (torch/lantern carried by the token) ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-stone-gray uppercase tracking-wide">
                  {t('npcEditor.light.title')}
                </h3>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lightEmit?.enabled ?? false}
                    onChange={toggleLightEmit}
                    className="rounded accent-warm-amber"
                  />
                  <span className="text-[11px] text-stone-gray">
                    {lightEmit?.enabled ? t('lighting.enabled') : t('lighting.disabled')}
                  </span>
                </label>
              </div>

              {lightEmit?.enabled && (
                <div className="flex flex-col gap-2 glass-panel p-2.5">
                  {/* Preset radii */}
                  <div>
                    <span className="text-[10px] text-stone-gray block mb-1">{t('lighting.presets')}</span>
                    <div className="flex flex-wrap gap-1">
                      {LIGHT_PRESETS.map((p) => {
                        const isActive = lightEmit.brightRadius === p.bright && lightEmit.dimRadius === p.dim;
                        return (
                          <button
                            key={p.labelKey}
                            type="button"
                            onClick={() => updateLightEmit({ brightRadius: p.bright, dimRadius: p.dim })}
                            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                              isActive
                                ? 'bg-accent/25 text-accent-ink border border-accent/40'
                                : 'bg-parchment/60 text-stone-gray border border-moss-green/20 hover:bg-parchment'
                            }`}
                          >
                            {t(p.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bright radius */}
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] text-stone-gray">{t('lighting.brightRadius')}</span>
                      <span className="text-[10px] text-stone-gray">{lightEmit.brightRadius.toFixed(1)} {t('lighting.squaresUnit')}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={0.5}
                      value={lightEmit.brightRadius}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateLightEmit({ brightRadius: v, dimRadius: Math.max(v, lightEmit.dimRadius) });
                      }}
                      className="w-full h-1 accent-warm-amber"
                    />
                  </div>

                  {/* Dim radius */}
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] text-stone-gray">{t('lighting.dimRadius')}</span>
                      <span className="text-[10px] text-stone-gray">{lightEmit.dimRadius.toFixed(1)} {t('lighting.squaresUnit')}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={50}
                      step={0.5}
                      value={lightEmit.dimRadius}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateLightEmit({ dimRadius: v, brightRadius: Math.min(v, lightEmit.brightRadius) });
                      }}
                      className="w-full h-1 accent-warm-amber"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <span className="text-[10px] text-stone-gray block mb-1">{t('lighting.color')}</span>
                    <div className="flex flex-wrap gap-1 items-center">
                      {LIGHT_COLOR_PRESETS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => updateLightEmit({ color: c.value })}
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${
                            lightEmit.color === c.value
                              ? 'border-brand-ink scale-110'
                              : 'border-moss-green/20 hover:border-moss-green/40'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={t(c.labelKey)}
                        />
                      ))}
                      <input
                        type="color"
                        value={lightEmit.color}
                        onChange={(e) => updateLightEmit({ color: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title={t('lighting.pickCustomColor')}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
