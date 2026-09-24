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
        // A vertical stack — icon tile on its own row above the number/label, not beside them —
        // matching the approved reference's `.stat-card` layout exactly.
        p: 2.5,
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
      }}
    >
      <Box
        sx={{
          width: 38, height: 38, borderRadius: '10px', mb: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: (t) => alpha(t.palette[color]?.main || t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.12),
          color: (t) => t.palette[color]?.main || t.palette.primary.main,
        }}
      >
        <Icon sx={{ fontSize: 19 }} />
      </Box>
      <Typography fontWeight={800} lineHeight={1.2} sx={{ fontSize: '22px', mb: '2px' }}>{value ?? '—'}</Typography>
      <Typography fontWeight={700} noWrap sx={{ fontSize: '13.2px', color: '#374151' }}>{label}</Typography>
    </Paper>
  );
}
