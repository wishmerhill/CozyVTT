/**
 * Invite Player Modal
 * Fixed: uses /invitable-users endpoint (no admin required); renders via portal to avoid sidebar clipping
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, Users } from 'lucide-react';
import { api } from '@/services/api';
import { useServerConfigQuery } from '@/hooks/queries';
import { useToast } from '@/contexts/ToastContext';
import type { User } from '@/types';
import { Button, Modal, Field, Select } from '@/components/ui';
import { apiErrorMessage } from '@/utils/errors';

interface InvitePlayerModalProps {
  campaignId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InvitePlayerModal({
  campaignId,
  onClose,
  onSuccess,
}: InvitePlayerModalProps) {
  const { t } = useTranslation('campaign');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // Opt-in, and deliberately not remembered between invitations: emailing
  // someone is a decision worth making each time rather than a setting that
  // quietly stays on.
  const [sendEmail, setSendEmail] = useState(false);

  const { showToast } = useToast();
  const { data: serverConfig } = useServerConfigQuery();
  const emailAvailable = serverConfig?.smtp?.configured ?? false;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await api.listInvitableUsers(campaignId);
        setUsers(response.users || []);
      } catch (err) {
        console.error('Error fetching invitable users:', err);
        setError(t('invitePlayer.errorLoadUsers'));
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [campaignId]);

  const handleInvite = async () => {
    if (!selectedUserId) {
      setError(t('invitePlayer.selectUserRequired'));
      return;
    }
    try {
      setSending(true);
      setError('');
      const { emailSent } = await api.inviteUserToCampaign(
        campaignId,
        selectedUserId,
        sendEmail && emailAvailable
      );
      // Say what actually happened. Asking for an email and not getting one is
      // worth knowing about, and the server is the only thing that can tell us.
      showToast(
        emailSent ? t('invitePlayer.sentWithEmail') : t('invitePlayer.sentPlain'),
        'success'
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error sending invitation:', err);
      setError(apiErrorMessage(err) || t('invitePlayer.errorSend'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('roster.invite')}
      icon={Mail}
      size="sm"
      closeDisabled={sending}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={sending} variant="secondary">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!selectedUserId || loading}
            loading={sending}
            icon={Mail}
          >
            {sending ? t('common.sending') : t('invitation.send')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Error */}
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-danger/10 border border-danger/30">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* User list */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-7 h-7 text-brand-ink animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <Users className="w-8 h-8 text-ink-muted/40" />
            <p className="text-sm text-ink-muted">{t('invitePlayer.noUsers')}</p>
            <p className="text-xs text-ink-muted/70">{t('invitePlayer.noUsersHint')}</p>
          </div>
        ) : (
          <Field label={t('invitePlayer.selectUserLabel')}>
            {(field) => (
              <Select
                {...field}
                value={selectedUserId}
                onChange={(e) => { setSelectedUserId(e.target.value); setError(''); }}
              >
                <option value="">{t('invitePlayer.chooseUserPlaceholder')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {/* Email is opt-in. The invitation shows up on the player's dashboard
            regardless, so most of the time telling them yourself is enough.
            Note the label cannot name their email address — the invitable-users
            endpoint withholds addresses so a DM cannot harvest them. */}
        {!loading && users.length > 0 && (
          <label
            className={`flex items-start gap-3 ${
              emailAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
            }`}
          >
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={sendEmail && emailAvailable}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={sending || !emailAvailable}
                className="w-4 h-4 rounded border-moss-green/30 text-brand-ink focus:ring-moss-green/50"
              />
            </div>
            <div>
              <span className="text-sm text-ink">{t('invitePlayer.emailCheckboxLabel')}</span>
              <p className="text-xs text-warm-gray mt-0.5">
                {emailAvailable
                  ? t('invitePlayer.emailHintAvailable')
                  : t('invitePlayer.emailHintUnavailable')}
              </p>
            </div>
          </label>
        )}
      </div>
    </Modal>
  );
}
