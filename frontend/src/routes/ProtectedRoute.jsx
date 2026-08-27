import { Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAppSelector } from '../app/hooks';
import { selectHasPermission } from '../features/auth/authSlice';

/** `resource`/`action`, when given, gate the route the same way the sidebar nav gates its links —
 * so a role without access can't reach the page just by typing the URL directly. */
export default function ProtectedRoute({ children, resource, action }) {
  const token = useAppSelector((state) => state.auth.token);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const hasPermission = useAppSelector((state) => (resource ? selectHasPermission(state, resource, action) : true));

  if (!token) return <Navigate to="/login" replace />;

  if (!bootstrapped) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (resource && !hasPermission) return <Navigate to="/" replace />;

  return children;
}
