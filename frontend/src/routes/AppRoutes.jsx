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
import IdeasListPage from '../pages/Ideas/IdeasListPage';
import IdeaDetailPage from '../pages/Ideas/IdeaDetailPage';
import FeatureRequestsListPage from '../pages/Ideas/FeatureRequestsListPage';
import FeatureRequestDetailPage from '../pages/Ideas/FeatureRequestDetailPage';
import SuggestionsListPage from '../pages/Suggestions/SuggestionsListPage';
import SuggestionDetailPage from '../pages/Suggestions/SuggestionDetailPage';
import UsersPage from '../pages/Admin/UsersPage';
import RolesPage from '../pages/Admin/RolesPage';
import DepartmentsPage from '../pages/Admin/DepartmentsPage';
import AuditLogsPage from '../pages/Admin/AuditLogsPage';
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

      <Route path="/ideas" element={<Protected resource="ideas" action="read"><IdeasListPage /></Protected>} />
      <Route path="/ideas/:id" element={<Protected resource="ideas" action="read"><IdeaDetailPage /></Protected>} />

      <Route path="/feature-requests" element={<Protected resource="feature_requests" action="read"><FeatureRequestsListPage /></Protected>} />
      <Route path="/feature-requests/:id" element={<Protected resource="feature_requests" action="read"><FeatureRequestDetailPage /></Protected>} />

      <Route path="/suggestions" element={<Protected><SuggestionsListPage /></Protected>} />
      <Route path="/suggestions/:id" element={<Protected><SuggestionDetailPage /></Protected>} />

      <Route path="/admin/users" element={<Protected resource="users" action="read"><UsersPage /></Protected>} />
      <Route path="/admin/roles" element={<Protected resource="users" action="read"><RolesPage /></Protected>} />
      <Route path="/admin/departments" element={<Protected resource="users" action="read"><DepartmentsPage /></Protected>} />
      <Route path="/admin/audit-logs" element={<Protected resource="audit_logs" action="read"><AuditLogsPage /></Protected>} />

      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

      <Route path="*" element={<Protected><NotFoundPage /></Protected>} />
    </Routes>
  );
}
