import { Component } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

/**
 * Without this, a render-time exception anywhere in the tree (a null-pointer on an unexpected
 * API shape, a third-party component bug) crashes the whole SPA to a blank white screen with no
 * way back except a hard refresh via the browser chrome. This gives the user a way out.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', p: 4, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>Something went wrong</Typography>
        <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 480 }}>
          An unexpected error occurred while rendering this page. Reloading usually fixes it — if
          it keeps happening, let an administrator know what you were doing when it broke.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outlined" onClick={() => window.location.assign('/')}>Go to Dashboard</Button>
        </Stack>
      </Box>
    );
  }
}
