import { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { fetchMe } from './features/auth/authSlice';
import { getTheme } from './theme/theme';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';
import GlobalToast from './components/common/GlobalToast';

// Always light — the navy/blue design system was built and approved for light mode only; there's
// no toggle to switch it any more (see Topbar.jsx's removed dark-mode button).
const theme = getTheme('light');

export default function App() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);

  useEffect(() => {
    if (token && !bootstrapped) dispatch(fetchMe());
  }, [token, bootstrapped, dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
      <GlobalToast />
    </ThemeProvider>
  );
}
