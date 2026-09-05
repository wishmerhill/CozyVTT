/**
 * New Character Modal
 * Modal dialog for creating a new character with game system templates
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, User, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui';
import { Character, GameSystem, Campaign } from '@/types';
import { GAME_SYSTEM_OPTIONS } from '@/constants/game-systems';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import { apiErrorMessage, apiValidationIssues, errorMessage } from '@/utils/errors';

interface NewCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (character: Character) => void;
  /** If provided, character will be assigned to this campaign */
  campaign?: Campaign;
  /** If provided, this game system will be pre-selected and locked */
  preselectedGameSystem?: GameSystem | null;
}

interface TemplateOption {
  value: string;
  label: string;
  description: string;
}

/** Template value keys available per game system — labels/descriptions come from i18n. */
const TEMPLATE_KEYS_BY_SYSTEM: Record<string, string[]> = {
  [GameSystem.DND_5E]: ['blank', 'fighter'],
  [GameSystem.PATHFINDER_2E]: ['blank', 'fighter'],
  [GameSystem.SHADOWRUN_6E]: ['blank', 'streetsamurai'],
  [GameSystem.CALL_OF_CTHULHU_7E]: ['blank', 'privateinvestigator'],
};

/** Maps GameSystem enum values to the i18n key segment used under modal.new.templates.* */
const GAME_SYSTEM_I18N_KEY: Record<string, string> = {
  [GameSystem.DND_5E]: 'dnd5e',
  [GameSystem.PATHFINDER_2E]: 'pathfinder2e',
  [GameSystem.SHADOWRUN_6E]: 'shadowrun6e',
  [GameSystem.CALL_OF_CTHULHU_7E]: 'callOfCthulhu7e',
};

