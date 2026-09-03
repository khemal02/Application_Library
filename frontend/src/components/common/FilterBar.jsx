import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

/**
 * `filterDefs`: [{ key, label, options: [{value,label}] }] — rendered as select dropdowns.
 * `filters`/`onFiltersChange` and `search`/`onSearchChange` mirror useServerList's shape.
 */
export default function FilterBar({ search, onSearchChange, filters, onFiltersChange, filterDefs = [], searchPlaceholder = 'Search...', right }) {
  const handleFilterChange = (key, value) => {
    const next = { ...filters };
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value;
    onFiltersChange(next);
  };

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}
      sx={{
        mb: 2,
        // nowrap + its own horizontal scroll, not flexWrap — a row that wraps onto a second line
        // depending on exact pixel budget will always find some viewport width (or scrollbar
        // gutter, or long filter value) that tips it over. Scrolling the bar itself guarantees
        // everything stays on one line unconditionally, on any width.
        flexWrap: 'nowrap',
        overflowX: { sm: 'auto' },
        pb: { sm: 0.5 },
      }}
    >
      <TextField
        size="small"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 200, flexShrink: 0 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      {filterDefs.map((def) => (
        <TextField
          key={def.key}
          select
          size="small"
          label={def.label}
          value={filters[def.key] ?? ''}
          onChange={(e) => handleFilterChange(def.key, e.target.value)}
          sx={{
            // A single fixed width clipped longer labels like "Functional Area" against the
            // dropdown arrow. Sized off each filter's own label instead, with 140 as the floor so
            // short labels (Status, Industry) keep their existing compact width.
            minWidth: Math.max(140, def.label.length * 9 + 56),
            flexShrink: 0,
            '& .MuiSelect-select': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          }}
        >
          <MenuItem value="">All</MenuItem>
          {def.options.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
        </TextField>
      ))}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: { sm: 'auto' }, flexShrink: 0 }}>
        {right}
      </Stack>
    </Stack>
  );
}
