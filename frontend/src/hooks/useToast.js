import { useAppDispatch } from '../app/hooks';
import { showToast } from '../features/toast/toastSlice';

/** Dispatches to the single app-wide toast — call from anywhere instead of rolling a local Snackbar. */
export default function useToast() {
  const dispatch = useAppDispatch();
  return {
    showSuccess: (message) => dispatch(showToast({ message, severity: 'success' })),
    showError: (message) => dispatch(showToast({ message, severity: 'error' })),
    showInfo: (message) => dispatch(showToast({ message, severity: 'info' })),
  };
}
