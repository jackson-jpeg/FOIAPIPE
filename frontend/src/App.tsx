import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CommandBar } from '@/components/ui/CommandBar';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/authStore';

// Initialize Sentry if DSN is provided
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.MODE === 'development' ? 1.0 : 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NewsScannerPage } from '@/pages/NewsScannerPage';
import { FoiaTrackerPage } from '@/pages/FoiaTrackerPage';
import { FoiaEditorPage } from '@/pages/FoiaEditorPage';
import { VideoPipelinePage } from '@/pages/VideoPipelinePage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AgenciesPage } from '@/pages/AgenciesPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function PublicRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

// CommandBar handles its own Cmd+K shortcut internally

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <CommandBar />
          <Routes>
            {/* Public routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/news" element={<NewsScannerPage />} />
              <Route path="/foia" element={<FoiaTrackerPage />} />
              <Route path="/foia/editor/:id" element={<FoiaEditorPage />} />
              <Route path="/agencies" element={<AgenciesPage />} />
              <Route path="/videos" element={<VideoPipelinePage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 Not Found */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
