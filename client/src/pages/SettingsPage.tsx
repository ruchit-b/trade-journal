import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { patch, get, del } from '@/lib/api';
import { SETUP_TYPE_OPTIONS } from '@/components/trades/constants';
import type { User } from '@/lib/auth';
import type { Trade } from '@/types/trade';
import toast from 'react-hot-toast';

const PREF_BROKERAGE_KEY = 'tradeedge_default_brokerage';
const PREF_BROKERAGE_TYPE_KEY = 'tradeedge_default_brokerage_type';
const PREF_SETUPS_KEY = 'tradeedge_preferred_setups';

type ApiProfileResponse = { success: boolean; data?: { user: User } };
type ApiTradesResponse = { success: boolean; data?: { trades: Trade[] } };
type ApiDeleteResponse = { success: boolean; data?: { message: string } };

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [portfolioAmount, setPortfolioAmount] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [brokerageValue, setBrokerageValue] = useState('');
  const [brokerageType, setBrokerageType] = useState<'inr' | 'pct'>('inr');
  const [preferredSetups, setPreferredSetups] = useState<string[]>([]);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPortfolioAmount(user.portfolioAmount != null ? String(user.portfolioAmount) : '');
    }
  }, [user]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PREF_BROKERAGE_KEY);
      const t = localStorage.getItem(PREF_BROKERAGE_TYPE_KEY) as 'inr' | 'pct' | null;
      const s = localStorage.getItem(PREF_SETUPS_KEY);
      if (v != null) setBrokerageValue(v);
      if (t === 'inr' || t === 'pct') setBrokerageType(t);
      if (s) setPreferredSetups(JSON.parse(s));
    } catch {
      // ignore
    }
  }, []);

  const markUnsaved = useCallback(() => setHasUnsaved(true), []);

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
      const payload: { name?: string; email?: string; portfolioAmount?: number | null; currentPassword?: string; newPassword?: string } = {};
      if (name.trim() !== user.name) payload.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) payload.email = email.trim().toLowerCase();
      const portfolioNum = portfolioAmount.trim() === '' ? null : Number(portfolioAmount);
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
      if (newPassword.trim()) {
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
      setHasUnsaved(false);
      toast.success('Profile updated.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(ax?.response?.data?.error ?? ax?.message ?? 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePrefsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSaving(true);
    try {
      const num = brokerageValue.trim() === '' ? '' : String(Number(brokerageValue));
      localStorage.setItem(PREF_BROKERAGE_KEY, num);
      localStorage.setItem(PREF_BROKERAGE_TYPE_KEY, brokerageType);
      localStorage.setItem(PREF_SETUPS_KEY, JSON.stringify(preferredSetups));
      setHasUnsaved(false);
      toast.success('Preferences saved.');
    } catch {
      toast.error('Failed to save preferences.');
    } finally {
      setPrefsSaving(false);
    }
  };

  const toggleSetup = (setup: string) => {
    setPreferredSetups((prev) =>
      prev.includes(setup) ? prev.filter((s) => s !== setup) : [...prev, setup]
    );
    markUnsaved();
  };

  const handleExportCsv = async () => {
    setExportLoading(true);
    try {
      const res = await get<ApiTradesResponse>('/api/trades', { params: { limit: 1000 } });
      const trades = res?.data?.trades ?? [];
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
        'Sector',
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
          t.setupType,
          t.sector,
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
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile */}
          <Card>
            <CardHeader title="Profile" subtitle="Update your name, email and password" />
            <CardBody>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
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
                      onChange={(e) => {
                        setEmail(e.target.value);
                        markUnsaved();
                      }}
                      className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Portfolio value (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={portfolioAmount}
                    onChange={(e) => {
                      setPortfolioAmount(e.target.value);
                      markUnsaved();
                    }}
                    placeholder="e.g. 500000"
                    className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-text-muted">Used for portfolio risk % on dashboard and trades.</p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium text-text-secondary mb-2">Change password</p>
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
                </div>
                <Button type="submit" variant="primary" loading={profileSaving} disabled={profileSaving}>
                  Save Changes
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Trading preferences */}
          <Card>
            <CardHeader title="Trading preferences" subtitle="Saved in this browser only" />
            <CardBody>
              <form onSubmit={handlePrefsSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Default brokerage per trade
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      step={brokerageType === 'pct' ? 0.1 : 1}
                      value={brokerageValue}
                      onChange={(e) => {
                        setBrokerageValue(e.target.value);
                        markUnsaved();
                      }}
                      placeholder={brokerageType === 'inr' ? 'e.g. 20' : 'e.g. 0.5'}
                      className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <select
                      value={brokerageType}
                      onChange={(e) => {
                        setBrokerageType(e.target.value as 'inr' | 'pct');
                        markUnsaved();
                      }}
                      className="rounded-md border border-border bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
                    >
                      <option value="inr">₹</option>
                      <option value="pct">%</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Preferred setup types
                  </label>
                  <p className="text-xs text-text-muted mb-2">
                    This helps pre-fill the setup type when adding trades.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SETUP_TYPE_OPTIONS.map((setup) => (
                      <label
                        key={setup}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2 cursor-pointer hover:bg-elevated/80"
                      >
                        <input
                          type="checkbox"
                          checked={preferredSetups.includes(setup)}
                          onChange={() => toggleSetup(setup)}
                          className="rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text-primary">{setup}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" variant="secondary" loading={prefsSaving} disabled={prefsSaving}>
                  Save Preferences
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Data & Privacy */}
          <Card>
            <CardHeader title="Data & Privacy" subtitle="Export or delete your data" />
            <CardBody className="space-y-6">
              <div>
                <p className="text-sm text-text-secondary mb-2">Download all your trades as a CSV file.</p>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleExportCsv}
                  loading={exportLoading}
                  disabled={exportLoading}
                >
                  Export all my trades as CSV
                </Button>
              </div>
              <div className="rounded-lg border-2 border-loss/30 bg-loss/5 p-4">
                <p className="text-sm font-medium text-loss mb-1">Danger zone</p>
                <p className="text-sm text-text-secondary mb-3">
                  Permanently delete your account and all trades, imports and uploaded files. This cannot be undone.
                </p>
                <Button variant="danger" size="md" onClick={() => setDeleteModalOpen(true)}>
                  Delete my account
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Plan */}
          <Card>
            <CardHeader title="Plan" subtitle="Your current subscription" />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded-md border px-3 py-1 text-sm font-medium ${
                    user.plan === 'pro'
                      ? 'bg-accent/15 text-accent border-accent/30'
                      : 'bg-elevated text-text-secondary border-border'
                  }`}
                >
                  {user.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
              </div>
              {user.plan === 'free' ? (
                <div className="rounded-lg border border-border bg-elevated/50 p-4 space-y-3">
                  <p className="text-sm font-medium text-text-primary">Upgrade to Pro</p>
                  <ul className="text-sm text-text-secondary list-disc list-inside space-y-1">
                    <li>Unlimited trades (Free: 100 trades max)</li>
                    <li>Priority support</li>
                    <li>Advanced analytics</li>
                    <li>CSV export</li>
                  </ul>
                  <p className="text-xs text-text-muted">Coming soon — Razorpay integration</p>
                </div>
              ) : (
                <div className="text-sm text-text-secondary">
                  <p>Renewal date: —</p>
                  <Button variant="ghost" size="sm" className="mt-2" disabled>
                    Manage subscription
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
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
