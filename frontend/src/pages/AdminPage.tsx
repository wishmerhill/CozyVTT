// ============================================
// AdminPage
//
// Platform administration — Admin role only.
// Protected by ProtectedRoute requireRole={PlatformRole.ADMIN} in App.tsx.
//
// Tabs: Dashboard | Users | Settings | Activity
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/i18n';
import { useDebounce } from '@/hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Settings,
  Activity,
  BarChart3,
  ChevronLeft,
  Copy,
  Check,
  Loader2,
  Trash2,
  RefreshCw,
  Search,
  Shield,
  Database,
  FolderOpen,
  CalendarDays,
  UserPlus,
  Wifi,
  Clock,
  X,
  BookUser,
  Download,
  HardDrive,
  Mail,
  AlertCircle,
  Layers,
  Globe,
  FileText,
  User as UserIcon,
  MapPin,
  FileAudio,
  Image as ImageIcon,
  ArrowRightLeft,
  ChevronRight,
  Upload,
  RotateCcw,
  Palette,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { adminService } from '@/services/admin.service';
import type {
  User,
  SystemStats,
  AdminSystemSettings,
  AdminActivityData,
  AdminOnlineUser,
  AdminSystemLog,
  AdminServerConfig,
  AdminBackup,
  Asset,
  Campaign,
} from '@/types';
import { PlatformRole, AssetType, AssetScope } from '@/types';
import { api } from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';
import {
  PRESET_THEMES,
  FONT_OPTIONS,
  applyThemeColors,
  applyFont,
} from '@/themes';
import ThemePicker from '@/components/appearance/ThemePicker';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import LanguageSelector from '@/components/common/LanguageSelector';
import Button from '@/components/ui/Button';

// ============================================
// Helpers
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Body size a reverse proxy must accept: the largest upload limit plus a few MB
 * of multipart overhead (mirrors UPLOAD_OVERHEAD_BYTES in the backend).
 */
