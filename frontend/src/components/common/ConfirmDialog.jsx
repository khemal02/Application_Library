import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

export default function ConfirmDialog({ open, title = 'Are you sure?', description, confirmLabel = 'Confirm', onConfirm, onClose, danger = true }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      {description && (
        <DialogContent>
          <DialogContentText>{description}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color={danger ? 'error' : 'primary'} variant="contained" onClick={onConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
