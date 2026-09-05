/**
 * AtmospherePanel
 * Atmosphere & Immersion
 *
 * DM-only slide-over panel. Provides:
 *   1. Particle overlay selector (rain, mist, leaves, sparkles, snow)
 *   2. Ambient audio track picker (from AUDIO assets)
 *   3. Volume slider + loop toggle
 *
 * Emits atmosphere.effect.set and atmosphere.audio.set WebSocket events.
 * AtmospherePlayer (mounted at CampaignPage level) handles the echo back
 * from the server and updates CampaignContext for all clients.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Cloud,
  Music,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle,
  CloudRain,
  Wind,
  Leaf,
  Sparkles,
  Snowflake,
  Square,
  Play,
  StopCircle,
} from 'lucide-react';
import { useCampaign } from '@/contexts/CampaignContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import api from '@/services/api';
import type { Asset } from '@/types';

// ============================================
// Effect definitions
// ============================================

interface EffectOption {
  id: string;
  icon: React.ReactNode;
}

const EFFECT_OPTIONS: EffectOption[] = [
  { id: 'rain',     icon: <CloudRain className="w-5 h-5" /> },
  { id: 'mist',     icon: <Cloud className="w-5 h-5" /> },
  { id: 'leaves',   icon: <Leaf className="w-5 h-5" /> },
  { id: 'sparkles', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'snow',     icon: <Snowflake className="w-5 h-5" /> },
  { id: 'wind',     icon: <Wind className="w-5 h-5" /> },
];

// ============================================
// Props
// ============================================

interface AtmospherePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// Component
// ============================================

export default function AtmospherePanel({ isOpen, onClose }: AtmospherePanelProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const { campaign, activeAtmosphereEffect, activeAtmosphereAudio } = useCampaign();
  const { socket } = useWebSocket();

  // Audio asset list
  const [audioAssets, setAudioAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  // Local volume + loop (mirrors server state; UI-only until user commits)
  const [volume, setVolume] = useState(activeAtmosphereAudio?.volume ?? 0.5);
  const [loop, setLoop] = useState(activeAtmosphereAudio?.loop !== false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.5);

  // Sync volume/loop from context when panel opens or context changes
  useEffect(() => {
    if (activeAtmosphereAudio) {
      setVolume(activeAtmosphereAudio.volume);
      setLoop(activeAtmosphereAudio.loop !== false);
    }
  }, [activeAtmosphereAudio]);

  // Load AUDIO assets when panel opens
  useEffect(() => {
    if (!isOpen || !campaign) return;
    setLoadingAssets(true);
    setAssetError(null);
    api.listAssets({ type: 'AUDIO' })
      .then((r) => setAudioAssets(r.assets || []))
      .catch(() => setAssetError(t('vibe.loadAudioAssetsFailed')))
      .finally(() => setLoadingAssets(false));
  }, [isOpen, campaign]);

  // ============================================
  // Handlers
  // ============================================

  const handleEffectSelect = (effectId: string | null) => {
    socket?.emitAtmosphereEffectSet({ effect: effectId });
  };

  const handleAudioSelect = (assetId: string | null) => {
    socket?.emitAtmosphereAudioSet({
      assetId,
      volume: isMuted ? 0 : volume,
      loop,
    });
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (activeAtmosphereAudio) {
      socket?.emitAtmosphereAudioSet({
        assetId: activeAtmosphereAudio.assetId,
        volume: newVolume,
        loop,
      });
    }
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      const restoreVol = prevVolume > 0 ? prevVolume : 0.5;
      setVolume(restoreVol);
      if (activeAtmosphereAudio) {
        socket?.emitAtmosphereAudioSet({
          assetId: activeAtmosphereAudio.assetId,
          volume: restoreVol,
          loop,
        });
      }
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
      if (activeAtmosphereAudio) {
        socket?.emitAtmosphereAudioSet({
          assetId: activeAtmosphereAudio.assetId,
          volume: 0,
          loop,
        });
      }
    }
  };

  const handleLoopToggle = () => {
    const newLoop = !loop;
    setLoop(newLoop);
    if (activeAtmosphereAudio) {
      socket?.emitAtmosphereAudioSet({
        assetId: activeAtmosphereAudio.assetId,
        volume: isMuted ? 0 : volume,
        loop: newLoop,
      });
    }
  };

  // Format bytes for display
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ============================================
  // Render
  // ============================================

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="atmosphere-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="atmosphere-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-soft-cream border-l border-moss-green/20 shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-soft-cream border-b border-moss-green/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-moss-green/10">
                  <Cloud className="w-5 h-5 text-brand-ink" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-brand-ink">{t('vibe.title')}</h2>
                  <p className="text-xs text-warm-gray">{t('vibe.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-stone-gray/10 transition-colors"
              >
                <X className="w-5 h-5 text-stone-gray" />
              </button>
            </div>

            <div className="p-6 space-y-8">

              {/* ============================================
                  Section 1: Particle Overlay
                  ============================================ */}
              <section>
                <h3 className="text-sm font-semibold text-brand-ink uppercase tracking-wide mb-3">
                  {t('vibe.particleOverlay')}
                </h3>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  {EFFECT_OPTIONS.map((opt) => {
                    const isActive = activeAtmosphereEffect === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleEffectSelect(isActive ? null : opt.id)}
                        title={t(`vibe.effects.${opt.id}.description`)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          isActive
                            ? 'border-moss-green bg-moss-green/10 text-brand-ink'
                            : 'border-moss-green/20 bg-parchment/50 text-stone-gray hover:border-moss-green/50 hover:bg-moss-green/5'
                        }`}
                      >
                        {opt.icon}
                        <span className="text-xs font-medium">{t(`vibe.effects.${opt.id}.label`)}</span>
                        {isActive && (
                          <CheckCircle className="w-3 h-3 text-brand-ink" />
                        )}
                      </button>
                    );
                  })}

                  {/* "None" clear button */}
                  <button
                    onClick={() => handleEffectSelect(null)}
                    title={t('vibe.noOverlayTitle')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      !activeAtmosphereEffect
                        ? 'border-stone-gray/40 bg-stone-gray/10 text-stone-gray'
                        : 'border-moss-green/20 bg-parchment/50 text-stone-gray/50 hover:border-stone-gray/40 hover:bg-stone-gray/5'
                    }`}
                  >
                    <Square className="w-5 h-5" />
                    <span className="text-xs font-medium">{t('common:none')}</span>
                  </button>
                </div>

                <p className="text-xs text-warm-gray">
                  {activeAtmosphereEffect
                    ? t('vibe.activeEffectHint', { effect: t(`vibe.effects.${activeAtmosphereEffect}.label`, { defaultValue: activeAtmosphereEffect }) })
                    : t('vibe.noOverlayHint')}
                </p>
              </section>

              {/* ============================================
                  Section 2: Ambient Audio
                  ============================================ */}
              <section>
                <h3 className="text-sm font-semibold text-brand-ink uppercase tracking-wide mb-3">
                  {t('vibe.audio')}
                </h3>

                {/* Now Playing indicator */}
                {activeAtmosphereAudio && (
                  <div className="mb-4 p-3 rounded-lg bg-moss-green/10 border border-moss-green/20 flex items-center gap-3">
                    <div className="flex gap-0.5 items-end h-5 flex-shrink-0">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="w-1 bg-moss-green rounded-t"
                          style={{
                            height: `${30 + i * 18}%`,
                            animation: `bounce ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-brand-ink">{t('vibe.nowPlaying')}</p>
                      <p className="text-xs text-stone-gray truncate">
                        {audioAssets.find((a) => a.id === activeAtmosphereAudio.assetId)?.name ?? t('vibe.audioTrackFallback')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAudioSelect(null)}
                      title={t('vibe.stopAudio')}
                      className="p-1.5 rounded-lg text-danger-ink hover:bg-danger/10 transition-colors flex-shrink-0"
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Volume controls (only shown when audio is active) */}
                {activeAtmosphereAudio && (
                  <div className="mb-4 p-3 rounded-lg bg-parchment border border-moss-green/20 space-y-3">
                    {/* Volume slider */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleMuteToggle}
                        title={isMuted ? t('vibe.unmute') : t('vibe.mute')}
                        className="text-stone-gray hover:text-brand-ink transition-colors flex-shrink-0"
                      >
                        {isMuted || volume === 0
                          ? <VolumeX className="w-4 h-4" />
                          : <Volume2 className="w-4 h-4" />
                        }
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="flex-1 accent-moss-green"
                        title={t('vibe.volumeLabel')}
                      />
                      <span className="text-xs text-stone-gray w-8 text-right flex-shrink-0">
                        {Math.round((isMuted ? 0 : volume) * 100)}%
                      </span>
                    </div>

                    {/* Loop toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-gray">{t('vibe.loopTrack')}</span>
                      <button
                        onClick={handleLoopToggle}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          loop ? 'bg-moss-green' : 'bg-stone-gray/30'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            loop ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Asset picker */}
                <div>
                  {loadingAssets && (
                    <div className="flex items-center justify-center py-6 gap-2 text-stone-gray">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">{t('vibe.loadingAudioLibrary')}</span>
                    </div>
                  )}

                  {assetError && (
                    <p className="text-sm text-danger-ink py-2">{assetError}</p>
                  )}

                  {!loadingAssets && !assetError && audioAssets.length === 0 && (
                    <div className="text-center py-6 text-stone-gray">
                      <Music className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">{t('vibe.noAudioAssetsFound')}</p>
                      <p className="text-xs mt-1">
                        {t('vibe.uploadAudioHint')}
                      </p>
                    </div>
                  )}

                  {!loadingAssets && audioAssets.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-stone-gray mb-2">
                        {t('vibe.selectTrackHint')}
                      </p>
                      {audioAssets.map((asset) => {
                        const isPlaying = activeAtmosphereAudio?.assetId === asset.id;
                        return (
                          <button
                            key={asset.id}
                            onClick={() => handleAudioSelect(isPlaying ? null : asset.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                              isPlaying
                                ? 'border-moss-green bg-moss-green/10'
                                : 'border-moss-green/20 bg-parchment/50 hover:border-moss-green/40 hover:bg-moss-green/5'
                            }`}
                          >
                            <div className={`p-1.5 rounded ${isPlaying ? 'bg-moss-green/20' : 'bg-stone-gray/10'}`}>
                              {isPlaying
                                ? <StopCircle className="w-4 h-4 text-brand-ink" />
                                : <Play className="w-4 h-4 text-stone-gray" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isPlaying ? 'text-brand-ink' : 'text-stone-gray'}`}>
                                {asset.name}
                              </p>
                              <p className="text-xs text-warm-gray">
                                {formatSize(asset.fileSize)}
                                {' · '}{asset.scope === 'CAMPAIGN' ? t('vibe.scopeCampaign') : t('vibe.scopeGlobal')}
                              </p>
                            </div>
                            {isPlaying && (
                              <CheckCircle className="w-4 h-4 text-brand-ink flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Info note */}
              <div className="p-3 rounded-lg bg-moss-green/5 border border-moss-green/15">
                <p className="text-xs text-stone-gray">
                  {t('vibe.syncInfo')}
                </p>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
