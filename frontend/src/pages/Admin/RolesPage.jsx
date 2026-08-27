import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { rolesApi } from '../../services/domains';
import useToast from '../../hooks/useToast';

const RESOURCES = [
  'applications', 'tech_stack', 'features', 'ai_prompts', 'architecture_docs', 'api_docs', 'db_docs',
  'releases', 'bugs', 'roadmap', 'timeline', 'ideas', 'suggestions', 'comments', 'votes', 'attachments',
  'users', 'roles', 'departments', 'reports', 'dashboard', 'search', 'notifications', 'audit_logs', '*',
];
const ACTIONS = ['create', 'read', 'update', 'delete', 'review', 'assign', 'manage'];

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newResource, setNewResource] = useState('applications');
  const [newAction, setNewAction] = useState('read');
  const { showSuccess, showError } = useToast();

  const load = async () => {
    const res = await rolesApi.list({ limit: 50 });
    setRoles(res.data);
    if (selected) {
      const refreshed = res.data.find((r) => r.id === selected.id);
      setSelected(refreshed || null);
    }
  };

  useEffect(() => { load(); }, []);

  const addPermission = async () => {
    const existing = selected.permissions.map((p) => ({ resource: p.resource, action: p.action }));
    if (existing.some((p) => p.resource === newResource && p.action === newAction)) return;
    const updated = [...existing, { resource: newResource, action: newAction }];
    try {
      await rolesApi.setPermissions(selected.id, updated);
      showSuccess('Permission added');
      load();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update permissions');
    }
  };

  const removePermission = async (perm) => {
    const updated = selected.permissions
      .filter((p) => !(p.resource === perm.resource && p.action === perm.action))
      .map((p) => ({ resource: p.resource, action: p.action }));
    try {
      await rolesApi.setPermissions(selected.id, updated);
      showSuccess('Permission removed');
      load();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update permissions');
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Roles & Permissions</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined">
            <List>
              {roles.map((r) => (
                <ListItemButton key={r.id} selected={selected?.id === r.id} onClick={() => setSelected(r)}>
                  <ListItemText primary={r.label} secondary={r.description} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          {selected ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{selected.label} — Permissions</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {selected.permissions.map((p) => (
                  <Chip key={`${p.resource}:${p.action}`} label={`${p.resource}:${p.action}`} onDelete={() => removePermission(p)} />
                ))}
                {selected.permissions.length === 0 && <Typography variant="body2" color="text.secondary">No permissions assigned</Typography>}
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField select size="small" label="Resource" value={newResource} onChange={(e) => setNewResource(e.target.value)} sx={{ minWidth: 180 }}>
                  {RESOURCES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Action" value={newAction} onChange={(e) => setNewAction(e.target.value)} sx={{ minWidth: 140 }}>
                  {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </TextField>
                <Button variant="contained" onClick={addPermission}>Add</Button>
              </Stack>
            </Paper>
          ) : (
            <Typography color="text.secondary">Select a role to manage its permissions</Typography>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