export default function NewCharacterModal({
  isOpen,
  onClose,
  onSuccess,
  campaign,
  preselectedGameSystem,
}: NewCharacterModalProps) {
  const { t } = useTranslation('character');
  const [name, setName] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaign?.id || null
  );
  const [gameSystem, setGameSystem] = useState<GameSystem | null>(
    preselectedGameSystem || campaign?.gameSystem || null
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [error, setError] = useState('');

  // Fetch user's campaigns when modal opens
  useEffect(() => {
    if (isOpen && !campaign) {
      fetchUserCampaigns();
    }
  }, [isOpen, campaign]);

  // Update game system when campaign selection changes
  useEffect(() => {
    if (selectedCampaignId && availableCampaigns.length > 0) {
      const selectedCampaign = availableCampaigns.find(
        (c) => c.id === selectedCampaignId
      );
      if (selectedCampaign?.gameSystem) {
        setGameSystem(selectedCampaign.gameSystem);
      }
    }
  }, [selectedCampaignId, availableCampaigns]);

  const fetchUserCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const response = await api.listCampaigns();
      setAvailableCampaigns(response.campaigns);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const isGameSystemLocked = (): boolean => {
    // If preselected (from campaign context), lock it
    if (preselectedGameSystem !== undefined) {
      return true;
    }

    // If campaign is selected and has a game system, lock it
    if (selectedCampaignId && availableCampaigns.length > 0) {
      const selectedCampaign = availableCampaigns.find(
        (c) => c.id === selectedCampaignId
      );
      return selectedCampaign?.gameSystem !== null && selectedCampaign?.gameSystem !== undefined;
    }

    return false;
  };

  const getTemplateOptions = (): TemplateOption[] => {
    if (!gameSystem) {
      return [
        {
          value: 'blank',
          label: t('modal.new.templates.none.blank.label'),
          description: t('modal.new.templates.none.blank.description'),
        },
        {
          value: 'basic',
          label: t('modal.new.templates.none.basic.label'),
          description: t('modal.new.templates.none.basic.description'),
        },
      ];
    }

    const systemKey = GAME_SYSTEM_I18N_KEY[gameSystem];
    const values = TEMPLATE_KEYS_BY_SYSTEM[gameSystem] || [];
    return values.map((value) => ({
      value,
      label: t(`modal.new.templates.${systemKey}.${value}.label`),
      description: t(`modal.new.templates.${systemKey}.${value}.description`),
    }));
  };

  /**
   * When true, the sheet is also published as a shared template after the
   * character is created. Held in a ref rather than state because the second
   * submit button sets it immediately before the form submits, and a state
   * update would not have landed by the time handleSubmit reads it.
   */
  const alsoPublishTemplate = useRef(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Validation
    if (name.trim().length < 2) {
      setError(t('modal.new.errors.nameTooShort'));
      return;
    }

    if (name.trim().length > 100) {
      setError(t('modal.new.errors.nameTooLong'));
      return;
    }

    setLoading(true);

    try {
      // Always fetch the template from the backend (even for 'blank') so that
      // the character is created with all required schema fields populated.
      let templateData: Record<string, unknown> = {};
      if (selectedTemplate) {
        const systemParam = gameSystem || 'null';
        const templateResponse = await fetch(
          `/api/characters/templates/${systemParam}/${selectedTemplate}`,
          { credentials: 'include' }
        );

        if (!templateResponse.ok) {
          const errorText = await templateResponse.text();
          console.error('Template fetch failed:', errorText);
          throw new Error(`Failed to fetch character template: ${templateResponse.status} ${templateResponse.statusText}`);
        }

        const templateJson = await templateResponse.json();
        templateData = templateJson.data || {};
      }

      // Create character using the api client
      const response = await api.createCharacter({
        name: name.trim(),
        campaignId: selectedCampaignId || undefined,
        gameSystem: gameSystem || undefined,
        data: templateData as unknown as import('@/types').CharacterData,
      });

      // Optionally publish the same sheet as a shared template. Done after the
      // character exists, and failing softly: the character is the thing the
      // user asked for, so a template error must not lose it.
      if (alsoPublishTemplate.current) {
        try {
          await api.createCharacterTemplate({
            name: name.trim(),
            gameSystem: gameSystem || null,
            data: templateData,
          });
        } catch {
          setError(t('modal.new.publishTemplateFailed'));
        }
        alsoPublishTemplate.current = false;
      }

      // Reset form
      setName('');
      setSelectedCampaignId(campaign?.id || null);
      setGameSystem(preselectedGameSystem || campaign?.gameSystem || null);
      setSelectedTemplate('blank');

      // Notify parent
      onSuccess(response.character);

      // Close modal
      onClose();
    } catch (err) {
      // Show detailed validation errors if available
      const issues = apiValidationIssues(err);
      if (issues) {
        const errorList = issues
          .map((e) => `• ${e.path}: ${e.message}`)
          .join('\n');
        setError(`${apiErrorMessage(err)}\n\n${errorList}`);
        console.error('Validation errors:', issues);
      } else {
        setError(apiErrorMessage(err) || errorMessage(err) || t('modal.new.errors.createFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setSelectedCampaignId(campaign?.id || null);
      setGameSystem(preselectedGameSystem || campaign?.gameSystem || null);
      setSelectedTemplate('blank');
      setError('');
      onClose();
    }
  };

  const isFormValid = name.trim().length >= 2;

  return (
    <Modal open={isOpen} onClose={handleClose} title={t('modal.new.title')} icon={User} size="lg" closeDisabled={loading}>
      {/* Error Alert */}
      {error && (
                <div className="mb-4 bg-spirit-red/10 border border-spirit-red/30 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-spirit-red font-medium whitespace-pre-wrap font-mono">
                    {error}
                  </p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Character Name */}
                <div>
                  <label
                    htmlFor="characterName"
                    className="block text-sm font-semibold text-ink mb-2"
                  >
                    {t('modal.new.nameLabel')} <span className="text-spirit-red">*</span>
                  </label>
                  <input
                    type="text"
                    id="characterName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('modal.new.namePlaceholder')}
                    disabled={loading}
                    className="input-cozy w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    autoFocus
                    required
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('modal.new.nameHint')}
                  </p>
                </div>

                {/* Campaign Selection (if not from campaign context) */}
                {!campaign && (
                  <div>
                    <label
                      htmlFor="campaign"
                      className="block text-sm font-semibold text-ink mb-2"
                    >
                      {t('modal.new.campaignLabel')} <span className="text-ink-muted">({t('common:optional')})</span>
                    </label>
                    <select
                      id="campaign"
                      value={selectedCampaignId || ''}
                      onChange={(e) =>
                        setSelectedCampaignId(e.target.value || null)
                      }
                      disabled={loading || loadingCampaigns}
                      className="input-cozy w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{t('modal.new.unassignedOption')}</option>
                      {availableCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.gameSystem && ` (${c.gameSystem})`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-ink-muted">
                      {t('modal.new.campaignHint')}
                    </p>
                  </div>
                )}

                {/* Game System Selection */}
                <div>
                  <label
                    htmlFor="gameSystem"
                    className="block text-sm font-semibold text-ink mb-2"
                  >
                    {t('modal.new.gameSystemLabel')}{' '}
                    {isGameSystemLocked() ? (
                      <span className="text-ink-muted">{t('modal.new.fromCampaignSuffix')}</span>
                    ) : (
                      <span className="text-ink-muted">({t('common:optional')})</span>
                    )}
                  </label>
                  <select
                    id="gameSystem"
                    value={gameSystem || ''}
                    onChange={(e) => {
                      setGameSystem((e.target.value as GameSystem) || null);
                      setSelectedTemplate('blank'); // Reset template when game system changes
                    }}
                    disabled={loading || isGameSystemLocked()}
                    className="input-cozy w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{t('modal.template.flexibleNoSystem')}</option>
                    {GAME_SYSTEM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-ink-muted">
                    {isGameSystemLocked()
                      ? t('modal.new.gameSystemHintLocked')
                      : t('modal.new.gameSystemHintFree')}
                  </p>
                </div>

                {/* Template Selection (only if game system is selected) */}
                {gameSystem && (
                  <div>
                    <label
                      htmlFor="template"
                      className="block text-sm font-semibold text-ink mb-2"
                    >
                      {t('modal.new.templateLabel')}
                    </label>
                    <div className="space-y-3">
                      {getTemplateOptions().map((template) => (
                        <label
                          key={template.value}
                          className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedTemplate === template.value
                              ? 'border-moss-green bg-moss-green/5'
                              : 'border-ink/10 hover:border-moss-green/50'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="radio"
                            name="template"
                            value={template.value}
                            checked={selectedTemplate === template.value}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            disabled={loading}
                            className="mt-1 mr-3"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">
                                {template.label}
                              </span>
                              {template.value !== 'blank' && (
                                <Sparkles className="w-4 h-4 text-warm-amber" />
                              )}
                            </div>
                            <p className="text-sm text-ink-muted mt-1">
                              {template.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">
                      {t('modal.new.templateHint')}
                    </p>
                  </div>
                )}

                {/* Info Box */}
                <div className="rounded-lg p-4 bg-moss-green/10 border border-moss-green/30">
                  <p className="text-sm text-ink">
                    <strong className="text-brand-ink">{t('modal.new.noteLabel')}</strong> {t('modal.new.noteBody')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    variant="secondary" className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('modal.new.cancel')}
                  </Button>

                  <Button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                        {t('modal.new.creating')}
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 inline-block mr-2" />
                        {t('modal.new.create')}
                      </>
                    )}
                  </Button>
                </div>

                {/* Publish the same sheet for others to copy, in one step. */}
                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={loading || !isFormValid}
                    onClick={() => { alsoPublishTemplate.current = true; }}
                    title={t('modal.new.publishTitleHint')}
                    className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('modal.new.createAndPublish')}
                  </Button>
                </div>
              </form>
    </Modal>
  );
}
