import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/Auth/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import MyAssignedStagesPage from '../pages/Dashboard/MyAssignedStagesPage';
import ApplicationsListPage from '../pages/Applications/ApplicationsListPage';
import ApplicationDetailPage from '../pages/Applications/ApplicationDetailPage';
import ApplicationStagesPage from '../pages/Applications/ApplicationStagesPage';
import ChangeRequestDetailPage from '../pages/Applications/ChangeRequestDetailPage';
import ApplicationTrackingListPage from '../pages/ApplicationTracking/ApplicationTrackingListPage';
import ApplicationTrackingDetailPage from '../pages/ApplicationTracking/ApplicationTrackingDetailPage';
import IdeaPrioritizationListPage from '../pages/IdeaPrioritization/IdeaPrioritizationListPage';
import IdeasAndFeatureRequestsListPage from '../pages/Ideas/IdeasAndFeatureRequestsListPage';
import IdeaDetailPage from '../pages/Ideas/IdeaDetailPage';
import FeatureRequestDetailPage from '../pages/Ideas/FeatureRequestDetailPage';
import UsersPage from '../pages/Admin/UsersPage';
import RolesPage from '../pages/Admin/RolesPage';
import DepartmentsPage from '../pages/Admin/DepartmentsPage';
import ProfilePage from '../pages/Profile/ProfilePage';
import NotFoundPage from '../pages/NotFoundPage';

function Protected({ children, resource, action }) {
  return (
    <ProtectedRoute resource={resource} action={action}>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard is the post-login landing page. */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/my-stages" element={<Protected resource="change_requests" action="read"><MyAssignedStagesPage /></Protected>} />

      <Route path="/applications" element={<Protected><ApplicationsListPage /></Protected>} />
      <Route path="/applications/:id" element={<Protected><ApplicationDetailPage /></Protected>} />
      <Route path="/applications/:id/stages" element={<Protected><ApplicationStagesPage /></Protected>} />
      <Route path="/applications/:applicationId/change-requests/:changeRequestId" element={<Protected><ChangeRequestDetailPage /></Protected>} />

      {/* New Ideas and Modify Current Application were merged into one list screen
          (IdeasAndFeatureRequestsListPage) — rendered at BOTH original routes, each still under
          its own original guard, so neither existing link/bookmark/dashboard-tile breaks and
          nobody gains access they didn't already have. The page itself further narrows what it
          shows per-viewer via its own real ideas:read/feature_requests:read checks. */}
      <Route path="/ideas" element={<Protected resource="ideas" action="read"><IdeasAndFeatureRequestsListPage /></Protected>} />
      <Route path="/ideas/:id" element={<Protected resource="ideas" action="read"><IdeaDetailPage /></Protected>} />

      <Route path="/feature-requests" element={<Protected resource="feature_requests" action="read"><IdeasAndFeatureRequestsListPage /></Protected>} />
      <Route path="/feature-requests/:id" element={<Protected resource="feature_requests" action="read"><FeatureRequestDetailPage /></Protected>} />

      <Route path="/application-tracking" element={<Protected resource="application_tracks" action="read"><ApplicationTrackingListPage /></Protected>} />
      <Route path="/application-tracking/:id" element={<Protected resource="application_tracks" action="read"><ApplicationTrackingDetailPage /></Protected>} />
      {/* Distinct module from Application Tracking (by explicit request) — same underlying
          resource/data (application_tracks), just narrowed to the "waiting to start" ranked
          queue; no separate detail page, a row click isn't wired here (the list itself is the
          whole page). */}
      <Route path="/idea-prioritization" element={<Protected resource="application_tracks" action="read"><IdeaPrioritizationListPage /></Protected>} />

      <Route path="/admin/users" element={<Protected resource="users" action="read"><UsersPage /></Protected>} />
      <Route path="/admin/roles" element={<Protected resource="users" action="read"><RolesPage /></Protected>} />
      <Route path="/admin/departments" element={<Protected resource="users" action="read"><DepartmentsPage /></Protected>} />

      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

      <Route path="*" element={<Protected><NotFoundPage /></Protected>} />
    </Routes>
  );
}
