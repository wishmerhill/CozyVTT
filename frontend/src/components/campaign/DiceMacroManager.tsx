/**
 * Add, rename, correct and delete your saved dice rolls.
 *
 * The macros themselves are one-click buttons in the dice panel; this is where
 * the list is managed, so the panel keeps a single row of buttons and nothing
 * else. Opening it pre-fills the expression box with whatever is currently typed
 * in the dice panel, so "I have typed this three times now" becomes a macro
 * without retyping it.
 *
 * Expressions are checked by the server against the code that actually rolls
 * them, and its message is what gets shown — the client cannot tell a good
 * expression from a bad one on its own, and pretending otherwise here would let
 * someone save a button that fails every time they press it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dices, Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react';
import { Button, Modal, Input } from '@/components/ui';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/services/api';
import { apiErrorMessage } from '@/utils/errors';
import type { DiceMacro } from '@/types';

interface DiceMacroManagerProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  /** Whatever is currently in the dice panel's expression box. */
  initialExpression?: string;
  /** Tell the panel the list changed, so its buttons refresh. */
  onMacrosChanged: (macros: DiceMacro[]) => void;
}

export default function DiceMacroManager({
  isOpen,
  onClose,
  campaignId,
  initialExpression = '',
  onMacrosChanged,
}: DiceMacroManagerProps) {
  const { t } = useTranslation(['campaign', 'common']);
  const [macros, setMacros] = useState<DiceMacro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newExpression, setNewExpression] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editExpression, setEditExpression] = useState('');

  const [macroToDelete, setMacroToDelete] = useState<DiceMacro | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const publish = useCallback(
    (next: DiceMacro[]) => {
      setMacros(next);
      onMacrosChanged(next);
    },
    [onMacrosChanged]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { macros: fetched } = await api.listDiceMacros(campaignId);
      publish(fetched);
    } catch (err) {
      setError(apiErrorMessage(err) ?? t('diceMacros.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [campaignId, publish]);

  // Reload each time it opens: another tab may have changed the list, and the
  // panel behind is about to render whatever this returns.
  useEffect(() => {
    if (!isOpen) return;
    void load();
    setNewName('');
    setNewExpression(initialExpression.trim());
    setEditingId(null);
    setError(null);
  }, [isOpen, load, initialExpression]);

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    try {
      const { macro } = await api.createDiceMacro(campaignId, {
        name: newName.trim(),
        expression: newExpression.trim(),
      });
      publish([...macros, macro]);
      setNewName('');
      setNewExpression('');
    } catch (err) {
      // The server's wording explains itself — "Too many dice. Maximum 100 per
      // expression." — so it is shown rather than replaced with something vague.
      setError(apiErrorMessage(err) ?? t('diceMacros.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (macro: DiceMacro) => {
    setEditingId(macro.id);
    setEditName(macro.name);
    setEditExpression(macro.expression);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const { macro } = await api.updateDiceMacro(campaignId, editingId, {
        name: editName.trim(),
        expression: editExpression.trim(),
      });
      // Replaced in place: the order is the order of the buttons, and an edit
      // must not move one.
      publish(macros.map((m) => (m.id === macro.id ? macro : m)));
      setEditingId(null);
    } catch (err) {
      setError(apiErrorMessage(err) ?? t('diceMacros.errorSaveEdit'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!macroToDelete) return;
    const doomed = macroToDelete;
    setMacroToDelete(null);
    setDeletingId(doomed.id);
    setError(null);
    try {
      await api.deleteDiceMacro(campaignId, doomed.id);
      publish(macros.filter((m) => m.id !== doomed.id));
    } catch (err) {
      setError(apiErrorMessage(err) ?? t('diceMacros.errorDelete'));
    } finally {
      setDeletingId(null);
    }
  };

  const canAdd = newName.trim().length > 0 && newExpression.trim().length > 0 && !saving;

  return (
    <>
      <Modal open={isOpen} onClose={onClose} title={t('diceMacros.title')} icon={Dices} size="md">
        <div className="space-y-4">
          <p className="text-xs text-ink-secondary">
            {t('diceMacros.description')}
          </p>

          {error && (
            <p className="text-xs text-danger-ink" role="alert">
              {error}
            </p>
          )}

          {/* Existing macros */}
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-ink-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('diceMacros.loading')}
            </div>
          ) : macros.length === 0 ? (
            <p className="text-xs text-ink-secondary italic">
              {t('diceMacros.empty')}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {macros.map((macro) => (
                <li
                  key={macro.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-moss-green/20 bg-surface/40"
                >
                  {editingId === macro.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label={t('diceMacros.nameLabel', { name: macro.name })}
                        className="flex-1 min-w-0"
                      />
                      <Input
                        value={editExpression}
                        onChange={(e) => setEditExpression(e.target.value)}
                        aria-label={t('diceMacros.expressionLabel', { name: macro.name })}
                        className="flex-1 min-w-0 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={saving}
                        aria-label={t('diceMacros.saveChangesLabel', { name: macro.name })}
                        className="p-1.5 rounded-lg text-success-ink hover:bg-success/10 disabled:opacity-40"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label={t('diceMacros.cancelEditing')}
                        className="p-1.5 rounded-lg text-ink-secondary hover:bg-surface"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 truncate text-sm text-ink">{macro.name}</span>
                      <span className="font-mono text-xs text-ink-secondary flex-shrink-0">
                        {macro.expression}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditing(macro)}
                        aria-label={t('diceMacros.editLabel', { name: macro.name })}
                        className="p-1.5 rounded-lg text-ink-secondary hover:bg-surface"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMacroToDelete(macro)}
                        disabled={deletingId === macro.id}
                        aria-label={t('diceMacros.deleteLabel', { name: macro.name })}
                        className="p-1.5 rounded-lg text-danger-ink hover:bg-danger/10 disabled:opacity-40"
                      >
                        {deletingId === macro.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add a new one */}
          <div className="pt-3 border-t border-moss-green/20 space-y-2">
            <div className="text-xs text-ink-secondary">{t('diceMacros.addSectionTitle')}</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('diceMacros.namePlaceholder')}
                aria-label={t('diceMacros.nameAriaLabel')}
                className="flex-1 min-w-0"
              />
              <Input
                value={newExpression}
                onChange={(e) => setNewExpression(e.target.value)}
                placeholder={t('diceMacros.expressionPlaceholder')}
                aria-label={t('diceMacros.expressionAriaLabel')}
                className="flex-1 min-w-0 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canAdd) {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd}
                variant="secondary"
                className="flex items-center gap-2 flex-shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('diceMacros.addButton')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!macroToDelete}
        title={t('diceMacros.deleteConfirmTitle')}
        message={t('diceMacros.deleteConfirmMessage', { name: macroToDelete?.name ?? t('diceMacros.deleteConfirmFallbackName') })}
        confirmLabel={t('common:delete')}
        cancelLabel={t('common:cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setMacroToDelete(null)}
      />
    </>
  );
}
