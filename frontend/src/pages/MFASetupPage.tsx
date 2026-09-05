// ============================================
// MFA Setup Page
//
// Two-step flow:
//   Step 1: Scan QR code → enter 6-digit TOTP to verify
//   Step 2: Save backup codes (shown once)
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Copy, CheckCircle, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { apiErrorMessage } from '@/utils/errors';

type Step = 'loading' | 'scan' | 'backup-codes' | 'error';

export default function MFASetupPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { authenticated, setupMFA, completeMFASetup } = useAuth();

  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('loading');
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);
  const [initError, setInitError] = useState('');

  useEffect(() => {
    if (!authenticated) {
      navigate('/auth/login', { replace: true });
    }
  }, [authenticated, navigate]);

  useEffect(() => {
    if (!authenticated) return;

    const initSetup = async () => {
      try {
        const data = await setupMFA();
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
        setStep('scan');
      } catch (err) {
        setInitError(apiErrorMessage(err) || 'Failed to initiate MFA setup');
        setStep('error');
      }
    };

    initSetup();
  }, [authenticated]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError('');

    if (token.length !== 6) {
      setTokenError(t('auth:mfa.verifyTokenErrorInvalid'));
      return;
    }

    try {
      setVerifying(true);
      const result = await completeMFASetup(token);
      setBackupCodes(result.backupCodes);
      setStep('backup-codes');
    } catch (err) {
      setTokenError(apiErrorMessage(err) || t('auth:mfa.verifyTokenErrorInvalidCode'));
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const handleDone = () => {
    navigate('/profile');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-soft-cream via-parchment to-warm-amber/20 px-4 py-8">
      <div className="glass-panel max-w-lg w-full p-8 space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-moss-green/10 rounded-full p-3">
              <Shield className="w-8 h-8 text-brand-ink" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-brand-ink font-heading">
            {t('auth:mfa.setupTitle')}
          </h1>
          <p className="mt-1 text-sm text-warm-gray">
            {step === 'backup-codes'
              ? t('auth:mfa.enabled')
              : t('auth:mfa.scanQR')}
          </p>
        </div>

        {step === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-danger-ink flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-ink">{initError}</p>
            </div>
            <Button onClick={() => navigate('/profile')} variant="secondary" className="w-full">
              {t('common:back')}
            </Button>
          </div>
        )}

        {step === 'scan' && (
          <div className="space-y-6">
            <ol className="text-sm text-warm-gray space-y-2 list-decimal list-inside">
              <li>{t('auth:mfa.scanQR')}</li>
              <li>{t('auth:mfa.secretKey')}</li>
              <li>{t('auth:mfa.verifyToken')}</li>
            </ol>

            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-xl border border-moss-green/20 inline-block">
                <img src={qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-gray mb-1.5">{t('auth:mfa.secretKey')}</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-parchment/60 border border-moss-green/15">
                <code className="flex-1 text-sm font-mono text-brand-ink break-all">{secret}</code>
                <button
                  onClick={copySecret}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-moss-green/10 transition-colors"
                  title={t('auth:mfa.secretKey')}
                >
                  {secretCopied ? (
                    <CheckCircle className="w-4 h-4 text-brand-ink" />
                  ) : (
                    <Copy className="w-4 h-4 text-stone-gray" />
                  )}
                </button>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-gray mb-1.5">
                  {t('auth:mfa.verifyToken')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value.replace(/[^0-9]/g, ''));
                    setTokenError('');
                  }}
                  placeholder={t('auth:mfa.verifyTokenPlaceholder')}
                  className={`input-cozy w-full text-center text-2xl tracking-widest font-mono ${tokenError ? 'border-danger/60 focus:ring-danger' : ''}`}
                  autoFocus
                  autoComplete="one-time-code"
                />
                {tokenError && (
                  <p className="mt-1 text-xs text-danger-ink">{tokenError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => navigate('/profile')}
                  disabled={verifying}
                  variant="secondary" className="flex-1"
                >
                  {t('common:cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={verifying || token.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('auth:mfa.verifyTokenLoading')}
                    </>
                  ) : (
                    <>
                      {t('auth:mfa.verifySubmit')}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === 'backup-codes' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
              <CheckCircle className="w-5 h-5 text-success-ink flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-success-ink">{t('auth:mfa.enabled')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-warm-amber/10 border border-warm-amber/30">
              <AlertTriangle className="w-5 h-5 text-warm-amber flex-shrink-0 mt-0.5" />
              <p className="text-sm text-stone-gray">
                <span className="font-semibold">{t('auth:mfa.backupCodesWarning')}</span>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-stone-gray uppercase tracking-wide">
                  {t('auth:mfa.backupCodes')}
                </p>
                <button
                  onClick={copyBackupCodes}
                  className="flex items-center gap-1 text-xs text-brand-ink hover:text-brand-ink/80 transition-colors"
                >
                  {codesCopied ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy all
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 rounded-lg bg-parchment/60 border border-moss-green/15">
                {backupCodes.map((code, i) => (
                  <code
                    key={i}
                    className="text-sm font-mono text-brand-ink text-center py-1.5 px-2 rounded bg-paper/60 border border-moss-green/10"
                  >
                    {code.slice(0, 4)}-{code.slice(4)}
                  </code>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={codesAcknowledged}
                onChange={(e) => setCodesAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-moss-green/30 text-brand-ink focus:ring-moss-green/50"
              />
              <span className="text-sm text-stone-gray">
                I have saved my backup codes in a secure location.
              </span>
            </label>

            <Button
              onClick={handleDone}
              disabled={!codesAcknowledged}
              className="w-full"
            >
              Done — Return to Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}