import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

// Browser-history back (same as the browser's own back button), not a hardcoded "go to module
// root" — returns to whichever list/filter/page the user actually came from. Icon-only, no label.
export default function BackButton() {
  const navigate = useNavigate();
  return (
    <IconButton
      size="small"
      onClick={() => navigate(-1)}
      aria-label="Back"
      sx={{
        mb: 0.25,
        color: 'text.secondary',
        '&:hover': {
          color: 'primary.main',
          backgroundColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
        },
      }}
    >
      <ArrowBackRoundedIcon fontSize="small" />
    </IconButton>
  );
}
