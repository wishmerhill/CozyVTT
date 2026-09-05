// ============================================
// Delete Character Modal
// Confirmation dialog with campaign assignment validation
// ============================================

import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { Character, Campaign } from '@/types';
import { Button, Modal } from '@/components/ui';
import { apiErrorMessage } from '@/utils/errors';

interface DeleteCharacterModalProps {
  isOpen: boolean;
  character: Character | null;
  campaign?: Campaign | null;
  onClose: () => void;
  onConfirm: (characterId: string) => Promise<void>;
}

export default function DeleteCharacterModal({
  isOpen,
  character,
  campaign,
  onClose,
  onConfirm,
}: DeleteCharacterModalProps) {
  const { t } = useTranslation(['character', 'campaign', 'common']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  if (!character) return null;

  // Check if character is in an active or paused campaign
  const isInActiveCampaign = campaign && (
    campaign.status === 'ACTIVE' || campaign.status === 'PAUSED'
  );

  // Check if character is in preparation/completed/archived campaign
  const isInInactiveCampaign = campaign && (
    campaign.status === 'PREPARATION' ||
    campaign.status === 'COMPLETED' ||
    campaign.status === 'ARCHIVED'
  );

  const statusLabel = (status: string) =>
    t(`campaign:status.${status.toLowerCase()}`).toLowerCase();

  const handleConfirm = async () => {
    // Prevent deletion if in active campaign
    if (isInActiveCampaign) {
      setError(t('modal.delete.blockedByStatus', { status: statusLabel(campaign!.status) }));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onConfirm(character.id);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err) || t('modal.delete.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title={t('modal.delete.title')} icon={Trash2} size="sm" closeDisabled={loading}>
      {/* Error Alert */}
      {error && (
        <div role="alert" className="mb-4 bg-danger/10 border border-danger/30 rounded-lg p-4">
          <p className="text-sm text-danger font-medium">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
                {/* Active Campaign Warning */}
                {isInActiveCampaign && (
                  <div className="bg-warm-amber/10 border border-warm-amber/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-warm-amber flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-warm-amber mb-1">
                          {t('modal.delete.cannotDeleteTitle')}
                        </h3>
                        <p className="text-sm text-stone-gray">
                          <Trans
                            i18nKey="character:modal.delete.cannotDeleteBody"
                            values={{ name: campaign!.name, status: statusLabel(campaign!.status) }}
                            components={{ strong: <strong /> }}
                          />
                        </p>
                        <p className="text-sm text-stone-gray mt-2">
                          {t('modal.delete.cannotDeleteHint')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inactive Campaign Warning */}
                {isInInactiveCampaign && (
                  <div className="bg-warm-amber/10 border border-warm-amber/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-warm-amber flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-warm-amber mb-1">
                          {t('modal.delete.assignedWarningTitle')}
                        </h3>
                        <p className="text-sm text-stone-gray">
                          <Trans
                            i18nKey="character:modal.delete.assignedWarningBody"
                            values={{ name: campaign!.name, status: statusLabel(campaign!.status) }}
                            components={{ strong: <strong /> }}
                          />
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unassigned Character Confirmation */}
                {!campaign && (
                  <div className="bg-moss-green/10 border border-moss-green/30 rounded-lg p-4">
                    <p className="text-sm text-stone-gray">
                      {t('modal.delete.confirm', { name: character.name })}
                    </p>
                  </div>
                )}

                {/* Character Info */}
                <div className="glass-panel p-4">
                  <h3 className="font-semibold text-brand-ink mb-2">{t('modal.delete.detailsTitle')}</h3>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-warm-gray">{t('modal.delete.nameLabel')}</dt>
                      <dd className="text-stone-gray font-medium">{character.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-warm-gray">{t('modal.delete.gameSystemLabel')}</dt>
                      <dd className="text-stone-gray font-medium">
                        {character.gameSystem || t('common:flexible')}
                      </dd>
                    </div>
                    {campaign && (
                      <div className="flex justify-between">
                        <dt className="text-warm-gray">{t('modal.delete.campaignLabel')}</dt>
                        <dd className="text-stone-gray font-medium">{campaign.name}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

      {/* Actions */}
      <div className="flex gap-3 pt-6">
        <Button
          type="button"
          onClick={handleClose}
          disabled={loading}
          variant="secondary"
          className="flex-1"
        >
          {t('modal.delete.cancel')}
        </Button>

        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!!isInActiveCampaign}
          loading={loading}
          icon={Trash2}
          variant="danger"
          className="flex-1"
        >
          {loading ? t('modal.delete.deleting') : t('modal.delete.delete')}
        </Button>
      </div>
    </Modal>
  );
}
