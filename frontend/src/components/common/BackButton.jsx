import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

// Browser-history back (same as the browser's own back button), not a hardcoded "go to module
// root" — returns to whichever list/filter/page the user actually came from. Styled as a Button
// rather than a bare IconButton to match the rest of the app's labeled affordances (Edit, Submit
// Idea, ...) instead of an unlabeled floating icon.
export default function BackButton({ children = 'Back' }) {
  const navigate = useNavigate();
  return (
    <Button
      size="small"
      onClick={() => navigate(-1)}
      startIcon={<ArrowBackRoundedIcon fontSize="small" />}
      sx={{
        mb: 0.25,
        px: 1.25,
        py: 0.25,
        color: 'text.secondary',
        '&:hover': {
          color: 'primary.main',
          backgroundColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
        },
      }}
    >
      {children}
    </Button>
  );
}
