import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { hideToast } from '../../features/toast/toastSlice';

/** Mounted once at the app root — every `useToast()` call anywhere in the tree surfaces here. */
export default function GlobalToast() {
  const dispatch = useAppDispatch();
  const { open, message, severity, key } = useAppSelector((state) => state.toast);

  return (
    <Snackbar
      key={key}
      open={open}
      autoHideDuration={4000}
      onClose={(_, reason) => { if (reason !== 'clickaway') dispatch(hideToast()); }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        variant="filled"
        severity={severity}
        onClose={() => dispatch(hideToast())}
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
