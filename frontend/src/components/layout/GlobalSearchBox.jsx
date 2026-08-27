import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InputBase from '@mui/material/InputBase';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import { searchApi } from '../../services/domains';

const ENTITY_ROUTE = {
  application: (id) => `/applications/${id}`,
  idea: (id) => `/ideas/${id}`,
  suggestion: (id) => `/suggestions/${id}`,
  ai_prompt: () => `/applications`,
};

export default function GlobalSearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const anchorRef = useRef(null);
  const debounceTimer = useRef(null);
  const navigate = useNavigate();

  // A pending debounce timer left running past unmount would call setResults on a gone
  // component — clear it on cleanup rather than just on the next keystroke.
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceTimer.current);
    if (!value.trim()) { setResults(null); return; }
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await searchApi.search(value);
        setResults(res.data);
      } catch {
        setResults(null);
      }
    }, 300);
  };

  const groups = results ? [
    ['Applications', results.applications],
    ['Ideas', results.ideas],
    ['Suggestions', results.suggestions],
    ['AI Prompts', results.aiPrompts],
  ].filter(([, items]) => items.length) : [];

  return (
    <ClickAwayListener onClickAway={() => setResults(null)}>
      <Box ref={anchorRef} sx={{ position: 'relative', width: 360 }}>
        <Paper
          variant="outlined"
          sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.5, borderRadius: 2 }}
        >
          <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          <InputBase
            placeholder="Search applications, ideas, suggestions, prompts..."
            inputProps={{ 'aria-label': 'Search applications, ideas, suggestions, and prompts' }}
            fullWidth
            value={query}
            onChange={handleChange}
          />
        </Paper>
        <Popper open={groups.length > 0} anchorEl={anchorRef.current} placement="bottom-start" style={{ width: 360, zIndex: 1300 }}>
          <Paper sx={{ mt: 1, maxHeight: 400, overflow: 'auto' }} elevation={4}>
            <List dense>
              {groups.map(([label, items]) => (
                <Box key={label}>
                  <Typography variant="overline" sx={{ pl: 2, color: 'text.secondary' }}>{label}</Typography>
                  {items.map((item) => (
                    <ListItemButton
                      key={item.id}
                      onClick={() => { navigate(ENTITY_ROUTE[item.entity_type]?.(item.id) || '/'); setResults(null); setQuery(''); }}
                    >
                      <ListItemText primary={item.title} />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </List>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
