// ============================================
// Register Page
// Handles new user registration
// Includes password strength validation and confirmation
// ============================================

import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  isValidEmail,
  isStrongPassword,
  getPasswordStrength,
} from '@/utils/validation';
import Button from '@/components/ui/Button';
import { apiErrorMessage, apiErrorStatus, apiErrorText } from '@/utils/errors';

export default function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { register, authenticated } = useAuth();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Password strength
  const passwordStrength = password ? getPasswordStrength(password) : null;

  // Redirect if already authenticated
  if (authenticated) {
    navigate('/dashboard');
    return null;
  }

  /**
   * Validate form fields
   * Returns true if valid, false otherwise
   */
  const validateForm = (): boolean => {
    const errors: {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    // Validate display name
    if (!displayName) {
      errors.displayName = t('common:displayNameRequired');
    } else if (displayName.length < 2) {
      errors.displayName = t('common:displayNameMinLength');
    } else if (displayName.length > 50) {
      errors.displayName = t('common:displayNameMaxLength');
    }

    // Validate email
    if (!email) {
      errors.email = t('common:emailRequired');
    } else if (!isValidEmail(email)) {
      errors.email = t('common:validEmailRequired');
    }

    // Validate password
    if (!password) {
      errors.password = t('common:passwordRequired');
    } else if (!isStrongPassword(password)) {
      errors.password = t('common:passwordMinLength');
    }

    // Validate confirm password
    if (!confirmPassword) {
      errors.confirmPassword = t('common:confirmPasswordRequired');
    } else if (password !== confirmPassword) {
      errors.confirmPassword = t('common:passwordsDoNotMatch');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const result = await register(email, password, displayName);

      if (result.pendingApproval) {
        // Account submitted — waiting for admin approval
        setPendingApproval(true);
        return;
      }
      // On success, user is logged in and will be redirected by auth check above
    } catch (err) {
      // Handle specific error messages
      const serverError = apiErrorText(err);
      if (apiErrorStatus(err) === 403) {
        setError(apiErrorMessage(err) || t('auth:register.errorDisabled'));
      } else if (serverError) {
        setError(serverError);
      } else if (apiErrorStatus(err) === 409) {
        setError(t('auth:register.errorAccountExists'));
      } else if (apiErrorStatus(err) === 429) {
        setError(t('auth:register.errorTooManyAttempts'));
      } else {
        setError(t('auth:register.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-soft-cream via-parchment to-warm-amber/20 px-4">
        <div className="glass-panel max-w-md w-full p-8 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">&#9203;</span>
          </div>
          <h1 className="text-2xl font-bold text-brand-ink font-heading">{t('auth:register.pendingApprovalTitle')}</h1>
          <p className="text-warm-gray text-sm" dangerouslySetInnerHTML={{ __html: t('auth:register.pendingApprovalMessage') }} />
          <Link to="/auth/login" className="btn-primary inline-block mt-4">
            {t('auth:register.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-soft-cream via-parchment to-warm-amber/20 px-4">
      <div className="glass-panel max-w-md w-full p-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-ink font-heading">
            {t('auth:register.title')}
          </h1>
          <p className="mt-2 text-sm text-warm-gray">
            {t('auth:register.subtitle')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="bg-spirit-red/10 border border-spirit-red/30 rounded-lg p-4">
            <p className="text-sm text-spirit-red font-medium">{error}</p>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name Input */}
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-brand-ink mb-1"
            >
              {t('auth:register.displayNameLabel')}
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              className={`input-cozy w-full ${
                fieldErrors.displayName
                  ? 'border-spirit-red focus:ring-spirit-red'
                  : ''
              }`}
              placeholder="Your name"
              disabled={loading}
              maxLength={50}
              aria-required="true"
              aria-invalid={!!fieldErrors.displayName}
              aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
            />
            {fieldErrors.displayName && (
              <p id="displayName-error" role="alert" className="mt-1 text-xs text-spirit-red">
                {fieldErrors.displayName}
              </p>
            )}
          </div>

          {/* Email Input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-brand-ink mb-1"
            >
              {t('auth:register.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={`input-cozy w-full ${
                fieldErrors.email ? 'border-spirit-red focus:ring-spirit-red' : ''
              }`}
              placeholder="your@email.com"
              disabled={loading}
              aria-required="true"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="reg-email-error" role="alert" className="mt-1 text-xs text-spirit-red">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-brand-ink mb-1"
            >
              {t('auth:register.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              className={`input-cozy w-full ${
                fieldErrors.password
                  ? 'border-spirit-red focus:ring-spirit-red'
                  : ''
              }`}
              placeholder="At least 12 characters"
              disabled={loading}
              aria-required="true"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={[
                fieldErrors.password ? 'reg-password-error' : '',
                password ? 'password-strength' : '',
              ].filter(Boolean).join(' ') || undefined}
            />
            {fieldErrors.password && (
              <p id="reg-password-error" role="alert" className="mt-1 text-xs text-spirit-red">
                {fieldErrors.password}
              </p>
            )}

            {/* Password Strength Indicator */}
            {password && passwordStrength && (
              <div id="password-strength" className="mt-2" aria-live="polite">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-warm-gray">
                    {t('common:passwordStrength')}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      passwordStrength.color === 'green'
                        ? 'text-success-ink'
                        : passwordStrength.color === 'yellow'
                        ? 'text-warning-ink'
                        : 'text-danger-ink'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-warm-gray/20 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      passwordStrength.color === 'green'
                        ? 'bg-success'
                        : passwordStrength.color === 'yellow'
                        ? 'bg-warning'
                        : 'bg-danger'
                    }`}
                    style={{ width: `${(passwordStrength.score / 10) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-brand-ink mb-1"
            >
              {t('auth:register.confirmPasswordLabel')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((prev) => ({
                  ...prev,
                  confirmPassword: undefined,
                }));
              }}
              className={`input-cozy w-full ${
                fieldErrors.confirmPassword
                  ? 'border-spirit-red focus:ring-spirit-red'
                  : ''
              }`}
              placeholder="Re-enter your password"
              disabled={loading}
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-spirit-red">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {t('auth:register.loading')}
              </span>
            ) : (
              t('auth:register.submit')
            )}
          </Button>
        </form>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm text-warm-gray">
            {t('auth:register.alreadyHaveAccount')}{' '}
              <Link
                to="/auth/login"
                className="text-brand-ink hover:text-brand-ink/80 font-medium transition-colors"
              >
                {t('auth:register.signIn')}
              </Link>
          </p>
        </div>
      </div>
    </div>
  );
}