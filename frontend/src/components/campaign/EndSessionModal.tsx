/**
 * End Session Modal
 * Session State Management
 *
 * Confirmation modal for ending a session.
 * Allows DM to choose whether to save game state and add session notes.
 * Shows session summary (duration, session number).
 */

import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Square, Save, Clock, Hash } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

// ============================================
// Duration formatter
// ============================================

function formatDuration(startedAt: string, t: TFunction): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  const minutesText = t('session.durationMinutes', { count: m });
  if (h === 0) return minutesText;
  const hoursText = t('session.durationHours', { count: h });
  return `${hoursText} ${minutesText}`;
}

// ============================================
// Props
// ============================================

interface EndSessionModalProps {
  session: {
    id: string;
    sessionNumber: number;
    startedAt: string;
  };
  onConfirm: (saveState: boolean, notes: string) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

// ============================================
// Component
// ============================================

export default function EndSessionModal({
  session,
  onConfirm,
  onClose,
  isSubmitting,
}: EndSessionModalProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const [saveState, setSaveState] = useState(true);
  const [notes, setNotes] = useState('');

  const duration = formatDuration(session.startedAt, t);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(saveState, notes);
  };

  return (
    <Modal open onClose={onClose} title={t('session.end')} icon={Square} size="sm" closeDisabled={isSubmitting}>
      <div className="space-y-5">
        <p className="text-xs text-ink-muted -mt-4">{t('session.endHint')}</p>

        {/* Session Summary */}
        <div className="rounded-lg bg-parchment border border-moss-green/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-gray uppercase tracking-wide">{t('session.summaryTitle')}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-warm-amber flex-shrink-0" />
              <div>
                <p className="text-xs text-warm-gray">{t('session.sessionLabel')}</p>
                <p className="text-sm font-semibold text-stone-gray">#{session.sessionNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-warm-amber flex-shrink-0" />
              <div>
                <p className="text-xs text-warm-gray">{t('session.duration')}</p>
                <p className="text-sm font-semibold text-stone-gray">{duration}</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Save State Toggle */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={saveState}
                onChange={(e) => setSaveState(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 rounded border-moss-green/30 text-brand-ink focus:ring-moss-green/50 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5 text-brand-ink" />
                <span className="text-sm font-medium text-stone-gray">{t('session.saveGameState')}</span>
              </div>
              <p className="text-xs text-warm-gray mt-0.5">
                {t('session.saveGameStateHint')}
              </p>
            </div>
          </label>

          {/* Session Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-gray mb-1.5">
              {t('session.notes')}
              <span className="ml-1 font-normal text-warm-gray">({t('common:optional')})</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              maxLength={2000}
              placeholder={t('session.notesPlaceholder')}
              className="input-cozy w-full resize-none text-sm"
            />
            <p className="text-xs text-warm-gray mt-1 text-right">{notes.length}/2000</p>
            <p className="text-xs text-warm-gray/70 mt-1">
              <Trans
                i18nKey="campaign:session.notesHistoryHint"
                components={{ strong: <span className="font-medium" /> }}
              />
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              variant="secondary"
            >
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={isSubmitting}
              icon={Square}
              className="text-sm"
            >
              {isSubmitting ? t('session.ending') : t('session.end')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
