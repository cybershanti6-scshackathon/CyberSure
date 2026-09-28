import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/pages/LandingPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { DeviceDetailPage } from '@/pages/DeviceDetailPage';
import { ConfigurationPage } from '@/pages/ConfigurationPage';
import { ConverterPage } from '@/pages/ConverterPage';
import { IssuesPage } from '@/pages/IssuesPage';
import { CompliancePage } from '@/pages/CompliancePage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AssistantPage } from '@/pages/AssistantPage';
import { ChangesPage } from '@/pages/ChangesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* The landing page is deliberately outside the application shell. */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<Navigate to="/" replace />} />

      <Route element={<AppShell />}>
        <Route path="/assessment" element={<OverviewPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
        <Route path="/configuration" element={<ConfigurationPage />} />
        <Route path="/converter" element={<ConverterPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/changes" element={<ChangesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/overview" element={<Navigate to="/assessment" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
