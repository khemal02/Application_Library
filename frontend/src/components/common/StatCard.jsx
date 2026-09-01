import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export default function StatCard({
  label, value, icon: Icon, color = 'primary', onClick,
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
      }}
    >
      <Box
        sx={{
          width: 48, height: 48, borderRadius: 2.5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: (t) => alpha(t.palette[color]?.main || t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.12),
          color: (t) => t.palette[color]?.main || t.palette.primary.main,
        }}
      >
        <Icon />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" fontWeight={800} lineHeight={1.2}>{value ?? '—'}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>{label}</Typography>
      </Box>
    </Paper>
  );
}
