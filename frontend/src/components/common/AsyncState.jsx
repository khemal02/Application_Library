import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

export function LoadingBlock({ minHeight = '40vh' }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight }}>
      <CircularProgress />
    </Box>
  );
}

export function ErrorBlock({ message = 'Something went wrong', onRetry }) {
  return (
    <Alert
      severity="error"
      action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}
    >
      {message}
    </Alert>
  );
}
