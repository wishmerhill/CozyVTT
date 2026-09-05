/**
 * Campaign Invitation Modal
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, XCircle, Users } from 'lucide-react';
import { api } from '@/services/api';
import Toast, { useToast } from '@/components/Toast';
import type { CampaignInvitation, Character } from '@/types';
import { Modal } from '@/components/ui';
import { apiErrorMessage } from '@/utils/errors';

interface InvitationModalProps {
  invitation: CampaignInvitation;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

export default function InvitationModal({
  invitation,
  onClose,
  onAccept,
  onDecline,
}: InvitationModalProps) {
  const { t } = useTranslation('campaign');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // Fetch user's characters
  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        setLoading(true);
        const response = await api.listCharacters();

        // Filter for compatible characters
        const compatible = response.characters.filter((char: Character) => {
          // Not already assigned
          const notAssigned = !char.campaignId;

          // Game system compatible
          const systemMatch =
            !char.gameSystem ||
            !invitation.campaign?.gameSystem ||
            char.gameSystem === invitation.campaign.gameSystem;

          return notAssigned && systemMatch;
        });

        setCharacters(compatible);
      } catch (error) {
        console.error('Error fetching characters:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacters();
  }, [invitation.campaign?.gameSystem]);

  // Toggle character selection
  const toggleCharacter = (characterId: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    );
  };

  // Handle accept invitation
  const handleAccept = async () => {
    try {
      setProcessing(true);
      await api.acceptInvitation(invitation.id, selectedCharacterIds);
      onAccept();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      showToast(apiErrorMessage(error) || t('invitation.errorAccept'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Handle decline invitation
  const handleDecline = async () => {
    try {
      setProcessing(true);
      await api.declineInvitation(invitation.id);
      onDecline();
    } catch (error) {
      console.error('Error declining invitation:', error);
      showToast(apiErrorMessage(error) || t('invitation.errorDecline'), 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Get game system display name
  const getSystemName = (gameSystem: string | null) => {
    switch (gameSystem) {
      case 'DND_5E':
        return t('gameSystemNames.dnd5e');
      case 'PATHFINDER_2E':
        return t('gameSystemNames.pathfinder2e');
      case 'SHADOWRUN_6E':
        return t('gameSystemNames.shadowrun6e');
      case 'CALL_OF_CTHULHU_7E':
        return t('gameSystemNames.callOfCthulhu7e');
      case null:
        return t('gameSystemNames.flexible');
      default:
        return gameSystem;
    }
  };

  return (
    <>
      <Modal open onClose={onClose} title={t('invitation.modalTitle')} icon={Users} size="lg" closeDisabled={processing}>
          <p className="text-sm text-ink-muted -mt-4 mb-4">
            {t('invitation.subtitle')}
          </p>

          {/* Campaign Details */}
          <div className="mb-6 p-4 rounded-lg bg-parchment/50 border border-moss-green/20">
            <h3 className="text-lg font-semibold text-brand-ink mb-2">
              {invitation.campaign?.name}
            </h3>
            {invitation.campaign?.description && (
              <p className="text-sm text-warm-gray mb-3">
                {invitation.campaign.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-warm-gray">{t('invitation.gameSystemLabel')}</span>{' '}
                <span className="font-medium text-stone-gray">
                  {getSystemName(invitation.campaign?.gameSystem || null)}
                </span>
              </div>
              {invitation.campaign?.owner && (
                <div>
                  <span className="text-warm-gray">{t('info.dm')}</span>{' '}
                  <span className="font-medium text-stone-gray">
                    {invitation.campaign.owner.displayName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Character Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-brand-ink mb-3">
              {t('invitation.selectCharacters')}
            </h3>
            <p className="text-sm text-warm-gray mb-4">
              {t('invitation.selectCharactersHint')}
            </p>

            {loading ? (
              <div className="text-center py-8">
                <p className="text-sm text-warm-gray">{t('invitation.loadingCharacters')}</p>
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-lg bg-parchment/50">
                <p className="text-sm text-warm-gray mb-2">
                  {t('invitation.noCompatibleCharacters')}
                </p>
                <p className="text-xs text-warm-gray">
                  {t('invitation.noCompatibleCharactersHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-parchment/50 hover:bg-parchment cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCharacterIds.includes(character.id)}
                      onChange={() => toggleCharacter(character.id)}
                      className="w-4 h-4 rounded border-moss-green/30 text-brand-ink focus:ring-moss-green focus:ring-offset-0"
                    />
                    {character.tokenImageUrl ? (
                      <img
                        src={character.tokenImageUrl}
                        alt={character.name}
                        className="w-10 h-10 rounded-full object-cover border border-moss-green/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-moss-green/10 border border-moss-green/20 flex items-center justify-center">
                        <span className="text-sm text-brand-ink font-semibold">
                          {character.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-gray">
                        {character.name}
                      </p>
                      {character.gameSystem && (
                        <p className="text-xs text-warm-gray">
                          {getSystemName(character.gameSystem)}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleDecline}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="w-4 h-4" />
              {t('invitation.decline')}
            </button>
            <button
              onClick={handleAccept}
              disabled={processing}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-moss-green text-white hover:bg-moss-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {processing ? t('invitation.processing') : t('invitation.acceptButton')}
            </button>
          </div>
      </Modal>

      <Toast message={toast.message} type={toast.type} show={toast.show} onClose={hideToast} />
    </>
  );
}
