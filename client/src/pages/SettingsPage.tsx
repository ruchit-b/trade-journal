import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { patch, get, del } from '@/lib/api';
import { Download } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { User } from '@/lib/auth';
import type { Trade } from '@/types/trade';
import type { TradesResponse } from '@/types/trade';
import toast from 'react-hot-toast';

type ApiProfileResponse = { success: boolean; data?: { user: User } };
type ApiTradesResponse = { success: boolean; data?: TradesResponse };
type ApiDeleteResponse = { success: boolean; data?: { message: string } };

function formatInrWhole(value: number | null | undefined): string {
  if (value == null) return '';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [portfolioAmount, setPortfolioAmount] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPortfolioAmount(formatInrWhole(user.portfolioAmount));
    }
  }, [user]);

  const markUnsaved = useCallback(() => setHasUnsaved(true), []);

  const portfolioRaw = portfolioAmount.replace(/,/g, '').trim();
  const portfolioNum = portfolioRaw === '' ? null : Number(portfolioRaw);
  const portfolioValid = portfolioNum === null || Number.isFinite(portfolioNum);
  const nameChanged = name.trim() !== user?.name;
  const portfolioChanged = portfolioValid && portfolioNum !== (user?.portfolioAmount ?? null);
  const wantsPasswordChange = passwordOpen && !!newPassword.trim();
  const hasProfileChanges = !!user && (nameChanged || portfolioChanged || wantsPasswordChange);

  // Note: In-app navigation is not blocked when there are unsaved changes because useBlocker
  // requires a data router (createBrowserRouter). The beforeunload handler still warns on refresh/close.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    try {
      const payload: { name?: string; portfolioAmount?: number | null; currentPassword?: string; newPassword?: string } = {};
      if (name.trim() !== user.name) payload.name = name.trim();
      if (portfolioNum !== null && !Number.isFinite(portfolioNum)) {
        toast.error('Portfolio value must be a valid number.');
        setProfileSaving(false);
        return;
      }
      if (portfolioNum !== null && portfolioNum < 0) {
        toast.error('Portfolio value cannot be negative.');
        setProfileSaving(false);
        return;
      }
      const currentPortfolio = user.portfolioAmount ?? null;
      if (portfolioNum !== currentPortfolio) {
        payload.portfolioAmount = portfolioNum;
      }
      if (passwordOpen && newPassword.trim()) {
        if (newPassword.trim().length < 8) {
          toast.error('New password must be at least 8 characters.');
          setProfileSaving(false);
          return;
        }
        if (newPassword.trim() !== confirmPassword.trim()) {
          toast.error('New passwords do not match.');
          setProfileSaving(false);
          return;
        }
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword.trim();
      }
      if (Object.keys(payload).length === 0) {
        toast.success('No changes to save.');
        setProfileSaving(false);
        return;
      }
      const res = await patch<ApiProfileResponse>('/api/auth/profile', payload);
      if (!res?.success) throw new Error('Failed to update');
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
      setHasUnsaved(false);
      toast.success('Profile updated.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(ax?.response?.data?.error ?? ax?.message ?? 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleExportCsv = async () => {
    setExportLoading(true);
    try {
      const limit = 100;
      let page = 1;
      let totalPages = 1;
      const trades: Trade[] = [];
      do {
        const res = await get<ApiTradesResponse>('/api/trades', {
          params: { page, limit, sortBy: 'entryDate', sortOrder: 'desc' },
        });
        const batch = res?.data?.trades ?? [];
        trades.push(...batch);
        totalPages = res?.data?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);
      const headers = [
        'Symbol',
        'Direction',
        'Entry Price',
        'Exit Price',
        'Quantity',
        'Entry Date',
        'Exit Date',
        'P&L',
        'Outcome',
        'Setup Type',
        'Notes',
      ];
      const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = trades.map((t) =>
        [
          t.symbol,
          t.direction,
          t.entryPrice,
          t.exitPrice ?? '',
          t.quantity,
          t.entryDate?.slice(0, 10) ?? '',
          t.exitDate?.slice(0, 10) ?? '',
          t.pnl ?? '',
          t.outcome ?? '',
          t.setupType ?? '',
          t.notes,
        ].map(escape)
      );
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tradeedge-trades-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${trades.length} trades.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Type DELETE to confirm.');
      return;
    }
    if (!deletePassword.trim()) {
      toast.error('Enter your password.');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await del<ApiDeleteResponse>('/api/auth/account', {
        data: { password: deletePassword },
      });
      if (!res?.success) throw new Error('Failed to delete');
      toast.success('Account deleted.');
      setDeleteModalOpen(false);
      logout();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(ax?.response?.data?.error ?? ax?.message ?? 'Failed to delete account.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            {/* Profile */}
            <Card>
              <CardHeader title="Profile" subtitle="Update your name and password" />
              <CardBody>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Theme</label>
                  <div className="flex w-full max-w-xs overflow-hidden rounded-full border border-border bg-elevated">
                    {[
                      { value: 'dark' as const, label: 'Dark' },
                      { value: 'light' as const, label: 'Light' },
                    ].map((opt) => {
                      const active = theme === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTheme(opt.value)}
                          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                            active ? 'bg-accent text-accent-foreground' : 'text-text-muted hover:text-text-primary'
                          }`}
                          aria-pressed={active}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markUnsaved();
                    }}
                    minLength={2}
                    className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-muted cursor-not-allowed"
                    aria-readonly="true"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Portfolio value (₹)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9,]*"
                    value={portfolioAmount}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '');
                      const next = digits === '' ? '' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(digits));
                      setPortfolioAmount(next);
                      markUnsaved();
                    }}
                    placeholder="e.g. 500000"
                    className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-text-muted">Used for portfolio risk % on dashboard and trades.</p>
                </div>
                <div>
                  {passwordOpen && (
                    <div className="space-y-2">
                      <input
                        type="password"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          markUnsaved();
                        }}
                        className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <input
                        type="password"
                        placeholder="New password (min 8 characters)"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          markUnsaved();
                        }}
                        className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          markUnsaved();
                        }}
                        className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPasswordOpen((v) => !v);
                      if (passwordOpen) {
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }
                      markUnsaved();
                    }}
                  >
                    {passwordOpen ? 'Cancel password change' : 'Change password'}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={profileSaving}
                    disabled={profileSaving || !hasProfileChanges}
                  >
                    Save Changes
                  </Button>
                </div>
                </form>
              </CardBody>
            </Card>

            {/* Data & Privacy */}
            <Card>
              <CardHeader title="Data & Privacy" subtitle="Export or delete your data" />
              <CardBody className="space-y-6">
                <div className="rounded-xl border border-border bg-elevated/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
                      <Download className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">Export</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Download all your trades as a CSV file.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleExportCsv}
                      loading={exportLoading}
                      disabled={exportLoading}
                      className="border border-border hover:border-accent/40"
                    >
                      Export all my trades as CSV
                    </Button>
                    <span className="text-xs text-text-muted">Exports up to your latest trades.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[rgba(239,68,68,0.40)] bg-[rgba(239,68,68,0.08)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loss/15 text-loss">
                      <span className="text-lg font-semibold leading-none">!</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-loss">Danger zone</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Permanently delete your account and all trades, imports and uploaded files. This cannot be undone.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Button
                          variant="danger"
                          size="md"
                          onClick={() => setDeleteModalOpen(true)}
                          className="border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.14)] text-[rgb(239,68,68)] hover:bg-[rgba(239,68,68,0.20)]"
                        >
                          Delete my account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete account modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/90 p-4">
          <Card className="w-full max-w-md border-loss/20">
            <CardBody className="space-y-4">
              <h3 className="font-semibold text-text-primary">Delete your account?</h3>
              <p className="text-sm text-text-secondary">
                This will permanently delete all your trades, imports and uploaded files. Type{' '}
                <strong className="text-loss">DELETE</strong> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDeleteConfirmText('');
                    setDeletePassword('');
                  }}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteAccount}
                  loading={deleteLoading}
                  disabled={deleteConfirmText !== 'DELETE' || !deletePassword.trim() || deleteLoading}
                >
                  Delete account
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
