import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';

export default function TagInput({ value = [], onChange, label = 'Tags' }) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      renderTags={(tagValue, getTagProps) => tagValue.map((option, index) => (
        <Chip variant="outlined" label={option} size="small" {...getTagProps({ index })} key={option} />
      ))}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="Type and press enter" size="small" />
      )}
    />
  );
}
