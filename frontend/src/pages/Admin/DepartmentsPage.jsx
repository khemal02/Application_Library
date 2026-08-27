import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { departmentsApi } from '../../services/domains';
import useToast from '../../hooks/useToast';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [newDept, setNewDept] = useState('');
  const [error, setError] = useState(null);
  const { showSuccess } = useToast();

  const load = async () => {
    try {
      const res = await departmentsApi.list({ limit: 100 });
      setDepartments(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load departments');
    }
  };

  useEffect(() => { load(); }, []);

  const runOrReportError = async (action, fallbackMessage) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.response?.data?.message || fallbackMessage);
    }
  };

  const addDepartment = () => {
    if (!newDept.trim()) return;
    runOrReportError(async () => {
      await departmentsApi.create({ name: newDept });
      setNewDept('');
      showSuccess('Department added');
      await load();
    }, 'Failed to add department');
  };

  const removeDepartment = (id) => runOrReportError(async () => {
    await departmentsApi.remove(id);
    showSuccess('Department deleted');
    await load();
  }, 'Failed to delete department — it may still have applications assigned to it');

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Departments</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Paper variant="outlined" sx={{ p: 2, maxWidth: 480 }}>
        <List dense>
          {departments.map((d) => (
            <ListItem key={d.id} secondaryAction={
              <IconButton size="small" aria-label={`Delete ${d.name} department`} onClick={() => removeDepartment(d.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            }>
              <ListItemText primary={d.name} secondary={d.description} />
            </ListItem>
          ))}
        </List>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField size="small" fullWidth placeholder="New department name" value={newDept} onChange={(e) => setNewDept(e.target.value)} />
          <IconButton color="primary" aria-label="Add department" onClick={addDepartment}><AddIcon /></IconButton>
        </Stack>
      </Paper>
    </Box>
  );
}
