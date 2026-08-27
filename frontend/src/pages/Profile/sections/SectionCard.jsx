import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/** Shared card shell for every Profile & Settings section — keeps heading style/spacing
 * consistent without each section re-declaring the same Paper/Typography boilerplate. */
export default function SectionCard({ title, action, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, ...sx }}>
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          {title && <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>}
          {action}
        </Box>
      )}
      {children}
    </Paper>
  );
}
