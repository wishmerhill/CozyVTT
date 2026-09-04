/**
 * NewCharacterTemplateModal
 * Publishes a new shareable starter sheet.
 *
 * The sheet itself starts from the same blank the character-creation flow uses,
 * fetched from the backend so it arrives with every field its game system
 * requires. The author then fills it in through the normal sheet editor.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import api from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import { GAME_SYSTEM_OPTIONS } from '@/constants/game-systems';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Textarea, Select } from '@/components/ui/Input';

interface NewCharacterTemplateModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** Prefill from an existing sheet — used by "Save as Template". */
  initial?: {
    name?: string;
    gameSystem?: string | null;
    data?: unknown;
    tokenImageUrl?: string | null;
  };
}

export default function NewCharacterTemplateModal({
  onClose,
  onCreated,
  initial,
}: NewCharacterTemplateModalProps) {
  const { t } = useTranslation(['character', 'common']);
  const { showToast } = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState('');
  const [gameSystem, setGameSystem] = useState(initial?.gameSystem ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When prefilled from an existing sheet the system is fixed — the data only
  // makes sense against the system it was written for.
  const systemLocked = initial?.data !== undefined;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('modal.template.nameRequired'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let data = initial?.data;

      // No sheet supplied: start from the backend's blank for this system so
      // every required field is present, exactly as character creation does.
      if (data === undefined) {
        const systemParam = gameSystem || 'null';
        const res = await fetch(`/api/characters/templates/${systemParam}/blank`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load a blank sheet');
        data = (await res.json()).data ?? {};
      }

      await api.createCharacterTemplate({
        name: name.trim(),
        description: description.trim() || null,
        gameSystem: gameSystem || null,
        tokenImageUrl: initial?.tokenImageUrl ?? null,
        data,
      });

      showToast(t('modal.template.published'), 'success');
      onCreated();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        t('modal.template.createFailed');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial?.data !== undefined ? t('modal.template.saveAsTitle') : t('modal.template.newTitle')}
      icon={FileText}
      closeDisabled={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {t('modal.template.publishButton')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          {t('modal.template.visibilityNote')}
        </p>

        <Field label={t('modal.template.nameFieldLabel')} required error={error}>
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('modal.template.namePlaceholder')}
              maxLength={200}
            />
          )}
        </Field>

        <Field
          label={t('modal.template.descriptionFieldLabel')}
          hint={t('modal.template.descriptionHint')}
        >
          {(props) => (
            <Textarea
              {...props}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('modal.template.descriptionPlaceholder')}
            />
          )}
        </Field>

        <Field
          label={t('modal.template.gameSystemFieldLabel')}
          hint={
            systemLocked
              ? t('modal.template.gameSystemHintLocked')
              : t('modal.template.gameSystemHintEditable')
          }
        >
          {(props) => (
            <Select
              {...props}
              value={gameSystem ?? ''}
              disabled={systemLocked}
              onChange={(e) => setGameSystem(e.target.value)}
            >
              <option value="">{t('modal.template.flexibleNoSystem')}</option>
              {GAME_SYSTEM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
