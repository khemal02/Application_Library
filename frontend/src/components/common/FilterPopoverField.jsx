import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

/**
 * One field inside a "Filters" popover (see ApplicationsListPage/IdeasAndFeatureRequestsListPage):
 * a plain static label above a bordered select box, not MUI's default overlapping floating label
 * — matches the approved reference's own filter card exactly.
 */
export default function FilterPopoverField({ label, allLabel, value, onChange, options }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>{label}</Typography>
      <TextField
        select fullWidth size="small"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">{allLabel}</MenuItem>
        {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </TextField>
    </Box>
  );
}
