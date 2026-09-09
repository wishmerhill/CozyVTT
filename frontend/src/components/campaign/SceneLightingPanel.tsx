/**
 * SceneLightingPanel
 * DM-only slide-over exposing the current map's environment type and
 * ambient light preset (Day / Dusk / Night / Pitch Black / Custom) — the
 * same fields editable from the in-canvas DM Ambient Controls widget and
 * the Edit Map modal, surfaced here as a session-wide quick link so the DM
 * doesn't need to hunt for the floating map-editor widget mid-session.
 *
 * Distinct from AtmospherePanel: that one drives purely cosmetic,
 * campaign-wide particle/audio overlays. This one drives the per-map
 * environmentType/ambientLightPreset fields that gate the actual
 * raycasting/fog-of-war/visibility logic in MapCanvas.
 */

import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { X, SunMoon } from 'lucide-react';
import { useCampaign } from '@/contexts/CampaignContext';
import api from '@/services/api';
import DmAmbientControls from '@/components/campaign/DmAmbientControls';

interface SceneLightingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SceneLightingPanel({ isOpen, onClose }: SceneLightingPanelProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const { campaign, currentMap, setCurrentMap } = useCampaign();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="scene-lighting-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="scene-lighting-panel"
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
                  <SunMoon className="w-5 h-5 text-brand-ink" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-brand-ink">{t('lighting.sceneLightingTitle')}</h2>
                  <p className="text-xs text-warm-gray">{t('lighting.sceneLightingSubtitle')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-stone-gray/10 transition-colors"
              >
                <X className="w-5 h-5 text-stone-gray" />
              </button>
            </div>

            <div className="p-6">
              {currentMap && campaign ? (
                <DmAmbientControls
                  embedded
                  environmentType={currentMap.environmentType ?? 'indoor'}
                  ambientLightPreset={currentMap.ambientLightPreset ?? 'pitch_black'}
                  ambientColor={currentMap.ambientColor ?? '#000000'}
                  ambientOpacity={currentMap.ambientOpacity ?? 1}
                  lightingEnabled={currentMap.lightingEnabled ?? false}
                  onChange={(changes) => {
                    const updatedMap = { ...currentMap, ...changes };
                    setCurrentMap(updatedMap); // optimistic — the DM's own view updates immediately
                    api.updateMap(campaign.id, currentMap.id, changes).catch(() => {
                      setCurrentMap(currentMap); // revert on failure
                    });
                  }}
                />
              ) : (
                <p className="text-sm text-warm-gray">{t('lighting.sceneLightingNoMap')}</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
