import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/Auth/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import ApplicationsListPage from '../pages/Applications/ApplicationsListPage';
import ApplicationDetailPage from '../pages/Applications/ApplicationDetailPage';
import IdeasListPage from '../pages/Ideas/IdeasListPage';
import IdeaDetailPage from '../pages/Ideas/IdeaDetailPage';
import FeatureRequestsListPage from '../pages/Ideas/FeatureRequestsListPage';
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

      {/* Applications is the post-login landing page; Dashboard moved to its own path. */}
      <Route path="/" element={<Navigate to="/applications" replace />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />

      <Route path="/applications" element={<Protected><ApplicationsListPage /></Protected>} />
      <Route path="/applications/:id" element={<Protected><ApplicationDetailPage /></Protected>} />

      <Route path="/ideas" element={<Protected><IdeasListPage /></Protected>} />
      <Route path="/ideas/:id" element={<Protected><IdeaDetailPage /></Protected>} />

      <Route path="/feature-requests" element={<Protected><FeatureRequestsListPage /></Protected>} />
      <Route path="/feature-requests/:id" element={<Protected><IdeaDetailPage /></Protected>} />

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
