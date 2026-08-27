import { useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { fetchMe } from './features/auth/authSlice';
import { getTheme } from './theme/theme';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/common/ErrorBoundary';
import GlobalToast from './components/common/GlobalToast';

export default function App() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const token = useAppSelector((state) => state.auth.token);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

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
