import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui/Spinner';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TradesPage = lazy(() => import('@/pages/TradesPage').then((m) => ({ default: m.TradesPage })));
const AddTradePage = lazy(() => import('@/pages/AddTradePage').then((m) => ({ default: m.AddTradePage })));
const EditTradePage = lazy(() => import('@/pages/EditTradePage').then((m) => ({ default: m.EditTradePage })));
const TradeDetailPage = lazy(() => import('@/pages/TradeDetailPage').then((m) => ({ default: m.TradeDetailPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ImportPage = lazy(() => import('@/pages/ImportPage').then((m) => ({ default: m.ImportPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <DashboardPage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/trades"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <TradesPage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/trades/:id/edit"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <EditTradePage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/trades/:id"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <TradeDetailPage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/trades/new"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <AddTradePage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/analytics"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <AnalyticsPage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/import"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <ImportPage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthenticatedLayout>
                <Suspense fallback={<PageFallback />}>
                  <SettingsPage />
                </Suspense>
              </AuthenticatedLayout>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </ErrorBoundary>
  );
}

export default App;