function requiredProxyBodyMB(uploadLimits: Record<string, number>): number {
  const largest = Math.max(...Object.values(uploadLimits));
  return Math.ceil((largest + 5 * 1024 * 1024) / (1024 * 1024));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return i18n.t('admin:time.justNow');
  if (minutes < 60) return i18n.t('admin:time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t('admin:time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return i18n.t('admin:time.daysAgo', { count: days });
}

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return i18n.t('admin:time.expired');
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return i18n.t('admin:time.inMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return i18n.t('admin:time.inHoursMinutes', { hours, minutes: minutes % 60 });
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  INFO: 'bg-info/10 text-info-ink',
  WARNING: 'bg-warning/10 text-warning-ink',
  ERROR: 'bg-danger/10 text-danger-ink',
  CRITICAL: 'bg-danger/20 text-danger-ink font-bold',
};

type Tab = 'dashboard' | 'users' | 'settings' | 'appearance' | 'activity' | 'backups' | 'assets';

// ============================================
// AdminPage
// ============================================

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation(['admin', 'common']);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // ---- Dashboard ----
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  // ---- Users ----
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebounce(userSearch, 250);

  // Delete flow
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password flow
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [resetLinkError, setResetLinkError] = useState('');
  const [copied, setCopied] = useState(false);

  // Role change
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null);

  // Create user modal
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: '', displayName: '', platformRole: 'USER' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPasswordCopied, setNewUserPasswordCopied] = useState(false);
  // 'create' generates a temporary password; 'invite' emails a set-password link
  const [createUserMode, setCreateUserMode] = useState<'create' | 'invite'>('create');
  // Success message shown after an invite or an emailed create
  const [createUserSuccess, setCreateUserSuccess] = useState('');
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [resendInviteResult, setResendInviteResult] = useState<{ id: string; message: string } | null>(null);

  // MFA reset per-row (inline confirm)
  const [resetMfaConfirmId, setResetMfaConfirmId] = useState<string | null>(null);
  const [isResettingMfa, setIsResettingMfa] = useState(false);
  const [resetMfaError, setResetMfaError] = useState('');

  // User approval
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  // ---- Settings ----
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    instanceName: '',
    timezone: 'UTC',
    allowRegistration: false,
    requireAdminApproval: true,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // ---- Appearance ----
  const { refreshAppearance } = useTheme();
  const [appearanceForm, setAppearanceForm] = useState({
    themeId: 'cozy-default',
    fontId: 'default',
    customColors: {
      primary: '#4A5D4E',
      accent: '#D4A574',
      background: '#FFF9E6',
      text: '#1F2937',
    },
  });
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceError, setAppearanceError] = useState('');

  // ---- Server Config (read-only) ----
  const [serverConfig, setServerConfig] = useState<AdminServerConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ---- Backups ----
  const [backups, setBackups] = useState<AdminBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupCreateError, setBackupCreateError] = useState('');
  const [deletingBackupFile, setDeletingBackupFile] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // ---- Activity ----
  const [activity, setActivity] = useState<AdminActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  // ---- Admin Assets ----
  const [adminAssets, setAdminAssets] = useState<Asset[]>([]);
  const [adminAssetsLoading, setAdminAssetsLoading] = useState(false);
  const [adminAssetsError, setAdminAssetsError] = useState('');
  const [adminAssetsTotal, setAdminAssetsTotal] = useState(0);
  const [adminAssetsTotalPages, setAdminAssetsTotalPages] = useState(0);
  const [adminAssetsPage, setAdminAssetsPage] = useState(1);
  const [adminAssetsScope, setAdminAssetsScope] = useState('');
  const [adminAssetsType, setAdminAssetsType] = useState('');
  const [adminAssetsSearch, setAdminAssetsSearch] = useState('');
  const debouncedAdminAssetsSearch = useDebounce(adminAssetsSearch, 300);
  const [adminCampaigns, setAdminCampaigns] = useState<Campaign[]>([]);
  // Per-row scope change: if set, this asset's row shows the campaign picker
  const [assetScopePicker, setAssetScopePicker] = useState<{ assetId: string; campaignId: string } | null>(null);
  const [assetScopeChanging, setAssetScopeChanging] = useState<string | null>(null);
  const [assetDeleting, setAssetDeleting] = useState<string | null>(null);

  // ---- Global Asset Manager toggle ----
  const [togglingGlobalAssets, setTogglingGlobalAssets] = useState<string | null>(null);
  const [togglingTemplateEditor, setTogglingTemplateEditor] = useState<string | null>(null);

  // ---- Delete user — asset warning ----
  const [deletingUserAssetCount, setDeletingUserAssetCount] = useState<number>(0);
  const [loadingDeleteWarning, setLoadingDeleteWarning] = useState<string | null>(null);

  // ============================================
  // Data loaders
  // ============================================

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      setStats(await adminService.getStats());
    } catch (err: unknown) {
      setStatsError(err instanceof Error ? err.message : t('common:error'));
    } finally {
      setStatsLoading(false);
    }
  }, [t]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      setUsers(await adminService.getUsers());
    } catch (err: unknown) {
      setUsersError(err instanceof Error ? err.message : t('common:error'));
    } finally {
      setUsersLoading(false);
    }
  }, [t]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError('');
    try {
      setSettings(await adminService.getSettings());
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : t('common:error'));
    } finally {
      setSettingsLoading(false);
    }
  }, [t]);

  const loadServerConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      setServerConfig(await adminService.getConfig());
    } catch {
      // non-fatal — config panel just won't show
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    setBackupsError('');
    try {
      setBackups(await adminService.listBackups());
    } catch (err: unknown) {
      setBackupsError(err instanceof Error ? err.message : t('common:error'));
    } finally {
      setBackupsLoading(false);
    }
  }, [t]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError('');
    try {
      setActivity(await adminService.getActivity());
    } catch (err: unknown) {
      setActivityError(err instanceof Error ? err.message : t('common:error'));
    } finally {
      setActivityLoading(false);
    }
  }, [t]);

  const loadAdminAssets = useCallback(async (
    page: number,
    scope: string,
    type: string,
    search: string,
  ) => {
    setAdminAssetsLoading(true);
    setAdminAssetsError('');
    try {
      const resp = await api.listAssets({
        page,
        limit: 25,
        scope: scope || undefined,
        type: type || undefined,
        search: search || undefined,
      });
      setAdminAssets(resp.assets);
      setAdminAssetsTotal(resp.pagination.total);
      setAdminAssetsTotalPages(resp.pagination.totalPages);
    } catch (err: unknown) {
      setAdminAssetsError(err instanceof Error ? err.message : t('common:error'));
    } finally {
      setAdminAssetsLoading(false);
    }
  }, [t]);

  const loadAdminCampaigns = useCallback(async () => {
    try {
      const { campaigns } = await api.adminListAllCampaigns();
      setAdminCampaigns(campaigns);
    } catch {
      // non-fatal
    }
  }, []);

  // Populate forms when settings load
  useEffect(() => {
    if (settings) {
      setSettingsForm({
        instanceName: settings.instanceName,
        timezone: settings.timezone,
        allowRegistration: settings.allowRegistration,
        requireAdminApproval: settings.requireAdminApproval,
      });
      setAppearanceForm({
        themeId: settings.themeId || 'cozy-default',
        fontId: settings.fontId || 'default',
        customColors: settings.customThemeColors as any || {
          primary: '#4A5D4E',
          accent: '#D4A574',
          background: '#FFF9E6',
          text: '#1F2937',
        },
      });
    }
  }, [settings]);

  // Lazy-load per tab
  useEffect(() => {
    if (activeTab === 'dashboard' && !stats && !statsLoading) loadStats();
    if (activeTab === 'users' && users.length === 0 && !usersLoading) loadUsers();
    // The Users tab needs smtp.configured to decide whether inviting is possible
    if (activeTab === 'users' && !serverConfig && !configLoading) loadServerConfig();
    if (activeTab === 'settings' || activeTab === 'appearance') {
      if (!settings && !settingsLoading) loadSettings();
      if (activeTab === 'settings' && !serverConfig && !configLoading) loadServerConfig();
    }
    if (activeTab === 'activity' && !activity && !activityLoading) loadActivity();
    if (activeTab === 'backups' && backups.length === 0 && !backupsLoading) loadBackups();
    if (activeTab === 'assets') {
      loadAdminAssets(1, '', '', '');
      if (adminCampaigns.length === 0) loadAdminCampaigns();
    }
  }, [activeTab]);  

  // Reload assets when filters/page change
  useEffect(() => {
    if (activeTab !== 'assets') return;
    loadAdminAssets(adminAssetsPage, adminAssetsScope, adminAssetsType, debouncedAdminAssetsSearch);
  }, [adminAssetsPage, adminAssetsScope, adminAssetsType, debouncedAdminAssetsSearch]);  

  // Reset page when filters change
  useEffect(() => {
    setAdminAssetsPage(1);
  }, [adminAssetsScope, adminAssetsType, debouncedAdminAssetsSearch]);

  // ============================================
  // User management actions
  // ============================================

  const handleToggleTemplateEditor = async (u: User) => {
    setTogglingTemplateEditor(u.id);
    const next = !u.templateEditor;
    // Optimistic update
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, templateEditor: next } : x));
    try {
      const updated = await adminService.updateUser(u.id, { templateEditor: next });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      showToast(`${t('admin:users.templateEditor')} ${next ? t('common:enabled') : t('common:disabled')} — ${u.displayName}`, 'success');
    } catch (err: unknown) {
      // Revert on error
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, templateEditor: !next } : x));
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? t('admin:users.permissionUpdateFailed'), 'error');
    } finally {
      setTogglingTemplateEditor(null);
    }
  };

  const handleToggleGlobalAssets = async (u: User) => {
    setTogglingGlobalAssets(u.id);
    const next = !u.globalAssetManager;
    // Optimistic update
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, globalAssetManager: next } : x));
    try {
      const updated = await adminService.updateUser(u.id, { globalAssetManager: next });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      showToast(`${t('admin:users.globalAssets')} ${next ? t('common:enabled') : t('common:disabled')} — ${u.displayName}`, 'success');
    } catch (err: unknown) {
      // Revert on error
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, globalAssetManager: !next } : x));
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? t('admin:users.permissionUpdateFailed'), 'error');
    } finally {
      setTogglingGlobalAssets(null);
    }
  };

  const handleRoleChange = async (u: User) => {
    setRoleChangingId(u.id);
    try {
      const newRole = u.platformRole === PlatformRole.ADMIN
        ? PlatformRole.USER
        : PlatformRole.ADMIN;
      const updated = await adminService.updateUser(u.id, { platformRole: newRole });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      showToast(`${t('admin:users.roleChanged')} ${newRole}`, 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? t('common:error'), 'error');
    } finally {
      setRoleChangingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    setResetError('');
    try {
      const pwd = await adminService.resetUserPassword(resetTarget.id);
      setTempPassword(pwd);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResetError(e.response?.data?.message ?? t('common:error'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendPasswordResetLink = async () => {
    if (!resetTarget) return;
    setIsSendingResetLink(true);
    setResetLinkError('');
    try {
      await adminService.sendPasswordResetLink(resetTarget.id);
      setResetLinkSent(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResetLinkError(e.response?.data?.message ?? t('common:error'));
    } finally {
      setIsSendingResetLink(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const deletedName = deletingUser.displayName;
      await adminService.deleteUser(deletingUser.id);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      setDeletingUser(null);
      setDeleteEmail('');
      showToast(`${t('common:delete')} "${deletedName}"`, 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setDeleteError(e.response?.data?.message ?? t('common:error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyToClipboard = async (text: string, setCopiedFn: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFn(true);
      setTimeout(() => setCopiedFn(false), 2000);
    } catch {
      // clipboard unavailable — user can select manually
    }
  };

  const closeResetModal = () => {
    setResetTarget(null);
    setTempPassword('');
    setResetError('');
    setCopied(false);
    setResetLinkSent(false);
    setResetLinkError('');
  };

  const closeDeleteModal = () => {
    setDeletingUser(null);
    setDeleteEmail('');
    setDeleteError('');
    setDeletingUserAssetCount(0);
  };

  const openDeleteModal = async (u: User) => {
    closeResetModal();
    setResetMfaConfirmId(null);
    setDeleteEmail('');
    setDeleteError('');
    setDeletingUserAssetCount(0);
    setLoadingDeleteWarning(u.id);
    try {
      const resp = await api.listAssets({ uploadedBy: u.id, scope: 'USER', limit: 1 });
      setDeletingUserAssetCount(resp.pagination.total);
    } catch {
      // non-fatal — just proceed without warning
    } finally {
      setLoadingDeleteWarning(null);
    }
    setDeletingUser(u);
  };

  const handleCreateUser = async () => {
    setCreatingUser(true);
    setCreateUserError('');
    try {
      const payload = {
        email: createUserForm.email.trim(),
        displayName: createUserForm.displayName.trim() || undefined,
        platformRole: createUserForm.platformRole,
      };

      if (createUserMode === 'invite') {
        const { user: newUser, expiresInDays } = await adminService.inviteUser(payload);
        setCreateUserSuccess(
          t('admin:createUser.successInvite', { email: newUser.email, days: expiresInDays })
        );
        setUsers(prev => [newUser, ...prev]);
      } else {
        const { user: newUser, emailSent, temporaryPassword } = await adminService.createUser(payload);
        if (emailSent) {
          // The user has their password by email; the admin doesn't need it
          setCreateUserSuccess(t('admin:createUser.successCreateEmail', { email: newUser.email }));
        } else {
          setNewUserPassword(temporaryPassword ?? '');
        }
        setUsers(prev => [newUser, ...prev]);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCreateUserError(
        e.response?.data?.message ??
          (createUserMode === 'invite' ? t('admin:createUser.errorInvite') : t('admin:createUser.error'))
      );
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    setResendingInviteId(userId);
    setResendInviteResult(null);
    try {
      const { message } = await adminService.resendInvite(userId);
      setResendInviteResult({ id: userId, message });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResendInviteResult({
        id: userId,
        message: e.response?.data?.message ?? t('common:error'),
      });
    } finally {
      setResendingInviteId(null);
    }
  };

  const closeCreateUserModal = () => {
    setCreateUserOpen(false);
    setCreateUserForm({ email: '', displayName: '', platformRole: 'USER' });
    setCreateUserError('');
    setNewUserPassword('');
    setNewUserPasswordCopied(false);
    setCreateUserSuccess('');
  };

  const handleResetMfa = async (userId: string) => {
    setIsResettingMfa(true);
    setResetMfaError('');
    try {
      await adminService.resetMfa(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, mfaEnabled: false } : u));
      setResetMfaConfirmId(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResetMfaError(e.response?.data?.message ?? t('common:error'));
    } finally {
      setIsResettingMfa(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setApprovingUserId(userId);
    try {
      await adminService.approveUser(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isApproved: true } : u));
      showToast(t('admin:users.approve') + '!', 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? t('common:error'), 'error');
    } finally {
      setApprovingUserId(null);
    }
  };

  // ============================================
  // Admin asset management
  // ============================================

  const handleAdminAssetScopeChange = async (asset: Asset, newScope: string, campaignId?: string) => {
    if (newScope === AssetScope.CAMPAIGN && !campaignId) return;
    setAssetScopeChanging(asset.id);
    try {
      const result = await api.patchAssetScope(asset.id, newScope, campaignId);
      setAdminAssets(prev => prev.map(a => a.id === asset.id ? result.asset : a));
      setAssetScopePicker(null);
      showToast(t('admin:assets.scopeUpdated'), 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      showToast(e.response?.data?.error ?? t('admin:assets.scopeUpdateFailed'), 'error');
    } finally {
      setAssetScopeChanging(null);
    }
  };

  const handleAdminDeleteAsset = async (assetId: string) => {
    setAssetDeleting(assetId);
    try {
      await api.deleteAsset(assetId);
      setAdminAssets(prev => prev.filter(a => a.id !== assetId));
      setAdminAssetsTotal(prev => prev - 1);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? t('common:error'), 'error');
    } finally {
      setAssetDeleting(null);
    }
  };

  // ============================================
  // SMTP test
  // ============================================

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const message = await adminService.testSmtp();
      setSmtpTestResult({ ok: true, message });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSmtpTestResult({ ok: false, message: e.response?.data?.message ?? t('common:error') });
    } finally {
      setSmtpTesting(false);
    }
  };

  // ============================================
  // Backup actions
  // ============================================

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupCreateError('');
    try {
      const backup = await adminService.createBackup();
      setBackups(prev => [backup, ...prev]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setBackupCreateError(e.response?.data?.message ?? t('common:error'));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    setDeletingBackupFile(filename);
    try {
      await adminService.deleteBackup(filename);
      setBackups(prev => prev.filter(b => b.filename !== filename));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e.response?.data?.message ?? t('common:error'), 'error');
    } finally {
      setDeletingBackupFile(null);
    }
  };

  const handleRestoreBackup = () => {
    if (!restoreFile) return;
    setShowRestoreConfirm(true);
  };

  const handleRestoreBackupConfirmed = async () => {
    setShowRestoreConfirm(false);
    if (!restoreFile) return;
    setRestoring(true);
    setRestoreError('');
    try {
      await adminService.restoreBackup(restoreFile);
      setRestoreSuccess(true);
      setRestoreFile(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setRestoreError(e.response?.data?.message ?? t('common:error'));
    } finally {
      setRestoring(false);
    }
  };

  // ============================================
  // Settings actions
  // ============================================

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsError('');
    try {
      const updated = await adminService.updateSettings(settingsForm);
      setSettings(updated);
      showToast(t('admin:settings.success'), 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSettingsError(e.response?.data?.message ?? t('admin:settings.error'));
    } finally {
      setSettingsSaving(false);
    }
  };

  // ============================================
  // Filtered users (client-side search)
  // ============================================

  const filteredUsers = useMemo(() => {
    const q = debouncedUserSearch.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q)
    );
  }, [users, debouncedUserSearch]);

  // ============================================
  // Tab bar config
  // ============================================

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t('admin:tabs.dashboard'), icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'users',     label: t('admin:tabs.users'),     icon: <Users className="w-4 h-4" /> },
    { id: 'assets',    label: t('admin:tabs.assets'),    icon: <Layers className="w-4 h-4" /> },
    { id: 'settings',  label: t('admin:tabs.settings'),  icon: <Settings className="w-4 h-4" /> },
    { id: 'appearance', label: t('admin:tabs.appearance'), icon: <Palette className="w-4 h-4" /> },
    { id: 'backups',   label: t('admin:tabs.backups'),   icon: <HardDrive className="w-4 h-4" /> },
    { id: 'activity',  label: t('admin:tabs.activity'),  icon: <Activity className="w-4 h-4" /> },
  ];

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-cream via-parchment to-warm-amber/20">

      {/* ---- Header ---- */}
      <header className="bg-moss-green/10 border-b border-moss-green/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                aria-label={t('admin:panel.backToDashboard')}
                className="flex items-center gap-1 text-sm text-warm-gray hover:text-brand-ink transition-colors"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                {t('admin:panel.backToDashboard')}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-brand-ink font-heading flex items-center gap-2">
                  <Shield className="w-6 h-6" aria-hidden="true" />
                  {t('admin:panel.title')}
                </h1>
                <p className="text-xs text-warm-gray mt-0.5">{t('admin:panel.subtitle')}</p>
              </div>
            </div>
            <span className="text-sm text-warm-gray">
              {t('admin:panel.signedInAs')}{' '}
              <span className="font-medium text-brand-ink">{user?.displayName}</span>
            </span>
          </div>

          {/* Tab Navigation */}
          <nav aria-label={t('admin:panel.title')}>
            <div role="tablist" aria-label={t('admin:tabs.dashboard')} className="flex gap-1 mt-4">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-paper text-brand-ink border border-b-paper border-moss-green/20 -mb-px'
                      : 'text-warm-gray hover:text-brand-ink hover:bg-paper/50'
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* ---- Main ---- */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">

        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="tabpanel-dashboard" aria-labelledby="tab-dashboard">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-brand-ink">{t('admin:dashboard.title')}</h2>
              <Button
                onClick={loadStats}
                disabled={statsLoading}
                variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-3"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                {t('admin:dashboard.refresh')}
              </Button>
            </div>

            {statsError && (
              <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-4 mb-6 text-sm">
                {statsError}
              </div>
            )}

            {statsLoading && !stats ? (
              <div className="glass-panel overflow-hidden">
                {/* Stat card skeletons */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 animate-pulse">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center p-4 space-y-2">
                      <div className="w-7 h-7 bg-moss-green/10 rounded-full" />
                      <div className="h-8 w-10 bg-moss-green/15 rounded" />
                      <div className="h-3 w-14 bg-stone-gray/10 rounded" />
                    </div>
                  ))}
                </div>
                <TableSkeleton rows={6} columns={3} />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <Users className="w-7 h-7 text-brand-ink mb-2" />
                    <p className="text-3xl font-bold text-brand-ink">{stats?.userCount ?? '\u2014'}</p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.users')}</p>
                  </div>

                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <FolderOpen className="w-7 h-7 text-warm-amber mb-2" />
                    <p className="text-3xl font-bold text-brand-ink">{stats?.campaignCount ?? '\u2014'}</p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.campaigns')}</p>
                    {stats && (
                      <p className="text-xs text-success-ink mt-0.5">{stats.activeCampaignCount} {t('admin:dashboard.active')}</p>
                    )}
                  </div>

                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <CalendarDays className="w-7 h-7 text-info-ink mb-2" />
                    <p className="text-3xl font-bold text-brand-ink">{stats?.sessionCount ?? '\u2014'}</p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.sessions')}</p>
                    {stats && (
                      <p className="text-xs text-success-ink mt-0.5">{stats.activeSessionCount} {t('admin:dashboard.live')}</p>
                    )}
                  </div>

                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <BookUser className="w-7 h-7 text-info-ink mb-2" />
                    <p className="text-3xl font-bold text-brand-ink">{stats?.characterCount ?? '\u2014'}</p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.characters')}</p>
                  </div>

                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <Database className="w-7 h-7 text-teal-500 mb-2" />
                    <p className="text-3xl font-bold text-brand-ink">{stats?.mapCount ?? '\u2014'}</p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.maps')}</p>
                  </div>

                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <Database className="w-7 h-7 text-spirit-ink mb-2" />
                    <p className="text-2xl font-bold text-brand-ink break-all">
                      {stats ? formatBytes(stats.totalStorageBytes) : '\u2014'}
                    </p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.storage')}</p>
                  </div>

                  <div className="glass-panel p-5 flex flex-col items-center text-center">
                    <Shield className="w-7 h-7 text-success-ink mb-2" />
                    <p className="text-sm font-bold text-success-ink">{t('admin:dashboard.healthy')}</p>
                    <p className="text-xs text-warm-gray mt-1">{t('admin:dashboard.status')}</p>
                    <div className="mt-2 space-y-1 text-left w-full">
                      {[
                        { key: 'apiLabel', ok: true },
                        { key: 'dbLabel', ok: true },
                        { key: 'wsLabel', ok: true },
                      ].map(({ key, ok }) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-stone-gray">{t(`admin:dashboard.${key}`)}</span>
                          <span className={ok ? 'text-success-ink' : 'text-danger-ink'}>&#9679;</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Asset Breakdown Table */}
                {stats && stats.assetBreakdown.length > 0 && (
                  <section className="glass-panel overflow-hidden">
                    <div className="px-4 py-3 border-b border-warm-gray/20 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-warm-amber" />
                      <h3 className="font-semibold text-brand-ink text-sm">{t('admin:dashboard.totalAssets')}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-gray/10 bg-moss-green/5">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.type')}</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.count')}</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.size')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.assetBreakdown.map(row => (
                            <tr key={row.type} className="border-b border-warm-gray/10 hover:bg-moss-green/5">
                              <td className="px-4 py-2 font-medium text-stone-gray">{row.type}</td>
                              <td className="px-4 py-2 text-right text-warm-gray">{row.count}</td>
                              <td className="px-4 py-2 text-right text-warm-gray">{formatBytes(row.sizeBytes)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-moss-green/5 font-medium">
                            <td className="px-4 py-2 text-stone-gray">{t('admin:dashboard.total')}</td>
                            <td className="px-4 py-2 text-right text-stone-gray">
                              {stats.assetBreakdown.reduce((s, r) => s + r.count, 0)}
                            </td>
                            <td className="px-4 py-2 text-right text-stone-gray">
                              {formatBytes(stats.totalStorageBytes)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-brand-ink">{t('admin:users.title')}</h2>
              <div className="flex items-center gap-2">
                {/* Only offered when email can actually be delivered — the
                    invitation link is the sole way into an invited account */}
                {serverConfig?.smtp.configured && (
                  <Button
                    onClick={() => { setCreateUserMode('invite'); setCreateUserOpen(true); }}
                    className="flex items-center gap-2 text-sm py-1.5 px-3"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {t('admin:users.inviteUser')}
                  </Button>
                )}
                <Button
                  onClick={() => { setCreateUserMode('create'); setCreateUserOpen(true); }}
                  variant={serverConfig?.smtp.configured ? 'secondary' : 'primary'}
                  className="flex items-center gap-2 text-sm py-1.5 px-3"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('admin:users.createUser')}
                </Button>
                <Button
                  onClick={loadUsers}
                  disabled={usersLoading}
                  variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-3"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                  {t('common:refresh')}
                </Button>
              </div>
            </div>

            {usersError && (
              <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-4 mb-4 text-sm">
                {usersError}
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray" />
              <input
                type="text"
                placeholder={t('admin:users.searchPlaceholder')}
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="input-cozy pl-9 w-full max-w-sm"
              />
            </div>

            {usersLoading && users.length === 0 ? (
              <div className="glass-panel overflow-hidden">
                <TableSkeleton rows={8} columns={6} />
              </div>
            ) : (
              <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-warm-gray/20 bg-moss-green/5">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.displayName')}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.email')}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.role')}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">MFA</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.joined')}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.lastLogin')}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-warm-gray">
                            {userSearch ? t('admin:users.noMatch') : t('admin:users.noUsers')}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(u => {
                          const isSelf = u.id === user?.id;
                          const isRoleChanging = roleChangingId === u.id;
                          const isDeleteExpanded = deletingUser?.id === u.id;
                          const isResetExpanded = resetTarget?.id === u.id;
                          const isMfaConfirm = resetMfaConfirmId === u.id;
                          const isPending = u.isApproved === false;
                          const isApproving = approvingUserId === u.id;

                          return (
                            <React.Fragment key={u.id}>
                              <tr className="border-b border-warm-gray/10 hover:bg-moss-green/5 transition-colors">
                                {/* User */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-moss-green/20 flex items-center justify-center text-brand-ink font-medium text-xs flex-shrink-0">
                                      {u.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-stone-gray">{u.displayName}</span>
                                    {isSelf && (
                                      <span className="text-xs text-warm-gray">{t('admin:users.you')}</span>
                                    )}
                                    {isPending && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-warning/10 text-warning-ink font-medium">{t('admin:users.pending')}</span>
                                    )}
                                  </div>
                                </td>
                                {/* Email */}
                                <td className="px-4 py-3 text-warm-gray">{u.email}</td>
                                {/* Role */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => !isSelf && !isRoleChanging && handleRoleChange(u)}
                                      disabled={isSelf || isRoleChanging}
                                      title={isSelf ? t('admin:users.cannotChangeOwnRole') : t('admin:users.clickToggleRole')}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                        u.platformRole === PlatformRole.ADMIN
                                          ? 'bg-moss-green/20 text-brand-ink hover:bg-moss-green/30'
                                          : 'bg-warm-gray/20 text-warm-gray hover:bg-warm-gray/30'
                                      } ${isSelf ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                                    >
                                      {isRoleChanging && <Loader2 className="w-3 h-3 animate-spin" />}
                                      {u.platformRole}
                                    </button>
                                    {/* Global Assets toggle — only for non-admin users */}
                                    {u.platformRole !== PlatformRole.ADMIN && (
                                      <button
                                        onClick={() => !isSelf && togglingGlobalAssets !== u.id && handleToggleGlobalAssets(u)}
                                        disabled={isSelf || togglingGlobalAssets === u.id}
                                        title={t('admin:users.canUploadGlobalAssets')}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                          u.globalAssetManager
                                            ? 'bg-warm-amber/20 text-warm-amber hover:bg-warm-amber/30'
                                            : 'bg-warm-gray/10 text-warm-gray/60 hover:bg-warm-gray/20'
                                        } ${isSelf ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                                      >
                                        {togglingGlobalAssets === u.id
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <Globe className="w-3 h-3" />
                                        }
                                        {t('admin:users.globalAssets')}
                                      </button>
                                    )}
                                    {/* Template editor toggle — only for non-admin users */}
                                    {u.platformRole !== PlatformRole.ADMIN && (
                                      <button
                                        onClick={() => !isSelf && togglingTemplateEditor !== u.id && handleToggleTemplateEditor(u)}
                                        disabled={isSelf || togglingTemplateEditor === u.id}
                                        title={t('admin:users.canEditTemplates')}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                          u.templateEditor
                                            ? 'bg-spirit-purple/20 text-spirit-purple hover:bg-spirit-purple/30'
                                            : 'bg-warm-gray/10 text-warm-gray/60 hover:bg-warm-gray/20'
                                        } ${isSelf ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                                      >
                                        {togglingTemplateEditor === u.id
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <FileText className="w-3 h-3" />
                                        }
                                        {t('admin:users.templateEditor')}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                {/* MFA */}
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-medium ${u.mfaEnabled ? 'text-success-ink' : 'text-warm-gray'}`}>
                                    {u.mfaEnabled ? t('common:enabled') : t('common:off')}
                                  </span>
                                </td>
                                {/* Joined */}
                                <td className="px-4 py-3 text-warm-gray text-xs">{formatDate(u.createdAt)}</td>
                                {/* Last Login */}
                                <td className="px-4 py-3 text-warm-gray text-xs">
                                  {u.lastLoginAt ? (
                                    formatDate(u.lastLoginAt)
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-warm-amber/15 text-warm-amber px-2 py-0.5 text-[10px] font-medium">
                                      {t('admin:users.neverSignedIn')}
                                    </span>
                                  )}
                                </td>
                                {/* Actions */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Resend invite — only useful before a first sign-in */}
                                    {!u.lastLoginAt && serverConfig?.smtp.configured && (
                                      <button
                                        onClick={() => handleResendInvite(u.id)}
                                        disabled={resendingInviteId === u.id}
                                        title={t('admin:users.resendInvite')}
                                        className="text-xs py-1 px-2 flex items-center gap-1 rounded border border-moss-green/30 text-brand-ink hover:bg-moss-green/5 transition-colors disabled:opacity-50"
                                      >
                                        {resendingInviteId === u.id
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <Mail className="w-3 h-3" />}
                                        {t('admin:users.invite')}
                                      </button>
                                    )}
                                    {/* Approve — only when pending */}
                                    {isPending && (
                                      <button
                                        onClick={() => handleApproveUser(u.id)}
                                        disabled={isApproving}
                                        title={t('admin:users.approve')}
                                        className="text-xs py-1 px-2 flex items-center gap-1 rounded border border-success/30 text-success-ink hover:bg-success/10 transition-colors disabled:opacity-50"
                                      >
                                        {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        {t('admin:users.approve')}
                                      </button>
                                    )}
                                    {/* Reset MFA — only when MFA enabled */}
                                    {u.mfaEnabled && (
                                      <button
                                        onClick={() => {
                                          if (isMfaConfirm) {
                                            setResetMfaConfirmId(null);
                                            setResetMfaError('');
                                          } else {
                                            closeResetModal();
                                            closeDeleteModal();
                                            setResetMfaConfirmId(u.id);
                                            setResetMfaError('');
                                          }
                                        }}
                                        disabled={isSelf}
                                        title={isSelf ? t('admin:users.cannotResetOwnMfa') : t('admin:users.mfaReset')}
                                        className={`text-xs py-1 px-2 flex items-center gap-1 rounded border transition-colors ${
                                          isSelf
                                            ? 'opacity-40 cursor-not-allowed border-warm-gray/20 text-warm-gray'
                                            : 'border-warning/30 text-warning-ink hover:bg-warning/10'
                                        }`}
                                      >
                                        <Shield className="w-3 h-3" />
                                        MFA
                                      </button>
                                    )}
                                    {/* Reset Password */}
                                    <Button
                                      onClick={() => {
                                      if (isResetExpanded) {
                                      closeResetModal();
                                      } else {
                                      closeDeleteModal();
                                      setResetMfaConfirmId(null);
                                      setResetTarget(u);
                                      setTempPassword('');
                                      setResetError('');
                                      }
                                      }}
                                      disabled={isSelf}
                                      title={isSelf ? t('admin:users.cannotResetOwnPwd') : t('admin:users.pwdReset')}
                                      variant="secondary" className={`text-xs py-1 px-2 flex items-center gap-1 ${isSelf ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      {t('admin:users.pwdShort')}
                                    </Button>
                                    {/* Delete */}
                                    <button
                                      onClick={() => {
                                        if (isDeleteExpanded) {
                                          closeDeleteModal();
                                        } else {
                                          openDeleteModal(u);
                                        }
                                      }}
                                      disabled={isSelf || loadingDeleteWarning === u.id}
                                      title={isSelf ? t('admin:users.cannotDeleteOwn') : t('admin:users.deleteTitle')}
                                      className={`text-xs py-1 px-2 flex items-center gap-1 rounded border transition-colors ${
                                        isSelf
                                          ? 'opacity-40 cursor-not-allowed border-warm-gray/20 text-warm-gray'
                                          : 'border-danger/30 text-danger-ink hover:bg-danger/10'
                                      }`}
                                    >
                                      {loadingDeleteWarning === u.id
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <Trash2 className="w-3 h-3" />
                                      }
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* MFA Reset Inline Confirm */}
                              {isMfaConfirm && (
                                <tr className="bg-warning/10 border-b border-warm-gray/10">
                                  <td colSpan={7} className="px-6 py-4">
                                    <div className="max-w-md">
                                      <p className="text-sm font-medium text-warning-ink mb-1">
                                        {t('admin:users.mfaTitle')} <strong>{u.displayName}</strong>?
                                      </p>
                                      <p className="text-xs text-warning-ink mb-3">
                                        {t('admin:users.mfaDesc')}
                                      </p>
                                      {resetMfaError && (
                                        <p className="text-xs text-danger-ink mb-2">{resetMfaError}</p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleResetMfa(u.id)}
                                          disabled={isResettingMfa}
                                          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-warning text-white hover:bg-warning disabled:opacity-50 transition-colors"
                                        >
                                          {isResettingMfa && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                          {t('admin:users.confirmReset')}
                                        </button>
                                        <Button
                                          onClick={() => { setResetMfaConfirmId(null); setResetMfaError(''); }}
                                          variant="secondary" className="text-sm py-1.5 px-4"
                                        >
                                          {t('common:cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Resend invite result */}
                              {resendInviteResult?.id === u.id && (
                                <tr className="bg-moss-green/5 border-b border-warm-gray/10">
                                  <td colSpan={7} className="px-6 py-2">
                                    <p className="text-xs text-stone-gray">{resendInviteResult.message}</p>
                                  </td>
                                </tr>
                              )}
                              {/* Reset Password Inline Panel */}
                              {isResetExpanded && (
                                <tr className="bg-info/10 border-b border-warm-gray/10">
                                  <td colSpan={7} className="px-6 py-4">
                                    <div className="max-w-md">
                                      <p className="text-sm font-medium text-stone-gray mb-3">
                                        {t('admin:users.pwdTitle')} <strong>{u.displayName}</strong>
                                      </p>
                                      {tempPassword ? (
                                        <div>
                                          <p className="text-xs text-warm-gray mb-2">
                                            {t('admin:users.pwdTemp')}
                                          </p>
                                          <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-paper border border-warm-gray/30 rounded px-3 py-2 text-sm font-mono text-ink-secondary select-all">
                                              {tempPassword}
                                            </code>
                                            <Button
                                              onClick={() => handleCopyToClipboard(tempPassword, setCopied)}
                                              variant="secondary" className="flex items-center gap-1 text-xs py-2 px-3"
                                            >
                                              {copied ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                                              {copied ? t('admin:createUser.copied') : t('admin:createUser.copy')}
                                            </Button>
                                          </div>
                                          <button
                                            onClick={closeResetModal}
                                            className="mt-3 text-xs text-warm-gray hover:text-stone-gray"
                                          >
                                            {t('common:close')}
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {/* Option 1: Generate temporary password */}
                                          <div>
                                            <p className="text-xs text-warm-gray mb-1.5">{t('admin:users.pwdGenerate')}:</p>
                                            {resetError && (
                                              <p className="text-xs text-danger-ink mb-1.5">{resetError}</p>
                                            )}
                                            <Button
                                              onClick={handleResetPassword}
                                              disabled={isResetting || isSendingResetLink}
                                              className="flex items-center gap-2 text-sm py-1.5 px-4"
                                            >
                                              {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                              {t('admin:users.pwdGenerate')}
                                            </Button>
                                          </div>

                                          {/* Option 2: Send reset link via email */}
                                          <div>
                                            <p className="text-xs text-warm-gray mb-1.5">{t('admin:users.orSendLink')}</p>
                                            {resetLinkSent ? (
                                              <p className="text-xs text-success-ink flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" /> {t('admin:users.pwdLinkSent')} {resetTarget?.email}
                                              </p>
                                            ) : (
                                              <>
                                                {resetLinkError && (
                                                  <p className="text-xs text-danger-ink mb-1.5">{resetLinkError}</p>
                                                )}
                                                <Button
                                                  onClick={handleSendPasswordResetLink}
                                                  disabled={isSendingResetLink || isResetting}
                                                  variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-4"
                                                >
                                                  {isSendingResetLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                                  {t('admin:users.pwdSendLink')}
                                                </Button>
                                              </>
                                            )}
                                          </div>

                                          <button
                                            onClick={closeResetModal}
                                            className="text-xs text-warm-gray hover:text-stone-gray"
                                          >
                                            {t('common:cancel')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Delete Inline Panel */}
                              {isDeleteExpanded && (
                                <tr className="bg-danger/10 border-b border-warm-gray/10">
                                  <td colSpan={7} className="px-6 py-4">
                                    <div className="max-w-md">
                                      <p className="text-sm font-medium text-danger-ink mb-1">
                                        {t('admin:users.deleteTitle')} <strong>{u.displayName}</strong>?
                                      </p>
                                      <p className="text-xs text-warm-gray mb-3">
                                        {t('admin:users.deleteDesc')}
                                      </p>
                                      {deletingUserAssetCount > 0 && (
                                        <div className="flex items-start gap-2 mb-3 p-2.5 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning-ink">
                                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-warning-ink" />
                                          <span dangerouslySetInnerHTML={{
                                            __html: t('admin:users.deleteAssetWarning', { count: deletingUserAssetCount })
                                          }} />
                                        </div>
                                      )}
                                      {deleteError && (
                                        <p className="text-xs text-danger-ink mb-2">{deleteError}</p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="email"
                                          placeholder={u.email}
                                          value={deleteEmail}
                                          onChange={e => setDeleteEmail(e.target.value)}
                                          className="input-cozy text-sm flex-1"
                                        />
                                        <button
                                          onClick={handleDeleteUser}
                                          disabled={deleteEmail !== u.email || isDeleting}
                                          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-danger text-white hover:bg-danger disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                          {t('common:delete')}
                                        </button>
                                        <Button
                                          onClick={closeDeleteModal}
                                          variant="secondary" className="text-sm py-2 px-4"
                                        >
                                          {t('common:cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {users.length > 0 && (
                  <div className="px-4 py-2 border-t border-warm-gray/10 text-xs text-warm-gray">
                    {filteredUsers.length} / {users.length} {t('admin:users.title')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== ASSETS TAB ===== */}
        {activeTab === 'assets' && (
          <div role="tabpanel" id="tabpanel-assets" aria-labelledby="tab-assets">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-brand-ink">{t('admin:assets.title')}</h2>
              <Button
                onClick={() => loadAdminAssets(adminAssetsPage, adminAssetsScope, adminAssetsType, debouncedAdminAssetsSearch)}
                disabled={adminAssetsLoading}
                variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-3"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminAssetsLoading ? 'animate-spin' : ''}`} />
                {t('common:refresh')}
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray" />
                <input
                  type="text"
                  placeholder={t('admin:assets.searchPlaceholder')}
                  value={adminAssetsSearch}
                  onChange={e => setAdminAssetsSearch(e.target.value)}
                  className="input-cozy pl-9 w-full"
                />
                {adminAssetsSearch && (
                  <button
                    onClick={() => setAdminAssetsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-gray hover:text-stone-gray"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Scope filter */}
              <select
                value={adminAssetsScope}
                onChange={e => setAdminAssetsScope(e.target.value)}
                className="input-cozy text-sm"
              >
                <option value="">{t('admin:assets.filterScope')}</option>
                <option value="GLOBAL">{t('admin:assets.global')}</option>
                <option value="USER">{t('admin:assets.personal')}</option>
                <option value="CAMPAIGN">{t('admin:assets.campaign')}</option>
              </select>

              {/* Type filter */}
              <select
                value={adminAssetsType}
                onChange={e => setAdminAssetsType(e.target.value)}
                className="input-cozy text-sm"
              >
                <option value="">{t('admin:assets.filterType')}</option>
                <option value="MAP">{t('admin:assets.map')}</option>
                <option value="TOKEN">{t('admin:assets.token')}</option>
                <option value="AUDIO">{t('admin:assets.audio')}</option>
                <option value="AVATAR">{t('admin:assets.avatar')}</option>
              </select>
            </div>

            {adminAssetsError && (
              <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-4 mb-4 text-sm">
                {adminAssetsError}
              </div>
            )}

            <div className="glass-panel overflow-hidden">
              {adminAssetsLoading && adminAssets.length === 0 ? (
                <TableSkeleton rows={8} columns={7} />
              ) : adminAssets.length === 0 ? (
                <div className="text-center py-12 text-warm-gray">
                  <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('admin:assets.noAssets')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-warm-gray/20 bg-moss-green/5">
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide w-14">{t('admin:assets.preview')}</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.name')}</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.type')}</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.scope')}</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.uploader')}</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.campaign')}</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.size')}</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminAssets.map(asset => {
                        const isScopePickerOpen = assetScopePicker?.assetId === asset.id;
                        const isChangingScope = assetScopeChanging === asset.id;
                        const isDeleting = assetDeleting === asset.id;

                        // Thumb URL
                        const thumbUrl = asset.type === AssetType.AVATAR
                          ? api.getAssetUrl(asset.uploadedById, 'avatars')
                          : asset.type === AssetType.MAP
                            ? api.getAssetUrl(asset.id, 'maps')
                            : asset.type === AssetType.TOKEN
                              ? api.getAssetUrl(asset.id, 'tokens')
                              : null;

                        return (
                          <React.Fragment key={asset.id}>
                            <tr className={`border-b border-warm-gray/10 hover:bg-moss-green/5 transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
                              {/* Thumb */}
                              <td className="px-3 py-2">
                                <div className="w-10 h-10 rounded bg-moss-green/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                                  {thumbUrl ? (
                                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : asset.type === AssetType.AUDIO ? (
                                    <FileAudio className="w-5 h-5 text-spirit-purple" />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-stone-gray/40" />
                                  )}
                                </div>
                              </td>
                              {/* Name */}
                              <td className="px-3 py-2 max-w-[180px]">
                                <p className="font-medium text-stone-gray truncate" title={asset.description ?? asset.name}>
                                  {asset.name}
                                </p>
                                {asset.description && (
                                  <p className="text-xs text-warm-gray truncate">{asset.description}</p>
                                )}
                              </td>
                              {/* Type */}
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-parchment border border-moss-green/20 text-stone-gray">
                                  {asset.type === AssetType.MAP && <MapPin className="w-3 h-3 text-warm-amber" />}
                                  {asset.type === AssetType.TOKEN && <UserIcon className="w-3 h-3 text-brand-ink" />}
                                  {asset.type === AssetType.AUDIO && <FileAudio className="w-3 h-3 text-spirit-purple" />}
                                  {asset.type === AssetType.AVATAR && <UserIcon className="w-3 h-3 text-sunset-orange" />}
                                  {asset.type}
                                </span>
                              </td>
                              {/* Scope */}
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  asset.scope === AssetScope.GLOBAL
                                    ? 'bg-spirit/10 text-spirit-ink'
                                    : asset.scope === AssetScope.USER
                                      ? 'bg-moss-green/15 text-brand-ink'
                                      : 'bg-warm-amber/15 text-warm-amber'
                                }`}>
                                  {asset.scope === AssetScope.GLOBAL && <Globe className="w-3 h-3" />}
                                  {asset.scope === AssetScope.USER && <UserIcon className="w-3 h-3" />}
                                  {asset.scope === AssetScope.CAMPAIGN && <Users className="w-3 h-3" />}
                                  {asset.scope === AssetScope.GLOBAL ? t('admin:assets.global') : asset.scope === AssetScope.USER ? t('admin:assets.personal') : t('admin:assets.campaign')}
                                </span>
                              </td>
                              {/* Uploader */}
                              <td className="px-3 py-2 text-warm-gray text-xs">
                                {asset.uploadedBy?.displayName ?? '—'}
                              </td>
                              {/* Campaign */}
                              <td className="px-3 py-2 text-warm-gray text-xs">
                                {asset.campaign?.name ?? '—'}
                              </td>
                              {/* Size */}
                              <td className="px-3 py-2 text-warm-gray text-xs whitespace-nowrap">
                                {formatBytes(asset.fileSize)}
                              </td>
                              {/* Actions */}
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Scope change dropdown */}
                                  <div className="relative">
                                    <select
                                      value={asset.scope}
                                      disabled={isChangingScope || isDeleting}
                                      onChange={e => {
                                        const newScope = e.target.value;
                                        if (newScope === AssetScope.CAMPAIGN) {
                                          setAssetScopePicker({ assetId: asset.id, campaignId: '' });
                                        } else if (newScope !== asset.scope) {
                                          handleAdminAssetScopeChange(asset, newScope);
                                        }
                                      }}
                                      className="text-xs py-1 px-2 pr-6 rounded border border-moss-green/30 text-stone-gray bg-paper-white hover:border-moss-green/60 cursor-pointer disabled:opacity-50 appearance-none"
                                      title={t('admin:assets.scope')}
                                    >
                                      <option value={AssetScope.GLOBAL}>{t('admin:assets.global')}</option>
                                      <option value={AssetScope.USER}>{t('admin:assets.personal')}</option>
                                      <option value={AssetScope.CAMPAIGN}>{t('admin:assets.campaign')}…</option>
                                    </select>
                                    {isChangingScope && (
                                      <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-brand-ink pointer-events-none" />
                                    )}
                                    {!isChangingScope && (
                                      <ArrowRightLeft className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-warm-gray/60 pointer-events-none" />
                                    )}
                                  </div>
                                  {/* Delete */}
                                  <button
                                    onClick={() => handleAdminDeleteAsset(asset.id)}
                                    disabled={isDeleting || isChangingScope}
                                    className="text-xs py-1 px-2 flex items-center gap-1 rounded border border-danger/30 text-danger-ink hover:bg-danger/10 transition-colors disabled:opacity-50"
                                    title={t('admin:assets.delete')}
                                  >
                                    {isDeleting
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <Trash2 className="w-3 h-3" />
                                    }
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Campaign picker row */}
                            {isScopePickerOpen && (
                              <tr className="bg-warm-amber/5 border-b border-warm-gray/10">
                                <td colSpan={8} className="px-6 py-3">
                                  <div className="flex items-center gap-3 max-w-lg">
                                    <Users className="w-4 h-4 text-warm-amber flex-shrink-0" />
                                    <p className="text-xs text-stone-gray font-medium whitespace-nowrap">{t('admin:assets.moveToCampaign')}</p>
                                    <select
                                      value={assetScopePicker?.campaignId ?? ''}
                                      onChange={e => setAssetScopePicker(p => p ? { ...p, campaignId: e.target.value } : null)}
                                      className="input-cozy text-xs flex-1"
                                      autoFocus
                                    >
                                      <option value="">{t('admin:assets.selectCampaign')}</option>
                                      {adminCampaigns.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                    <Button
                                      onClick={() => {
                                      if (assetScopePicker?.campaignId) {
                                      handleAdminAssetScopeChange(asset, AssetScope.CAMPAIGN, assetScopePicker.campaignId);
                                      }
                                      }}
                                      disabled={!assetScopePicker?.campaignId || isChangingScope}
                                      className="text-xs py-1 px-3 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isChangingScope && <Loader2 className="w-3 h-3 animate-spin" />}
                                      {t('admin:assets.move')}
                                    </Button>
                                    <Button
                                      onClick={() => setAssetScopePicker(null)}
                                      variant="secondary" className="text-xs py-1 px-3"
                                    >
                                      {t('common:cancel')}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer: count + pagination */}
              {adminAssetsTotal > 0 && (
                <div className="px-4 py-3 border-t border-warm-gray/10 flex items-center justify-between text-xs text-warm-gray">
                  <span>
                    {t('admin:assets.totalLabel', { count: adminAssetsTotal })}
                    {(adminAssetsScope || adminAssetsType || adminAssetsSearch) ? ` ${t('admin:assets.filtered')}` : ''}
                  </span>
                  {adminAssetsTotalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAdminAssetsPage(p => Math.max(1, p - 1))}
                        disabled={adminAssetsPage <= 1 || adminAssetsLoading}
                        className="p-1 rounded hover:bg-moss-green/10 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span>{t('admin:assets.page', { current: adminAssetsPage, total: adminAssetsTotalPages })}</span>
                      <button
                        onClick={() => setAdminAssetsPage(p => Math.min(adminAssetsTotalPages, p + 1))}
                        disabled={adminAssetsPage >= adminAssetsTotalPages || adminAssetsLoading}
                        className="p-1 rounded hover:bg-moss-green/10 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== SETTINGS TAB ===== */}
        {activeTab === 'settings' && (
          <div role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings" className="max-w-2xl space-y-6">
            <h2 className="text-xl font-semibold text-brand-ink">{t('admin:settings.title')}</h2>

            {settingsLoading && !settings ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
              </div>
            ) : (
              <section className="glass-panel p-6 space-y-6">
                {/* Instance Name */}
                <div>
                  <label className="block text-sm font-medium text-stone-gray mb-1">
                    {t('admin:settings.instanceName')}
                  </label>
                  <input
                    type="text"
                    value={settingsForm.instanceName}
                    maxLength={100}
                    onChange={e => setSettingsForm(f => ({ ...f, instanceName: e.target.value }))}
                    className="input-cozy w-full"
                    placeholder="CozyVTT"
                  />
                  <p className="text-xs text-warm-gray mt-1">
                    {t('admin:settings.instanceNameHint')}
                  </p>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-stone-gray mb-1">
                    {t('admin:settings.timezone')}
                  </label>
                  <input
                    type="text"
                    value={settingsForm.timezone}
                    maxLength={50}
                    onChange={e => setSettingsForm(f => ({ ...f, timezone: e.target.value }))}
                    className="input-cozy w-full"
                    placeholder="UTC"
                  />
                  <p className="text-xs text-warm-gray mt-1">
                    {t('admin:settings.timezoneHint')}
                  </p>
                </div>

                {/* Allow Registration */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-gray">{t('admin:settings.allowRegistration')}</p>
                    <p className="text-xs text-warm-gray mt-0.5">
                      {t('admin:settings.allowRegistrationDesc')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSettingsForm(f => ({ ...f, allowRegistration: !f.allowRegistration }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settingsForm.allowRegistration ? 'bg-moss-green' : 'bg-warm-gray/40'
                    }`}
                    role="switch"
                    aria-checked={settingsForm.allowRegistration}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settingsForm.allowRegistration ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Require Admin Approval */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-gray">{t('admin:settings.requireAdminApproval')}</p>
                    <p className="text-xs text-warm-gray mt-0.5">
                      {t('admin:settings.requireApprovalDesc')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSettingsForm(f => ({ ...f, requireAdminApproval: !f.requireAdminApproval }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settingsForm.requireAdminApproval ? 'bg-moss-green' : 'bg-warm-gray/40'
                    }`}
                    role="switch"
                    aria-checked={settingsForm.requireAdminApproval}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settingsForm.requireAdminApproval ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-warm-gray/20 flex items-center gap-3">
                  {settingsError && (
                    <p className="text-sm text-danger-ink flex-1">{settingsError}</p>
                  )}
                  <Button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="flex items-center gap-2 ml-auto"
                  >
                    {settingsSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('admin:settings.save')}
                  </Button>
                </div>

              </section>
            )}

            {/* ---- SMTP Configuration (read-only) ---- */}
            <section className="glass-panel p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-warm-gray/20">
                <Mail className="w-4 h-4 text-warm-amber" />
                <h3 className="font-semibold text-brand-ink text-sm">{t('admin:settings.smtpSection')}</h3>
                <span className="ml-auto text-xs text-warm-gray">{t('admin:settings.smtpReadOnly')}</span>
              </div>

              {configLoading ? (
                <div className="flex items-center gap-2 text-sm text-warm-gray">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common:loading')}
                </div>
              ) : serverConfig ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      serverConfig.smtp.configured
                        ? 'bg-success/10 text-success-ink'
                        : 'bg-warning/10 text-warning-ink'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${serverConfig.smtp.configured ? 'bg-success' : 'bg-warning'}`} />
                      {serverConfig.smtp.configured ? t('admin:settings.smtpConfigured') : t('admin:settings.smtpNotConfigured')}
                    </span>
                    {serverConfig.smtp.configured && (
                      <span className="text-xs text-warm-gray">
                        {serverConfig.smtp.host}:{serverConfig.smtp.port}
                        {serverConfig.smtp.secure ? ' (TLS)' : ' (STARTTLS)'}
                        {serverConfig.smtp.user ? ` · ${serverConfig.smtp.user}` : ''}
                      </span>
                    )}
                  </div>

                  {serverConfig.smtp.configured && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSmtpTest}
                        disabled={smtpTesting}
                        className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg border border-moss-green/30 text-brand-ink hover:bg-moss-green/10 transition-colors disabled:opacity-50"
                      >
                        {smtpTesting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Mail className="w-3.5 h-3.5" />
                        }
                        {t('admin:settings.smtpTestBtn')}
                      </button>
                      {smtpTestResult && (
                        <span className={`text-xs ${smtpTestResult.ok ? 'text-success-ink' : 'text-danger-ink'}`}>
                          {smtpTestResult.ok ? t('admin:settings.smtpTestSuccess') : t('admin:settings.smtpTestFailure')} {smtpTestResult.message}
                        </span>
                      )}
                    </div>
                  )}

                  {!serverConfig.smtp.configured && (
                    <p className="text-xs text-warm-gray">
                      {t('admin:settings.smtpNoConfig')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-warm-gray">{t('common:error')}</p>
              )}
            </section>

            {/* ---- Upload Size Limits (read-only) ---- */}
            <section className="glass-panel p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-warm-gray/20">
                <FolderOpen className="w-4 h-4 text-warm-amber" />
                <h3 className="font-semibold text-brand-ink text-sm">{t('admin:settings.uploadLimitsSection')}</h3>
                <span className="ml-auto text-xs text-warm-gray">{t('admin:settings.uploadLimitsReadOnly')}</span>
              </div>

              {configLoading ? (
                <div className="flex items-center gap-2 text-sm text-warm-gray">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common:loading')}
                </div>
              ) : serverConfig ? (
                <div>
                  <table className="w-full text-sm">
                    <tbody>
                      {(Object.entries(serverConfig.uploadLimits) as [string, number][]).map(([type, bytes]) => (
                        <tr key={type} className="border-b border-warm-gray/10 last:border-0">
                          <td className="py-1.5 text-stone-gray font-medium w-24">{type}</td>
                          <td className="py-1.5 text-warm-gray">{formatBytes(bytes)}</td>
                          <td className="py-1.5 text-right text-xs text-warm-gray/60">
                            <code className="font-mono">MAX_{type}_SIZE_MB</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-warm-gray/70 mt-3">
                    {t('admin:settings.uploadLimitsHint', { size: requiredProxyBodyMB(serverConfig.uploadLimits) })}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-warm-gray">{t('common:error')}</p>
              )}
            </section>

            {/* ---- Session Timeouts (read-only) ---- */}
            <section className="glass-panel p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-warm-gray/20">
                <Clock className="w-4 h-4 text-warm-amber" />
                <h3 className="font-semibold text-brand-ink text-sm">{t('admin:settings.sessionTimeoutsSection')}</h3>
                <span className="ml-auto text-xs text-warm-gray">{t('admin:settings.sessionTimeoutsReadOnly')}</span>
              </div>

              {configLoading ? (
                <div className="flex items-center gap-2 text-sm text-warm-gray">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common:loading')}
                </div>
              ) : serverConfig ? (
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-warm-gray/10">
                      <td className="py-1.5 text-stone-gray font-medium">{t('admin:settings.sessionTimeoutLabel')}</td>
                      <td className="py-1.5 text-warm-gray">
                        {formatDuration(serverConfig.sessionTimeoutMs)}
                      </td>
                      <td className="py-1.5 text-right text-xs text-warm-gray/60">
                        <code className="font-mono">SESSION_MAX_AGE</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-stone-gray font-medium">{t('admin:settings.rememberMeLabel')}</td>
                      <td className="py-1.5 text-warm-gray">
                        {formatDuration(serverConfig.rememberMeTimeoutMs)}
                      </td>
                      <td className="py-1.5 text-right text-xs text-warm-gray/60">
                        <code className="font-mono">REMEMBER_ME_MAX_AGE</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-warm-gray">{t('common:error')}</p>
              )}
            </section>
          </div>
        )}

        {/* ===== APPEARANCE TAB ===== */}
        {activeTab === 'appearance' && (
          <div role="tabpanel" id="tabpanel-appearance" aria-labelledby="tab-appearance" className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-brand-ink">{t('admin:appearance.title')}</h2>
              <p className="text-sm text-warm-gray mt-1">
                {t('admin:appearance.description')}
              </p>
            </div>

            {settingsLoading && !settings ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-brand-ink animate-spin" />
              </div>
            ) : (
              <>
                <ThemePicker
                  themeId={appearanceForm.themeId}
                  fontId={appearanceForm.fontId}
                  customColors={appearanceForm.customColors}
                  onChange={(next) => {
                    setAppearanceForm(f => ({
                      ...f,
                      themeId: next.themeId,
                      fontId: next.fontId,
                      customColors: next.customColors,
                    }));
                  }}
                />

                {/* Language */}
                <section className="glass-panel p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-warm-gray/20">
                    <Globe className="w-4 h-4 text-warm-amber" />
                    <h3 className="font-semibold text-brand-ink text-sm">{t('admin:appearance.languageTitle')}</h3>
                  </div>
                  <p className="text-xs text-warm-gray">{t('admin:appearance.languageDescription')}</p>
                  <LanguageSelector />
                </section>

                {/* Save Appearance */}
                <div className="flex items-center gap-3">
                  {appearanceError && (
                    <p className="text-sm text-danger-ink flex-1">{appearanceError}</p>
                  )}
                  <Button
                    onClick={async () => {
                    setAppearanceSaving(true);
                    setAppearanceError('');
                    try {
                    const updateData: Record<string, any> = {
                    themeId: appearanceForm.themeId,
                    fontId: appearanceForm.fontId,
                    };
                    if (appearanceForm.themeId === 'custom') {
                    updateData.customThemeColors = appearanceForm.customColors;
                    }
                    await adminService.updateSettings(updateData);
                    await refreshAppearance();
                    showToast(t('admin:appearance.save') + '!', 'success');
                    } catch (err: any) {
                    setAppearanceError(err.response?.data?.message || t('common:error'));
                    } finally {
                    setAppearanceSaving(false);
                    }
                    }}
                    disabled={appearanceSaving}
                    className="flex items-center gap-2 ml-auto"
                  >
                    {appearanceSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('admin:appearance.save')}
                  </Button>
                  <Button
                    onClick={() => {
                    const defaultTheme = PRESET_THEMES[0];
                    setAppearanceForm(f => ({ ...f, themeId: 'cozy-default', fontId: 'default' }));
                    applyThemeColors(defaultTheme.colors);
                    applyFont(FONT_OPTIONS[0]);
                    }}
                    variant="secondary" className="text-sm"
                  >
                    {t('admin:appearance.reset')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== BACKUPS TAB ===== */}
        {activeTab === 'backups' && (
          <div role="tabpanel" id="tabpanel-backups" aria-labelledby="tab-backups" className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-brand-ink">{t('admin:backups.title')}</h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  className="flex items-center gap-2 text-sm py-1.5 px-3"
                >
                  {creatingBackup
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <HardDrive className="w-3.5 h-3.5" />
                  }
                  {t('admin:backups.create')}
                </Button>
                <Button
                  onClick={loadBackups}
                  disabled={backupsLoading}
                  variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-3"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${backupsLoading ? 'animate-spin' : ''}`} />
                  {t('common:refresh')}
                </Button>
              </div>
            </div>

            {backupCreateError && (
              <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-4 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{backupCreateError}</span>
              </div>
            )}

            {backupsError && (
              <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-4 text-sm">
                {backupsError}
              </div>
            )}

            <section className="glass-panel overflow-hidden">
              <div className="px-4 py-3 border-b border-warm-gray/20 flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-ink" />
                <h3 className="font-semibold text-brand-ink text-sm">{t('admin:backups.available')}</h3>
                {backups.length > 0 && (
                  <span className="ml-auto text-xs text-warm-gray">{t('admin:backups.countLabel', { count: backups.length })}</span>
                )}
              </div>

              {backupsLoading && backups.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-brand-ink animate-spin" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-10 text-warm-gray">
                  <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('admin:backups.noBackups')}</p>
                  <p className="text-xs mt-1" dangerouslySetInnerHTML={{ __html: t('admin:backups.noBackupsHint') }} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-warm-gray/10 bg-moss-green/5">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:backups.filename')}</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:backups.size')}</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:backups.created')}</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:assets.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map(b => (
                        <tr key={b.filename} className="border-b border-warm-gray/10 hover:bg-moss-green/5">
                          <td className="px-4 py-2.5 font-mono text-xs text-stone-gray">{b.filename}</td>
                          <td className="px-4 py-2.5 text-warm-gray text-xs">{formatBytes(b.sizeBytes)}</td>
                          <td className="px-4 py-2.5 text-warm-gray text-xs">{formatRelativeTime(b.createdAt)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={adminService.getBackupDownloadUrl(b.filename)}
                                download={b.filename}
                                className="text-xs py-1 px-2 flex items-center gap-1 rounded border border-moss-green/30 text-brand-ink hover:bg-moss-green/10 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                {t('admin:backups.download')}
                              </a>
                              <button
                                onClick={() => handleDeleteBackup(b.filename)}
                                disabled={deletingBackupFile === b.filename}
                                className="text-xs py-1 px-2 flex items-center gap-1 rounded border border-danger/30 text-danger-ink hover:bg-danger/10 transition-colors disabled:opacity-50"
                              >
                                {deletingBackupFile === b.filename
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Trash2 className="w-3 h-3" />
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="glass-panel overflow-hidden border border-danger/40">
              <div className="px-4 py-3 border-b border-danger/30 flex items-center gap-2 bg-danger/10">
                <RotateCcw className="w-4 h-4 text-danger-ink" />
                <h3 className="font-semibold text-danger-ink text-sm">{t('admin:backups.restoreSection')}</h3>
              </div>
              <div className="p-5 space-y-4">
                {restoreSuccess ? (
                  <div className="bg-moss-green/10 border border-moss-green/30 rounded-lg p-4 text-center space-y-2">
                    <p className="text-sm font-semibold text-brand-ink">{t('admin:backups.restoreSuccess')}</p>
                    <p className="text-xs text-warm-gray">
                      {t('admin:backups.restoreSuccessDesc')}
                    </p>
                    <Button
                      onClick={() => window.location.href = '/login'}
                      className="text-xs py-1.5 px-4 mt-1"
                    >
                      {t('admin:backups.goToLogin')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="bg-danger/10 border border-danger/60 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-danger-ink mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-danger-ink" dangerouslySetInnerHTML={{ __html: t('admin:backups.restoreWarning') }} />
                    </div>

                    <div>
                      <input
                        ref={restoreInputRef}
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={(e) => {
                          setRestoreFile(e.target.files?.[0] ?? null);
                          setRestoreError('');
                        }}
                      />
                      <Button
                        onClick={() => restoreInputRef.current?.click()}
                        variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-3"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {restoreFile ? t('admin:backups.changeFile') : t('admin:backups.selectFile')}
                      </Button>
                      {restoreFile && (
                        <p className="text-xs text-warm-gray mt-1.5 font-mono">
                          {restoreFile.name} ({formatBytes(restoreFile.size)})
                        </p>
                      )}
                    </div>

                    {restoreError && (
                      <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-3 text-xs flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {restoreError}
                      </div>
                    )}

                    {restoreFile && (
                      <button
                        onClick={handleRestoreBackup}
                        disabled={restoring}
                        className="flex items-center gap-2 text-sm py-1.5 px-4 rounded-lg bg-danger text-white hover:bg-danger disabled:opacity-50 transition-colors font-medium"
                      >
                        {restoring
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('admin:backups.restoring')}</>
                          : <><RotateCcw className="w-3.5 h-3.5" /> {t('admin:backups.restoreInstance')}</>
                        }
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {activeTab === 'activity' && (
          <div role="tabpanel" id="tabpanel-activity" aria-labelledby="tab-activity">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-brand-ink">{t('admin:activity.title')}</h2>
              <Button
                onClick={loadActivity}
                disabled={activityLoading}
                variant="secondary" className="flex items-center gap-2 text-sm py-1.5 px-3"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${activityLoading ? 'animate-spin' : ''}`} />
                {t('common:refresh')}
              </Button>
            </div>

            {activityError && (
              <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-4 mb-6 text-sm">
                {activityError}
              </div>
            )}

            {activityLoading && !activity ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-panel overflow-hidden">
                    <TableSkeleton rows={4} columns={4} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-8">

                {/* Currently Online */}
                <section className="glass-panel overflow-hidden">
                  <div className="px-4 py-3 border-b border-warm-gray/20 flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-success-ink" />
                    <h3 className="font-semibold text-brand-ink text-sm">{t('admin:activity.onlineSection')}</h3>
                    {activity?.onlineUsers && (
                      <span className="ml-auto text-xs font-medium text-success-ink">
                        {t('admin:activity.onlineCount', { count: activity.onlineUsers.length })}
                      </span>
                    )}
                  </div>
                  {!activity?.onlineUsers?.length ? (
                    <p className="text-sm text-warm-gray text-center py-6">{t('admin:activity.noOnline')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-gray/10 bg-moss-green/5">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.user')}</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.email')}</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.role')}</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.lastLogin')}</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.sessionExpires')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.onlineUsers.map((u: AdminOnlineUser) => (
                            <tr key={u.id} className="border-b border-warm-gray/10 hover:bg-moss-green/5">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-2 h-2 rounded-full bg-success flex-shrink-0" />
                                  <span className="font-medium text-stone-gray">{u.displayName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-warm-gray">{u.email}</td>
                              <td className="px-4 py-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  u.platformRole === PlatformRole.ADMIN
                                    ? 'bg-moss-green/20 text-brand-ink'
                                    : 'bg-warm-gray/20 text-warm-gray'
                                }`}>
                                  {u.platformRole}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-warm-gray text-xs">{formatRelativeTime(u.lastLoginAt)}</td>
                              <td className="px-4 py-2 text-xs text-warm-gray">{formatExpiry(u.sessionExpiry)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Recent Admin Actions */}
                <section className="glass-panel overflow-hidden">
                  <div className="px-4 py-3 border-b border-warm-gray/20 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-warm-amber" />
                    <h3 className="font-semibold text-brand-ink text-sm">{t('admin:activity.adminActions')}</h3>
                    <span className="text-xs text-warm-gray ml-auto">{t('admin:activity.last100')}</span>
                  </div>
                  {!activity?.recentLogs?.length ? (
                    <p className="text-sm text-warm-gray text-center py-6">{t('admin:activity.noActions')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-gray/10 bg-moss-green/5">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.time')}</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.level')}</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.action')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.recentLogs.map((log: AdminSystemLog) => (
                            <tr key={log.id} className="border-b border-warm-gray/10 hover:bg-moss-green/5">
                              <td className="px-4 py-2 text-warm-gray text-xs whitespace-nowrap">{formatRelativeTime(log.createdAt)}</td>
                              <td className="px-4 py-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${LOG_LEVEL_COLORS[log.level] ?? 'bg-warm-gray/20 text-warm-gray'}`}>
                                  {log.level}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-stone-gray">{log.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Recent Registrations */}
                <section className="glass-panel overflow-hidden">
                  <div className="px-4 py-3 border-b border-warm-gray/20 flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-ink" />
                    <h3 className="font-semibold text-brand-ink text-sm">{t('admin:activity.recentRegistrations')}</h3>
                    <span className="text-xs text-warm-gray ml-auto">{t('admin:activity.recent50')}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-warm-gray/10 bg-moss-green/5">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.user')}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.email')}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.role')}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">MFA</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.joined')}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:users.lastLogin')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!activity?.recentUsers.length ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-warm-gray">{t('admin:activity.noUsers')}</td>
                          </tr>
                        ) : (
                          activity.recentUsers.map(u => (
                            <tr key={u.id} className="border-b border-warm-gray/10 hover:bg-moss-green/5">
                              <td className="px-4 py-2 font-medium text-stone-gray">{u.displayName}</td>
                              <td className="px-4 py-2 text-warm-gray">{u.email}</td>
                              <td className="px-4 py-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  u.platformRole === PlatformRole.ADMIN
                                    ? 'bg-moss-green/20 text-brand-ink'
                                    : 'bg-warm-gray/20 text-warm-gray'
                                }`}>
                                  {u.platformRole}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`text-xs ${u.mfaEnabled ? 'text-success-ink' : 'text-warm-gray'}`}>
                                  {u.mfaEnabled ? t('common:on') : t('common:off')}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-warm-gray text-xs">{formatDate(u.createdAt)}</td>
                              <td className="px-4 py-2 text-warm-gray text-xs">{formatDate(u.lastLoginAt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Recent Game Sessions */}
                <section className="glass-panel overflow-hidden">
                  <div className="px-4 py-3 border-b border-warm-gray/20 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-info-ink" />
                    <h3 className="font-semibold text-brand-ink text-sm">{t('admin:activity.recentSessions')}</h3>
                    <span className="text-xs text-warm-gray ml-auto">{t('admin:activity.recent20')}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-warm-gray/10 bg-moss-green/5">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.campaign')}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.sessionNum', { number: '' })}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.started')}</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-warm-gray uppercase tracking-wide">{t('admin:activity.ended')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!activity?.recentSessions.length ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-warm-gray">{t('admin:activity.noSessions')}</td>
                          </tr>
                        ) : (
                          activity.recentSessions.map(s => (
                            <tr key={s.id} className="border-b border-warm-gray/10 hover:bg-moss-green/5">
                              <td className="px-4 py-2 font-medium text-stone-gray">{s.campaign.name}</td>
                              <td className="px-4 py-2 text-warm-gray">{t('admin:activity.sessionNum', { number: s.sessionNumber })}</td>
                              <td className="px-4 py-2 text-warm-gray text-xs">{formatDate(s.startedAt)}</td>
                              <td className="px-4 py-2 text-xs">
                                {s.endedAt
                                  ? <span className="text-warm-gray">{formatDate(s.endedAt)}</span>
                                  : <span className="text-success-ink font-medium">{t('admin:activity.inProgress')}</span>
                                }
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

              </div>
            )}
          </div>
        )}

      </main>

      {/* ===== CREATE USER MODAL ===== */}
      {createUserOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && !newUserPassword) closeCreateUserModal(); }}
        >
          <div className="bg-paper rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-warm-gray/20">
              <h2 className="text-lg font-semibold text-brand-ink flex items-center gap-2">
                {createUserMode === 'invite' ? <Mail className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                {createUserMode === 'invite' ? t('admin:createUser.inviteTitle') : t('admin:createUser.title')}
              </h2>
              {!newUserPassword && (
                <button onClick={closeCreateUserModal} className="text-warm-gray hover:text-stone-gray transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-5">
              {createUserSuccess ? (
                /* Invited, or created with the details emailed — no password to show */
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success-ink mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-success-ink font-medium">{createUserSuccess}</p>
                  </div>
                  <p className="text-xs text-warm-gray">
                    {t('admin:createUser.inviteDescription')}
                  </p>
                  <Button onClick={closeCreateUserModal} className="w-full">
                    {t('admin:createUser.done')}
                  </Button>
                </div>
              ) : newUserPassword ? (
                /* Success — show temp password */
                <div>
                  <p className="text-sm text-success-ink font-medium mb-1">{t('admin:createUser.successCreate')}</p>
                  <p className="text-xs text-warm-gray mb-4">
                    {t('admin:createUser.tempPasswordDesc')}
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <code className="flex-1 bg-warm-amber/10 border border-warm-amber/30 rounded px-3 py-2 text-sm font-mono text-stone-gray select-all">
                      {newUserPassword}
                    </code>
                    <Button
                      onClick={() => handleCopyToClipboard(newUserPassword, setNewUserPasswordCopied)}
                      variant="secondary" className="flex items-center gap-1 text-xs py-2 px-3"
                    >
                      {newUserPasswordCopied ? <Check className="w-3.5 h-3.5 text-success-ink" /> : <Copy className="w-3.5 h-3.5" />}
                      {newUserPasswordCopied ? t('admin:createUser.copied') : t('admin:createUser.copy')}
                    </Button>
                  </div>
                  <Button onClick={closeCreateUserModal} className="w-full">
                    {t('admin:createUser.done')}
                  </Button>
                </div>
              ) : (
                /* Form */
                <div className="space-y-4">
                  <p className="text-xs text-warm-gray">
                    {createUserMode === 'invite'
                      ? t('admin:createUser.inviteDescription')
                      : serverConfig?.smtp.configured
                        ? t('admin:createUser.createDescriptionEmail')
                        : t('admin:createUser.createDescriptionNoEmail')}
                  </p>

                  {createUserError && (
                    <div className="bg-danger/10 border border-danger/30 text-danger-ink rounded-lg p-3 text-sm">
                      {createUserError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-stone-gray mb-1">
                      {t('admin:createUser.emailLabel')} <span className="text-danger-ink">*</span>
                    </label>
                    <input
                      type="email"
                      value={createUserForm.email}
                      onChange={e => setCreateUserForm(f => ({ ...f, email: e.target.value }))}
                      className="input-cozy w-full"
                      placeholder="user@example.com"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-gray mb-1">
                      {t('admin:createUser.displayNameLabel')} <span className="text-warm-gray text-xs">{t('admin:createUser.displayNameOptional')}</span>
                    </label>
                    <input
                      type="text"
                      value={createUserForm.displayName}
                      onChange={e => setCreateUserForm(f => ({ ...f, displayName: e.target.value }))}
                      className="input-cozy w-full"
                      placeholder={t('admin:createUser.displayNamePlaceholder')}
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-gray mb-2">{t('admin:createUser.roleLabel')}</label>
                    <div className="flex gap-2">
                      {(['USER', 'ADMIN'] as const).map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setCreateUserForm(f => ({ ...f, platformRole: role }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            createUserForm.platformRole === role
                              ? role === 'ADMIN'
                                ? 'bg-moss-green text-white border-moss-green'
                                : 'bg-stone-gray/20 text-stone-gray border-stone-gray/40'
                              : 'border-warm-gray/30 text-warm-gray hover:border-warm-gray/60'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button
                      onClick={handleCreateUser}
                      disabled={creatingUser || !createUserForm.email.trim()}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      {creatingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                      {createUserMode === 'invite' ? t('admin:createUser.sendInvitation') : t('admin:createUser.createUserBtn')}
                    </Button>
                    <Button
                      onClick={closeCreateUserModal}
                      disabled={creatingUser}
                      variant="secondary" className="flex-1"
                    >
                      {t('common:cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restore backup confirmation */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title={t('admin:restore.confirmTitle')}
        message={t('admin:restore.confirmMessage')}
        confirmLabel={t('admin:restore.confirmLabel')}
        variant="danger"
        isLoading={restoring}
        onConfirm={handleRestoreBackupConfirmed}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
}