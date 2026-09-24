import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import useServerList from '../../hooks/useServerList';
import useToast from '../../hooks/useToast';
import { usersApi, rolesApi, departmentsApi } from '../../services/domains';
import DataTable from '../../components/common/DataTable';
import FilterBar from '../../components/common/FilterBar';
import StatusBadge from '../../components/common/StatusBadge';
import { FUNCTIONAL_AREA_OPTIONS, INDUSTRY_OPTIONS } from '../../constants/options';

const EMPTY_VALUES = {
  name: '', email: '', password: '', roleId: '', departmentId: '', functionalAreas: [], industry: '',
};

/**
 * One dialog for both New User and Edit User — `user` (null for create, the row's record for
 * edit) is the only thing that switches its behavior: no password field once editing (the update
 * endpoint doesn't accept one — resetting a password isn't this form's job), email locked
 * read-only (changing a login identity has bigger implications than the other fields here, so
 * that stays out of scope), and the submit action calls create vs update accordingly.
 */
function UserFormDialog({
  open, onClose, onSaved, roles, departments, user,
}) {
  const isEdit = !!user;
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: EMPTY_VALUES,
  });
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      reset(isEdit ? {
        name: user.name || '',
        email: user.email || '',
        password: '',
        roleId: user.roleId || '',
        departmentId: user.departmentId || '',
        functionalAreas: user.functionalAreas || [],
        industry: user.industry || '',
      } : EMPTY_VALUES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      if (isEdit) {
        const { email, password, ...rest } = values;
        await usersApi.update(user.id, { ...rest, departmentId: rest.departmentId || null, industry: rest.industry || null });
      } else {
        await usersApi.create({ ...values, departmentId: values.departmentId || null, industry: values.industry || null });
      }
      onSaved();
    } catch (err) {
      setSubmitError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} user — please try again`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit User' : 'New User'}</DialogTitle>
      <DialogContent>
        {submitError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>{submitError}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Name" {...register('name', { required: 'Required' })} error={!!errors.name} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth label="Email" disabled={isEdit}
              helperText={isEdit ? 'Email can\'t be changed here' : undefined}
              {...register('email', { required: 'Required' })} error={!!errors.email}
            />
          </Grid>
          {!isEdit && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth type="password" label="Temporary Password"
                helperText="At least 10 characters, including a letter and a number"
                {...register('password', { required: 'Required', minLength: 10 })}
                error={!!errors.password}
              />
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Controller name="roleId" control={control} rules={{ required: true }} render={({ field }) => (
              <TextField select fullWidth label="Role" {...field} error={!!errors.roleId}>
                {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="departmentId" control={control} render={({ field }) => (
              <TextField select fullWidth label="Department" {...field}>
                <MenuItem value="">—</MenuItem>
                {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller name="industry" control={control} render={({ field }) => (
              <TextField select fullWidth label="Industry" {...field}>
                <MenuItem value="">—</MenuItem>
                {INDUSTRY_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid item xs={12}>
            <Controller name="functionalAreas" control={control} render={({ field }) => (
              <TextField
                select fullWidth label="Functional Areas" value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                helperText="Optional — lets this user review ideas in these areas even outside their department"
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {selected.map((value) => (
                        <Chip key={value} size="small" label={FUNCTIONAL_AREA_OPTIONS.find((o) => o.value === value)?.label || value} />
                      ))}
                    </Stack>
                  ),
                }}
              >
                {FUNCTIONAL_AREA_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Checkbox size="small" checked={field.value.includes(opt.value)} />
                    <ListItemText primary={opt.label} />
                  </MenuItem>
                ))}
              </TextField>
            )} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function UsersPage() {
  const list = useServerList(usersApi.list);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const { showSuccess } = useToast();

  useEffect(() => {
    rolesApi.list({ limit: 50 }).then((res) => setRoles(res.data));
    departmentsApi.list({ limit: 50 }).then((res) => setDepartments(res.data));
  }, []);

  const openCreate = () => { setEditingUser(null); setFormOpen(true); };
  const openEdit = (user) => { setEditingUser(user); setFormOpen(true); };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Users</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New User</Button>
      </Stack>

      <FilterBar
        search={list.search} onSearchChange={list.setSearch}
        filters={list.filters} onFiltersChange={list.setFilters}
        filterDefs={[
          { key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
          { key: 'roleId', label: 'Role', options: roles.map((r) => ({ value: r.id, label: r.label })) },
          { key: 'departmentId', label: 'Department', options: departments.map((d) => ({ value: d.id, label: d.name })) },
        ]}
        searchPlaceholder="Search here..."
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (r) => <Chip size="small" label={r.role?.label} /> },
          { key: 'department', label: 'Department', render: (r) => r.department?.name || '—' },
          { key: 'industry', label: 'Industry', render: (r) => INDUSTRY_OPTIONS.find((o) => o.value === r.industry)?.label || '—' },
          {
            key: 'functionalAreas',
            label: 'Functional Areas',
            render: (r) => (r.functionalAreas?.length
              ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {r.functionalAreas.map((fa) => (
                    <Chip key={fa} size="small" variant="outlined" label={FUNCTIONAL_AREA_OPTIONS.find((o) => o.value === fa)?.label || fa} />
                  ))}
                </Stack>
              )
              : '—'),
          },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <IconButton size="small" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            ),
          },
        ]}
        rows={list.rows}
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.setLimit}
        loading={list.loading}
      />

      <UserFormDialog
        open={formOpen}
        user={editingUser}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); showSuccess(editingUser ? 'User updated' : 'User created'); list.reload(); }}
        roles={roles} departments={departments}
      />
    </Box>
  );
}
